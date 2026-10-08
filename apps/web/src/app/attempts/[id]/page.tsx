"use client";

import { useRouter } from "next/navigation";
import { Fragment, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { ContentBlocks } from "../../../components/ContentBlocks";
import { Alert, Button, ConfirmDialog, DataState } from "../../../components/ds";
import { ExamCoach, PaceSummary, type CoachItem, type PacePoint } from "./ExamCoach";
import "./attempt.css";
import "./coach.css";

interface Block { type: string; [key: string]: unknown }
interface Option { number: number; blocks: Block[] }

interface Item {
  questionId: string;
  order: number;
  points: number;
  sectionId: string | null;
  flagged: boolean;
  question: {
    id: string;
    subjectCode: string;
    passage: { externalId: string; blocks: Block[] } | null;
    stemBlocks: Block[];
    options: Option[];
    assets: { media_key: string; checksum: string }[];
  };
  selectedOption: number | null;
  /** Time already recorded for this question, from earlier on this attempt. */
  timeSpentMs?: number;
  /** When the answer now chosen was given. */
  answeredAt?: string | null;
}

interface AttemptState {
  id: string;
  examTitle: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  remainingSeconds: number;
  startedAt: string;
  deadlineAt: string;
  sections: { id: string; title: string; order: number }[];
  items: Item[];
}

/** How often the time spent per question and the flags are sent. */
const ACTIVITY_FLUSH_MS = 15_000;
/** How often an answer that failed to save is tried again. */
const RETRY_MS = 5_000;

/** The English section reads left to right, punctuation included. */
const textDirection = (subjectCode: string) => (subjectCode === "english" ? { dir: "ltr" as const, lang: "en" } : {});

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
  /** Not yet reported: milliseconds per question, and flag changes. */
  const pendingTime = useRef(new Map<string, number>());
  const pendingFlags = useRef(new Map<string, boolean>());
  /** Answers the server has not confirmed, tried again until it does. */
  const unsaved = useRef(new Map<string, number | null>());
  const currentQuestion = useRef<string | null>(null);
  const [online, setOnline] = useState(true);
  /** Seconds on each question in this tab, on top of what the server recorded. */
  const [liveSpent, setLiveSpent] = useState<Record<string, number>>({});
  const [sideTab, setSideTab] = useState<"map" | "time">("map");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AttemptState>(`/attempts/${params.id}`);
      setAttempt(data);
      setRemaining(data.remainingSeconds);
      setFlagged(new Set(data.items.filter((item) => item.flagged).map((item) => item.questionId)));
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

  /** Sends the time spent and flag changes gathered since the last report. A
   * failed report keeps its entries for the next one. */
  const flushActivity = useCallback(
    async (keepalive = false) => {
      const ids = new Set([...pendingTime.current.keys(), ...pendingFlags.current.keys()]);
      if (ids.size === 0) return;
      const entries = [...ids].map((questionId) => ({
        questionId,
        timeSpentMs: Math.round(pendingTime.current.get(questionId) ?? 0),
        ...(pendingFlags.current.has(questionId) ? { flagged: pendingFlags.current.get(questionId) } : {}),
      }));
      pendingTime.current.clear();
      pendingFlags.current.clear();
      try {
        await apiFetch(`/attempts/${params.id}/activity`, { method: "POST", body: { entries }, keepalive });
      } catch {
        for (const entry of entries) {
          pendingTime.current.set(entry.questionId, (pendingTime.current.get(entry.questionId) ?? 0) + entry.timeSpentMs);
          if (entry.flagged !== undefined && !pendingFlags.current.has(entry.questionId)) pendingFlags.current.set(entry.questionId, entry.flagged);
        }
      }
    },
    [params.id],
  );

  /** Tries every unconfirmed answer once more; returns how many still failed. */
  const retryUnsaved = useCallback(async () => {
    for (const [questionId, option] of [...unsaved.current]) {
      setSaveState((previous) => ({ ...previous, [questionId]: "saving" }));
      try {
        await apiFetch(`/attempts/${params.id}/answers/${questionId}`, { method: "PUT", body: { selectedOption: option } });
        if (unsaved.current.get(questionId) === option) unsaved.current.delete(questionId);
        setSaveState((previous) => ({ ...previous, [questionId]: "saved" }));
      } catch (err) {
        // The attempt is over: nothing more will be accepted.
        if (err instanceof ApiError && err.status === 403) unsaved.current.clear();
        setSaveState((previous) => ({ ...previous, [questionId]: "failed" }));
      }
    }
    return unsaved.current.size;
  }, [params.id]);

  const submit = useCallback(async (manual = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      // Answers and time first: a submit must not leave anything behind.
      const stillUnsaved = await retryUnsaved();
      if (manual && stillUnsaved > 0) {
        submittingRef.current = false;
        setConfirming(false);
        setSubmitError(`${toPersianDigits(stillUnsaved)} پاسخ هنوز به سرور نرسیده. اتصال اینترنت را بررسی کن و دوباره «پایان آزمون» را بزن؛ پاسخ‌ها مدام دوباره فرستاده می‌شوند.`);
        return;
      }
      await flushActivity();
      await apiFetch(`/attempts/${params.id}/submit`, { method: "POST" });
      router.push(`/attempts/${params.id}/report`);
    } catch (err) {
      submittingRef.current = false;
      setConfirming(false);
      setSubmitError(err instanceof Error ? err.message : "ثبت آزمون ناموفق بود. دوباره تلاش کنید.");
    }
  }, [flushActivity, params.id, retryUnsaved, router]);

  // Time on the question in view, while the page is visible; reported in
  // batches, and once more when the page is hidden or closed.
  const attemptId = attempt?.id;
  const inProgress = attempt?.status === "IN_PROGRESS";
  useEffect(() => {
    if (!attemptId || !inProgress) return;
    let last = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      const id = currentQuestion.current;
      if (id && document.visibilityState === "visible") {
        const step = Math.min(now - last, 5_000);
        pendingTime.current.set(id, (pendingTime.current.get(id) ?? 0) + step);
        setLiveSpent((previous) => ({ ...previous, [id]: (previous[id] ?? 0) + step / 1000 }));
      }
      last = now;
    }, 1_000);
    const flush = setInterval(() => void flushActivity(), ACTIVITY_FLUSH_MS);
    const retry = setInterval(() => {
      if (unsaved.current.size > 0) void retryUnsaved();
    }, RETRY_MS);
    const onHidden = () => {
      if (document.visibilityState === "hidden") void flushActivity(true);
    };
    const onPageHide = () => void flushActivity(true);
    const onOnline = () => {
      setOnline(true);
      void retryUnsaved();
    };
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(tick);
      clearInterval(flush);
      clearInterval(retry);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [attemptId, inProgress, flushActivity, retryUnsaved]);

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
                item.questionId === questionId
                  ? { ...item, selectedOption: option, answeredAt: option === null ? null : new Date().toISOString() }
                  : item,
              ),
            }
          : previous,
      );
      setSaveState((previous) => ({ ...previous, [questionId]: "saving" }));
      unsaved.current.set(questionId, option);
      try {
        await apiFetch(`/attempts/${params.id}/answers/${questionId}`, {
          method: "PUT",
          body: { selectedOption: option },
        });
        // A newer choice made meanwhile is still waiting for its own save.
        if (unsaved.current.get(questionId) === option) unsaved.current.delete(questionId);
        setSaveState((previous) => ({ ...previous, [questionId]: "saved" }));
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) unsaved.current.delete(questionId);
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
      pendingFlags.current.set(questionId, next.has(questionId));
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

  useEffect(() => {
    currentQuestion.current = attempt?.items[current]?.questionId ?? null;
  }, [attempt, current]);

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
  const duration = attempt ? Math.max(1, Math.round((Date.parse(attempt.deadlineAt) - Date.parse(attempt.startedAt)) / 1000)) : 0;
  const elapsed = Math.max(0, duration - remaining);
  /** The pace so far: each answer now on the sheet at the moment it was given. */
  const trail: PacePoint[] = useMemo(() => {
    if (!attempt) return [];
    const start = Date.parse(attempt.startedAt);
    const times = attempt.items
      .filter((item) => item.selectedOption !== null && item.answeredAt)
      .map((item) => Math.max(0, (Date.parse(item.answeredAt!) - start) / 1000))
      .sort((a, b) => a - b);
    return times.map((t, i) => [Math.round(t), i + 1] as PacePoint);
  }, [attempt]);

  const coachItems: CoachItem[] = useMemo(
    () =>
      (attempt?.items ?? []).map((item, index) => ({
        index,
        sectionId: item.sectionId,
        subjectCode: item.question.subjectCode,
        answered: item.selectedOption !== null,
        flagged: flagged.has(item.questionId),
        spent: (item.timeSpentMs ?? 0) / 1000 + (liveSpent[item.questionId] ?? 0),
      })),
    [attempt, flagged, liveSpent],
  );
  const unanswered = total - answered;
  const flaggedCount = flagged.size;
  const failedSaves = Object.values(saveState).filter((state) => state === "failed").length;
  const sectionTitle = useMemo(() => new Map((attempt?.sections ?? []).map((section) => [section.id, section.title])), [attempt]);
  /** Question numbers sharing each reading passage, for its heading. */
  const passageRange = useMemo(() => {
    const ranges = new Map<string, { first: number; last: number }>();
    (attempt?.items ?? []).forEach((item, index) => {
      const key = item.question.passage?.externalId;
      if (!key) return;
      const range = ranges.get(key);
      ranges.set(key, range ? { ...range, last: index + 1 } : { first: index + 1, last: index + 1 });
    });
    return ranges;
  }, [attempt]);
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
      <PaceSummary elapsed={elapsed} duration={duration} answered={answered} total={total} remaining={remaining} />
      <dl className="at-counts">
        <div><dt>پاسخ‌داده</dt><dd>{toPersianDigits(answered)}</dd></div>
        <div><dt>بی‌پاسخ</dt><dd>{toPersianDigits(unanswered)}</dd></div>
        <div><dt>علامت‌دار</dt><dd>{toPersianDigits(flaggedCount)}</dd></div>
      </dl>
      <div className="at-tabs" role="tablist" aria-label="نمای کناری">
        <button type="button" role="tab" aria-selected={sideTab === "map"} onClick={() => setSideTab("map")}>نقشهٔ سؤال‌ها</button>
        <button type="button" role="tab" aria-selected={sideTab === "time"} onClick={() => setSideTab("time")}>تحلیل زمان</button>
      </div>
      {sideTab === "time" ? (
        <ExamCoach
          items={coachItems}
          sections={attempt.sections}
          trail={trail}
          elapsed={elapsed}
          duration={duration}
          remaining={remaining}
          current={current}
          onGo={goTo}
        />
      ) : (
      <>
      <div className="at-grid">
        {attempt.items.map((item, index) => {
          const done = item.selectedOption !== null;
          const isFlagged = flagged.has(item.questionId);
          const newSection = item.sectionId && item.sectionId !== attempt.items[index - 1]?.sectionId;
          return (
            <Fragment key={item.questionId}>
            {newSection && <span className="at-grid-section">{sectionTitle.get(item.sectionId!)}</span>}
            <button
              type="button"
              className="at-dot"
              data-done={done || undefined}
              data-flag={isFlagged || undefined}
              aria-current={index === current ? "true" : undefined}
              onClick={() => goTo(index)}
              aria-label={`سؤال ${toPersianDigits(index + 1)}، ${done ? "پاسخ داده شده" : "بی‌پاسخ"}${isFlagged ? "، علامت‌دار" : ""}`}
            >
              {toPersianDigits(index + 1)}
            </button>
            </Fragment>
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
      </>
      )}
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
              <svg className="at-ring" viewBox="0 0 36 36" aria-hidden="true">
                <circle className="at-ring-track" cx="18" cy="18" r="15" />
                <circle
                  className="at-ring-fill"
                  cx="18"
                  cy="18"
                  r="15"
                  pathLength={100}
                  strokeDasharray={`${duration ? (remaining / duration) * 100 : 0} 100`}
                />
              </svg>
              <span className="at-clock-text">
                <span>زمان باقی‌مانده</span>
                <strong className="tnum">{formatTime(remaining)}</strong>
              </span>
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
                {!online && (
                  <Alert tone="warning">
                    اینترنت قطع است. به آزمون ادامه بده؛ پاسخ‌هایت روی همین صفحه می‌مانند و با وصل شدن خودکار ذخیره می‌شوند.
                  </Alert>
                )}
                {failedSaves > 0 && online && (
                  <Alert tone="danger">
                    {toPersianDigits(failedSaves)} پاسخ هنوز روی سرور ثبت نشده؛ هر چند ثانیه خودکار دوباره فرستاده می‌شود.
                  </Alert>
                )}
                {submitError && <Alert tone="danger">{submitError}</Alert>}

                {attempt.items.map((item, index) => {
                  const state = saveState[item.questionId];
                  const isFlagged = flagged.has(item.questionId);
                  const newSection = item.sectionId && item.sectionId !== attempt.items[index - 1]?.sectionId;
                  const passage = item.question.passage;
                  const range = passage ? passageRange.get(passage.externalId) : undefined;
                  const firstOfPassage = !!passage && passage.externalId !== attempt.items[index - 1]?.question.passage?.externalId;
                  const direction = textDirection(item.question.subjectCode);
                  return (
                    <Fragment key={item.questionId}>
                    {newSection && <h2 className="at-section">{sectionTitle.get(item.sectionId!)}</h2>}
                    <section
                      className="at-q"
                      id={`q-${index + 1}`}
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

                      {passage && range && (
                        <details className="at-passage" open={firstOfPassage} {...direction}>
                          <summary>
                            متن مشترک سؤال‌های {toPersianDigits(range.first)} تا {toPersianDigits(range.last)}
                          </summary>
                          <ContentBlocks blocks={passage.blocks} assets={item.question.assets} />
                        </details>
                      )}

                      <div className="at-stem" {...direction}>
                        <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />
                      </div>

                      <div className="at-options" role="radiogroup" aria-labelledby={`q-${index + 1}-n`} {...direction}>
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
                    </Fragment>
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
        onConfirm={() => void submit(true)}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
