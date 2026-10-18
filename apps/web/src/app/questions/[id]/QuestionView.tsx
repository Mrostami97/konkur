"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { formatRial, toPersianDigits } from "../../../lib/format";
import { ContentBlocks } from "../../../components/ContentBlocks";
import { tidyQuestionBlocks } from "../../../lib/question-text";
import { BuyButton } from "../../../components/BuyButton";
import { DataState } from "../../../components/ds";
import { fieldLabel } from "../../account/profile-options";
import { OUTSIDE_1406_SUBJECTS, topicPlace } from "../../../lib/syllabus";
import { CONFIDENCE, PracticePanel, loadHistory, type Confidence, type History, type Outcome } from "./PracticePanel";
import { clearPracticeSet, readPracticeSet } from "../practice-set";

interface Block {
  type: string;
  [key: string]: unknown;
}

interface Option {
  number: number;
  blocks: Block[];
}

/**
 * Everything below `version` is optional because the API decides server-side
 * how much of a question this caller may see (question-bank.service.ts
 * `getById`): a sample question or one whose subject the caller has bank
 * access to arrives whole, anything else arrives as metadata alone -- no
 * stem, no options, no answer key. Locked fields are never sent here, so
 * they are not fetched-then-hidden.
 */
interface Question {
  id: string;
  subjectCode: string;
  examDegree: string;
  examMajor: string;
  examYear: number;
  examCode?: string | null;
  questionNumber?: number | null;
  topicCodes: string[];
  assets?: { media_key: string; checksum: string }[];
  isSample: boolean;
  version: number;
  stemBlocks?: Block[];
  options?: Option[];
  correctOption?: number;
  /** Every option the final key accepts, when more than one. */
  acceptedOptions?: number[];
  /** DELETED: the board removed it; POSITIVE_EFFECT: a wrong answer costs nothing. */
  keyState?: "NORMAL" | "DELETED" | "POSITIVE_EFFECT";
  solutionBlocks?: Block[];
  /** The tagger's own chapter and description, shown after answering. */
  labels?: { chapter?: string; topic?: string } | null;
  /** Whose answer the key is: the board's, or ours where no official key exists. */
  keySource?: "official" | "authored" | null;
}

/**
 * One question as a study page: pick an answer, check it, then read the
 * solution. The key arrives with the question for a caller entitled to it;
 * waiting for "check" is study practice, not access control.
 */
export function QuestionView({ id, subjectTitles }: { id: string; subjectTitles: Record<string, string> }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [wrongAnswerId, setWrongAnswerId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  /** Where this question sits in a practice set from the exam builder, if it is in one. */
  const [inSet, setInSet] = useState<{ index: number; total: number; next: string | null } | null>(null);

  useEffect(() => {
    const set = readPracticeSet();
    const index = set.indexOf(id);
    setInSet(index >= 0 ? { index, total: set.length, next: set[index + 1] ?? null } : null);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await apiFetch<Question>(`/questions/${id}`);
        setQuestion(loaded);
        setStartedAt(Date.now());
        // Signed-out visitors get null: their answers are checked here but not kept.
        if (loaded.options) setHistory(await loadHistory(loaded.id));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError("اتصال به بانک سؤال برقرار نشد.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const outside1406 = question ? OUTSIDE_1406_SUBJECTS[question.subjectCode] : undefined;
  const title = question ? subjectTitles[question.subjectCode] ?? outside1406 ?? question.subjectCode : "";
  const hasKey = question?.correctOption !== undefined;
  const deleted = question?.keyState === "DELETED";
  const accepted = question ? [question.correctOption, ...(question.acceptedOptions ?? [])].filter((n): n is number => typeof n === "number") : [];
  const keyOptions = [...new Set(accepted)].sort();
  const correct = checked && picked !== null && !deleted && keyOptions.includes(picked);
  const place = question ? topicPlace(question.subjectCode, question.topicCodes[0]) : null;

  /** Shows the key at once; a signed-in student's answer is also graded and kept on the server. */
  async function check() {
    if (!question || picked === null) return;
    setChecked(true);
    if (!history) return;
    try {
      const saved = await apiFetch<{ answerId: string; outcome: Outcome; history: History }>(`/questions/${question.id}/practice`, {
        method: "POST",
        body: { selectedOption: picked, ...(confidence ? { confidence } : {}), timeSpentMs: Math.min(Date.now() - startedAt, 6 * 3600 * 1000) },
      });
      setHistory(saved.history);
      setWrongAnswerId(saved.outcome === "WRONG" ? saved.answerId : null);
    } catch {
      // The key is already on screen; a failed save only means this try is not in the history.
    }
  }

  function retry() {
    setChecked(false);
    setPicked(null);
    setConfidence(null);
    setWrongAnswerId(null);
    setStartedAt(Date.now());
  }

  return (
    <main className="qv">
      <div className="qv-top">
        <div className="qv-wrap">
          <p className="qv-crumbs">
            <Link href="/questions">بانک سؤال</Link>
            <span aria-hidden="true">/</span>
            <span>{title || "سؤال"}</span>
          </p>
          {question && (
            <>
              <h1 className="qv-title">
                کنکور {question.examDegree === "PHD" ? "دکتری " : ""}
                {toPersianDigits(question.examYear)}
                {question.questionNumber ? <> · سؤال {toPersianDigits(question.questionNumber)}</> : null}
              </h1>
              <div className="qv-meta">
                <span>{fieldLabel(question.examMajor)}</span>
                <span>{question.isSample ? "نمونهٔ رایگان" : "بانک درس"}</span>
              </div>
              {/* Where it sits in the 1406 syllabus; each step opens the bank on it. */}
              <nav className="qv-place" aria-label="جای سؤال در سرفصل ۱۴۰۶">
                <Link href={`/questions?subject=${encodeURIComponent(question.subjectCode)}`}>{title}</Link>
                {place && (
                  <>
                    <span aria-hidden="true">›</span>
                    <Link href={`/questions?subject=${encodeURIComponent(question.subjectCode)}&chapter=${encodeURIComponent(place.chapter.code)}`}>{place.chapter.title}</Link>
                    <span aria-hidden="true">›</span>
                    <Link href={`/questions?subject=${encodeURIComponent(question.subjectCode)}&topic=${encodeURIComponent(place.topic.code)}`}>{place.topic.title}</Link>
                  </>
                )}
                {outside1406 && <span className="qv-tag qv-tag-muted">خارج از کنکور ۱۴۰۶</span>}
                {place?.chapter.offSyllabus && <span className="qv-tag qv-tag-muted">خارج از سرفصل ۱۴۰۶</span>}
              </nav>
            </>
          )}
        </div>
      </div>

      <div className="qv-wrap qv-body">
        <DataState
          loading={loading}
          error={notFound ? null : error}
          isEmpty={notFound}
          emptyTitle="سؤال پیدا نشد"
          emptyDescription="ممکن است این سؤال هنوز منتشر نشده یا نشانی آن تغییر کرده باشد."
          skeletonRows={5}
        >
          {question && (
            <>
              {question.stemBlocks && question.options ? (
                <article className="qv-sheet" aria-label="متن سؤال">
                  <div className="qv-stem">
                    <ContentBlocks blocks={tidyQuestionBlocks(question.stemBlocks)} assets={question.assets} />
                  </div>
                  <div className="qv-options" role="radiogroup" aria-label="گزینه‌ها">
                    {question.options.map((option) => {
                      const isKey = checked && !deleted && keyOptions.includes(option.number);
                      const isWrongPick = checked && !deleted && option.number === picked && !keyOptions.includes(option.number);
                      return (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={picked === option.number}
                          className="qv-option"
                          data-picked={(!checked && picked === option.number) || undefined}
                          data-correct={isKey || undefined}
                          data-wrong={isWrongPick || undefined}
                          disabled={checked}
                          onClick={() => setPicked(option.number)}
                          key={option.number}
                        >
                          <span className="qv-opt-n" aria-hidden="true">{toPersianDigits(option.number)}</span>
                          <span className="qv-opt-body">
                            <ContentBlocks blocks={option.blocks} assets={question.assets} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {hasKey && (
                    <div className="qv-actions">
                      {!checked ? (
                        <>
                          {/* Asked before the key shows, so a lucky guess is not counted as knowing it. */}
                          {history && (
                            <div className="qp-confidence" role="group" aria-label="چقدر مطمئنی؟">
                              <span>چقدر مطمئنی؟</span>
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
                          <button type="button" className="ds-btn ds-btn-primary" disabled={picked === null} onClick={() => void check()}>
                            بررسی پاسخ
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="qv-verdict" data-ok={correct || undefined} data-bad={(!correct && !deleted) || undefined} data-void={deleted || undefined} role="status">
                            {deleted
                              ? "این تست در کلید نهایی حذف شد؛ در کنکور برای هیچ پاسخی نمره‌ای داده یا کم نشد."
                              : correct
                                ? keyOptions.length > 1
                                  ? `درست است. کلید نهایی گزینه‌های ${keyOptions.map((n) => toPersianDigits(n)).join(" و ")} را پذیرفت.`
                                  : "درست است."
                                : keyOptions.length > 1
                                  ? `نادرست؛ کلید نهایی گزینه‌های ${keyOptions.map((n) => toPersianDigits(n)).join(" و ")} را پذیرفت.`
                                  : `نادرست؛ پاسخ درست گزینهٔ ${toPersianDigits(question.correctOption!)} است.`}
                            {question.keyState === "POSITIVE_EFFECT" && " این تست در کلید نهایی «تأثیر مثبت» دارد: پاسخ غلط نمرهٔ منفی ندارد."}
                          </p>
                          {!deleted && question.keySource && (
                            <span className="qv-tag" data-authored={question.keySource === "authored" || undefined}>
                              {question.keySource === "official" ? "کلید رسمی سنجش" : "پاسخ کنکور کامپیوتر؛ کلید رسمی در دسترس نیست"}
                            </span>
                          )}
                          <button type="button" className="ds-btn ds-btn-ghost" onClick={retry}>
                            دوباره حل می‌کنم
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <PracticePanel questionId={question.id} history={history} onHistory={setHistory} wrongAnswerId={checked ? wrongAnswerId : null} />
                </article>
              ) : (
                <section className="qv-locked">
                  <h2>این سؤال با بانک سؤال همین درس باز می‌شود</h2>
                  <p>
                    متن، گزینه‌ها و راه‌حل برای حساب‌هایی نمایش داده می‌شود که بانک سؤال {title} را تهیه کرده‌اند. بانک سؤال
                    جدا از دوره‌ها فروخته می‌شود؛ سؤال‌های نمونه برای همه آزادند.
                  </p>
                  <BankOffer subjectCode={question.subjectCode} />
                </section>
              )}

              {checked && question.solutionBlocks && question.solutionBlocks.length > 0 && (
                <section className="qv-solution" aria-labelledby="qv-solution-title">
                  {question.labels?.topic && <p className="qv-about">این تست دربارهٔ: {question.labels.topic}</p>}
                  <h2 id="qv-solution-title">راه‌حل</h2>
                  <div>
                    <ContentBlocks blocks={question.solutionBlocks} assets={question.assets} />
                  </div>
                </section>
              )}

              {inSet && (
                <nav className="qv-set" aria-label="تمرین مبحثی">
                  <span className="tnum">
                    تمرین مبحثی · تست {toPersianDigits(inSet.index + 1)} از {toPersianDigits(inSet.total)}
                  </span>
                  {inSet.next ? (
                    <Link className="ds-btn ds-btn-primary" href={`/questions/${inSet.next}`}>تست بعدی</Link>
                  ) : (
                    <Link className="ds-btn ds-btn-primary" href="/questions/build" onClick={clearPracticeSet}>پایان تمرین؛ آزمون تازه</Link>
                  )}
                </nav>
              )}

              <nav className="qv-nav" aria-label="ادامه">
                <Link className="ds-btn ds-btn-secondary" href="/questions">بازگشت به فهرست</Link>
                <Link className="ds-btn ds-btn-ghost" href={`/questions?subject=${encodeURIComponent(question.subjectCode)}`}>سؤال‌های دیگر {title}</Link>
              </nav>
            </>
          )}
        </DataState>
      </div>
    </main>
  );
}

interface BankProduct {
  id: string;
  kind: string;
  prices?: { amountRial: number }[];
  questionBankGrants?: { subjectCode: string }[];
}

/**
 * The bank product of one subject, sold on its own (owner, 2026-10-06): its
 * price and a buy button when it is on sale, otherwise a note and the free
 * sample questions of the subject.
 */
function BankOffer({ subjectCode }: { subjectCode: string }) {
  const [product, setProduct] = useState<BankProduct | null | undefined>(undefined);

  useEffect(() => {
    apiFetch<BankProduct[]>("/products")
      .then((products) =>
        setProduct(
          products.find(
            (item) => item.kind === "QUESTION_BANK" && item.questionBankGrants?.some((grant) => grant.subjectCode === subjectCode) && item.prices?.length,
          ) ?? null,
        ),
      )
      .catch(() => setProduct(null));
  }, [subjectCode]);

  const samples = (
    <Link className="ds-btn ds-btn-secondary" href={`/questions?subject=${encodeURIComponent(subjectCode)}`}>
      سؤال‌های نمونهٔ این درس
    </Link>
  );
  if (product === undefined) return null;
  if (!product) {
    return (
      <>
        <p className="qv-locked-soon">فروش بانک سؤال این درس به‌زودی باز می‌شود.</p>
        {samples}
      </>
    );
  }
  return (
    <>
      <p className="qv-locked-price tnum">{formatRial(product.prices![0].amountRial)}</p>
      <BuyButton productId={product.id} label="تهیهٔ بانک سؤال این درس" />
      {samples}
    </>
  );
}