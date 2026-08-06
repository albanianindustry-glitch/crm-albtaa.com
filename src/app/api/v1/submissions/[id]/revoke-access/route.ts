import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getSubmissionBusinessId } from "@/domain/submissions/repository";
import { revokePortalAccessForSubmission } from "@/domain/tokens/service";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businessId = await getSubmissionBusinessId(params.id);
  if (!businessId) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, businessId);
  if (forbidden) return forbidden;

  const result = await revokePortalAccessForSubmission(businessId, params.id, auth.session.staffUserId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, revokedCount: result.revokedCount });
}
