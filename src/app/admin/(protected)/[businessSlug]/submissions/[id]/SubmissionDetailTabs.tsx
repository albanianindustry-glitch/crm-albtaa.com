"use client";

import { useState, useEffect, useCallback } from "react";

interface Note {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string };
}
interface DocumentItem {
  id: string;
  fileName: string;
  status: string;
  uploadedAt: string;
  documentType: { label: string };
}
interface TaskItem {
  id: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
  assignee: { name: string } | null;
}
interface TimelineEntry {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  actorType: "SYSTEM" | "STAFF" | "CLIENT";
  actorId: string | null;
  createdAt: string;
}

interface SubmissionDetail {
  id: string;
  customFields: Record<string, string>;
  sourceMeta: Record<string, string>;
  createdAt: string;
  notes: Note[];
  documents: DocumentItem[];
  tasks: TaskItem[];
}

const TABS = ["Info", "Notes", "Documents", "Tasks", "Timeline"] as const;
type Tab = (typeof TABS)[number];

const TIMELINE_LABELS: Record<string, string> = {
  "submission.created": "Submission received",
  "submission.spam_blocked": "Submission blocked as spam",
  "email.sent": "Email sent",
  "email.failed": "Email failed to send",
  "stage.changed": "Stage changed",
  "note.added": "Note added",
  "document.uploaded": "Document uploaded",
  "document.reviewed": "Document reviewed",
  "task.created": "Task created",
  "task.completed": "Task completed",
  "reminder.scheduled": "Reminder scheduled",
  "reminder.sent": "Reminder sent",
  "reminder.failed": "Reminder failed",
  "automation.rule_failed": "Automation rule failed",
  "portal_access.revoked": "Portal access revoked"
};

export default function SubmissionDetailTabs({
  submission
}: {
  businessSlug: string;
  submission: SubmissionDetail;
}) {
  const [tab, setTab] = useState<Tab>("Info");

  const [notes, setNotes] = useState(submission.notes);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [tasks, setTasks] = useState(submission.tasks);
  const [taskDraft, setTaskDraft] = useState("");
  const [taskDueDraft, setTaskDueDraft] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const [revoking, setRevoking] = useState(false);
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setTimelineError(null);
    try {
      const res = await fetch(`/api/v1/submissions/${submission.id}/timeline`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load timeline");
      setTimeline(data.timeline);
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : "Failed to load timeline");
    }
  }, [submission.id]);

  useEffect(() => {
    if (tab === "Timeline" && timeline === null) {
      loadTimeline();
    }
  }, [tab, timeline, loadTimeline]);

  async function submitNote() {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/v1/submissions/${submission.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      setNotes([{ ...data.note, author: { name: data.note.author?.name ?? "You" } }, ...notes]);
      setNoteDraft("");
      setTimeline(null);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function submitTask() {
    if (!taskDraft.trim()) return;
    setSavingTask(true);
    setTaskError(null);
    try {
      const res = await fetch(`/api/v1/submissions/${submission.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskDraft.trim(),
          ...(taskDueDraft ? { dueAt: new Date(taskDueDraft).toISOString() } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add task");
      setTasks([{ ...data.task, assignee: null }, ...tasks]);
      setTaskDraft("");
      setTaskDueDraft("");
      setTimeline(null);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setSavingTask(false);
    }
  }

  async function completeTask(taskId: string) {
    setCompletingId(taskId);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/complete`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete task");
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, completedAt: data.task.completedAt } : t)));
      setTimeline(null);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to complete task");
    } finally {
      setCompletingId(null);
    }
  }

  async function revokePortalAccess() {
    if (!confirm("Revoke this client's portal link? They will no longer be able to access it.")) return;
    setRevoking(true);
    setRevokeError(null);
    setRevokeMessage(null);
    try {
      const res = await fetch(`/api/v1/submissions/${submission.id}/revoke-access`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke access");
      setRevokeMessage(
        data.revokedCount > 0 ? `Revoked ${data.revokedCount} active link(s).` : "No active links to revoke."
      );
      setTimeline(null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map((t) => (
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
            {t === "Notes" && notes.length > 0 ? ` (${notes.length})` : ""}
            {t === "Documents" && submission.documents.length > 0 ? ` (${submission.documents.length})` : ""}
            {t === "Tasks" && tasks.filter((task) => !task.completedAt).length > 0
              ? ` (${tasks.filter((task) => !task.completedAt).length})`
              : ""}
          </button>
        ))}
      </div>

      {tab === "Info" && (
        <div style={{ display: "grid", gap: 10, fontSize: "0.88rem" }}>
          <Row label="Submitted" value={new Date(submission.createdAt).toLocaleString()} />
          {Object.entries(submission.customFields).map(([key, value]) => (
            <Row key={key} label={key} value={value} />
          ))}
          <Row label="Referrer" value={submission.sourceMeta.referrer || "—"} />
          <Row label="Page URL" value={submission.sourceMeta.pageUrl || "—"} />
          <Row
            label="UTM"
            value={
              [submission.sourceMeta.utmSource, submission.sourceMeta.utmMedium, submission.sourceMeta.utmCampaign]
                .filter(Boolean)
                .join(" / ") || "—"
            }
          />

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 16 }}>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 8 }}>Client portal</div>
            {revokeError && <div className="error-msg">{revokeError}</div>}
            {revokeMessage && (
              <div style={{ fontSize: "0.82rem", color: "var(--accent)", marginBottom: 8 }}>{revokeMessage}</div>
            )}
            <button
              onClick={revokePortalAccess}
              disabled={revoking}
              style={{
                fontSize: "0.8rem",
                background: "none",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer"
              }}
            >
              {revoking ? "Revoking…" : "Revoke portal access"}
            </button>
          </div>
        </div>
      )}

      {tab === "Notes" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add an internal note…"
              rows={3}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
                fontFamily: "inherit",
                marginBottom: 8
              }}
            />
            {noteError && <div className="error-msg">{noteError}</div>}
            <button
              className="submit-btn"
              style={{ width: "auto", padding: "8px 18px" }}
              onClick={submitNote}
              disabled={savingNote}
            >
              {savingNote ? "Saving…" : "Add note"}
            </button>
          </div>

          {notes.length === 0 ? (
            <div className="empty-state">No notes yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notes.map((n) => (
                <div key={n.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 4 }}>
                    {n.author.name} · {new Date(n.createdAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: "0.88rem", whiteSpace: "pre-wrap" }}>{n.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Documents" &&
        (submission.documents.length === 0 ? (
          <div className="empty-state">
            No documents uploaded yet. Clients upload documents through their portal link.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {submission.documents.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span>
                  {d.documentType.label} — {d.fileName}
                </span>
                <span style={{ color: "var(--ink-soft)" }}>{d.status}</span>
              </div>
            ))}
          </div>
        ))}

      {tab === "Tasks" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              value={taskDraft}
              onChange={(e) => setTaskDraft(e.target.value)}
              placeholder="New task…"
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: "0.85rem"
              }}
            />
            <input
              type="date"
              value={taskDueDraft}
              onChange={(e) => setTaskDueDraft(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.85rem" }}
            />
            <button
              className="submit-btn"
              style={{ width: "auto", padding: "8px 18px" }}
              onClick={submitTask}
              disabled={savingTask}
            >
              {savingTask ? "Adding…" : "Add"}
            </button>
          </div>
          {taskError && <div className="error-msg">{taskError}</div>}

          {tasks.length === 0 ? (
            <div className="empty-state">No tasks yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tasks.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={!!t.completedAt}
                    disabled={!!t.completedAt || completingId === t.id}
                    onChange={() => completeTask(t.id)}
                  />
                  <span style={{ flex: 1, textDecoration: t.completedAt ? "line-through" : "none" }}>
                    {t.title}
                  </span>
                  <span style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>
                    {t.assignee?.name ?? "Unassigned"}
                    {t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Timeline" && (
        <div>
          {timelineError && <div className="error-msg">{timelineError}</div>}
          {timeline === null ? (
            <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>Loading…</p>
          ) : timeline.length === 0 ? (
            <div className="empty-state">No activity recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {timeline
                .slice()
                .reverse()
                .map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: "0.85rem"
                    }}
                  >
                    <div style={{ color: "var(--ink-soft)", fontSize: "0.75rem", whiteSpace: "nowrap", width: 130 }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>{TIMELINE_LABELS[entry.type] ?? entry.type}</span>
                      <span style={{ color: "var(--ink-soft)" }}> · {entry.actorType.toLowerCase()}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
      <span style={{ color: "var(--ink-soft)", textTransform: "capitalize" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
