import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "platform_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET env var must be set and at least 32 characters long."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  staffUserId: string;
  email: string;
  role: "OWNER" | "STAFF";
  // Business ids this user is restricted to; empty array = all businesses.
  businessIds: string[];
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      staffUserId: payload.staffUserId as string,
      email: payload.email as string,
      role: payload.role as "OWNER" | "STAFF",
      businessIds: (payload.businessIds as string[]) ?? []
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().delete(COOKIE_NAME);
}
