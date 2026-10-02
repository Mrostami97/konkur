"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(hours > 0 ? 2 : 1, "0")}:${String(seconds).padStart(2, "0")}`;
  return toPersianDigits(hours > 0 ? `${hours}:${mmss}` : mmss);
}

/** Keys by physical position, so the shortcuts work on a Persian layout too. */
const OPTION_KEYS: Record<string, number> = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4,
  Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4,
};

/**
 * The exam sitting. It runs without the site's header, footer or tab bar
 * (see PublicChrome): under time pressure the only things on screen are the
 * questions, the clock, what is answered, and the way out.
 */
export default function AttemptPage({ params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = use(pendingParams);
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  /** Per-question save state. An answer that looks selected but never
   * reached the server would be lost without the candidate knowing. */
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

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

  const saveAnswer = useCallback(
    async (questionId: string, option: number | null) => {
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
    },
    [params.id],
  );

  const toggleFlag = useCallback((questionId: string) => {
    setFlagged((previous) => {
      const next = new Set(previous);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  const goTo = useCallback((index: number) => {
    const target = sectionRefs.current[index];
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
    setCurrent(index);
    setPaletteOpen(false);
  }, []);

  // The question in view is the one the keyboard answers.
  const itemCount = attempt?.items.length ?? 0;
  useEffect(() => {
    if (!itemCount) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const index = Number((visible[0]?.target as HTMLElement | undefined)?.dataset.index);
        if (!Number.isNaN(index)) setCurrent(index);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    sectionRefs.current.forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, [itemCount]);

  useEffect(() => {
    if (!attempt || confirming) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && (target as HTMLInputElement).type !== "radio") return;
      const item = attempt.items[current];
      if (!item) return;
      const option = OPTION_KEYS[event.code];
      if (option && item.question.options.some((row) => row.number === option)) {
        event.preventDefault();
        void saveAnswer(item.questionId, option);
      } else if ((event.code === "Digit0" || event.code === "Numpad0") && item.selectedOption !== null) {
        event.preventDefault();
        void saveAnswer(item.questionId, null);
      } else if (event.code === "KeyF") {
        event.preventDefault();
        toggleFlag(item.questionId);
      } else if (event.code === "KeyN" && current < attempt.items.length - 1) {
        event.preventDefault();
        goTo(current + 1);
      } else if (event.code === "KeyP" && current > 0) {
        event.preventDefault();
        goTo(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attempt, confirming, current, goTo, paletteOpen, saveAnswer, toggleFlag]);

  const answered = useMemo(
    () => (attempt?.items ?? []).filter((item) => item.selectedOption !== null).length,
    [attempt],
  );
  const total = attempt?.items.length ?? 0;
  const unanswered = total - answered;
  const flaggedCount = flagged.size;
  const failedSaves = Object.values(saveState).filter((state) => state === "failed").length;
  // Announced once per threshold, not every second.
  const stage = remaining > 0 && remaining <= 60 ? 2 : remaining > 0 && remaining <= 300 ? 1 : 0;
  const stageMessage = stage === 2 ? "کمتر از یک دقیقه مانده است." : stage === 1 ? "پنج دقیقه تا پایان آزمون مانده است." : "";

  const palette = attempt && (
    <div className="at-palette">
      <div className="at-palette-head">
        <h2>سؤال‌ها</h2>
        <button type="button" className="at-sheet-close" onClick={() => setPaletteOpen(false)} aria-label="بستن فهرست سؤال‌ها">
          ×
        </button>
      </div>
      <dl className="at-counts">
        <div><dt>پاسخ‌داده</dt><dd>{toPersianDigits(answered)}</dd></div>
        <div><dt>بی‌پاسخ</dt><dd>{toPersianDigits(unanswered)}</dd></div>
        <div><dt>علامت‌دار</dt><dd>{toPersianDigits(flaggedCount)}</dd></div>
      </dl>
      <div className="at-grid">
        {attempt.items.map((item, index) => {
          const done = item.selectedOption !== null;
          const isFlagged = flagged.has(item.questionId);
          return (
            <button
              type="button"
              className="at-dot"
              data-done={done || undefined}
              data-flag={isFlagged || undefined}
              aria-current={index === current ? "true" : undefined}
              key={item.questionId}
              onClick={() => goTo(index)}
              aria-label={`سؤال ${toPersianDigits(index + 1)}، ${done ? "پاسخ داده شده" : "بی‌پاسخ"}${isFlagged ? "، علامت‌دار" : ""}`}
            >
              {toPersianDigits(index + 1)}
            </button>
          );
        })}
      </div>
      <div className="at-legend" aria-hidden="true">
        <span><i className="at-key at-key-done" />پاسخ‌داده</span>
        <span><i className="at-key" />بی‌پاسخ</span>
        <span><i className="at-key at-key-flag" />علامت‌دار</span>
      </div>
      <div className="at-keys">
        <p>میان‌برها</p>
        <span><kbd>۱</kbd>–<kbd>۴</kbd> انتخاب گزینه</span>
        <span><kbd>۰</kbd> پاک کردن پاسخ</span>
        <span><kbd>F</kbd> علامت برای مرور</span>
        <span><kbd>N</kbd> / <kbd>P</kbd> سؤال بعد و قبل</span>
      </div>
    </div>
  );

  return (
    <main className="at">
      {attempt && (
        <header className="at-bar">
          <div className="at-bar-inner">
            <div className="at-title">
              <span className="at-brand">کنکور کامپیوتر · آزمون</span>
              <h1>{attempt.examTitle}</h1>
            </div>
            <div className="at-progress" aria-label={`${toPersianDigits(answered)} از ${toPersianDigits(total)} سؤال پاسخ داده شده`}>
              <span className="at-progress-text">
                <b>{toPersianDigits(answered)}</b> از {toPersianDigits(total)} پاسخ‌داده
              </span>
              <span className="at-progress-track" aria-hidden="true">
                <span style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
              </span>
            </div>
            <div className="at-clock" data-stage={stage || undefined}>
              <span>زمان باقی‌مانده</span>
              <strong className="tnum">{formatTime(remaining)}</strong>
            </div>
            <Button variant="primary" onClick={() => setConfirming(true)} className="at-finish">
              پایان آزمون
            </Button>
          </div>
          <p className="sr-only" aria-live="polite">{stageMessage}</p>
        </header>
      )}

      <div className="at-shell">
        <DataState loading={loading} error={error} onRetry={load} skeletonRows={4}>
          {attempt && (
            <div className="at-body">
              <div className="at-sheet">
                {failedSaves > 0 && (
                  <Alert tone="danger">
                    {toPersianDigits(failedSaves)} پاسخ روی سرور ثبت نشد. روی همان سؤال‌ها دوباره گزینه را انتخاب
                    کنید تا ذخیره شوند.
                  </Alert>
                )}
                {submitError && <Alert tone="danger">{submitError}</Alert>}

                {attempt.items.map((item, index) => {
                  const state = saveState[item.questionId];
                  const isFlagged = flagged.has(item.questionId);
                  return (
                    <section
                      className="at-q"
                      id={`q-${index + 1}`}
                      key={item.questionId}
                      data-index={index}
                      data-current={index === current || undefined}
                      ref={(node) => {
                        sectionRefs.current[index] = node;
                      }}
                      tabIndex={-1}
                      aria-labelledby={`q-${index + 1}-n`}
                    >
                      <div className="at-q-head">
                        <span className="at-q-n" id={`q-${index + 1}-n`}>
                          سؤال {toPersianDigits(index + 1)}
                        </span>
                        <span className="at-q-tools">
                          <span className="at-save" data-state={state} role={state === "failed" ? "alert" : undefined}>
                            {state === "saving" ? "در حال ذخیره…" : state === "saved" ? "ذخیره شد" : state === "failed" ? "ذخیره نشد" : ""}
                          </span>
                          {item.selectedOption !== null && (
                            <button type="button" className="at-tool" onClick={() => saveAnswer(item.questionId, null)}>
                              پاک کردن پاسخ
                            </button>
                          )}
                          <button
                            type="button"
                            className="at-tool"
                            data-on={isFlagged || undefined}
                            onClick={() => toggleFlag(item.questionId)}
                            aria-pressed={isFlagged}
                          >
                            {isFlagged ? "علامت‌دار" : "علامت برای مرور"}
                          </button>
                        </span>
                      </div>

                      <div className="at-stem">
                        <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />
                      </div>

                      <div className="at-options" role="radiogroup" aria-labelledby={`q-${index + 1}-n`}>
                        {item.question.options.map((option) => {
                          const on = item.selectedOption === option.number;
                          return (
                            <label className="at-option" data-on={on || undefined} key={option.number}>
                              <input
                                type="radio"
                                className="sr-only"
                                name={item.questionId}
                                checked={on}
                                onChange={() => saveAnswer(item.questionId, option.number)}
                              />
                              <span className="at-opt-n" aria-hidden="true">{toPersianDigits(option.number)}</span>
                              <span className="at-opt-body">
                                <ContentBlocks blocks={option.blocks} assets={item.question.assets} />
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}

                <div className="at-end">
                  <p>
                    {unanswered > 0
                      ? `${toPersianDigits(unanswered)} سؤال بی‌پاسخ مانده؛ پاسخ غلط نمرهٔ منفی دارد، پس بی‌پاسخ گذاشتن هم یک تصمیم است.`
                      : "به همهٔ سؤال‌ها پاسخ داده‌ای."}
                  </p>
                  <Button variant="primary" onClick={() => setConfirming(true)}>پایان و ثبت آزمون</Button>
                </div>
              </div>

              <aside className="at-side" data-open={paletteOpen || undefined} aria-label="فهرست سؤال‌ها">
                {palette}
              </aside>
              {paletteOpen && (
                <button type="button" className="at-scrim" onClick={() => setPaletteOpen(false)} aria-label="بستن فهرست سؤال‌ها" />
              )}
            </div>
          )}
        </DataState>
      </div>

      {attempt && (
        <nav className="at-dock" aria-label="حرکت بین سؤال‌ها">
          <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0}>قبلی</button>
          <button type="button" className="at-dock-main" onClick={() => setPaletteOpen(true)} aria-expanded={paletteOpen}>
            سؤال {toPersianDigits(current + 1)} از {toPersianDigits(total)}
            <small>{toPersianDigits(answered)} پاسخ‌داده</small>
          </button>
          <button type="button" onClick={() => goTo(current + 1)} disabled={current >= total - 1}>بعدی</button>
        </nav>
      )}

      <ConfirmDialog
        open={confirming}
        title="ثبت نهایی آزمون؟"
        description={
          unanswered > 0
            ? `${toPersianDigits(unanswered)} سؤال بی‌پاسخ${flaggedCount > 0 ? ` و ${toPersianDigits(flaggedCount)} سؤال علامت‌دار` : ""} مانده است. پس از ثبت، امکان تغییر پاسخ‌ها نیست.`
            : flaggedCount > 0
              ? `به همهٔ سؤال‌ها پاسخ داده‌ای، اما ${toPersianDigits(flaggedCount)} سؤال را برای مرور علامت زده‌ای. پس از ثبت، امکان تغییر پاسخ‌ها نیست.`
              : "به همهٔ سؤال‌ها پاسخ داده‌ای. پس از ثبت، امکان تغییر پاسخ‌ها نیست."
        }
        confirmLabel="ثبت کن"
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
