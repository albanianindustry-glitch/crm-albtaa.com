import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateStaff } from "@/domain/staff/service";
import { createSession } from "@/lib/auth/session";
import { checkPublicRateLimit } from "@/lib/rateLimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  // Rate-limited per IP+email to blunt brute-force login attempts
  // (same floor-level in-memory limiter used on the public submission
  // endpoint — see lib/rateLimit.ts for its scope and limitations).
  const rateLimit = await checkPublicRateLimit(`login:${ip}:${parsed.data.email.toLowerCase()}`, 8, 5 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  const staff = await authenticateStaff(parsed.data.email, parsed.data.password);

  // Deliberately generic error message — don't reveal whether the
  // email exists.
  if (!staff) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession({
    staffUserId: staff.staffUserId,
    email: staff.email,
    role: staff.role,
    businessIds: staff.businessIds
  });

  return NextResponse.json({
    success: true,
    user: { email: staff.email, name: staff.name, role: staff.role }
  });
}
