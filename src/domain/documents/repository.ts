import { prisma } from "@/lib/prisma";

export async function getDocumentTypeByKey(businessId: string, key: string) {
  return prisma.documentType.findUnique({ where: { businessId_key: { businessId, key } } });
}

export async function listDocumentTypesForBusiness(businessId: string) {
  return prisma.documentType.findMany({ where: { businessId } });
}

export interface CreateDocumentInput {
  businessId: string;
  submissionId: string;
  documentTypeId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export async function createDocument(input: CreateDocumentInput) {
  return prisma.document.create({ data: input });
}

export async function listDocumentsForSubmission(businessId: string, submissionId: string) {
  return prisma.document.findMany({
    where: { businessId, submissionId },
    include: { documentType: true },
    orderBy: { uploadedAt: "desc" }
  });
}

export async function getDocumentById(businessId: string, documentId: string) {
  return prisma.document.findFirst({ where: { id: documentId, businessId } });
}

export async function updateDocumentStatus(
  businessId: string,
  documentId: string,
  status: "APPROVED" | "REJECTED",
  reviewNote?: string
) {
  return prisma.document.updateMany({
    where: { id: documentId, businessId },
    data: { status, reviewedAt: new Date(), reviewNote }
  });
}
