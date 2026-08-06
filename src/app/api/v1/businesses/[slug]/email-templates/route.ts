import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { resolveBusinessForAdminRoute } from "@/lib/adminRouteHelpers";
import { listEmailTemplates } from "@/domain/email/repository";
import { saveEmailTemplate } from "@/domain/email/service";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const resolved = await resolveBusinessForAdminRoute(params.slug, auth.session);
  if (!resolved.ok) return resolved.response;

  const templates = await listEmailTemplates(resolved.business.id);
  return NextResponse.json({ templates });
}

const saveSchema = z.object({
  triggerKey: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  bodyText: z.string().min(1),
  isActive: z.boolean()
});

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const resolved = await resolveBusinessForAdminRoute(params.slug, auth.session);
  if (!resolved.ok) return resolved.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const template = await saveEmailTemplate({
    businessId: resolved.business.id,
    ...parsed.data,
    staffUserId: auth.session.staffUserId
  });

  return NextResponse.json({ template });
}
