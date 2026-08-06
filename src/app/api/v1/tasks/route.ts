import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { getMyTasks } from "@/domain/tasks/service";

export async function GET() {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const tasks = await getMyTasks(auth.session.businessIds, auth.session.staffUserId);
  return NextResponse.json({ tasks });
}
