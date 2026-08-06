import { prisma } from "@/lib/prisma";

export interface CreateNoteInput {
  businessId: string;
  submissionId: string;
  authorId: string;
  body: string;
}

export async function createNote(input: CreateNoteInput) {
  return prisma.note.create({ data: input, include: { author: true } });
}

export async function listNotesForSubmission(businessId: string, submissionId: string) {
  return prisma.note.findMany({
    where: { businessId, submissionId },
    include: { author: true },
    orderBy: { createdAt: "desc" }
  });
}
