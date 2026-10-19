"use client";

import Link from "next/link";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type MouseEvent } from "react";
import { apiFetch } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { ContentBlocks } from "../../components/ContentBlocks";
import { Glyph } from "../../components/SubjectIcon";
import { tidyQuestionBlocks } from "../../lib/question-text";
import { fieldLabel } from "../account/profile-options";
import { topicPlace } from "../../lib/syllabus";
import type { ReadingLink } from "../../content/article-topics";
import { CONFIDENCE, HistoryMarks, REASONS, historySentence, type Confidence, type History, type Outcome } from "./practice";

export interface Block {
  type: string;
  [key: string]: unknown;
}

export interface QuestionOption {
  number: number;
  blocks: Block[];
}

/**
 * A question as the API sends it. Everything below `version` is optional:
 * the API decides server-side how much a caller may see
 * (question-bank.service.ts), and a locked question arrives as metadata
 * alone -- no stem, options or key -- so nothing is fetched and then hidden.
 */
export interface BankQuestion {
  id: string;
  subjectCode: string;
  examDegree?: string;
  examMajor: string;
  examYear: number;
  questionNumber?: number | null;
  topicCodes?: string[];
  isSample: boolean;
  version?: number;
  createdAt?: string;
  passage?: { externalId: string; blocks: Block[] } | null;
  assets?: { media_key: string; checksum: string }[];
  stemBlocks?: Block[];
  options?: QuestionOption[];
  correctOption?: number;
  /** Every option the final key accepts, when more than one. */
  acceptedOptions?: number[];
  /** DELETED: the board removed it; POSITIVE_EFFECT: a wrong answer costs nothing. */
  keyState?: "NORMAL" | "DELETED" | "POSITIVE_EFFECT";
  solutionBlocks?: Block[];
  solutionHint?: string | null;
  solutionShortcut?: string | null;
  labels?: { chapter?: string; topic?: string } | null;
  keySource?: "official" | "authored" | null;
}

export const isOpen = (question: BankQuestion) => Boolean(question.stemBlocks && question.options);

/** «کنکور ۱۳۹۶ · سؤال ۱۶۵» */
export function examLine(question: BankQuestion) {
  return `کنکور ${question.examDegree === "PHD" ? "دکتری " : ""}${toPersianDigits(question.examYear)}${
    question.questionNumber ? ` · سؤال ${toPersianDigits(question.questionNumber)}` : ""
  }`;
}

/** Roughly how long an option reads once its formula is typeset. */
function visibleLength(blocks: Block[]) {
  return blocks
    .map((block) => String(block.text ?? ""))
    .join(" ")
    // Typewriter text (code in an option) keeps its spaces and sets wide; it never wraps.
    .replace(/\\texttt\{([^}]*)\}/g, (_, code: string) => code + code.slice(0, Math.ceil(code.length / 2)))
    .replace(/\\(?:frac|dfrac|tfrac|mathrm|mathbf|text|operatorname)\s*\{?/g, "")
    .replace(/\\[a-zA-Z]+/g, "x")
    .replace(/[{}$^_\\]/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * How the four options sit: one row when all are short («C++», «$\frac56n$»),
 * two by two when medium, one under another when long or holding a figure or
 * code -- so a question with short options never spends a screen on them.
 */
export function optionLayout(options: QuestionOption[]): "row" | "grid" | "stack" {
  const texts = options.map((option) => option.blocks.map((block) => String(block.text ?? "")).join("\n"));
  if (texts.some((text) => text.includes("```"))) {
    // Code options sit side by side when their lines fit half the card.
    const widest = Math.max(...texts.flatMap((text) => text.replace(/```[^\n]*/g, "").split("\n").map((line) => line.length)));
    return widest <= 44 ? "grid" : "stack";
  }
  if (texts.some((text) => text.includes("\n"))) return "stack";
  const longest = Math.max(...options.map((option) => visibleLength(option.blocks)));
  // A figure option (a cropped formula or line of code) sits two by two unless its text runs long.
  if (options.some((option) => option.blocks.some((block) => block.type !== "text"))) return "grid";
  if (longest <= 16) return "row";
  if (longest <= 48) return "grid";
  return "stack";
}

/**
 * An option that carries its booklet crop shows the crop alone: the typed
 * text beside it is a transcription of the same formula or code, and set
 * right-to-left it reads jumbled. The text stays as the image's alt text.
 */
function optionBlocks(blocks: Block[]): Block[] {
  if (!blocks.some((block) => block.type === "image")) return blocks;
  const text = blocks
    .filter((block) => block.type === "text")
    .map((block) => String(block.text ?? ""))
    .join(" ");
  return blocks.filter((block) => block.type !== "text").map((block) => (block.type === "image" && !block.alt ? { ...block, alt: text } : block));
}

export interface CardHandle {
  pick: (option: number) => void;
  check: () => void;
  hint: () => void;
  star: () => void;
}

interface CardProps {
  question: BankQuestion;
  subjectTitle: string;
  /** The row number on the sheet; absent on a question's own page. */
  position?: number;
  /** null when signed out: answers are checked but not kept. */
  history: History | null;
  onHistory?: (history: History) => void;
  /** Called once an answer is checked, for the sheet's map of the page. */
  onOutcome?: (id: string, outcome: Outcome) => void;
  active?: boolean;
  onActivate?: () => void;
  /** Lesson notes and test articles for this question's chapter. */
  reading?: ReadingLink[];
  /** Open the shared passage at first (the first question of its group). */
  passageOpen?: boolean;
}

/**
 * One question as a study card: header line, stem, options laid out by their
 * length, and one action bar. The solution opens in tabs under the card
 * instead of stacking down the page, and figures never grow past a third of
 * the screen (tap to zoom) -- so a question and its options fit one screen.
 */
export const QuestionCard = forwardRef<CardHandle, CardProps>(function QuestionCard(
  { question, subjectTitle, position, history, onHistory, onOutcome, active, onActivate, reading, passageOpen },
  ref,
) {
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [tab, setTab] = useState<"shortcut" | "solution" | "note" | null>(null);
  const [wrongAnswerId, setWrongAnswerId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState(history?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => setNote(history?.note ?? ""), [history?.note]);
  // The clock starts when the student reaches the question, not when the page loaded.
  useEffect(() => {
    if (active && startedAt.current === null) startedAt.current = Date.now();
  }, [active]);

  const deleted = question.keyState === "DELETED";
  const keyOptions = [...new Set([question.correctOption, ...(question.acceptedOptions ?? [])].filter((n): n is number => typeof n === "number"))].sort();
  const hasKey = question.correctOption !== undefined;
  const correct = checked && picked !== null && !deleted && keyOptions.includes(picked);
  const place = topicPlace(question.subjectCode, question.topicCodes?.[0]);
  const longStem = (question.stemBlocks ?? []).reduce((sum, block) => sum + String(block.text ?? "").length, 0) > 420;
  const hasSolution = Boolean(question.solutionBlocks?.length);
  const layout = question.options ? optionLayout(question.options) : "stack";

  async function check() {
    if (!hasKey || picked === null || checked) return;
    setChecked(true);
    const local: Outcome = deleted ? "VOID" : keyOptions.includes(picked) ? "CORRECT" : "WRONG";
    // A wrong answer opens the quick way at once; a right one leaves the solution a tap away.
    if (local === "WRONG") setTab(question.solutionShortcut ? "shortcut" : hasSolution ? "solution" : null);
    onOutcome?.(question.id, local);
    if (!history) return;
    try {
      const spent = Date.now() - (startedAt.current ?? Date.now());
      const saved = await apiFetch<{ answerId: string; outcome: Outcome; history: History }>(`/questions/${question.id}/practice`, {
        method: "POST",
        body: { selectedOption: picked, ...(confidence ? { confidence } : {}), timeSpentMs: Math.min(spent, 6 * 3600 * 1000) },
      });
      onHistory?.(saved.history);
      setWrongAnswerId(saved.outcome === "WRONG" ? saved.answerId : null);
    } catch {
      // The key is already on screen; a failed save only means this try is not in the history.
    }
  }

  function retry() {
    setChecked(false);
    setPicked(null);
    setConfidence(null);
    setHintOpen(false);
    setTab(null);
    setWrongAnswerId(null);
    setReason(null);
    startedAt.current = Date.now();
  }

  async function mark(body: { starred?: boolean; note?: string | null }) {
    if (!history) return;
    setSaving(true);
    try {
      const saved = await apiFetch<{ starred: boolean; note: string | null }>(`/questions/${question.id}/mark`, { method: "PUT", body });
      onHistory?.({ ...history, ...saved });
    } finally {
      setSaving(false);
    }
  }

  async function pickReason(value: string) {
    if (!wrongAnswerId) return;
    const next = reason === value ? null : value;
    setReason(next);
    await apiFetch(`/questions/practice-answers/${wrongAnswerId}`, { method: "PATCH", body: { errorReason: next } }).catch(() => setReason(reason));
  }

  useImperativeHandle(ref, () => ({
    pick: (option) => {
      if (!checked && question.options?.some((item) => item.number === option)) setPicked(option);
    },
    check: () => void check(),
    hint: () => {
      if (question.solutionHint && !checked) setHintOpen((open) => !open);
    },
    star: () => void mark({ starred: !history?.starred }),
  }));

  /** A figure in the stem or an option opens large. */
  function onBodyClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLImageElement) {
      event.preventDefault();
      event.stopPropagation();
      setZoom(target.currentSrc || target.src);
    }
  }

  const verdict = deleted
    ? "این تست در کلید نهایی حذف شد؛ برای هیچ پاسخی نمره‌ای داده یا کم نشد."
    : correct
      ? keyOptions.length > 1
        ? `درست است. کلید نهایی گزینه‌های ${keyOptions.map((n) => toPersianDigits(n)).join(" و ")} را پذیرفت.`
        : "درست است."
      : keyOptions.length > 1
        ? `نادرست؛ کلید نهایی گزینه‌های ${keyOptions.map((n) => toPersianDigits(n)).join(" و ")} را پذیرفت.`
        : `نادرست؛ پاسخ درست گزینهٔ ${toPersianDigits(question.correctOption ?? 0)} است.`;

  const topicHref = place
    ? `/questions?subject=${encodeURIComponent(question.subjectCode)}&topic=${encodeURIComponent(place.topic.code)}`
    : `/questions?subject=${encodeURIComponent(question.subjectCode)}`;

  return (
    <article
      className="qc"
      data-active={active || undefined}
      data-state={checked ? (deleted ? "void" : correct ? "right" : "wrong") : undefined}
      aria-label={`${subjectTitle} · ${examLine(question)}`}
      onPointerDown={onActivate}
      onFocusCapture={onActivate}
    >
      <header className="qc-head">
        {position !== undefined && <span className="qc-n tnum">{toPersianDigits(position)}</span>}
        <span className="qc-exam">
          <Link href={`/questions/${question.id}`}>{examLine(question)}</Link>
          <span className="qc-track">{fieldLabel(question.examMajor)}</span>
        </span>
        <Link className="qc-topic" href={topicHref} title={place ? `${place.chapter.title} › ${place.topic.title}` : subjectTitle}>
          {place ? place.topic.title : subjectTitle}
        </Link>
        <span className="qc-badges">
          {question.isSample && <span className="qc-badge" data-tone="free">نمونهٔ رایگان</span>}
          {history && history.seen > 0 && (
            <span className="qc-history" title={historySentence(history)}>
              <HistoryMarks outcomes={history.outcomes.slice(-4)} />
            </span>
          )}
          {history && (
            <button
              type="button"
              className="qc-star"
              aria-pressed={history.starred}
              aria-label={history.starred ? "برداشتن ستاره" : "ستاره بزن"}
              title={history.starred ? "ستاره‌دار (S)" : "ستاره بزن (S)"}
              disabled={saving}
              onClick={() => void mark({ starred: !history.starred })}
            >
              <Glyph name="star" />
            </button>
          )}
        </span>
      </header>

      {question.passage?.blocks?.length ? (
        <details className="qc-passage" open={passageOpen}>
          <summary>متن مشترک این سؤال</summary>
          <div onClick={onBodyClick}>
            <ContentBlocks blocks={tidyQuestionBlocks(question.passage.blocks)} assets={question.assets} />
          </div>
        </details>
      ) : null}

      <div className="qc-body" onClick={onBodyClick}>
        <div className="qc-stem" data-long={longStem || undefined}>
          <ContentBlocks blocks={tidyQuestionBlocks(question.stemBlocks ?? [])} assets={question.assets} />
        </div>
        <div className="qc-options" data-layout={layout} role="radiogroup" aria-label="گزینه‌ها">
          {question.options?.map((option) => {
            const isKey = checked && !deleted && keyOptions.includes(option.number);
            const isWrongPick = checked && !deleted && option.number === picked && !keyOptions.includes(option.number);
            return (
              <button
                type="button"
                role="radio"
                aria-checked={picked === option.number}
                className="qc-opt"
                data-picked={(!checked && picked === option.number) || undefined}
                data-correct={isKey || undefined}
                data-wrong={isWrongPick || undefined}
                disabled={checked}
                onClick={() => setPicked(option.number)}
                key={option.number}
              >
                <span className="qc-opt-n" aria-hidden="true">{toPersianDigits(option.number)}</span>
                <span className="qc-opt-body">
                  <ContentBlocks blocks={optionBlocks(option.blocks)} assets={question.assets} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {hasKey && (
        <div className="qc-bar">
          {!checked ? (
            <>
              {history && (
                <div className="qc-conf" role="group" aria-label="چقدر مطمئنی؟">
                  {CONFIDENCE.map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      aria-pressed={confidence === item.value}
                      onClick={() => setConfidence((current) => (current === item.value ? null : item.value))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              <span className="qc-bar-end">
                {question.solutionHint && (
                  <button type="button" className="qc-ghost" aria-expanded={hintOpen} aria-label="سرنخ (H)" title="سرنخ (H)" onClick={() => setHintOpen((open) => !open)}>
                    <Glyph name="hint" />
                    <span className="qc-ghost-label">سرنخ</span>
                  </button>
                )}
                <button type="button" className="ds-btn ds-btn-primary ds-btn-sm qc-check" disabled={picked === null} onClick={() => void check()}>
                  بررسی پاسخ
                </button>
              </span>
            </>
          ) : (
            <>
              <p className="qc-verdict" role="status">
                <Glyph name={deleted ? "doc" : correct ? "checkCircle" : "closeCircle"} />
                <span>
                  {verdict}
                  {question.keyState === "POSITIVE_EFFECT" && " این تست «تأثیر مثبت» دارد: پاسخ غلط نمرهٔ منفی ندارد."}
                </span>
              </p>
              <span className="qc-bar-end">
                {!deleted && question.keySource && (
                  <span className="qc-badge" data-tone={question.keySource === "authored" ? "warn" : "free"}>
                    {question.keySource === "official" ? "کلید رسمی سنجش" : "پاسخ کنکور کامپیوتر"}
                  </span>
                )}
                <button type="button" className="qc-ghost" onClick={retry}>
                  <Glyph name="restart" />
                  دوباره
                </button>
              </span>
            </>
          )}
        </div>
      )}

      {hintOpen && !checked && question.solutionHint && (
        <div className="qc-hint" role="note">
          <ContentBlocks blocks={[{ type: "text", text: question.solutionHint }]} />
        </div>
      )}

      {checked && wrongAnswerId && (
        <div className="qc-reasons" role="group" aria-label="چرا غلط زدی؟">
          <span>چرا غلط زدی؟</span>
          {REASONS.map((item) => (
            <button type="button" key={item.value} aria-pressed={reason === item.value} onClick={() => void pickReason(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {checked && (question.solutionShortcut || hasSolution || history || reading?.length) && (
        <div className="qc-more">
          <div className="qc-tabs" role="tablist" aria-label="بعد از پاسخ">
            {question.solutionShortcut && (
              <button type="button" role="tab" aria-selected={tab === "shortcut"} onClick={() => setTab(tab === "shortcut" ? null : "shortcut")}>
                <Glyph name="bolt" />
                راه سریع
              </button>
            )}
            {hasSolution && (
              <button type="button" role="tab" aria-selected={tab === "solution"} onClick={() => setTab(tab === "solution" ? null : "solution")}>
                <Glyph name="doc" />
                حل کامل
              </button>
            )}
            {history && (
              <button type="button" role="tab" aria-selected={tab === "note"} onClick={() => setTab(tab === "note" ? null : "note")}>
                <Glyph name="note" />
                {history.note ? "یادداشت من" : "یادداشت"}
              </button>
            )}
            {!question.solutionShortcut && !hasSolution && <span className="qc-nosol">حل تشریحی این تست هنوز نوشته نشده است.</span>}
          </div>

          {tab === "shortcut" && question.solutionShortcut && (
            <div className="qc-panel" role="tabpanel">
              <ContentBlocks blocks={[{ type: "text", text: question.solutionShortcut }]} />
            </div>
          )}
          {tab === "solution" && hasSolution && (
            <div className="qc-panel" role="tabpanel" onClick={onBodyClick}>
              {question.labels?.topic && <p className="qc-about">این تست دربارهٔ: {question.labels.topic}</p>}
              <ContentBlocks blocks={question.solutionBlocks!} assets={question.assets} />
            </div>
          )}
          {tab === "note" && history && (
            <form
              className="qc-panel qc-note"
              role="tabpanel"
              onSubmit={(event) => {
                event.preventDefault();
                void mark({ note: note.trim() || null }).then(() => setTab(null));
              }}
            >
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} placeholder="نکته‌ای که نمی‌خواهی دوباره فراموش کنی" />
              <button type="submit" className="ds-btn ds-btn-primary ds-btn-sm" disabled={saving}>ذخیره</button>
            </form>
          )}

          {reading && reading.length > 0 && (
            <p className="qc-read">
              <span>برای همین فصل بخوان:</span>
              {reading.slice(0, 3).map((link) => (
                <Link key={link.slug} href={`/articles/${link.slug}`} data-kind={link.kind}>{link.title}</Link>
              ))}
            </p>
          )}
        </div>
      )}

      {zoom && (
        <div className="qc-zoom" role="dialog" aria-modal="true" aria-label="تصویر بزرگ" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" />
          <button type="button" className="qc-zoom-close" aria-label="بستن" onClick={() => setZoom(null)}>×</button>
        </div>
      )}
    </article>
  );
});

/** A run of questions this visitor cannot open, shown once instead of as empty cards. */
export function LockedRun({
  questions,
  subjectTitle,
  startAt,
  signedOut,
}: {
  questions: BankQuestion[];
  subjectTitle: (code: string) => string;
  startAt: number;
  /** A signed-out visitor may already own the bank: offer to sign in first. */
  signedOut: boolean;
}) {
  const subjects = [...new Set(questions.map((question) => question.subjectCode))];
  return (
    <section className="qc-locked" aria-label="تست‌های قفل">
      <span className="qc-locked-icon"><Glyph name="lock" /></span>
      <div>
        <p className="qc-locked-title">
          {questions.length === 1 ? "تست " : "تست‌های "}
          <span className="tnum">
            {toPersianDigits(startAt)}
            {questions.length > 1 ? ` تا ${toPersianDigits(startAt + questions.length - 1)}` : ""}
          </span>{" "}
          با بانک سؤال {subjects.map(subjectTitle).join("، ")} باز می‌شود
        </p>
        <p className="qc-locked-list">
          {questions.map((question) => (
            <Link key={question.id} href={`/questions/${question.id}`}>{examLine(question)}</Link>
          ))}
        </p>
        <p className="qc-locked-actions">
          {signedOut && (
            <Link className="ds-btn ds-btn-primary ds-btn-sm" href="/login?next=/questions">ورود به حساب</Link>
          )}
          {subjects.length === 1 && (
            <Link className="ds-btn ds-btn-secondary ds-btn-sm" href={`/questions/${questions[0].id}`}>تهیهٔ بانک {subjectTitle(subjects[0])}</Link>
          )}
        </p>
      </div>
    </section>
  );
}
