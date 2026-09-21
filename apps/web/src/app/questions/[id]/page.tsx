"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { ContentBlocks } from "../../../components/ContentBlocks";
import { EmptyState, PageHeader } from "../../../components/ui";

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
 * `getById`): a sample question or one whose subject the caller has active
 * bank access to arrives whole, and anything else arrives as metadata alone
 * -- no stem, no options, no answer key. The locked fields were never sent
 * to this client, so they are not fetched-then-hidden, and there is no other
 * endpoint to "get" them from.
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

export default function QuestionDetailPage({ params }: { params: { id: string } }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<Question>(`/questions/${params.id}`);
        setQuestion(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setMessage("اتصال به بانک سؤال برقرار نشد.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <main className="page-container">
        <div className="surface-card loading-state">در حال بارگذاری سؤال…</div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="page-container">
        <EmptyState
          title="سؤال پیدا نشد"
          description="ممکن است این سؤال هنوز منتشر نشده یا نشانی آن تغییر کرده باشد."
          action={
            <Link className="button button-secondary" href="/questions">
              بازگشت به بانک سؤال
            </Link>
          }
        />
      </main>
    );
  }

  if (!question) {
    return (
      <main className="page-container">
        {message && (
          <div className="form-error" role="alert">
            {message}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="page-container">
      <PageHeader
        eyebrow={`${question.subjectCode} — ${question.examMajor} — ${question.examYear}`}
        title="متن سؤال"
        description={`نسخه ${question.version}`}
        action={
          <Link className="button button-secondary" href="/questions">
            بازگشت به بانک سؤال
          </Link>
        }
      />

      {question.stemBlocks && question.options ? (
        <article className="editorial-body surface-card">
          <ContentBlocks blocks={question.stemBlocks} assets={question.assets} />
          <ol style={{ paddingInlineStart: "1.5rem" }}>
            {question.options.map((option) => (
              <li
                key={option.number}
                style={{
                  margin: "0.5rem 0",
                  fontWeight: question.correctOption === option.number ? 700 : undefined,
                }}
              >
                <ContentBlocks blocks={option.blocks} assets={question.assets} />
                {question.correctOption === option.number && (
                  <span style={{ marginInlineStart: "0.5rem", color: "#1a7f45" }}>(پاسخ صحیح)</span>
                )}
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      {question.solutionBlocks ? (
        <section className="surface-card">
          <span className="eyebrow">راه‌حل</span>
          <ContentBlocks blocks={question.solutionBlocks} assets={question.assets} />
        </section>
      ) : (
        <EmptyState
          title="این سؤال قفل است"
          description="متن، گزینه‌ها و راه‌حل این سؤال فقط برای حساب‌هایی نمایش داده می‌شود که دسترسی بانک سؤال این درس را دارند. سؤال‌های نمونهٔ این درس آزادند."
          action={
            <Link className="button button-primary" href="/courses">
              مشاهدهٔ دوره‌ها و دسترسی بانک سؤال ←
            </Link>
          }
        />
      )}
    </main>
  );
}
