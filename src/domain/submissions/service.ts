import { Business, Prisma } from "@prisma/client";
// `prisma` is used here ONLY for `.$transaction()` — orchestrating a
// transaction boundary across multiple repositories is a service-
// layer responsibility (a single repository shouldn't own a
// multi-repository transaction). Every read/write inside each
// transaction below still goes through a repository function, passed
// the `tx` client — no direct table access happens in this file.
import { prisma } from "@/lib/prisma";
import { PublicSubmissionPayload } from "@/lib/validation/publicSubmission";
import { cleanString, isValidEmail } from "@/lib/sanitize";
import { checkForSpam } from "@/lib/spamCheck";
import { getActiveFormWithFields } from "@/domain/forms/repository";
import { findOrCreateContact, getContactById } from "@/domain/contacts/repository";
import {
  createSubmission,
  getSubmissionsForBusiness,
  updateSubmissionStage as updateSubmissionStageRow
} from "@/domain/submissions/repository";
import { getDefaultPipelineWithStages, getStageById } from "@/domain/pipelines/repository";
import { logActivity } from "@/domain/activity/service";
import { handleEvent } from "@/domain/automation/service";

export type CreateSubmissionResult =
  | { status: "created"; submissionId: string }
  | { status: "spam" }
  | { status: "validation_error"; error: string };

/**
 * Full orchestration for a public form submission:
 *   1. Resolve the business's active form definition
 *   2. Validate required fields (base + form-specific)
 *   3. Run spam/abuse checks
 *   4. Persist Contact + Submission + ActivityLog atomically
 *   5. Fire the "submission.created" automation event (internal +
 *      client emails, any configured stage move / task) — after the
 *      transaction commits, so a slow/failed email never holds a DB
 *      transaction open or rolls back a successfully saved lead.
 */
export async function createSubmissionFromPublicForm(
  business: Business,
  payload: PublicSubmissionPayload
): Promise<CreateSubmissionResult> {
  const firstName = cleanString(payload.firstName, 80);
  const lastName = cleanString(payload.lastName, 80);
  const email = cleanString(payload.email, 254).toLowerCase();
  const phone = payload.phone ? cleanString(payload.phone, 40) : undefined;

  if (!firstName || !lastName || !email) {
    return { status: "validation_error", error: "Missing required fields" };
  }
  if (!isValidEmail(email)) {
    return { status: "validation_error", error: "Invalid email format" };
  }

  const formDef = await getActiveFormWithFields(business.id, payload.formSlug);
  if (!formDef) {
    return { status: "validation_error", error: `Unknown or inactive form: ${payload.formSlug}` };
  }

  // Sanitize + validate custom field values against the form's field
  // definitions (required-ness, max length for text-like fields).
  const rawFields = payload.fields ?? {};
  const customFields: Record<string, string> = {};
  for (const field of formDef.fields) {
    const rawValue = rawFields[field.key];
    const cleaned = cleanString(rawValue, 2000);

    if (field.required && !cleaned) {
      return { status: "validation_error", error: `Missing required field: ${field.label}` };
    }
    if (cleaned) {
      customFields[field.key] = cleaned;
    }
  }

  const textToScan = [firstName, lastName, customFields.message, customFields.service]
    .filter(Boolean)
    .join(" ");

  const spamResult = await checkForSpam({
    businessId: business.id,
    email,
    elapsedSeconds: payload.elapsedSeconds,
    textToScan
  });

  if (spamResult.spam) {
    await logActivity({
      businessId: business.id,
      type: "submission.spam_blocked",
      payload: { email, formSlug: payload.formSlug, reason: spamResult.reason },
      actorType: "SYSTEM"
    });
    return { status: "spam" };
  }

  const defaultPipeline = await getDefaultPipelineWithStages(business.id);
  const firstStage = defaultPipeline?.stages[0];

  const { submissionId, contactId } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const contact = await findOrCreateContact(business.id, { email, firstName, lastName, phone }, tx);

    const submission = await createSubmission(
      business.id,
      {
        contactId: contact.id,
        formId: formDef.form.id,
        formVersionId: formDef.formVersion.id,
        customFields,
        sourceMeta: {
          referrer: payload.meta?.referrer ?? "",
          pageUrl: payload.meta?.pageUrl ?? "",
          utmSource: payload.meta?.utmSource ?? "",
          utmMedium: payload.meta?.utmMedium ?? "",
          utmCampaign: payload.meta?.utmCampaign ?? "",
          userAgent: payload.meta?.userAgent ?? "",
          lang: payload.lang ?? "EN"
        },
        currentStageId: firstStage?.id
      },
      tx
    );

    await logActivity(
      {
        businessId: business.id,
        submissionId: submission.id,
        type: "submission.created",
        payload: { formSlug: payload.formSlug, contactEmail: email },
        actorType: "SYSTEM"
      },
      tx
    );

    return { submissionId: submission.id, contactId: contact.id };
  });

  // Fire automations (internal notification + client welcome email
  // with portal link, per whatever this business has configured)
  // outside the DB transaction.
  await handleEvent(business, "submission.created", {
    submissionId,
    pipelineId: defaultPipeline?.id,
    contactId,
    contactEmail: email,
    contactFirstName: firstName,
    contactLastName: lastName,
    templateVariables: {
      formLabel: formDef.form.name,
      service: customFields.service ?? "",
      message: customFields.message ?? "",
      country: customFields.country ?? ""
    },
    conditionValues: {
      formSlug: payload.formSlug
    }
  });

  return { status: "created", submissionId };
}

/**
 * Manual stage change from the admin CRM UI. Validates the stage
 * belongs to this business, updates the submission, logs the event,
 * and fires any "stage.changed" automations configured for the new
 * stage (e.g. an email or a follow-up task).
 */
export async function changeSubmissionStage(
  business: Business,
  submissionId: string,
  stageId: string,
  staffUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const submission = await getSubmissionsForBusiness(business.id, submissionId);
  if (!submission) return { ok: false, error: "Submission not found" };

  const stage = await getStageById(business.id, stageId);
  if (!stage) return { ok: false, error: "Stage not found for this business" };

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await updateSubmissionStageRow(business.id, submissionId, stageId, tx);
    if (!updated) throw new Error("Submission stage update failed (ownership check did not match)");
    await logActivity(
      {
        businessId: business.id,
        submissionId,
        type: "stage.changed",
        payload: { fromStageId: submission.currentStageId, toStageId: stage.id, toStageKey: stage.key },
        actorType: "STAFF",
        actorId: staffUserId
      },
      tx
    );
  });

  const contact = await getContactById(business.id, submission.contactId);

  await handleEvent(business, "stage.changed", {
    submissionId,
    pipelineId: stage.pipelineId,
    contactId: submission.contactId,
    contactEmail: contact?.email ?? "",
    contactFirstName: contact?.firstName ?? "",
    contactLastName: contact?.lastName ?? "",
    templateVariables: { stageLabel: stage.label },
    conditionValues: { "stage.key": stage.key }
  });

  return { ok: true };
}
