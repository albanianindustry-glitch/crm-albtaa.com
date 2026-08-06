import Link from "next/link";
import { requireSession } from "@/lib/auth/requireSession";
import { listBusinessesForStaff } from "@/domain/businesses/repository";

interface BusinessBranding {
  primaryColor?: string;
}

export default async function AdminHomePage() {
  const session = await requireSession();
  const businesses = await listBusinessesForStaff(session);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Businesses</h1>
        <p>Select a business to view its pipeline.</p>
      </div>

      {businesses.length === 0 ? (
        <div className="empty-state">No businesses are available to your account yet.</div>
      ) : (
        <div className="business-grid">
          {businesses.map((b: { id: string; slug: string; name: string; branding: unknown }) => {
            const branding = (b.branding as BusinessBranding) ?? {};
            return (
              <Link key={b.id} href={`/admin/${b.slug}`} className="business-card">
                <div className="swatch" style={{ background: branding.primaryColor || "#0e1b2e" }} />
                <h3>{b.name}</h3>
                <span>/{b.slug}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
