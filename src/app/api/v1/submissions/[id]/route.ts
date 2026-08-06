import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getSubmissionBusinessId, getSubmissionById } from "@/domain/submissions/repository";
import { changeSubmissionStage } from "@/domain/submissions/service";
import { getBusinessById } from "@/domain/businesses/repository";

async function resolveBusinessForSubmission(submissionId: string) {
  const businessId = await getSubmissionBusinessId(submissionId);
  if (!businessId) return null;
  return getBusinessById(businessId);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const business = await resolveBusinessForSubmission(params.id);
  if (!business) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, business.id);
  if (forbidden) return forbidden;

  const submission = await getSubmissionById(business.id, params.id);
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  return NextResponse.json({ submission });
}

const patchSchema = z.object({
  stageId: z.string().min(1)
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const business = await resolveBusinessForSubmission(params.id);
  if (!business) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, business.id);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await changeSubmissionStage(business, params.id, parsed.data.stageId, auth.session.staffUserId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
