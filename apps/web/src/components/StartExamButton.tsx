"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiError } from "../lib/api";

export function StartExamButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const attempt = await apiFetch<{ id: string }>(`/exams/${examId}/start`, { method: "POST" });
      router.push(`/attempts/${attempt.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setLoading(false);
    }
  }

  return (
    <button onClick={start} disabled={loading}>
      {loading ? "در حال شروع..." : "شروع آزمون"}
    </button>
  );
}
