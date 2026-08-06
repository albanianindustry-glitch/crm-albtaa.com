import {
  createTask,
  completeTask as completeTaskRepo,
  listTasksForAssignee,
  listTasksForSubmission
} from "@/domain/tasks/repository";
import { getSubmissionsForBusiness } from "@/domain/submissions/repository";
import { logActivity } from "@/domain/activity/service";
import { listAllActiveBusinessIds } from "@/domain/businesses/repository";

export interface CreateTaskManualInput {
  businessId: string;
  submissionId: string;
  title: string;
  dueAt?: Date;
  assigneeId?: string;
  staffUserId: string;
}

export async function createTaskManually(input: CreateTaskManualInput) {
  const submission = await getSubmissionsForBusiness(input.businessId, input.submissionId);
  if (!submission) throw new Error("Submission not found for this business");

  const task = await createTask({
    businessId: input.businessId,
    submissionId: input.submissionId,
    title: input.title,
    dueAt: input.dueAt,
    assigneeId: input.assigneeId
  });

  await logActivity({
    businessId: input.businessId,
    submissionId: input.submissionId,
    type: "task.created",
    payload: { taskId: task.id, title: task.title, assigneeId: input.assigneeId },
    actorType: "STAFF",
    actorId: input.staffUserId
  });

  return task;
}

export async function completeTaskById(businessId: string, taskId: string, staffUserId: string) {
  const task = await completeTaskRepo(businessId, taskId);
  if (!task) return null;

  await logActivity({
    businessId,
    submissionId: task.submissionId,
    type: "task.completed",
    payload: { taskId: task.id, title: task.title },
    actorType: "STAFF",
    actorId: staffUserId
  });

  return task;
}

export async function getMyTasks(businessIds: string[], staffUserId: string) {
  // A staff member's personal task list spans every business they
  // can access (or all businesses if unrestricted) — fetched per
  // business and merged, since Task queries are businessId-scoped by
  // design and there is intentionally no cross-business query path.
  let scopedIds = businessIds;
  if (scopedIds.length === 0) {
    scopedIds = await listAllActiveBusinessIds();
  }

  const results = await Promise.all(scopedIds.map((id) => listTasksForAssignee(id, staffUserId)));
  return results.flat().sort((a, b) => {
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

export { listTasksForSubmission };
