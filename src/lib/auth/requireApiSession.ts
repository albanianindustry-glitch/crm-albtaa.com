import { NextResponse } from "next/server";
import { getSession, SessionPayload } from "./session";

export type ApiSessionResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

export async function requireApiSession(): Promise<ApiSessionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { ok: true, session };
}

export function assertBusinessAccess(
  session: SessionPayload,
  businessId: string
): NextResponse | null {
  if (session.businessIds.length === 0) return null; // unrestricted
  if (session.businessIds.includes(businessId)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
