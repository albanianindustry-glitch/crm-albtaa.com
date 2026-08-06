import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getSubmissionBusinessId } from "@/domain/submissions/repository";
import { createTaskManually } from "@/domain/tasks/service";

const taskSchema = z.object({
  title: z.string().min(1).max(300),
  dueAt: z.string().datetime().optional(),
  assigneeId: z.string().optional()
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

  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const task = await createTaskManually({
      businessId,
      submissionId: params.id,
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      assigneeId: parsed.data.assigneeId ?? auth.session.staffUserId,
      staffUserId: auth.session.staffUserId
    });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 400 }
    );
  }
}
