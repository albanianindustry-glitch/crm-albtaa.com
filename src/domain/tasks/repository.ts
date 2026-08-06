import { prisma } from "@/lib/prisma";

export interface CreateTaskInput {
  businessId: string;
  submissionId: string;
  assigneeId?: string;
  title: string;
  dueAt?: Date;
}

export async function createTask(input: CreateTaskInput) {
  return prisma.task.create({ data: input });
}

export async function listTasksForAssignee(businessId: string, assigneeId?: string) {
  return prisma.task.findMany({
    where: {
      businessId,
      completedAt: null,
      ...(assigneeId ? { assigneeId } : {})
    },
    include: { submission: { include: { contact: true } }, assignee: true },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
  });
}

export async function completeTask(businessId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, businessId } });
  if (!task) return null;
  return prisma.task.update({ where: { id: taskId }, data: { completedAt: new Date() } });
}

/** Exception to businessId-first, same rationale as getSubmissionBusinessId. */
export async function getTaskBusinessId(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { businessId: true } });
  return task?.businessId ?? null;
}

export async function listTasksForSubmission(businessId: string, submissionId: string) {
  return prisma.task.findMany({
    where: { businessId, submissionId },
    include: { assignee: true },
    orderBy: { createdAt: "desc" }
  });
}
