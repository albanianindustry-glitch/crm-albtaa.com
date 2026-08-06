import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSession, canAccessBusiness } from "@/lib/auth/requireSession";
import { getBusinessBySlug } from "@/domain/businesses/repository";
import { getSubmissionById } from "@/domain/submissions/repository";
import SubmissionDetailTabs from "./SubmissionDetailTabs";

export default async function SubmissionDetailPage({
  params
}: {
  params: { businessSlug: string; id: string };
}) {
  const session = await requireSession();
  const business = await getBusinessBySlug(params.businessSlug);
  if (!business) notFound();
  if (!canAccessBusiness(session, business.id)) redirect("/admin");

  const submission = await getSubmissionById(business.id, params.id);
  if (!submission) notFound();

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-header">
        <p style={{ marginBottom: 8 }}>
          <Link href={`/admin/${business.slug}`}>← {business.name} pipeline</Link>
        </p>
        <h1>
          {submission.contact.firstName} {submission.contact.lastName}
        </h1>
        <p>
          {submission.contact.email}
          {submission.contact.phone ? ` · ${submission.contact.phone}` : ""} ·{" "}
          {submission.form.name} · {submission.currentStage?.label ?? "No stage"}
        </p>
      </div>

      <SubmissionDetailTabs
        businessSlug={business.slug}
        submission={{
          id: submission.id,
          customFields: submission.customFields as Record<string, string>,
          sourceMeta: submission.sourceMeta as Record<string, string>,
          createdAt: submission.createdAt.toISOString(),
          notes: submission.notes.map(
            (n: { id: string; body: string; createdAt: Date; author: { name: string } }) => ({
              id: n.id,
              body: n.body,
              createdAt: n.createdAt.toISOString(),
              author: { name: n.author.name }
            })
          ),
          documents: submission.documents.map(
            (d: {
              id: string;
              fileName: string;
              status: string;
              uploadedAt: Date;
              documentType: { label: string };
            }) => ({
              id: d.id,
              fileName: d.fileName,
              status: d.status,
              uploadedAt: d.uploadedAt.toISOString(),
              documentType: { label: d.documentType.label }
            })
          ),
          tasks: submission.tasks.map(
            (t: {
              id: string;
              title: string;
              dueAt: Date | null;
              completedAt: Date | null;
              assignee: { name: string } | null;
            }) => ({
              id: t.id,
              title: t.title,
              dueAt: t.dueAt ? t.dueAt.toISOString() : null,
              completedAt: t.completedAt ? t.completedAt.toISOString() : null,
              assignee: t.assignee ? { name: t.assignee.name } : null
            })
          )
        }}
      />
    </div>
  );
}
