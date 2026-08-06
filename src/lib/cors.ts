import { NextResponse } from "next/server";

/**
 * The public submission endpoint is called cross-origin, by design,
 * from each business's own marketing website (a different domain
 * than this app). It carries no cookies/credentials — the API key is
 * the real access control, not CORS — so it's safe and standard
 * (same pattern as most bearer-token-authenticated public APIs) to
 * allow any origin to read the response. Origin is still separately
 * checked server-side against Business.allowedOrigins in
 * resolveBusinessFromApiKey for defense-in-depth; that check is
 * independent of these headers, which only control whether a
 * browser's JS is allowed to read the response at all.
 */
export const PUBLIC_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  "Access-Control-Max-Age": "86400"
};

/** Wraps a NextResponse with the public CORS headers applied. */
export function withPublicCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(PUBLIC_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/** Standard 204 preflight response for a public CORS-enabled route. */
export function publicCorsPreflight(): NextResponse {
  return withPublicCors(new NextResponse(null, { status: 204 }));
}
