import { prisma } from "@/lib/prisma";
import { ActivityActorType, Prisma } from "@prisma/client";

export interface WriteActivityLogInput {
  businessId: string;
  submissionId?: string;
  type: string;
  payload: Record<string, unknown>;
  actorType: ActivityActorType;
  actorId?: string;
}

export async function writeActivityLog(
  input: WriteActivityLogInput,
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  await tx.activityLog.create({
    data: {
      businessId: input.businessId,
      submissionId: input.submissionId,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      actorType: input.actorType,
      actorId: input.actorId
    }
  });
}

export async function findTimelineForSubmission(businessId: string, submissionId: string) {
  return prisma.activityLog.findMany({
    where: { businessId, submissionId },
    orderBy: { createdAt: "asc" }
  });
}
