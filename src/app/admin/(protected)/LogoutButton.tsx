"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return <button onClick={handleLogout}>Sign out</button>;
}
