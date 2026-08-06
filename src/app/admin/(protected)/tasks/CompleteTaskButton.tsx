"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompleteTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function complete() {
    setLoading(true);
    try {
      await fetch(`/api/v1/tasks/${taskId}/complete`, { method: "PATCH" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return <input type="checkbox" disabled={loading} onChange={complete} />;
}
