import { apiFetch, ApiError } from "../../lib/api";
import { savePracticeSet } from "./practice-set";

export interface Selection {
  subjectCode: string;
  topicCodes?: string[];
  count: number;
}

/**
 * Starts a practice from the bank: "feedback" walks a random set one question
 * at a time with the key after each; "exam" builds a timed exam of the
 * student's own and starts it. Returns where to go, or a message to show.
 */
export async function startPractice(
  selection: Selection,
  mode: "feedback" | "exam",
  title: string,
  back: string,
): Promise<{ href: string } | { message: string }> {
  try {
    if (mode === "feedback") {
      const set = await apiFetch<{ ids: string[] }>("/questions/practice-set", { method: "POST", body: selection });
      if (set.ids.length === 0) return { message: "هنوز تستی که به آن دسترسی داشته باشی در این بخش نیست." };
      savePracticeSet(set.ids);
      return { href: `/questions/${set.ids[0]}` };
    }
    const exam = await apiFetch<{ examId: string }>("/questions/practice-exams", {
      method: "POST",
      body: { ...selection, title, durationMinutes: Math.max(5, Math.round(selection.count * 1.5)) },
    });
    const attempt = await apiFetch<{ id: string }>(`/exams/${exam.examId}/start`, { method: "POST" });
    return { href: `/attempts/${attempt.id}` };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { href: `/login?next=${encodeURIComponent(back)}` };
    if (err instanceof ApiError && err.code === "PROFILE_INCOMPLETE") return { href: `/account/profile?next=${encodeURIComponent(back)}` };
    if (err instanceof ApiError && err.status === 400) return { message: "هنوز تستی که به آن دسترسی داشته باشی در این بخش نیست." };
    return { message: "شروع ممکن نشد. چند لحظهٔ دیگر دوباره امتحان کن." };
  }
}
