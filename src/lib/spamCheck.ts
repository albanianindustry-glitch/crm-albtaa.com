import { countRecentSubmissionsByEmail } from "@/domain/contacts/repository";

const MIN_ELAPSED_SECONDS = 3;
const MAX_PER_EMAIL_PER_HOUR = 3;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Ported directly from the original Apps Script CONFIG.SPAM_KEYWORDS.
const SPAM_KEYWORDS = [
  "casino",
  "viagra",
  "crypto investment",
  "make money fast",
  "earn $",
  "seo service",
  "buy followers",
  "click here",
  "weight loss",
  "adult content",
  "free gift",
  "binary option"
];

export interface SpamCheckInput {
  businessId: string;
  email: string;
  elapsedSeconds?: number;
  textToScan: string; // concatenated firstName + lastName + message + service etc.
}

export type SpamCheckResult =
  | { spam: false }
  | { spam: true; reason: "TIME_TRAP" | "RATE_LIMIT" | "KEYWORD" };

/**
 * Same three heuristics as the original GAS script: a form filled out
 * too fast is almost certainly a bot; too many submissions from the
 * same email in an hour is abuse; certain keywords are near-certain
 * spam. Failing any check returns `spam: true` — the caller should
 * still respond with a generic success (matching the original
 * behavior of silently dropping spam rather than telling the sender
 * why it was rejected).
 */
export async function checkForSpam(input: SpamCheckInput): Promise<SpamCheckResult> {
  if (
    input.elapsedSeconds !== undefined &&
    input.elapsedSeconds > 0 &&
    input.elapsedSeconds < MIN_ELAPSED_SECONDS
  ) {
    return { spam: true, reason: "TIME_TRAP" };
  }

  const recentCount = await countRecentSubmissionsByEmail(
    input.businessId,
    input.email,
    ONE_HOUR_MS
  );
  if (recentCount >= MAX_PER_EMAIL_PER_HOUR) {
    return { spam: true, reason: "RATE_LIMIT" };
  }

  const haystack = input.textToScan.toLowerCase();
  for (const keyword of SPAM_KEYWORDS) {
    if (haystack.includes(keyword)) {
      return { spam: true, reason: "KEYWORD" };
    }
  }

  return { spam: false };
}
