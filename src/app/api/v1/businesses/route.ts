import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { listBusinessesForStaff } from "@/domain/businesses/repository";

export async function GET() {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businesses = await listBusinessesForStaff(auth.session);
  return NextResponse.json({ businesses });
}
