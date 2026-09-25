"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Glyph } from "../../../components/SubjectIcon";
import { apiFetch } from "../../../lib/api";
import { konkurPercent, toPersianDigits } from "../../../lib/format";
import { AccountShell } from "../AccountShell";
import { ProgressRing, ScoreTrend } from "../charts";
import { ATTEMPT_STATUS, faDate, type Mastery, type MyAttempt } from "../data";

export default function MyExamsPage() {
  const [attempts, setAttempts] = useState<MyAttempt[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mastery, setMastery] = useState<Mastery[]>([]);
  const [topicTitles, setTopicTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    apiFetch<MyAttempt[]>("/me/attempts")
      .then(setAttempts)
      .catch(() => setFailed(true));
    apiFetch<Mastery[]>("/me/mastery").then(setMastery).catch(() => setMastery([]));
    apiFetch<{ code: string; title: string }[]>("/topics")
      .then((topics) => setTopicTitles(new Map(topics.map((topic) => [topic.code, topic.title]))))
      .catch(() => undefined);
  }, []);

  const ranked = (attempts ?? []).filter((attempt) => attempt.standing?.rank != null && attempt.standing.isOfficial);
  const bestRank = ranked.length ? Math.min(...ranked.map((attempt) => attempt.standing!.rank!)) : null;

  const scored = (attempts ?? []).filter((attempt) => attempt.score);
  // Konkur percent throughout, so these figures match each row and the report.
  const percents = scored.map((attempt) => konkurPercent(attempt.score!));
  const average = percents.length ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) : null;
  const best = percents.length ? Math.round(Math.max(...percents)) : null;
  const inProgress = (attempts ?? []).filter((attempt) => attempt.status === "IN_PROGRESS");

  return (
    <AccountShell
      title="آزمون‌ها و کارنامه"
      subtitle="همهٔ آزمون‌هایی که داده‌ای، درصد هرکدام و روند پیشرفتت."
      action={
        <Link href="/exams" className="st-btn st-btn-primary">
          <Glyph name="target" />
          آزمون جدید
        </Link>
      }
    >
      {failed ? (
        <p className="st-alert st-alert-danger">فهرست آزمون‌ها الان بارگذاری نشد. صفحه را دوباره باز کن.</p>
      ) : attempts === null ? (
        <div aria-busy="true">
          <div className="st-skel-row">
            {Array.from({ length: 4 }, (_, index) => <div className="st-skel st-skel-kpi" key={index} />)}
          </div>
          <div className="st-skel st-skel-card-lg" />
        </div>
      ) : attempts.length === 0 ? (
        <div className="st-card">
          <div className="st-empty st-empty-lg">
            <span className="st-empty-icon"><Glyph name="target" /></span>
            <strong>هنوز آزمونی نداده‌ای</strong>
            <p>آزمون‌های زمان‌دار را از فهرست آزمون‌ها شروع کن؛ کارنامهٔ هر آزمون به نام خودت اینجا نگه داشته می‌شود.</p>
            <Link href="/exams" className="st-btn st-btn-primary">دیدن آزمون‌ها</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="st-exam-summary">
            <div className="st-card st-exam-ring">
              <ProgressRing percent={Math.max(0, average ?? 0)} size={120} stroke={11} tone="teal" label="میانگین" />
              <div>
                <strong>میانگین درصد به روش کنکور</strong>
                <p>
                  {average !== null
                    ? `در ${toPersianDigits(scored.length)} آزمون تصحیح‌شده.`
                    : "هنوز آزمونی تصحیح نشده است."}
                </p>
              </div>
            </div>
            <div className="st-mini-stats">
              <div><span>آزمون‌ها</span><b>{toPersianDigits(attempts.length)}</b></div>
              <div><span>بهترین درصد</span><b>{best !== null ? `${toPersianDigits(best)}٪` : "—"}</b></div>
              <div><span>بهترین رتبه</span><b>{bestRank !== null ? toPersianDigits(bestRank) : "—"}</b></div>
              <div><span>در جریان</span><b>{toPersianDigits(inProgress.length)}</b></div>
            </div>
          </div>

          {scored.length >= 2 && (
            <section className="st-card">
              <header className="st-card-head">
                <h2>
                  <span className="st-card-icon"><Glyph name="curve" /></span>
                  روند درصدها
                </h2>
                <span className="st-card-caption">از قدیمی به جدید</span>
              </header>
              <div className="st-trend-wrap st-trend-lg">
                <ScoreTrend
                  points={[...scored].reverse().map((attempt) => ({ value: konkurPercent(attempt.score!), label: attempt.exam.title }))}
                />
              </div>
            </section>
          )}

          <section className="st-card">
            <header className="st-card-head">
              <h2>
                <span className="st-card-icon"><Glyph name="list" /></span>
                همهٔ آزمون‌ها
              </h2>
            </header>
            <ul className="st-exam-list">
              {attempts.map((attempt) => {
                const status = ATTEMPT_STATUS[attempt.status];
                return (
                  <li key={attempt.id}>
                    <div className="st-exam-main">
                      <strong>{attempt.exam.title}</strong>
                      <small>
                        {faDate(attempt.startedAt, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                        {toPersianDigits(attempt.exam.durationMinutes)} دقیقه
                      </small>
                      {attempt.standing && (
                        <small className="st-exam-rank">
                          {attempt.standing.rank !== null
                            ? `رتبهٔ ${toPersianDigits(attempt.standing.rank)} از ${toPersianDigits(attempt.standing.participants)} نفر${attempt.standing.isOfficial ? "" : " (شرکت دوباره)"}`
                            : `${toPersianDigits(attempt.standing.participants)} شرکت‌کننده؛ رتبه از ۵ نفر به بالا`}
                        </small>
                      )}
                    </div>
                    {attempt.score ? (
                      <div className="st-exam-counts">
                        <span className="st-count-ok">{toPersianDigits(attempt.score.correctCount)} درست</span>
                        <span className="st-count-bad">{toPersianDigits(attempt.score.wrongCount)} غلط</span>
                        <span className="st-count-skip">{toPersianDigits(attempt.score.unansweredCount)} نزده</span>
                      </div>
                    ) : (
                      <span className={`st-badge st-badge-${status.tone}`}>{status.label}</span>
                    )}
                    <span className="st-exam-percent" title="درصد با نمرهٔ منفی">
                      {attempt.standing ? `${toPersianDigits(Math.round(attempt.standing.konkurPercent))}٪` : "—"}
                    </span>
                    <Link
                      href={attempt.status === "IN_PROGRESS" ? `/attempts/${attempt.id}` : `/attempts/${attempt.id}/report`}
                      className={`st-btn st-btn-sm ${attempt.status === "IN_PROGRESS" ? "st-btn-primary" : "st-btn-soft"}`}
                    >
                      {attempt.status === "IN_PROGRESS" ? "ادامهٔ آزمون" : "کارنامه"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {mastery.length > 0 && (
            <section className="st-card">
              <header className="st-card-head">
                <h2>
                  <span className="st-card-icon"><Glyph name="spark" /></span>
                  مباحثی که تمرین می‌خواهند
                </h2>
                <span className="st-card-caption">از پاسخ‌های آزمون‌هایت</span>
              </header>
              <ul className="st-mastery st-mastery-grid">
                {mastery.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <div className="st-row-between">
                      <span>{topicTitles.get(item.topicCode) ?? item.topicCode}</span>
                      <b>{toPersianDigits(Math.round(item.masteryScore * 100))}٪</b>
                    </div>
                    <div className="st-bar st-bar-warm"><span style={{ width: `${Math.round(item.masteryScore * 100)}%` }} /></div>
                    <small>بر پایهٔ {toPersianDigits(item.evidenceCount)} پاسخ</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AccountShell>
  );
}
