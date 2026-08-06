import { generateSecureToken } from "@/lib/crypto";
import {
  createAccessToken,
  findTokenByHash,
  markTokenUsed,
  revokeAllTokensForContact
} from "@/domain/tokens/repository";
import { getSubmissionsForBusiness } from "@/domain/submissions/repository";
import { logActivity } from "@/domain/activity/service";
import { createHash } from "crypto";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Mints a fresh raw token for this contact. We don't reuse a
 * previously issued token even if one is still valid, because only
 * its hash is stored — the raw value is never recoverable after the
 * request that created it (that's the point of hashing it). Lifecycle
 * is managed via expiry/revocation instead of reuse.
 */
export async function issueOrReuseAccessToken(
  contactId: string,
  submissionId?: string,
  expiresAt: Date | null = null
): Promise<string> {
  const { rawToken, hash } = generateSecureToken();
  await createAccessToken({ contactId, submissionId, tokenHash: hash, expiresAt });
  return rawToken;
}

export type TokenValidationResult =
  | { valid: true; tokenId: string; contact: NonNullable<Awaited<ReturnType<typeof findTokenByHash>>>["contact"]; submission: NonNullable<Awaited<ReturnType<typeof findTokenByHash>>>["submission"] }
  | { valid: false; reason: "NOT_FOUND" | "REVOKED" | "EXPIRED" };

export async function validateAccessToken(rawToken: string): Promise<TokenValidationResult> {
  const hash = hashToken(rawToken);
  const record = await findTokenByHash(hash);

  if (!record) return { valid: false, reason: "NOT_FOUND" };
  if (record.revokedAt) return { valid: false, reason: "REVOKED" };
  if (record.expiresAt && record.expiresAt < new Date()) return { valid: false, reason: "EXPIRED" };

  await markTokenUsed(record.id);

  return {
    valid: true,
    tokenId: record.id,
    contact: record.contact,
    submission: record.submission
  };
}

/**
 * Revokes every active portal link belonging to this submission's
 * contact — e.g. if their email is compromised, or a link was sent
 * to the wrong person. Reuses revokeAllTokensForContact, which
 * already existed in the repository but had no caller until now.
 */
export async function revokePortalAccessForSubmission(
  businessId: string,
  submissionId: string,
  staffUserId: string
): Promise<{ ok: true; revokedCount: number } | { ok: false; error: string }> {
  const submission = await getSubmissionsForBusiness(businessId, submissionId);
  if (!submission) return { ok: false, error: "Submission not found" };

  const result = await revokeAllTokensForContact(submission.contactId);

  await logActivity({
    businessId,
    submissionId,
    type: "portal_access.revoked",
    payload: { revokedCount: result.count },
    actorType: "STAFF",
    actorId: staffUserId
  });

  return { ok: true, revokedCount: result.count };
}
