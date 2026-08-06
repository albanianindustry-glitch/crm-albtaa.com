import { NextResponse } from "next/server";
import { getBusinessBySlug } from "@/domain/businesses/repository";
import { assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { SessionPayload } from "@/lib/auth/session";

export async function resolveBusinessForAdminRoute(slug: string, session: SessionPayload) {
  const business = await getBusinessBySlug(slug);
  if (!business) {
    return { ok: false as const, response: NextResponse.json({ error: "Business not found" }, { status: 404 }) };
  }
  const forbidden = assertBusinessAccess(session, business.id);
  if (forbidden) {
    return { ok: false as const, response: forbidden };
  }
  return { ok: true as const, business };
}
