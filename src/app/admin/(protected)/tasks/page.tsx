import Link from "next/link";
import { requireSession } from "@/lib/auth/requireSession";
import { getMyTasks } from "@/domain/tasks/service";
import { listBusinessesByIds } from "@/domain/businesses/repository";
import CompleteTaskButton from "./CompleteTaskButton";

export default async function MyTasksPage() {
  const session = await requireSession();
  const tasks = await getMyTasks(session.businessIds, session.staffUserId);

  const businessIds = Array.from(new Set(tasks.map((t) => t.businessId)));
  const businesses = await listBusinessesByIds(businessIds);
  const businessById = new Map<string, { id: string; slug: string; name: string }>(
    businesses.map((b: { id: string; slug: string; name: string }) => [b.id, b])
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Tasks</h1>
        <p>Open tasks assigned to you, across every business you can access.</p>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">No open tasks. Nice.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map((t) => {
            const business = businessById.get(t.businessId);
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: 14
                }}
              >
                <CompleteTaskButton taskId={t.id} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginTop: 2 }}>
                    {business && (
                      <Link href={`/admin/${business.slug}/submissions/${t.submissionId}`}>
                        {business.name} · {t.submission.contact.firstName} {t.submission.contact.lastName}
                      </Link>
                    )}
                    {t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
