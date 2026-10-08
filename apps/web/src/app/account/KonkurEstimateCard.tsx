"use client";

import Link from "next/link";
import { useMemo } from "react";
import modelJson from "../../content/rank-model-1277.json";
import { AdmissionMatches } from "../../components/AdmissionMatches";
import { Glyph } from "../../components/SubjectIcon";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";
import { boxesFrom, estimateFrom, rankHistory, type DatedResults } from "../../lib/konkur-estimate";
import { CODE_LABELS, rankWithMore, roundRank, type RankModel } from "../../lib/rank-model";
import type { MyAttempt } from "./data";
import "./estimate.css";

const model = modelJson as unknown as RankModel;
const fa = (value: number, digits = 0) => formatPersianNumber(value, { maximumFractionDigits: digits });
const faRank = (rank: number) => fa(roundRank(rank));

/** Graded attempts as dated per-subject results. */
export function resultsOf(attempts: readonly MyAttempt[]): DatedResults[] {
  return attempts
    .filter((attempt) => attempt.score && attempt.subjects?.length)
    .map((attempt) => ({
      attemptId: attempt.id,
      at: attempt.submittedAt ?? attempt.startedAt,
      examTitle: attempt.exam.title,
      subjects: attempt.subjects ?? [],
    }));
}

/** Best-code rank after each attempt: lower is better, so the axis is turned over and logarithmic. */
function RankTrend({ points }: { points: { at: string; examTitle: string; rank: number }[] }) {
  const W = 320;
  const H = 110;
  const pad = { x: 14, top: 12, bottom: 16 };
  const lns = points.map((point) => Math.log(point.rank));
  const lo = Math.min(...lns) - 0.15;
  const hi = Math.max(...lns) + 0.15;
  const x = (i: number) => pad.x + (i * (W - pad.x * 2)) / Math.max(points.length - 1, 1);
  const y = (ln: number) => pad.top + ((ln - lo) / (hi - lo || 1)) * (H - pad.top - pad.bottom);
  const line = lns.map((ln, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(ln).toFixed(1)}`).join(" ");
  return (
    <svg className="ke-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="روند رتبهٔ تقریبی، از قدیمی به جدید">
      <path d={line} className="ke-trend-line" />
      {points.map((point, i) => (
        <g key={point.at + i}>
          <circle cx={x(i)} cy={y(lns[i])} r={4} className="ke-trend-dot">
            <title>{`${point.examTitle}: حدود ${faRank(point.rank)}`}</title>
          </circle>
          {(i === 0 || i === points.length - 1) && (
            <text x={x(i)} y={y(lns[i]) - 8} textAnchor="middle" className="ke-trend-label">{faRank(point.rank)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/**
 * The student panel's answer to «with these results, roughly what rank, and
 * which universities?» -- from every exam taken on the site, read through the
 * model fitted on real 1400-1405 computer-engineering report cards.
 */
export function KonkurEstimateCard({ attempts, gpa, compact = false }: { attempts: readonly MyAttempt[]; gpa: number | null; compact?: boolean }) {
  const results = useMemo(() => resultsOf(attempts), [attempts]);
  const boxes = useMemo(() => boxesFrom(results), [results]);
  const estimate = useMemo(() => estimateFrom(model, boxes, gpa), [boxes, gpa]);
  const history = useMemo(() => (compact ? [] : rankHistory(model, results, gpa)), [compact, results, gpa]);

  // The box whose next ten points would move the best code's rank the most.
  const lever = useMemo(() => {
    if (!estimate) return null;
    const options = boxes
      .map((box, index) => ({ box, rank: rankWithMore(model, estimate.year, estimate.best.code, estimate.percents, gpa ?? model.gpaRef, index, 10) }))
      .filter((option) => option.rank !== null && (option.box.percent ?? 100) < 95)
      .sort((a, b) => (a.rank as number) - (b.rank as number));
    return options[0] ?? null;
  }, [boxes, estimate, gpa]);

  if (results.length === 0) return null;
  const measured = boxes.filter((box) => box.percent !== null).length;

  return (
    <section className="st-card ke" aria-labelledby="ke-title">
      <header className="st-card-head">
        <h2 id="ke-title">
          <span className="st-card-icon"><Glyph name="compass" /></span>
          رتبهٔ تقریبی و دانشگاه‌های در دسترس
        </h2>
        <span className="st-card-caption">از روی {toPersianDigits(model.cards)} کارنامهٔ واقعی ۱۴۰۰ تا ۱۴۰۵</span>
      </header>

      {!compact && (
        <ul className="ke-boxes" aria-label="درصد هر بخش از آخرین آزمون‌هایت">
          {boxes.map((box) => (
            <li key={box.key} data-missing={box.percent === null || undefined}>
              <span>{box.title}</span>
              <b className="tnum">{box.percent === null ? "سنجیده نشده" : `${fa(box.percent, 1)}٪`}</b>
            </li>
          ))}
        </ul>
      )}

      {!estimate ? (
        <div className="ke-missing">
          <p>
            {measured === 0
              ? "آزمون‌هایی که داده‌ای هنوز هیچ بخشی از کنکور ارشد مهندسی کامپیوتر را نسنجیده‌اند."
              : `${toPersianDigits(measured)} بخش از ۶ بخش سنجیده شده. برای تخمین رتبه هر شش بخش لازم است؛ حدس زدن درصد درسی که نسنجیده‌ای، رتبهٔ گمراه‌کننده می‌دهد.`}
          </p>
          <Link className="st-btn st-btn-primary st-btn-sm" href="/exams">یک آزمون جامع بزن</Link>
        </div>
      ) : (
        <>
          <div className="ke-hero">
            <div className="ke-best">
              <span>بهترین کد: {CODE_LABELS[estimate.best.code].title}</span>
              <strong className="tnum">≈ {faRank(estimate.best.rank)}</strong>
              <small className="tnum">
                بین {faRank(estimate.best.low80)} تا {faRank(estimate.best.high80)} · با درصدهای کنکور {toPersianDigits(estimate.year.year)}
              </small>
            </div>
            {!compact && (
              <div className="ke-codes">
                {estimate.codes.map((code) => (
                  <div key={code.code} data-best={code.code === estimate.best.code || undefined}>
                    <span>کد {toPersianDigits(code.code)} · {CODE_LABELS[code.code].title}</span>
                    <b className="tnum">{faRank(code.rank)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          {history.length >= 2 && (
            <div className="ke-history">
              <h3>رتبهٔ تقریبی بعد از هر آزمون</h3>
              <RankTrend points={history} />
            </div>
          )}

          {lever && lever.rank !== null && lever.rank < estimate.best.rank && (
            <p className="ke-lever">
              بیشترین اثر: اگر درصد <b>{lever.box.title}</b> را ۱۰ بالا ببری، رتبهٔ کد {toPersianDigits(estimate.best.code)} حدود{" "}
              <b className="tnum">{faRank(lever.rank)}</b> می‌شود.
            </p>
          )}

          <h3 className="ke-sub">با این رتبه، کجا قبول شده‌اند؟</h3>
          {estimate.matches.length > 0 ? (
            <AdmissionMatches matches={estimate.matches} limit={compact ? 3 : 8} />
          ) : (
            <p className="ke-note">با این درصدها رتبه‌ات هنوز به رشته‌محل‌هایی که کارنامهٔ قبولی‌شان را داریم نمی‌رسد؛ همان بخشی که بالا آمده بیشترین اثر را دارد.</p>
          )}

          <p className="ke-note">
            تخمین است، نه پیش‌بینی: درصدهای آخرین آزمون هر درس در شش بخش کارنامهٔ کنکور گذاشته شده
            {gpa ? ` و معدل ${toPersianDigits(gpa)} پروفایلت حساب شده.` : `؛ معدل در پروفایلت نیست، پس ${toPersianDigits(model.gpaRef)} فرض شد.`}{" "}
            {compact ? <Link href="/account/exams">جزئیات و روند</Link> : <Link href="/rank-calculator/master-computer-engineering">ماشین‌حساب رتبه</Link>}
          </p>
        </>
      )}
    </section>
  );
}
