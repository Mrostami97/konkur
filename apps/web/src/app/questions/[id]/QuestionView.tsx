"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { formatRial, toPersianDigits } from "../../../lib/format";
import { BuyButton } from "../../../components/BuyButton";
import { DataState } from "../../../components/ds";
import { Glyph } from "../../../components/SubjectIcon";
import { fieldLabel } from "../../account/profile-options";
import { OUTSIDE_1406_SUBJECTS, topicPlace } from "../../../lib/syllabus";
import { QuestionCard, examLine, isOpen, type BankQuestion, type CardHandle } from "../QuestionCard";
import { loadHistories, type History } from "../practice";
import { clearPracticeSet, readPracticeSet } from "../practice-set";

/** Where this question sits among its topic's questions, in bank order. */
interface Neighbours { index: number; total: number; previous: string | null; next: string | null }

/**
 * One question on its own page: the same card as the bank's sheet, with its
 * place in the 1406 syllabus above it and the previous and next question of
 * its topic (or of the practice set it was opened from) beside it.
 */
export function QuestionView({ id, subjectTitles }: { id: string; subjectTitles: Record<string, string> }) {
  const router = useRouter();
  const [question, setQuestion] = useState<BankQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [inSet, setInSet] = useState<{ index: number; total: number; next: string | null } | null>(null);
  const [neighbours, setNeighbours] = useState<Neighbours | null>(null);
  const card = useRef<CardHandle | null>(null);

  useEffect(() => {
    const set = readPracticeSet();
    const index = set.indexOf(id);
    setInSet(index >= 0 ? { index, total: set.length, next: set[index + 1] ?? null } : null);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await apiFetch<BankQuestion>(`/questions/${id}`);
        setQuestion(loaded);
        // Signed-out visitors get null: their answers are checked here but not kept.
        const histories = await loadHistories([loaded.id]);
        setHistory(histories?.[loaded.id] ?? null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError("اتصال به بانک سؤال برقرار نشد.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // The topic's questions in bank order, for "previous" and "next".
  const topic = question?.topicCodes?.[0];
  useEffect(() => {
    if (!question || !topic) return;
    apiFetch<{ items: { id: string }[]; total: number }>(
      `/questions?subjectCode=${encodeURIComponent(question.subjectCode)}&topicCode=${encodeURIComponent(topic)}&pageSize=100`,
    )
      .then(({ items, total }) => {
        const index = items.findIndex((item) => item.id === question.id);
        if (index >= 0) setNeighbours({ index, total, previous: items[index - 1]?.id ?? null, next: items[index + 1]?.id ?? null });
      })
      .catch(() => setNeighbours(null));
  }, [question, topic]);

  const nextId = inSet ? inSet.next : neighbours?.next ?? null;
  const previousId = inSet ? null : neighbours?.previous ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.ctrlKey || event.metaKey || event.altKey || (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))) return;
      const digit = /^(?:Digit|Numpad)([1-4])$/.exec(event.code);
      if (digit) card.current?.pick(Number(digit[1]));
      else if (event.code === "Enter" && !(target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement)) card.current?.check();
      else if (event.code === "KeyH") card.current?.hint();
      else if (event.code === "KeyS") card.current?.star();
      else if ((event.code === "KeyJ" || event.code === "KeyN") && nextId) router.push(`/questions/${nextId}`);
      else if ((event.code === "KeyK" || event.code === "KeyP") && previousId) router.push(`/questions/${previousId}`);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextId, previousId, router]);

  const outside1406 = question ? OUTSIDE_1406_SUBJECTS[question.subjectCode] : undefined;
  const title = question ? subjectTitles[question.subjectCode] ?? outside1406 ?? question.subjectCode : "";
  const place = question ? topicPlace(question.subjectCode, topic) : null;
  const bank = (query: string) => `/questions?subject=${encodeURIComponent(question!.subjectCode)}${query}`;

  return (
    <main className="qv">
      <div className="qv-wrap">
        <nav className="qv-crumbs" aria-label="جای سؤال در سرفصل ۱۴۰۶">
          <Link href="/questions">بانک تست</Link>
          {question && (
            <>
              <span aria-hidden="true">›</span>
              <Link href={bank("")}>{title}</Link>
              {place && (
                <>
                  <span aria-hidden="true">›</span>
                  <Link href={bank(`&chapter=${encodeURIComponent(place.chapter.code)}`)}>{place.chapter.title}</Link>
                  <span aria-hidden="true">›</span>
                  <Link href={bank(`&topic=${encodeURIComponent(place.topic.code)}`)}>{place.topic.title}</Link>
                </>
              )}
              {outside1406 && <span className="qc-badge">خارج از کنکور ۱۴۰۶</span>}
            </>
          )}
        </nav>

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
              <h1 className="sr-only">
                {title} · {examLine(question)} · {fieldLabel(question.examMajor)}
              </h1>
              {isOpen(question) ? (
                <QuestionCard ref={card} question={question} subjectTitle={title} history={history} onHistory={setHistory} active passageOpen />
              ) : (
                <section className="qv-locked">
                  <span className="qc-locked-icon"><Glyph name="lock" /></span>
                  <div>
                    <h2>{examLine(question)} · {fieldLabel(question.examMajor)}</h2>
                    <p>
                      متن، گزینه‌ها و حل این تست با بانک سؤال {title} باز می‌شود. بانک سؤال جدا از دوره‌ها فروخته می‌شود؛
                      تست‌های نمونه برای همه آزادند.
                    </p>
                    <div className="qv-locked-actions">
                      <BankOffer subjectCode={question.subjectCode} />
                    </div>
                  </div>
                </section>
              )}

              <nav className="qv-nav" aria-label={inSet ? "تمرین مبحثی" : "تست‌های همین مبحث"}>
                {inSet ? (
                  <span className="tnum">تمرین مبحثی · تست {toPersianDigits(inSet.index + 1)} از {toPersianDigits(inSet.total)}</span>
                ) : neighbours ? (
                  <span className="tnum">
                    {place?.topic.title ?? title} · تست {toPersianDigits(neighbours.index + 1)} از {toPersianDigits(neighbours.total)}
                  </span>
                ) : (
                  <Link href={bank("")}>تست‌های دیگر {title}</Link>
                )}
                <span className="qv-nav-steps">
                  {previousId && (
                    <Link className="ds-btn ds-btn-secondary ds-btn-sm" href={`/questions/${previousId}`} title="تست قبلی (K)">
                      <Glyph name="arrowRight" />
                      قبلی
                    </Link>
                  )}
                  {nextId ? (
                    <Link className="ds-btn ds-btn-primary ds-btn-sm" href={`/questions/${nextId}`} title="تست بعدی (J)">
                      بعدی
                      <Glyph name="arrowLeft" />
                    </Link>
                  ) : inSet ? (
                    <Link className="ds-btn ds-btn-primary ds-btn-sm" href="/questions/build" onClick={clearPracticeSet}>پایان تمرین؛ آزمون تازه</Link>
                  ) : null}
                </span>
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
  courseGrants?: unknown[];
  resourceGrants?: unknown[];
  questionBankGrants?: { subjectCode: string }[];
}

const grantsSubject = (item: BankProduct, subjectCode: string) =>
  Boolean(item.prices?.length && item.questionBankGrants?.some((grant) => grant.subjectCode === subjectCode));

/**
 * The bank of one subject, sold on its own (owner, 2026-10-06), and the whole
 * bank, a bundle of every subject's bank and nothing else (owner, 2026-10-24):
 * a price and a buy button for each that is on sale, otherwise a note and the
 * free sample questions of the subject.
 */
function BankOffer({ subjectCode }: { subjectCode: string }) {
  const [offers, setOffers] = useState<{ subject?: BankProduct; whole?: BankProduct } | null | undefined>(undefined);

  useEffect(() => {
    apiFetch<BankProduct[]>("/products")
      .then((products) => {
        const subject = products.find((item) => item.kind === "QUESTION_BANK" && grantsSubject(item, subjectCode));
        const whole = products.find(
          (item) =>
            item.kind === "BUNDLE" &&
            !item.courseGrants?.length &&
            !item.resourceGrants?.length &&
            (item.questionBankGrants?.length ?? 0) > 1 &&
            grantsSubject(item, subjectCode),
        );
        setOffers(subject || whole ? { subject, whole } : null);
      })
      .catch(() => setOffers(null));
  }, [subjectCode]);

  const samples = (
    <Link className="ds-btn ds-btn-secondary ds-btn-sm" href={`/questions?subject=${encodeURIComponent(subjectCode)}`}>
      تست‌های این درس
    </Link>
  );
  if (offers === undefined) return null;
  if (!offers) {
    return (
      <>
        <p className="qv-locked-soon">فروش بانک سؤال این درس به‌زودی باز می‌شود.</p>
        {samples}
      </>
    );
  }
  return (
    <>
      {offers.subject && (
        <span className="qv-offer">
          <span className="qv-locked-price tnum">{formatRial(offers.subject.prices![0].amountRial)}</span>
          <BuyButton productId={offers.subject.id} label="بانک سؤال این درس" />
        </span>
      )}
      {offers.whole && (
        <span className="qv-offer">
          <span className="qv-locked-price tnum">{formatRial(offers.whole.prices![0].amountRial)}</span>
          <BuyButton productId={offers.whole.id} label="کل بانک سؤال، همهٔ دروس" />
        </span>
      )}
      {samples}
    </>
  );
}
