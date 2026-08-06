"use client";

import { useState, useEffect, useCallback } from "react";

interface Stage {
  id: string;
  key: string;
  label: string;
}
interface EmailTemplate {
  id: string;
  triggerKey: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isActive: boolean;
}
interface EmailLog {
  id: string;
  triggerKey: string;
  toEmail: string;
  subject: string;
  sentAt: string;
}
interface AutomationRule {
  id: string;
  name: string;
  eventTrigger: string;
  conditions: Record<string, unknown>;
  actionType: "SEND_EMAIL" | "MOVE_STAGE" | "CREATE_TASK" | "SCHEDULE_REMINDER";
  actionConfig: Record<string, unknown>;
  isActive: boolean;
}

const SUB_TABS = ["Email Templates", "Email Logs", "Automation Rules"] as const;
type SubTab = (typeof SUB_TABS)[number];

const EVENT_TRIGGERS = ["submission.created", "stage.changed", "document.uploaded"];

export default function SettingsPanel({ businessSlug, stages }: { businessSlug: string; stages: Stage[] }) {
  const [tab, setTab] = useState<SubTab>("Email Templates");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: tab === t ? "var(--ink)" : "var(--ink-soft)",
              borderBottom: tab === t ? "2px solid var(--ink)" : "2px solid transparent"
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Email Templates" && <TemplatesTab businessSlug={businessSlug} />}
      {tab === "Email Logs" && <LogsTab businessSlug={businessSlug} />}
      {tab === "Automation Rules" && <RulesTab businessSlug={businessSlug} stages={stages} />}
    </div>
  );
}

// ── Email Templates ────────────────────────────────────────────────

function TemplatesTab({ businessSlug }: { businessSlug: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | { isNew: true } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/businesses/${businessSlug}/email-templates`);
    const data = await res.json();
    setTemplates(data.templates);
  }, [businessSlug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!templates) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;

  if (editing) {
    return (
      <TemplateEditor
        businessSlug={businessSlug}
        template={"isNew" in editing ? null : editing}
        onDone={() => {
          setEditing(null);
          load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}
      <button
        className="submit-btn"
        style={{ width: "auto", padding: "8px 18px", marginBottom: 16 }}
        onClick={() => setEditing({ isNew: true })}
      >
        New template
      </button>

      {templates.length === 0 ? (
        <div className="empty-state">No email templates configured yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => setEditing(t)}
              style={{
                cursor: "pointer",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 14
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{t.triggerKey}</span>
                <span style={{ fontSize: "0.78rem", color: t.isActive ? "var(--accent)" : "var(--ink-soft)" }}>
                  {t.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginTop: 4 }}>{t.subject}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({
  businessSlug,
  template,
  onDone,
  onCancel
}: {
  businessSlug: string;
  template: EmailTemplate | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [triggerKey, setTriggerKey] = useState(template?.triggerKey ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml ?? "");
  const [bodyText, setBodyText] = useState(template?.bodyText ?? "");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!triggerKey.trim() || !subject.trim() || !bodyHtml.trim() || !bodyText.trim()) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/businesses/${businessSlug}/email-templates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerKey: triggerKey.trim(), subject, bodyHtml, bodyText, isActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}
      <FormField label="Trigger key">
        <input
          value={triggerKey}
          onChange={(e) => setTriggerKey(e.target.value)}
          disabled={!!template}
          placeholder="e.g. lead.internal_notification"
          style={inputStyle}
        />
      </FormField>
      <FormField label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
      </FormField>
      <FormField label="Body (HTML)">
        <textarea rows={6} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} style={textareaStyle} />
      </FormField>
      <FormField label="Body (plain text)">
        <textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} style={textareaStyle} />
      </FormField>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", marginBottom: 16 }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="submit-btn" style={{ width: "auto", padding: "8px 18px" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Email Logs ──────────────────────────────────────────────────────

function LogsTab({ businessSlug }: { businessSlug: string }) {
  const [logs, setLogs] = useState<EmailLog[] | null>(null);

  useEffect(() => {
    fetch(`/api/v1/businesses/${businessSlug}/email-logs`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs));
  }, [businessSlug]);

  if (!logs) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;
  if (logs.length === 0) return <div className="empty-state">No emails sent yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {logs.map((l) => (
        <div
          key={l.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.82rem",
            padding: "8px 0",
            borderBottom: "1px solid var(--border)"
          }}
        >
          <div>
            <strong>{l.triggerKey}</strong> → {l.toEmail}
            <div style={{ color: "var(--ink-soft)" }}>{l.subject}</div>
          </div>
          <span style={{ color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
            {new Date(l.sentAt).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Automation Rules (Phase 8 builder) ──────────────────────────────

type ConditionRow = { path: string; operator: "eq" | "gte" | "lte" | "gt" | "lt"; value: string };

function RulesTab({ businessSlug, stages }: { businessSlug: string; stages: Stage[] }) {
  const [rules, setRules] = useState<AutomationRule[] | null>(null);
  const [editing, setEditing] = useState<AutomationRule | { isNew: true } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/businesses/${businessSlug}/automation-rules`);
    const data = await res.json();
    setRules(data.rules);
  }, [businessSlug]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(rule: AutomationRule) {
    await fetch(`/api/v1/automation-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive })
    });
    load();
  }

  async function removeRule(rule: AutomationRule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    const res = await fetch(`/api/v1/automation-rules/${rule.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete rule");
      return;
    }
    load();
  }

  if (!rules) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;

  if (editing) {
    return (
      <RuleEditor
        businessSlug={businessSlug}
        stages={stages}
        rule={"isNew" in editing ? null : editing}
        onDone={() => {
          setEditing(null);
          load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}
      <button
        className="submit-btn"
        style={{ width: "auto", padding: "8px 18px", marginBottom: 16 }}
        onClick={() => setEditing({ isNew: true })}
      >
        New rule
      </button>

      {rules.length === 0 ? (
        <div className="empty-state">No automation rules configured yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rules.map((r) => (
            <div
              key={r.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 14
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginTop: 2 }}>
                    when <strong>{r.eventTrigger}</strong>
                    {Object.keys(r.conditions ?? {}).length > 0 && " (with conditions)"} → {actionSummary(r)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => toggleActive(r)}
                    style={{
                      fontSize: "0.75rem",
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: 100,
                      padding: "4px 10px",
                      cursor: "pointer",
                      color: r.isActive ? "var(--accent)" : "var(--ink-soft)"
                    }}
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => setEditing(r)}
                    style={{ fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeRule(r)}
                    style={{ fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function actionSummary(r: AutomationRule): string {
  if (r.actionType === "SEND_EMAIL") {
    return `send "${r.actionConfig.templateKey}" to ${r.actionConfig.recipient}`;
  }
  if (r.actionType === "MOVE_STAGE") {
    return `move to stage "${r.actionConfig.stageKey}"`;
  }
  if (r.actionType === "CREATE_TASK") {
    return `create task "${r.actionConfig.title}"`;
  }
  if (r.actionType === "SCHEDULE_REMINDER") {
    return `schedule "${r.actionConfig.templateKey}" ${r.actionConfig.delayDays} day(s) later`;
  }
  return "";
}

function RuleEditor({
  businessSlug,
  stages,
  rule,
  onDone,
  onCancel
}: {
  businessSlug: string;
  stages: Stage[];
  rule: AutomationRule | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [eventTrigger, setEventTrigger] = useState(rule?.eventTrigger ?? EVENT_TRIGGERS[0] ?? "submission.created");
  const [conditions, setConditions] = useState<ConditionRow[]>(
    rule
      ? Object.entries(rule.conditions ?? {}).map(([path, v]) => {
          if (v !== null && typeof v === "object") {
            const [operator, value] = Object.entries(v as Record<string, unknown>)[0] ?? ["eq", ""];
            return { path, operator: operator as ConditionRow["operator"], value: String(value) };
          }
          return { path, operator: "eq" as const, value: String(v) };
        })
      : []
  );
  const [actionType, setActionType] = useState<AutomationRule["actionType"]>(rule?.actionType ?? "SEND_EMAIL");
  const [templateKey, setTemplateKey] = useState((rule?.actionConfig.templateKey as string) ?? "");
  const [recipient, setRecipient] = useState((rule?.actionConfig.recipient as string) ?? "client");
  const [stageKey, setStageKey] = useState((rule?.actionConfig.stageKey as string) ?? stages[0]?.key ?? "");
  const [taskTitle, setTaskTitle] = useState((rule?.actionConfig.title as string) ?? "");
  const [dueInDays, setDueInDays] = useState(String(rule?.actionConfig.dueInDays ?? "3"));
  const [delayDays, setDelayDays] = useState(String(rule?.actionConfig.delayDays ?? "3"));
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCondition() {
    setConditions([...conditions, { path: "", operator: "eq", value: "" }]);
  }
  function updateCondition(i: number, patch: Partial<ConditionRow>) {
    setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCondition(i: number) {
    setConditions(conditions.filter((_, idx) => idx !== i));
  }

  function buildConditionsJson(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const c of conditions) {
      if (!c.path.trim()) continue;
      const numeric = Number(c.value);
      const value = Number.isNaN(numeric) ? c.value : numeric;
      out[c.path.trim()] = c.operator === "eq" ? value : { [c.operator]: value };
    }
    return out;
  }

  function buildActionConfig(): Record<string, unknown> {
    if (actionType === "SEND_EMAIL") return { templateKey: templateKey.trim(), recipient };
    if (actionType === "MOVE_STAGE") return { stageKey: stageKey.trim() };
    if (actionType === "SCHEDULE_REMINDER") {
      return { templateKey: templateKey.trim(), delayDays: Number(delayDays) || 1 };
    }
    return { title: taskTitle.trim(), dueInDays: Number(dueInDays) || undefined };
  }

  async function save() {
    if (!name.trim() || !eventTrigger.trim()) {
      setError("Name and trigger event are required.");
      return;
    }
    if (actionType === "SEND_EMAIL" && !templateKey.trim()) {
      setError("Template key is required for a Send Email action.");
      return;
    }
    if (actionType === "MOVE_STAGE" && !stageKey.trim()) {
      setError("Stage is required for a Move Stage action.");
      return;
    }
    if (actionType === "CREATE_TASK" && !taskTitle.trim()) {
      setError("Task title is required for a Create Task action.");
      return;
    }
    if (actionType === "SCHEDULE_REMINDER") {
      if (!templateKey.trim()) {
        setError("Template key is required for a Schedule Reminder action.");
        return;
      }
      if (!delayDays.trim() || Number(delayDays) <= 0) {
        setError("Delay (days) must be a positive number for a Schedule Reminder action.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      eventTrigger: eventTrigger.trim(),
      conditions: buildConditionsJson(),
      actionType,
      actionConfig: buildActionConfig(),
      isActive
    };

    try {
      const res = await fetch(
        rule ? `/api/v1/automation-rules/${rule.id}` : `/api/v1/businesses/${businessSlug}/automation-rules`,
        {
          method: rule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rule");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      <FormField label="Rule name">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Remind about missing passport" />
      </FormField>

      <FormField label="When this happens">
        <input
          list="event-triggers"
          value={eventTrigger}
          onChange={(e) => setEventTrigger(e.target.value)}
          style={inputStyle}
        />
        <datalist id="event-triggers">
          {EVENT_TRIGGERS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FormField>

      <FormField label="Conditions (optional — all must match)">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conditions.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input
                value={c.path}
                onChange={(e) => updateCondition(i, { path: e.target.value })}
                placeholder="e.g. stage.key"
                style={{ ...inputStyle, flex: 2 }}
              />
              <select
                value={c.operator}
                onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionRow["operator"] })}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="eq">equals</option>
                <option value="gte">≥</option>
                <option value="lte">≤</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
              </select>
              <input
                value={c.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder="value"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() => removeCondition(i)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addCondition}
            style={{
              alignSelf: "flex-start",
              fontSize: "0.78rem",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 100,
              padding: "5px 12px",
              cursor: "pointer"
            }}
          >
            + Add condition
          </button>
        </div>
      </FormField>

      <FormField label="Then do this">
        <select value={actionType} onChange={(e) => setActionType(e.target.value as AutomationRule["actionType"])} style={inputStyle}>
          <option value="SEND_EMAIL">Send an email</option>
          <option value="MOVE_STAGE">Move to a pipeline stage</option>
          <option value="CREATE_TASK">Create a task</option>
          <option value="SCHEDULE_REMINDER">Schedule a reminder email</option>
        </select>
      </FormField>

      {actionType === "SEND_EMAIL" && (
        <>
          <FormField label="Email template trigger key">
            <input value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={inputStyle} placeholder="e.g. lead.client_welcome" />
          </FormField>
          <FormField label="Recipient">
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)} style={inputStyle}>
              <option value="client">Client</option>
              <option value="internal">Internal (staff)</option>
            </select>
          </FormField>
        </>
      )}

      {actionType === "MOVE_STAGE" && (
        <FormField label="Target stage">
          <select value={stageKey} onChange={(e) => setStageKey(e.target.value)} style={inputStyle}>
            {stages.map((s) => (
              <option key={s.id} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {actionType === "CREATE_TASK" && (
        <>
          <FormField label="Task title">
            <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} style={inputStyle} />
          </FormField>
          <FormField label="Due in (days)">
            <input type="number" value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} style={inputStyle} />
          </FormField>
        </>
      )}

      {actionType === "SCHEDULE_REMINDER" && (
        <>
          <FormField label="Email template trigger key">
            <input
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              style={inputStyle}
              placeholder="e.g. reminder.missing_medical_history"
            />
          </FormField>
          <FormField label="Send after (days)">
            <input type="number" min={1} value={delayDays} onChange={(e) => setDelayDays(e.target.value)} style={inputStyle} />
          </FormField>
        </>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", margin: "8px 0 16px" }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="submit-btn" style={{ width: "auto", padding: "8px 18px" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save rule"}
        </button>
        <button
          onClick={onCancel}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: "0.85rem",
  fontFamily: "inherit"
};
const textareaStyle: React.CSSProperties = { ...inputStyle, fontFamily: "monospace", fontSize: "0.8rem" };
