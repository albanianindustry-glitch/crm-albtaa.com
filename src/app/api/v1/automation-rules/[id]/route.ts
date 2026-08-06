import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, assertBusinessAccess } from "@/lib/auth/requireApiSession";
import { getAutomationRuleBusinessId } from "@/domain/automation/repository";
import { updateRule, deleteRule } from "@/domain/automation/service";
import { updateRuleSchema } from "@/lib/validation/automationRule";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businessId = await getAutomationRuleBusinessId(params.id);
  if (!businessId) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, businessId);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const ok = await updateRule(
    businessId,
    params.id,
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
  if (!ok) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const businessId = await getAutomationRuleBusinessId(params.id);
  if (!businessId) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const forbidden = assertBusinessAccess(auth.session, businessId);
  if (forbidden) return forbidden;

  const ok = await deleteRule(businessId, params.id, auth.session.staffUserId);
  if (!ok) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
