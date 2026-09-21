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
 * The public question payload never carries `correctOption` or
 * `solutionBlocks` -- the API's public read path (question-bank.service.ts
 * PUBLIC_QUESTION_SELECT) is structurally incapable of returning them, for
 * any caller, since there is no entitlement model yet to decide who may see
 * the answer key. Do not add those fields back here without a real
 * authorized endpoint behind them.
 */
interface Question {
  id: string;
  subjectCode: string;
  examDegree: string;
  examMajor: string;
  examYear: number;
  topicCodes: string[];
  stemBlocks: Block[];
  options: Option[];
  assets: { media_key: string; checksum: string }[];
  version: number;
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

      <article className="editorial-body surface-card">
        <ContentBlocks blocks={question.stemBlocks} assets={question.assets} />
        <ol style={{ paddingInlineStart: "1.5rem" }}>
          {question.options.map((option) => (
            <li key={option.number} style={{ margin: "0.5rem 0" }}>
              <ContentBlocks blocks={option.blocks} assets={question.assets} />
            </li>
          ))}
        </ol>
      </article>

      <EmptyState
        title="پاسخ و راه‌حل قفل است"
        description="نمایش پاسخ صحیح و راه‌حل این سؤال به دسترسی بانک سؤال نیاز دارد. این بخش هنوز برای هیچ حسابی -- حتی حساب‌های خریداری‌شده -- در دسترس نیست، چون مدل دسترسی هنوز پیاده‌سازی نشده است."
      />
    </main>
  );
}
