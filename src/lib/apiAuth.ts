import { getBusinessByApiKeyHash } from "@/domain/businesses/repository";
import { hashApiKey } from "@/lib/crypto";

export interface ApiKeyResolution {
  ok: true;
  businessId: string;
  businessSlug: string;
}
export interface ApiKeyFailure {
  ok: false;
  status: number;
  error: string;
}

/**
 * Resolves an API key to a Business, and — if an Origin header is
 * present — checks it against that business's allowedOrigins. Origin
 * checking is best-effort defense-in-depth (a server-to-server caller
 * won't send one), not the primary control; the API key is.
 */
export async function resolveBusinessFromApiKey(
  apiKey: string | null,
  origin: string | null
): Promise<ApiKeyResolution | ApiKeyFailure> {
  if (!apiKey) {
    return { ok: false, status: 401, error: "Missing X-API-Key header" };
  }

  const hash = hashApiKey(apiKey);
  const business = await getBusinessByApiKeyHash(hash);

  if (!business || !business.isActive) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  if (origin && business.allowedOrigins.length > 0) {
    const originAllowed = business.allowedOrigins.some(
      (allowed: string) => allowed.toLowerCase() === origin.toLowerCase()
    );
    if (!originAllowed) {
      return { ok: false, status: 403, error: "Origin not permitted for this API key" };
    }
  }

  return { ok: true, businessId: business.id, businessSlug: business.slug };
}
