import { NextRequest, NextResponse } from "next/server";

// Lightweight cookie-presence check only. Middleware runs on the Edge
// runtime, where `jose`'s JWT verification against our Node-based
// secret handling is more friction than it's worth for Phase 1 — real
// verification happens in the API routes / server components via
// getSession(). This just gives a fast redirect for the common case
// of "no cookie at all" so unauthenticated users don't see a flash of
// the admin shell before being bounced.
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSessionCookie = req.cookies.has("platform_session");
  if (!hasSessionCookie) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
