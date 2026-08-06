import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getSubmissionBusinessId } from "@/domain/submissions/repository";
import { addNoteToSubmission } from "@/domain/notes/service";

const noteSchema = z.object({
  body: z.string().min(1).max(5000)
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businessId = await getSubmissionBusinessId(params.id);
  if (!businessId) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, businessId);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }

  try {
    const note = await addNoteToSubmission({
      businessId,
      submissionId: params.id,
      authorId: auth.session.staffUserId,
      body: parsed.data.body
    });
    return NextResponse.json({ note });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add note" },
      { status: 400 }
    );
  }
}
