import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Generates a new API key for a business's website to authenticate with.
 * Returns both the raw key (show it once, at creation time only) and its
 * hash (what actually gets stored in the DB).
 */
export function generateApiKey(): { rawKey: string; hash: string } {
  const rawKey = "pk_" + randomBytes(32).toString("base64url");
  const hash = hashApiKey(rawKey);
  return { rawKey, hash };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generic secure random token generator, reused in later phases for
 * client portal AccessTokens (Phase 4). Included now so the hashing
 * convention (store hash, never raw value) is established from day one.
 */
export function generateSecureToken(): { rawToken: string; hash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, hash };
}
