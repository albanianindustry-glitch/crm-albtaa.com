import { Business, Prisma, AutomationActionType } from "@prisma/client";
import {
  getActiveRulesForTrigger,
  listAutomationRules as listAutomationRulesRepo,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule
} from "@/domain/automation/repository";
import { evaluateConditions } from "@/lib/conditions";
import { sendTemplatedEmail } from "@/domain/email/service";
import { issueOrReuseAccessToken } from "@/domain/tokens/service";
import { getPipelineStageByKey } from "@/domain/pipelines/repository";
import { updateSubmissionStage, getSubmissionsForBusiness } from "@/domain/submissions/repository";
import { createTask } from "@/domain/tasks/repository";
import { scheduleReminder } from "@/domain/reminders/service";
import { logActivity } from "@/domain/activity/service";
// `prisma` is used here ONLY for `.$transaction()` — see the same
// note in domain/submissions/service.ts.
import { prisma } from "@/lib/prisma";

export interface AutomationContext {
  submissionId?: string;
  pipelineId?: string; // pipeline the submission currently belongs to, for MOVE_STAGE resolution
  contactId: string;
  contactEmail: string;
  contactFirstName: string;
  contactLastName: string;
  // Any additional values available to {{variable}} interpolation in
  // email templates (e.g. serviceName, formLabel, stageLabel).
  templateVariables?: Record<string, unknown>;
  // Flat values automation conditions can compare against
  // (e.g. { "stage.key": "docs_pending" }).
  conditionValues?: Record<string, unknown>;
}

interface SendEmailActionConfig {
  templateKey: string;
  recipient: "internal" | "client";
}
interface MoveStageActionConfig {
  stageKey: string;
}
interface CreateTaskActionConfig {
  title: string;
  dueInDays?: number;
}
interface ScheduleReminderActionConfig {
  templateKey: string;
  delayDays: number;
}

/**
 * Evaluates every active AutomationRule for `business` matching
 * `eventTrigger`, and executes the ones whose conditions match. This
 * is the single place event-driven side effects happen — submission
 * creation, document upload, and stage changes all call through here
 * rather than hardcoding "send this email" inline, so a business's
 * automations stay fully data-driven and editable without code
 * changes.
 */
export async function handleEvent(
  business: Business,
  eventTrigger: string,
  context: AutomationContext
): Promise<void> {
  const rules = await getActiveRulesForTrigger(business.id, eventTrigger);

  for (const rule of rules) {
    const matches = evaluateConditions(
      (rule.conditions as Record<string, any>) ?? {},
      context.conditionValues ?? {}
    );
    if (!matches) continue;

    try {
      switch (rule.actionType) {
        case "SEND_EMAIL":
          await executeSendEmail(business, rule.actionConfig as unknown as SendEmailActionConfig, context);
          break;
        case "MOVE_STAGE":
          await executeMoveStage(business, rule.actionConfig as unknown as MoveStageActionConfig, context);
          break;
        case "CREATE_TASK":
          await executeCreateTask(business, rule.actionConfig as unknown as CreateTaskActionConfig, context);
          break;
        case "SCHEDULE_REMINDER":
          await executeScheduleReminder(
            business,
            rule.actionConfig as unknown as ScheduleReminderActionConfig,
            context
          );
          break;
      }
    } catch (err) {
      // One rule failing must not prevent other rules (or the
      // triggering operation) from completing.
      await logActivity({
        businessId: business.id,
        submissionId: context.submissionId,
        type: "automation.rule_failed",
        payload: {
          ruleId: rule.id,
          ruleName: rule.name,
          error: err instanceof Error ? err.message : String(err)
        },
        actorType: "SYSTEM"
      }).catch(() => {});
    }
  }
}

async function executeSendEmail(
  business: Business,
  config: SendEmailActionConfig,
  context: AutomationContext
): Promise<void> {
  let toEmail: string;
  const variables: Record<string, unknown> = {
    firstName: context.contactFirstName,
    lastName: context.contactLastName,
    email: context.contactEmail,
    businessName: business.name,
    ...context.templateVariables
  };

  if (config.recipient === "internal") {
    toEmail = business.notificationEmail;
  } else {
    toEmail = context.contactEmail;
    // Client-facing emails get a portal link — mint a fresh access
    // token scoped to this contact/submission. Expiry is null
    // (never expires) by default, per the frozen token design;
    // revocation/expiry policy is applied later if/when needed.
    const rawToken = await issueOrReuseAccessToken(context.contactId, context.submissionId, null);
    const portalBaseUrl = process.env.PORTAL_BASE_URL || "https://app.example.com";
    variables.portalLink = `${portalBaseUrl}/portal/${rawToken}`;
  }

  await sendTemplatedEmail({
    business,
    triggerKey: config.templateKey,
    toEmail,
    contactId: context.contactId,
    submissionId: context.submissionId,
    variables
  });
}

async function executeMoveStage(
  business: Business,
  config: MoveStageActionConfig,
  context: AutomationContext
): Promise<void> {
  if (!context.submissionId || !context.pipelineId) return;

  const stage = await getPipelineStageByKey(business.id, context.pipelineId, config.stageKey);
  if (!stage) return;

  const submission = await getSubmissionsForBusiness(business.id, context.submissionId);
  if (!submission) return;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await updateSubmissionStage(business.id, context.submissionId!, stage.id, tx);
    if (!updated) throw new Error("Submission stage update failed (ownership check did not match)");
    await logActivity({
      businessId: business.id,
      submissionId: context.submissionId,
      type: "stage.changed",
      payload: { fromStageId: submission.currentStageId, toStageId: stage.id, toStageKey: stage.key },
      actorType: "SYSTEM"
    });
  });
}

async function executeCreateTask(
  business: Business,
  config: CreateTaskActionConfig,
  context: AutomationContext
): Promise<void> {
  if (!context.submissionId) return;

  const dueAt = config.dueInDays
    ? new Date(Date.now() + config.dueInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const task = await createTask({
    businessId: business.id,
    submissionId: context.submissionId,
    title: config.title,
    dueAt
  });

  await logActivity({
    businessId: business.id,
    submissionId: context.submissionId,
    type: "task.created",
    payload: { taskId: task.id, title: task.title },
    actorType: "SYSTEM"
  });
}

// ── Rule management (Phase 8 — automation builder) ────────────────

export async function listRulesForBusiness(businessId: string) {
  return listAutomationRulesRepo(businessId);
}

export interface RuleInput {
  name: string;
  eventTrigger: string;
  conditions: Record<string, unknown>;
  actionType: AutomationActionType;
  actionConfig: Record<string, unknown>;
  isActive: boolean;
}

export async function createRule(businessId: string, input: RuleInput, staffUserId: string) {
  const rule = await createAutomationRule({
    businessId,
    name: input.name,
    eventTrigger: input.eventTrigger,
    conditions: input.conditions,
    actionType: input.actionType,
    actionConfig: input.actionConfig,
    isActive: input.isActive
  });

  await logActivity({
    businessId,
    type: "automation_rule.created",
    payload: { ruleId: rule.id, name: rule.name, eventTrigger: rule.eventTrigger },
    actorType: "STAFF",
    actorId: staffUserId
  });

  return rule;
}

export async function updateRule(
  businessId: string,
  ruleId: string,
  input: Partial<RuleInput>,
  staffUserId: string
): Promise<boolean> {
  const ok = await updateAutomationRule(businessId, ruleId, input);
  if (!ok) return false;

  await logActivity({
    businessId,
    type: "automation_rule.updated",
    payload: { ruleId, changes: Object.keys(input) },
    actorType: "STAFF",
    actorId: staffUserId
  });

  return true;
}

export async function deleteRule(businessId: string, ruleId: string, staffUserId: string): Promise<boolean> {
  const ok = await deleteAutomationRule(businessId, ruleId);
  if (!ok) return false;

  await logActivity({
    businessId,
    type: "automation_rule.deleted",
    payload: { ruleId },
    actorType: "STAFF",
    actorId: staffUserId
  });

  return true;
}

async function executeScheduleReminder(
  business: Business,
  config: ScheduleReminderActionConfig,
  context: AutomationContext
): Promise<void> {
  if (!context.submissionId) return;

  const scheduledFor = new Date(Date.now() + config.delayDays * 24 * 60 * 60 * 1000);
  await scheduleReminder(business.id, context.submissionId, config.templateKey, scheduledFor);
}
