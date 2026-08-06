import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getSubmissionBusinessId } from "@/domain/submissions/repository";
import { getTimelineForSubmission } from "@/domain/activity/service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businessId = await getSubmissionBusinessId(params.id);
  if (!businessId) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, businessId);
  if (forbidden) return forbidden;

  const timeline = await getTimelineForSubmission(businessId, params.id);
  return NextResponse.json({ timeline });
}
