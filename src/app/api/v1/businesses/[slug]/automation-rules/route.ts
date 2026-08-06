import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { resolveBusinessForAdminRoute } from "@/lib/adminRouteHelpers";
import { listRulesForBusiness, createRule } from "@/domain/automation/service";
import { createRuleSchema } from "@/lib/validation/automationRule";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const resolved = await resolveBusinessForAdminRoute(params.slug, auth.session);
  if (!resolved.ok) return resolved.response;

  const rules = await listRulesForBusiness(resolved.business.id);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
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

  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const rule = await createRule(
    resolved.business.id,
    {
      name: parsed.data.name,
      eventTrigger: parsed.data.eventTrigger,
      conditions: parsed.data.conditions,
      actionType: parsed.data.actionType,
      actionConfig: parsed.data.actionConfig,
      isActive: parsed.data.isActive
    },
    auth.session.staffUserId
  );
  return NextResponse.json({ rule });
}
