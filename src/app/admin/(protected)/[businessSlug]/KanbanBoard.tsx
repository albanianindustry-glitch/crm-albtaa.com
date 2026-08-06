"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Stage {
  id: string;
  key: string;
  label: string;
  order: number;
  isTerminal: boolean;
}

interface SubmissionListItem {
  id: string;
  createdAt: string;
  currentStageId: string | null;
  contact: { firstName: string; lastName: string; email: string };
  form: { name: string };
}

export default function KanbanBoard({
  businessSlug,
  stages
}: {
  businessSlug: string;
  stages: Stage[];
}) {
  const [submissions, setSubmissions] = useState<SubmissionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/submissions?business=${businessSlug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load submissions");
      setSubmissions(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    }
  }, [businessSlug]);

  useEffect(() => {
    load();
  }, [load]);

  async function moveStage(submissionId: string, stageId: string) {
    setMovingId(submissionId);
    try {
      const res = await fetch(`/api/v1/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to move stage");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move stage");
    } finally {
      setMovingId(null);
    }
  }

  if (error) return <div className="error-msg">{error}</div>;
  if (!submissions) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))`,
        gap: 16,
        alignItems: "start"
      }}
    >
      {stages.map((stage) => {
        const cards = submissions.filter((s) => s.currentStageId === stage.id);
        return (
          <div key={stage.id}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--ink-soft)",
                marginBottom: 10,
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <span>{stage.label}</span>
              <span>{cards.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cards.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: 12,
                    opacity: movingId === s.id ? 0.5 : 1
                  }}
                >
                  <Link
                    href={`/admin/${businessSlug}/submissions/${s.id}`}
                    style={{ fontWeight: 600, fontSize: "0.88rem", textDecoration: "none" }}
                  >
                    {s.contact.firstName} {s.contact.lastName}
                  </Link>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", margin: "3px 0 8px" }}>
                    {s.contact.email}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginBottom: 8 }}>
                    {s.form.name}
                  </div>
                  <select
                    value={stage.id}
                    disabled={movingId === s.id}
                    onChange={(e) => moveStage(s.id, e.target.value)}
                    style={{
                      width: "100%",
                      fontSize: "0.75rem",
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: "1px solid var(--border)"
                    }}
                  >
                    {stages.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {cards.length === 0 && (
                <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
