import { redirect } from "next/navigation";
import { getSession, SessionPayload } from "./session";

/**
 * Use in server components under /admin. Performs the real JWT
 * verification (unlike middleware's cookie-presence check) and
 * redirects to login if the session is missing or invalid.
 */
export async function requireSession(redirectTo?: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    const target = redirectTo
      ? `/admin/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/admin/login";
    redirect(target);
  }
  return session;
}

/** True if this staff member can access the given business id. */
export function canAccessBusiness(session: SessionPayload, businessId: string): boolean {
  if (session.businessIds.length === 0) return true; // no restriction = sees all
  return session.businessIds.includes(businessId);
}
