import { prisma } from "@/lib/prisma";

export async function getActiveEmailTemplate(businessId: string, triggerKey: string) {
  return prisma.emailTemplate.findFirst({
    where: { businessId, triggerKey, isActive: true }
  });
}

export async function listEmailTemplates(businessId: string) {
  return prisma.emailTemplate.findMany({ where: { businessId }, orderBy: { triggerKey: "asc" } });
}

export async function getEmailTemplateById(businessId: string, id: string) {
  return prisma.emailTemplate.findFirst({ where: { id, businessId } });
}

export interface UpsertEmailTemplateInput {
  businessId: string;
  triggerKey: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isActive: boolean;
}

export async function upsertEmailTemplate(input: UpsertEmailTemplateInput) {
  return prisma.emailTemplate.upsert({
    where: { businessId_triggerKey: { businessId: input.businessId, triggerKey: input.triggerKey } },
    update: {
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      isActive: input.isActive
    },
    create: input
  });
}

export async function listEmailLogs(businessId: string, limit = 100) {
  return prisma.emailLog.findMany({
    where: { businessId },
    orderBy: { sentAt: "desc" },
    take: limit
  });
}

export interface CreateEmailLogInput {
  businessId: string;
  contactId: string;
  triggerKey: string;
  toEmail: string;
  subject: string;
  resendId?: string;
}

export async function createEmailLog(input: CreateEmailLogInput) {
  return prisma.emailLog.create({ data: input });
}
