"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { ContentBlocks } from "../../../components/ContentBlocks";
import { Alert, Button, ConfirmDialog, DataState } from "../../../components/ds";
import "./attempt.css";

interface Block { type: string; [key: string]: unknown }
interface Option { number: number; blocks: Block[] }

interface Item {
  questionId: string;
  order: number;
  points: number;
  question: {
    id: string;
    stemBlocks: Block[];
    options: Option[];
    assets: { media_key: string; checksum: string }[];
  };
  selectedOption: number | null;
}

interface AttemptState {
  id: string;
  examTitle: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  remainingSeconds: number;
  items: Item[];
}

type SaveState = "saved" | "saving" | "failed";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return toPersianDigits(`${minutes}:${String(seconds).padStart(2, "0")}`);
}

export default function AttemptPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  /** Per-question save state. The previous version swallowed autosave
   * failures, so an answer could look selected on screen while never
   * reaching the server — the candidate would lose it without ever knowing. */
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AttemptState>(`/attempts/${params.id}`);
      setAttempt(data);
      setRemaining(data.remainingSeconds);
      if (data.status !== "IN_PROGRESS") router.push(`/attempts/${params.id}/report`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "خواندن آزمون ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await apiFetch(`/attempts/${params.id}/submit`, { method: "POST" });
      router.push(`/attempts/${params.id}/report`);
    } catch (err) {
      submittingRef.current = false;
      setConfirming(false);
      setSubmitError(err instanceof Error ? err.message : "ثبت آزمون ناموفق بود. دوباره تلاش کنید.");
    }
  }, [params.id, router]);

  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const interval = setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          clearInterval(interval);
          void submit();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt, submit]);

  async function selectOption(questionId: string, option: number) {
    setAttempt((previous) =>
      previous
        ? {
            ...previous,
            items: previous.items.map((item) =>
              item.questionId === questionId ? { ...item, selectedOption: option } : item,
            ),
          }
        : previous,
    );
    setSaveState((previous) => ({ ...previous, [questionId]: "saving" }));
    try {
      await apiFetch(`/attempts/${params.id}/answers/${questionId}`, {
        method: "PUT",
        body: { selectedOption: option },
      });
      setSaveState((previous) => ({ ...previous, [questionId]: "saved" }));
    } catch {
      setSaveState((previous) => ({ ...previous, [questionId]: "failed" }));
    }
  }

  function toggleFlag(questionId: string) {
    setFlagged((previous) => {
      const next = new Set(previous);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  const answered = useMemo(
    () => (attempt?.items ?? []).filter((item) => item.selectedOption !== null).length,
    [attempt],
  );
  const total = attempt?.items.length ?? 0;
  const unanswered = total - answered;
  const failedSaves = Object.values(saveState).filter((state) => state === "failed").length;

  return (
    <main className="at">
      {attempt && (
        <div className="at-bar">
          <div className="at-shell at-bar-inner">
            <div>
              <h1>{attempt.examTitle}</h1>
              <p className="at-bar-meta">
                {toPersianDigits(answered)} از {toPersianDigits(total)} پاسخ داده شده
                {unanswered > 0 ? ` · ${toPersianDigits(unanswered)} بی‌پاسخ` : ""}
              </p>
            </div>
            <div className={`at-clock ${remaining < 60 ? "at-clock-urgent" : ""}`}>
              <strong>{formatTime(remaining)}</strong>
              <span>{remaining < 60 ? "کمتر از یک دقیقه" : "زمان باقی‌مانده"}</span>
            </div>
          </div>
        </div>
      )}

      <div className="at-shell">
        <DataState loading={loading} error={error} onRetry={load} skeletonRows={4}>
          {attempt && (
            <div className="at-body">
              <div className="at-list">
                {failedSaves > 0 && (
                  <Alert tone="danger">
                    {toPersianDigits(failedSaves)} پاسخ روی سرور ثبت نشد. روی همان سؤال‌ها دوباره
                    گزینه را انتخاب کنید تا ذخیره شوند.
                  </Alert>
                )}
                {submitError && <Alert tone="danger">{submitError}</Alert>}

                {attempt.items.map((item, index) => {
                  const state = saveState[item.questionId];
                  const isFlagged = flagged.has(item.questionId);
                  return (
                    <section className="at-q" id={`q-${index + 1}`} key={item.questionId}>
                      <div className="at-q-head">
                        <span className="at-q-n">سؤال {toPersianDigits(index + 1)}</span>
                        <div className="ds-row">
                          {state === "saving" && <span className="at-save at-save-busy">در حال ذخیره…</span>}
                          {state === "saved" && <span className="at-save at-save-ok">ذخیره شد</span>}
                          {state === "failed" && <span className="at-save at-save-fail">ذخیره نشد</span>}
                          <button
                            type="button"
                            className={`at-flag-btn ${isFlagged ? "at-flag-on" : ""}`}
                            onClick={() => toggleFlag(item.questionId)}
                            aria-pressed={isFlagged}
                          >
                            {isFlagged ? "★ علامت‌دار" : "☆ علامت برای مرور"}
                          </button>
                        </div>
                      </div>

                      <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />

                      <div className="at-options">
                        {item.question.options.map((option) => (
                          <label
                            className={`at-option ${item.selectedOption === option.number ? "at-option-on" : ""}`}
                            key={option.number}
                          >
                            <input
                              type="radio"
                              name={item.questionId}
                              checked={item.selectedOption === option.number}
                              onChange={() => selectOption(item.questionId, option.number)}
                            />
                            <ContentBlocks blocks={option.blocks} assets={item.question.assets} />
                          </label>
                        ))}
                      </div>
                    </section>
                  );
                })}

                <div>
                  <Button variant="primary" onClick={() => setConfirming(true)}>پایان و ثبت آزمون</Button>
                </div>
              </div>

              <aside className="at-side">
                <div className="at-palette">
                  <h2>سؤال‌ها</h2>
                  <div className="at-grid">
                    {attempt.items.map((item, index) => (
                      <a
                        className={`at-dot ${item.selectedOption !== null ? "at-dot-done" : ""} ${flagged.has(item.questionId) ? "at-dot-flag" : ""}`}
                        href={`#q-${index + 1}`}
                        key={item.questionId}
                        aria-label={`سؤال ${toPersianDigits(index + 1)}${item.selectedOption !== null ? "، پاسخ داده شده" : "، بی‌پاسخ"}`}
                      >
                        {toPersianDigits(index + 1)}
                      </a>
                    ))}
                  </div>
                  <div className="at-legend">
                    <span><i className="at-key at-key-done" />پاسخ داده شده</span>
                    <span><i className="at-key" />بی‌پاسخ</span>
                    <span><i className="at-key at-key-flag" />علامت‌دار برای مرور</span>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </DataState>
      </div>

      <ConfirmDialog
        open={confirming}
        title="ثبت نهایی آزمون؟"
        description={
          unanswered > 0
            ? `${toPersianDigits(unanswered)} سؤال بی‌پاسخ مانده است. پس از ثبت، امکان تغییر پاسخ‌ها نیست.`
            : "به همهٔ سؤال‌ها پاسخ داده‌اید. پس از ثبت، امکان تغییر پاسخ‌ها نیست."
        }
        confirmLabel="ثبت کن"
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
