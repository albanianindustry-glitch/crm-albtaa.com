import { prisma } from "@/lib/prisma";

export interface CreateReminderInput {
  businessId: string;
  submissionId: string;
  triggerKey: string;
  scheduledFor: Date;
}

export async function createReminder(input: CreateReminderInput) {
  return prisma.reminder.create({ data: input });
}

export async function getDueReminders(now: Date, limit = 100) {
  return prisma.reminder.findMany({
    where: { sentAt: null, cancelledAt: null, scheduledFor: { lte: now } },
    include: { submission: { include: { contact: true, currentStage: true } }, business: true },
    orderBy: { scheduledFor: "asc" },
    take: limit
  });
}

export async function markReminderSent(reminderId: string) {
  return prisma.reminder.update({ where: { id: reminderId }, data: { sentAt: new Date() } });
}

export async function cancelRemindersForSubmission(submissionId: string, triggerKey?: string) {
  return prisma.reminder.updateMany({
    where: { submissionId, sentAt: null, cancelledAt: null, ...(triggerKey ? { triggerKey } : {}) },
    data: { cancelledAt: new Date() }
  });
}

export async function listRemindersForSubmission(businessId: string, submissionId: string) {
  return prisma.reminder.findMany({
    where: { businessId, submissionId },
    orderBy: { scheduledFor: "asc" }
  });
}
