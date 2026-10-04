"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContentBlocks } from "../../../../components/ContentBlocks";
import { API_URL, apiFetch } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  TableWrap,
} from "../../../../components/ds";
import "./review.css";

type Tier = "GOLD" | "SILVER" | "DRAFT";
type Block = { type: string; [key: string]: unknown };
type Asset = { media_key: string; checksum: string; filename: string; mime_type: string };

interface YearSummary {
  examCode: string;
  examYear: number;
  GOLD: number;
  SILVER: number;
  DRAFT: number;
  keysUnchecked: number;
}

interface ReviewQuestion {
  id: string;
  examYear: number;
  examCode: string | null;
  bookletNumber: number | null;
  questionNumber: number | null;
  sectionTitle: string | null;
  subjectCode: string;
  qualityTier: Tier;
  textVerified: boolean;
  keyVerified: boolean;
  passage: { externalId: string; blocks: Block[] } | null;
  stemBlocks: Block[];
  options: { number: number; blocks: Block[] }[];
  assets: Asset[];
  correctOption: number;
  acceptedOptions: number[];
  source: { archive_path?: string; page?: number; crop_media_key?: string } | null;
}

const TIER_LABEL: Record<Tier, { text: string; tone: "success" | "info" | "warning" }> = {
  GOLD: { text: "طلایی", tone: "success" },
  SILVER: { text: "نقره‌ای", tone: "info" },
  DRAFT: { text: "در انتظار بازبینی", tone: "warning" },
};

const fa = (value: number) => toPersianDigits(value);

/** The key a question accepts, as the final key prints it: «۲» or «۲ یا ۳». */
function keyLabel(question: Pick<ReviewQuestion, "correctOption" | "acceptedOptions">) {
  const keys = question.acceptedOptions.length > 1 ? question.acceptedOptions : [question.correctOption];
  return keys.map(fa).join(" یا ");
}

function cropUrl(question: ReviewQuestion) {
  const key = question.source?.crop_media_key;
  const asset = key ? question.assets.find((item) => item.media_key === key) : undefined;
  return asset ? `${API_URL}/media/${asset.checksum.replace("sha256:", "")}` : null;
}

/** Questions of one exam in booklet order, with the review decision on each. */
function ExamReview({
  exam,
  subjectTitle,
  onChanged,
}: {
  exam: YearSummary;
  subjectTitle: (code: string) => string;
  onChanged: () => void;
}) {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyDraft, setOnlyDraft] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ examCode: exam.examCode, examYear: String(exam.examYear), pageSize: "200" });
      const data = await apiFetch<{ items: ReviewQuestion[] }>(`/admin/questions?${params}`);
      setQuestions(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن سؤال‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [exam.examCode, exam.examYear]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(question: ReviewQuestion, verdict: { textVerified?: boolean; keyVerified?: boolean }) {
    setBusy(question.id);
    setError(null);
    try {
      const updated = await apiFetch<Pick<ReviewQuestion, "id" | "textVerified" | "keyVerified" | "qualityTier">>(
        `/admin/questions/${question.id}/review`,
        { method: "POST", body: verdict },
      );
      setQuestions((list) => list.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت بازبینی ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmKey() {
    setBusy("key");
    setError(null);
    try {
      const result = await apiFetch<{ questions: number; confirmed: number }>("/admin/questions/exam-key/confirm", {
        method: "POST",
        body: { examCode: exam.examCode, examYear: exam.examYear },
      });
      setConfirming(false);
      setNotice(`کلید ${fa(result.confirmed)} سؤال تأیید شد.`);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تأیید کلید ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  const shown = onlyDraft ? questions.filter((question) => question.qualityTier === "DRAFT") : questions;
  const keysUnchecked = questions.filter((question) => !question.keyVerified).length;

  return (
    <div className="ds-stack-lg">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <div className="ds-row-between">
          <div>
            <h2 className="ds-card-title">کلید کنکور {fa(exam.examYear)} (کد {fa(Number(exam.examCode))})</h2>
            <p className="ds-subtitle">
              این جدول را با کلید نهایی سنجش (صفحهٔ کلید در PDF) مقایسه کن. اگر همه یکی بود، کلید کل سال یک‌جا تأیید می‌شود.
              {keysUnchecked > 0 ? ` ${fa(keysUnchecked)} کلید هنوز تأیید نشده.` : " کلید همهٔ سؤال‌ها تأیید شده است."}
            </p>
          </div>
          <Button variant="primary" disabled={keysUnchecked === 0 || loading} onClick={() => setConfirming(true)}>
            کلید این سال درست است
          </Button>
        </div>
        <DataState loading={loading} error={null} isEmpty={questions.length === 0} emptyTitle="سؤالی برای این سال نیست" skeletonRows={3}>
          <ol className="rq-key" aria-label="جدول کلید">
            {questions.map((question) => (
              <li key={question.id} data-checked={question.keyVerified || undefined}>
                <span>{fa(question.questionNumber ?? 0)}</span>
                <b>{keyLabel(question)}</b>
              </li>
            ))}
          </ol>
        </DataState>
      </Card>

      <div className="ds-row-between">
        <h2 className="ds-card-title">
          {onlyDraft ? `سؤال‌های در انتظار بازبینی (${fa(shown.length)})` : `همهٔ سؤال‌های این سال (${fa(shown.length)})`}
        </h2>
        <Button size="sm" onClick={() => setOnlyDraft((value) => !value)}>
          {onlyDraft ? "نمایش همهٔ سؤال‌ها" : "فقط در انتظار بازبینی"}
        </Button>
      </div>

      {!loading && shown.length === 0 && (
        <Card>
          <p className="ds-subtitle">سؤالی در انتظار بازبینی نمانده است.</p>
        </Card>
      )}

      {shown.map((question) => {
        const crop = cropUrl(question);
        return (
          <Card key={question.id} className="rq-card">
            <header className="rq-head">
              <strong>سؤال {fa(question.questionNumber ?? 0)}</strong>
              <span>{subjectTitle(question.subjectCode)}</span>
              {question.sectionTitle && <span className="rq-muted">{question.sectionTitle}</span>}
              <Badge tone={TIER_LABEL[question.qualityTier].tone}>{TIER_LABEL[question.qualityTier].text}</Badge>
            </header>
            <div className="rq-body">
              {/* The English section reads left to right, punctuation included. */}
              <div className="rq-text" {...(question.subjectCode === "english" ? { dir: "ltr", lang: "en" } : {})}>
                {question.passage && (
                  <details className="rq-passage">
                    <summary>متن مشترک</summary>
                    <ContentBlocks blocks={question.passage.blocks} assets={question.assets} />
                  </details>
                )}
                <ContentBlocks blocks={question.stemBlocks} assets={question.assets} />
                <ol className="rq-options">
                  {question.options.map((option) => {
                    const isKey = option.number === question.correctOption || question.acceptedOptions.includes(option.number);
                    return (
                      <li key={option.number} data-key={isKey || undefined}>
                        <span className="rq-option-number">{fa(option.number)}</span>
                        <ContentBlocks blocks={option.blocks} assets={question.assets} />
                      </li>
                    );
                  })}
                </ol>
              </div>
              <figure className="rq-source">
                {crop ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crop} alt={`سؤال ${question.questionNumber} در دفترچهٔ اصلی`} loading="lazy" />
                ) : (
                  <p className="rq-muted">برش دفترچهٔ اصلی برای این سؤال نیست.</p>
                )}
                <figcaption>
                  دفترچهٔ اصلی{question.source?.page ? `، صفحهٔ ${fa(question.source.page)}` : ""}
                </figcaption>
              </figure>
            </div>
            <footer className="rq-actions">
              <Button
                size="sm"
                variant={question.textVerified ? "ghost" : "primary"}
                loading={busy === question.id}
                onClick={() => void review(question, { textVerified: !question.textVerified })}
              >
                {question.textVerified ? "✓ متن تأیید شده (پس‌گرفتن)" : "متن با دفترچه یکی است"}
              </Button>
              <Button
                size="sm"
                variant={question.keyVerified ? "ghost" : "primary"}
                loading={busy === question.id}
                onClick={() => void review(question, { keyVerified: !question.keyVerified })}
              >
                {question.keyVerified ? `✓ کلید ${keyLabel(question)} تأیید شده (پس‌گرفتن)` : `کلید ${keyLabel(question)} درست است`}
              </Button>
            </footer>
          </Card>
        );
      })}

      <ConfirmDialog
        open={confirming}
        title={`کلید کنکور ${fa(exam.examYear)} تأیید شود؟`}
        description="یعنی جدول بالا را خانه‌به‌خانه با کلید نهایی سنجش مقایسه کرده‌ای و همه یکی‌اند. سؤال‌هایی که متنشان هم تأیید شده، از همین لحظه در بانک و آزمون‌ها به دانشجو نشان داده می‌شوند."
        confirmLabel="بله، کلید این سال درست است"
        busy={busy === "key"}
        onConfirm={() => void confirmKey()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

export function ReviewQueue({ subjects }: { subjects: { code: string; title: string }[] }) {
  const [summary, setSummary] = useState<YearSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const names = useMemo(() => new Map(subjects.map((subject) => [subject.code, subject.title])), [subjects]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await apiFetch<YearSummary[]>("/admin/questions/review-summary"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن صف بازبینی ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exam = summary.find((row) => `${row.examCode}-${row.examYear}` === selected) ?? null;
  const totals = summary.reduce(
    (sum, row) => ({ ready: sum.ready + row.GOLD + row.SILVER, draft: sum.draft + row.DRAFT }),
    { ready: 0, draft: 0 },
  );

  return (
    <>
      <AdminPageHeader
        title="بازبینی سؤال‌های کنکور"
        description={`سؤال‌های واردشده از آرشیو تا وقتی متن و کلیدشان با دفترچهٔ اصلی تأیید نشده، به دانشجو نشان داده نمی‌شوند. الان ${fa(totals.ready)} سؤال آماده و ${fa(totals.draft)} سؤال در انتظار بازبینی است. اگر متن یا کلیدی غلط بود، در بانک محلی اصلاحش کن و فایل همان سال را دوباره بساز و وارد کن؛ همان سؤال به‌روز می‌شود.`}
        action={<Link className="ds-btn ds-btn-secondary" href="/admin/questions">بانک سؤال</Link>}
      />
      <div className="ds-stack-lg">
        <Card padded={false}>
          <div style={{ padding: loading || error || summary.length === 0 ? "var(--sp-4)" : 0 }}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={summary.length === 0}
              onRetry={load}
              emptyTitle="هنوز سؤالی از آرشیو وارد نشده"
              emptyDescription="فایل‌های ساخته‌شده برای هر سال را در «ورود داده» بارگذاری، تأیید و منتشر کن."
              skeletonRows={5}
            >
              <TableWrap>
                <thead>
                  <tr>
                    <th>کنکور</th>
                    <th>آماده</th>
                    <th>در انتظار بازبینی</th>
                    <th>کلید تأییدنشده</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => {
                    const key = `${row.examCode}-${row.examYear}`;
                    return (
                      <tr key={key} data-selected={key === selected || undefined}>
                        <td>
                          <strong>{fa(row.examYear)}</strong> <span className="rq-muted">کد {fa(Number(row.examCode))}</span>
                        </td>
                        <td>{fa(row.GOLD + row.SILVER)}</td>
                        <td>{row.DRAFT > 0 ? <Badge tone="warning">{fa(row.DRAFT)}</Badge> : "—"}</td>
                        <td>{row.keysUnchecked > 0 ? fa(row.keysUnchecked) : "—"}</td>
                        <td>
                          <Button size="sm" variant={key === selected ? "primary" : "secondary"} onClick={() => setSelected(key)}>
                            بازبینی
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>

        {exam && <ExamReview key={selected} exam={exam} subjectTitle={(code) => names.get(code) ?? code} onChanged={() => void load()} />}
      </div>
    </>
  );
}
