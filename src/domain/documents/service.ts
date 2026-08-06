import { Business } from "@prisma/client";
import { validateUpload, uploadDocumentFile, buildStoragePath } from "@/lib/storage";
import {
  getDocumentTypeByKey,
  createDocument,
  updateDocumentStatus,
  getDocumentById
} from "@/domain/documents/repository";
import { getSubmissionsForBusiness } from "@/domain/submissions/repository";
import { getContactById } from "@/domain/contacts/repository";
import { getStageById } from "@/domain/pipelines/repository";
import { logActivity } from "@/domain/activity/service";
import { handleEvent } from "@/domain/automation/service";

export interface UploadDocumentInput {
  business: Business;
  submissionId: string;
  documentTypeKey: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}

export type UploadDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

export async function uploadDocumentViaPortal(input: UploadDocumentInput): Promise<UploadDocumentResult> {
  const submission = await getSubmissionsForBusiness(input.business.id, input.submissionId);
  if (!submission) return { ok: false, error: "Submission not found" };

  const documentType = await getDocumentTypeByKey(input.business.id, input.documentTypeKey);
  if (!documentType) return { ok: false, error: "Unknown document type" };

  const validation = validateUpload(input.mimeType, input.fileBuffer.byteLength);
  if (!validation.ok) return { ok: false, error: validation.error };

  const storagePath = buildStoragePath(input.business.slug, input.submissionId, input.fileName);
  await uploadDocumentFile(storagePath, input.fileBuffer, input.mimeType);

  const document = await createDocument({
    businessId: input.business.id,
    submissionId: input.submissionId,
    documentTypeId: documentType.id,
    storagePath,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.fileBuffer.byteLength
  });

  await logActivity({
    businessId: input.business.id,
    submissionId: input.submissionId,
    type: "document.uploaded",
    payload: { documentId: document.id, documentType: documentType.key, fileName: input.fileName },
    actorType: "CLIENT"
  });

  const contact = await getContactById(input.business.id, submission.contactId);

  const pipelineId = submission.currentStageId
    ? (await getStageById(input.business.id, submission.currentStageId))?.pipelineId
    : undefined;

  await handleEvent(input.business, "document.uploaded", {
    submissionId: input.submissionId,
    pipelineId,
    contactId: submission.contactId,
    contactEmail: contact?.email ?? "",
    contactFirstName: contact?.firstName ?? "",
    contactLastName: contact?.lastName ?? "",
    templateVariables: { documentTypeLabel: documentType.label },
    conditionValues: { documentTypeKey: documentType.key }
  });

  return { ok: true, documentId: document.id };
}

export async function reviewDocument(
  business: Business,
  documentId: string,
  status: "APPROVED" | "REJECTED",
  staffUserId: string,
  reviewNote?: string
): Promise<{ ok: boolean }> {
  const result = await updateDocumentStatus(business.id, documentId, status, reviewNote);
  if (result.count === 0) return { ok: false };

  const document = await getDocumentById(business.id, documentId);

  await logActivity({
    businessId: business.id,
    submissionId: document?.submissionId,
    type: "document.reviewed",
    payload: { documentId, status, reviewNote },
    actorType: "STAFF",
    actorId: staffUserId
  });

  return { ok: true };
}
