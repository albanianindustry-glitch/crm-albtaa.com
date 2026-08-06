import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSession, canAccessBusiness } from "@/lib/auth/requireSession";
import { getBusinessBySlug } from "@/domain/businesses/repository";
import { getDefaultPipelineWithStages } from "@/domain/pipelines/repository";
import KanbanBoard from "./KanbanBoard";

export default async function BusinessPipelinePage({
  params
}: {
  params: { businessSlug: string };
}) {
  const session = await requireSession();
  const business = await getBusinessBySlug(params.businessSlug);
  if (!business) notFound();

  if (!canAccessBusiness(session, business.id)) {
    redirect("/admin");
  }

  const pipeline = await getDefaultPipelineWithStages(business.id);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <h1>{business.name}</h1>
        <p>
          <Link href="/admin">← All businesses</Link> · <Link href={`/admin/${business.slug}/settings`}>Settings</Link>
        </p>
      </div>

      {!pipeline ? (
        <div className="empty-state">No pipeline configured for this business yet.</div>
      ) : (
        <KanbanBoard businessSlug={business.slug} stages={pipeline.stages} />
      )}
    </div>
  );
}
