import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getTaskBusinessId } from "@/domain/tasks/repository";
import { completeTaskById } from "@/domain/tasks/service";

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businessId = await getTaskBusinessId(params.id);
  if (!businessId) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, businessId);
  if (forbidden) return forbidden;

  const task = await completeTaskById(businessId, params.id, auth.session.staffUserId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  return NextResponse.json({ task });
}
