import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getBusinessBySlug } from "@/domain/businesses/repository";
import { listSubmissions } from "@/domain/submissions/repository";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businessSlug = req.nextUrl.searchParams.get("business");
  if (!businessSlug) {
    return NextResponse.json({ error: "Missing 'business' query param" }, { status: 400 });
  }

  const business = await getBusinessBySlug(businessSlug);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, business.id);
  if (forbidden) return forbidden;

  const stageId = req.nextUrl.searchParams.get("stageId") ?? undefined;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");

  const result = await listSubmissions(business.id, { stageId, search, page });
  return NextResponse.json(result);
}
