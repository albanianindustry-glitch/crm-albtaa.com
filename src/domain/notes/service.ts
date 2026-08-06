import { createNote, CreateNoteInput } from "@/domain/notes/repository";
import { getSubmissionsForBusiness } from "@/domain/submissions/repository";
import { logActivity } from "@/domain/activity/service";

export async function addNoteToSubmission(input: CreateNoteInput) {
  const submission = await getSubmissionsForBusiness(input.businessId, input.submissionId);
  if (!submission) {
    throw new Error("Submission not found for this business");
  }

  const note = await createNote(input);

  await logActivity({
    businessId: input.businessId,
    submissionId: input.submissionId,
    type: "note.added",
    payload: { noteId: note.id, preview: note.body.slice(0, 140) },
    actorType: "STAFF",
    actorId: input.authorId
  });

  return note;
}
