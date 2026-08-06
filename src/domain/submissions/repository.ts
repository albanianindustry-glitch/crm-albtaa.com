import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateSubmissionInput {
  contactId: string;
  formId: string;
  formVersionId: string;
  customFields: Record<string, unknown>;
  sourceMeta: Record<string, unknown>;
  currentStageId?: string;
}

export async function createSubmission(
  businessId: string,
  input: CreateSubmissionInput,
  tx: Prisma.TransactionClient = prisma
) {
  return tx.submission.create({
    data: {
      businessId,
      contactId: input.contactId,
      formId: input.formId,
      formVersionId: input.formVersionId,
      customFields: input.customFields as Prisma.InputJsonValue,
      sourceMeta: input.sourceMeta as Prisma.InputJsonValue,
      currentStageId: input.currentStageId
    }
  });
}

export interface ListSubmissionsFilters {
  stageId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listSubmissions(businessId: string, filters: ListSubmissionsFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;

  const where: Prisma.SubmissionWhereInput = {
    businessId,
    ...(filters.stageId ? { currentStageId: filters.stageId } : {}),
    ...(filters.search
      ? {
          contact: {
            OR: [
              { email: { contains: filters.search, mode: "insensitive" } },
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } }
            ]
          }
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      include: { contact: true, currentStage: true, form: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.submission.count({ where })
  ]);

  return { items, total, page, pageSize };
}

export async function getSubmissionById(businessId: string, submissionId: string) {
  return prisma.submission.findFirst({
    where: { id: submissionId, businessId },
    include: {
      contact: true,
      currentStage: true,
      form: true,
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      documents: { include: { documentType: true }, orderBy: { uploadedAt: "desc" } },
      tasks: { include: { assignee: true }, orderBy: { createdAt: "desc" } }
    }
  });
}

/**
 * Uses updateMany + a businessId-scoped where clause (rather than
 * update-by-id) so an ownership mismatch fails closed instead of
 * silently updating a row without checking businessId. Returns
 * whether a row was actually updated.
 */
export async function updateSubmissionStage(
  businessId: string,
  submissionId: string,
  stageId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const result = await tx.submission.updateMany({
    where: { id: submissionId, businessId },
    data: { currentStageId: stageId }
  });
  return result.count > 0;
}

/**
 * The one intentional exception to "businessId is always the first
 * argument": routes shaped /submissions/:id don't carry a business
 * slug in the URL, so there's no businessId to scope by yet. This
 * returns only the businessId so the caller can then verify the
 * requesting staff member has access to it BEFORE calling any other
 * (properly businessId-scoped) repository function with the result.
 */
export async function getSubmissionBusinessId(submissionId: string): Promise<string | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { businessId: true }
  });
  return submission?.businessId ?? null;
}

export async function getSubmissionsForBusiness(businessId: string, submissionId: string) {
  return prisma.submission.findFirst({ where: { id: submissionId, businessId } });
}
