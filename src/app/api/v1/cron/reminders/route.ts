import { NextRequest, NextResponse } from "next/server";
import { processDueReminders } from "@/domain/reminders/service";

/**
 * Protected by CRON_SECRET rather than staff session auth — Vercel
 * Cron calls this directly (no browser session available). Vercel
 * automatically sends `Authorization: Bearer ${CRON_SECRET}` for
 * cron-triggered requests when CRON_SECRET is set as an env var.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueReminders();
  return NextResponse.json(result);
}
