import { NextRequest, NextResponse } from "next/server";
import { getBusinessById } from "@/domain/businesses/repository";
import { resolveBusinessFromApiKey } from "@/lib/apiAuth";
import { publicSubmissionSchema } from "@/lib/validation/publicSubmission";
import { createSubmissionFromPublicForm } from "@/domain/submissions/service";
import { checkPublicRateLimit } from "@/lib/rateLimit";
import { withPublicCors, publicCorsPreflight } from "@/lib/cors";

/**
 * Called cross-origin from each business's own marketing website —
 * see lib/cors.ts for why permissive CORS is safe here (no
 * cookies/credentials; the API key is the real access control).
 */
export async function OPTIONS() {
  return publicCorsPreflight();
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const origin = req.headers.get("origin");

  const auth = await resolveBusinessFromApiKey(apiKey, origin);
  if (!auth.ok) {
    return withPublicCors(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  const rateLimit = await checkPublicRateLimit(`submit:${auth.businessId}:${ipFromRequest(req)}`);
  if (!rateLimit.allowed) {
    // Respond success-shaped to avoid giving a bot useful signal,
    // consistent with how spam/rate-limited leads are handled inside
    // the service itself.
    return withPublicCors(NextResponse.json({ success: true }));
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withPublicCors(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }

  const parsed = publicSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return withPublicCors(
      NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
    );
  }

  const business = await getBusinessById(auth.businessId);
  if (!business) {
    return withPublicCors(NextResponse.json({ error: "Business not found" }, { status: 404 }));
  }

  const result = await createSubmissionFromPublicForm(business, parsed.data);

  if (result.status === "validation_error") {
    return withPublicCors(NextResponse.json({ error: result.error }, { status: 400 }));
  }

  // "spam" and "created" both return a generic success — matching
  // the original Apps Script's behavior of never revealing to the
  // caller why/whether something was filtered.
  return withPublicCors(NextResponse.json({ success: true }));
}

function ipFromRequest(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
