import Link from "next/link";
import { requireSession } from "@/lib/auth/requireSession";
import LogoutButton from "./LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="shell">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/admin" className="topbar-brand" style={{ textDecoration: "none", color: "white" }}>
            Platform
          </Link>
          <Link href="/admin/tasks" style={{ color: "white", fontSize: "0.85rem", textDecoration: "none", opacity: 0.85 }}>
            My Tasks
          </Link>
        </div>
        <div className="topbar-actions">
          <span>{session.email}</span>
          <LogoutButton />
        </div>
      </div>
      {children}
    </div>
  );
}
