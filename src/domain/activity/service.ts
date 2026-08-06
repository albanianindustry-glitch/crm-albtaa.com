import { ActivityActorType, Prisma } from "@prisma/client";
import { writeActivityLog, findTimelineForSubmission } from "@/domain/activity/repository";

export interface LogActivityInput {
  businessId: string;
  submissionId?: string;
  type: string;
  payload?: Record<string, unknown>;
  actorType: ActivityActorType;
  actorId?: string;
}

/**
 * Appends one event to ActivityLog. This is intentionally the ONLY
 * function anywhere in the codebase that domain services call to
 * write ActivityLog — every domain service (submissions, documents,
 * notes, tasks, email) calls through here so the event stream is
 * consistent and nothing is ever forgotten. The Timeline UI (Phase 7)
 * simply reads this table; it does not need any retrofitting because
 * every phase from here on writes to it as it ships.
 *
 * Accepts an optional transaction client so the log entry commits
 * atomically with the write it's recording (e.g. submission creation
 * and its "submission.created" log land together or not at all).
 */
export async function logActivity(
  input: LogActivityInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  await writeActivityLog(
    {
      businessId: input.businessId,
      submissionId: input.submissionId,
      type: input.type,
      payload: input.payload ?? {},
      actorType: input.actorType,
      actorId: input.actorId
    },
    tx
  );
}

export async function getTimelineForSubmission(businessId: string, submissionId: string) {
  return findTimelineForSubmission(businessId, submissionId);
}
