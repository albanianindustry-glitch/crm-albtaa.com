import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSession, canAccessBusiness } from "@/lib/auth/requireSession";
import { getBusinessBySlug } from "@/domain/businesses/repository";
import { getDefaultPipelineWithStages } from "@/domain/pipelines/repository";
import SettingsPanel from "./SettingsPanel";

export default async function SettingsPage({ params }: { params: { businessSlug: string } }) {
  const session = await requireSession();
  const business = await getBusinessBySlug(params.businessSlug);
  if (!business) notFound();
  if (!canAccessBusiness(session, business.id)) redirect("/admin");

  const pipeline = await getDefaultPipelineWithStages(business.id);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <p style={{ marginBottom: 8 }}>
          <Link href={`/admin/${business.slug}`}>← {business.name} pipeline</Link>
        </p>
        <h1>Settings</h1>
        <p>Email templates, email history, and automation rules for {business.name}.</p>
      </div>

      <SettingsPanel businessSlug={business.slug} stages={pipeline?.stages ?? []} />
    </div>
  );
}
