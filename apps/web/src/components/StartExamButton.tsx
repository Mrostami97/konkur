"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiError } from "../lib/api";

export function StartExamButton({ examId }: { examId: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/exams";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const attempt = await apiFetch<{ id: string }>(`/exams/${examId}/start`, { method: "POST" });
      router.push(`/attempts/${attempt.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      // A report card belongs to a named student: the API refuses a new
      // attempt until the profile has a name and education, and says so.
      if (err instanceof ApiError && err.code === "PROFILE_INCOMPLETE") {
        router.push(`/account/profile?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(
        err instanceof ApiError && err.status === 403
          ? "برای این آزمون دسترسی فعالی نداری."
          : "شروع آزمون ممکن نشد. چند لحظهٔ دیگر دوباره امتحان کن.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="start-exam">
      <button className="button button-primary" onClick={start} disabled={loading}>
        {loading ? "در حال شروع..." : "شروع آزمون"}
      </button>
      {error && (
        <p className="start-exam-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
