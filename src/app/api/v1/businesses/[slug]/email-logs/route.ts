import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { resolveBusinessForAdminRoute } from "@/lib/adminRouteHelpers";
import { listEmailLogs } from "@/domain/email/repository";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const resolved = await resolveBusinessForAdminRoute(params.slug, auth.session);
  if (!resolved.ok) return resolved.response;

  const logs = await listEmailLogs(resolved.business.id);
  return NextResponse.json({ logs });
}
