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
  topicCodes: string[];
  assets?: { media_key: string; checksum: string }[];
  isSample: boolean;
  version: number;
  stemBlocks?: Block[];
  options?: Option[];
  correctOption?: number;
  solutionBlocks?: Block[];
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

  useEffect(() => {
    (async () => {
      try {
        setQuestion(await apiFetch<Question>(`/questions/${id}`));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError("اتصال به بانک سؤال برقرار نشد.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const title = question ? subjectTitles[question.subjectCode] ?? question.subjectCode : "";
  const hasKey = question?.correctOption !== undefined;
  const correct = checked && picked !== null && picked === question?.correctOption;

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
            <div className="qv-meta">
              <span>{fieldLabel(question.examMajor)}</span>
              <span>کنکور {toPersianDigits(question.examYear)}</span>
              <span>{question.isSample ? "نمونهٔ رایگان" : "بانک درس"}</span>
            </div>
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
                      const isKey = checked && option.number === question.correctOption;
                      const isWrongPick = checked && option.number === picked && picked !== question.correctOption;
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
                        <button type="button" className="ds-btn ds-btn-primary" disabled={picked === null} onClick={() => setChecked(true)}>
                          بررسی پاسخ
                        </button>
                      ) : (
                        <>
                          <p className="qv-verdict" data-ok={correct || undefined} data-bad={!correct || undefined} role="status">
                            {correct ? "درست است." : `نادرست؛ پاسخ درست گزینهٔ ${toPersianDigits(question.correctOption!)} است.`}
                          </p>
                          <button type="button" className="ds-btn ds-btn-ghost" onClick={() => { setChecked(false); setPicked(null); }}>
                            دوباره حل می‌کنم
                          </button>
                        </>
                      )}
                    </div>
                  )}
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
                  <h2 id="qv-solution-title">راه‌حل</h2>
                  <div>
                    <ContentBlocks blocks={question.solutionBlocks} assets={question.assets} />
                  </div>
                </section>
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