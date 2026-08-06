import { prisma } from "@/lib/prisma";
import { AutomationActionType, Prisma } from "@prisma/client";

export async function getActiveRulesForTrigger(businessId: string, eventTrigger: string) {
  return prisma.automationRule.findMany({
    where: { businessId, eventTrigger, isActive: true }
  });
}

export async function listAutomationRules(businessId: string) {
  return prisma.automationRule.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
}

export async function getAutomationRuleById(businessId: string, id: string) {
  return prisma.automationRule.findFirst({ where: { id, businessId } });
}

/** Exception to businessId-first, same rationale as getSubmissionBusinessId. */
export async function getAutomationRuleBusinessId(id: string): Promise<string | null> {
  const rule = await prisma.automationRule.findUnique({ where: { id }, select: { businessId: true } });
  return rule?.businessId ?? null;
}

export interface CreateAutomationRuleInput {
  businessId: string;
  name: string;
  eventTrigger: string;
  conditions: Prisma.InputJsonValue;
  actionType: AutomationActionType;
  actionConfig: Prisma.InputJsonValue;
  isActive: boolean;
}

export async function createAutomationRule(input: CreateAutomationRuleInput) {
  return prisma.automationRule.create({ data: input });
}

export interface UpdateAutomationRuleInput {
  name?: string;
  eventTrigger?: string;
  conditions?: Prisma.InputJsonValue;
  actionType?: AutomationActionType;
  actionConfig?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export async function updateAutomationRule(
  businessId: string,
  id: string,
  input: UpdateAutomationRuleInput
) {
  const result = await prisma.automationRule.updateMany({
    where: { id, businessId },
    data: input
  });
  return result.count > 0;
}

export async function deleteAutomationRule(businessId: string, id: string) {
  const result = await prisma.automationRule.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
