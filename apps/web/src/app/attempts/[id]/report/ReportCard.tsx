"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ScoreTrend } from "../../../account/charts";
import modelJson from "../../../../content/rank-model-1277.json";
import { subjectName } from "../../../../content/subject-names";
import { toPersianDigits } from "../../../../lib/format";
import { AdmissionMatches } from "../../../../components/AdmissionMatches";
import {
  admissionMatches,
  BOXES,
  CODE_LABELS,
  CODES,
  estimateCode,
  roundRank,
  yearsFor,
  type Quota,
  type RankModel,
} from "../../../../lib/rank-model";

const model = modelJson as unknown as RankModel;

export interface SectionRow {
  sectionId: string | null;
  title: string;
  rankBox: string | null;
  coefficient: number;
  questions: number;
  correct: number;
  wrong: number;
  blank: number;
  percent: number;
  timeSpentMs: number;
  taraz: number | null;
  average: number | null;
}

export interface SubjectRow {
  subjectCode: string;
  questions: number;
  correct: number;
  wrong: number;
  blank: number;
  percent: number;
}

export interface CardItem {
  index: number;
  outcome: "correct" | "wrong" | "blank";
  sectionId: string | null;
  subjectCode: string;
  timeSpentMs: number;
  changeCount: number;
  flagged: boolean;
  crowdCorrectPercent: number | null;
}

export interface CardReport {
  exam: { simulatesExamCode: string | null; simulatesYear: number | null };
  sections: SectionRow[];
  subjects: SubjectRow[];
  timeSpentMs: number;
  overallTaraz: number | null;
  participants: number;
  rankMinimum: number;
  questionStatMinimum: number;
  gpa: number | null;
  history: { attemptId: string; examTitle: string; submittedAt: string | null; konkurPercent: number | null }[];
}

const fa = (value: number) => toPersianDigits(value);
const pct = (value: number) => `${toPersianDigits(value.toFixed(1))}٪`;
const minutes = (ms: number) => toPersianDigits(Math.round(ms / 60_000));
const seconds = (ms: number) => {
  const total = Math.round(ms / 1000);
  return total >= 90 ? `${fa(Math.round(total / 60))} دقیقه` : `${fa(total)} ثانیه`;
};

/** How a percentage reads to a student: strong, middling or weak. */
function level(percent: number) {
  if (percent >= 60) return { label: "قوی", tone: "good" as const };
  if (percent >= 30) return { label: "متوسط", tone: "mid" as const };
  return { label: "ضعیف", tone: "weak" as const };
}

/** A bar for a konkur percentage, which runs from -33.3 to 100. */
function PercentBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <span className="rc-bar" aria-hidden="true">
      <span style={{ width: `${width}%` }} data-tone={level(value).tone} />
    </span>
  );
}

function SectionsTable({ report }: { report: CardReport }) {
  const ranked = report.participants >= report.rankMinimum;
  return (
    <section className="rc-block" aria-labelledby="rc-sections-title">
      <div className="rc-head">
        <h2 id="rc-sections-title">کارنامهٔ درس‌به‌درس</h2>
        <p>
          {ranked
            ? `تراز هر بخش نسبت به ${fa(report.participants)} شرکت‌کنندهٔ همین آزمون؛ ۵۰۰۰ یعنی میانگین.`
            : `تراز وقتی حساب می‌شود که دست‌کم ${fa(report.rankMinimum)} نفر در این آزمون شرکت کرده باشند (الان ${fa(report.participants)} نفر).`}
        </p>
      </div>
      <div className="rc-table-wrap">
        <table className="rc-table">
          <thead>
            <tr>
              <th>بخش</th>
              <th>سؤال</th>
              <th>درست</th>
              <th>نادرست</th>
              <th>نزده</th>
              <th>درصد</th>
              <th>تراز</th>
              <th>میانگین همه</th>
            </tr>
          </thead>
          <tbody>
            {report.sections.map((section) => (
              <tr key={section.sectionId ?? section.title}>
                <th scope="row">{section.title}</th>
                <td>{fa(section.questions)}</td>
                <td>{fa(section.correct)}</td>
                <td>{fa(section.wrong)}</td>
                <td>{fa(section.blank)}</td>
                <td className="rc-percent">
                  <b className="tnum">{pct(section.percent)}</b>
                  <PercentBar value={section.percent} />
                </td>
                <td className="tnum">{section.taraz !== null ? fa(section.taraz) : "—"}</td>
                <td className="tnum">{section.average !== null && ranked ? pct(section.average) : "—"}</td>
              </tr>
            ))}
          </tbody>
          {report.overallTaraz !== null && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={6}>تراز کل (میانگین وزنی تراز بخش‌ها)</th>
                <td className="tnum" colSpan={2}><b>{fa(report.overallTaraz)}</b></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

/**
 * The rank these percentages would have earned in a real exam year, from the
 * model built on real report cards (the same one as the public rank
 * calculator). Only for a simulator of the computer-engineering exam with all
 * six sections; always a range, never a single promise.
 */
function RankEstimate({ report }: { report: CardReport }) {
  const [quota, setQuota] = useState<Quota>("free");
  const percents = BOXES.map((box) => report.sections.find((section) => section.rankBox === box.key)?.percent);
  const complete = percents.every((value): value is number => typeof value === "number");
  const years = yearsFor(model, quota);
  const year = years.find((row) => row.year === report.exam.simulatesYear) ?? years[years.length - 1];
  const gpa = report.gpa ?? model.gpaRef;
  const estimates = useMemo(
    () => (complete && year ? CODES.map((code) => estimateCode(model, year, code, percents as number[], gpa)) : []),
    [complete, year, percents, gpa],
  );

  if (report.exam.simulatesExamCode !== "1277") return null;
  return (
    <section className="rc-block" aria-labelledby="rc-rank-title">
      <div className="rc-head">
        <h2 id="rc-rank-title">رتبهٔ تقریبی با همین درصدها در کنکور {year ? fa(year.year) : ""}</h2>
        <p>
          از روی {fa(model.cards)} کارنامهٔ واقعی ۱۴۰۰ تا ۱۴۰۵. بازه‌ها جایی را نشان می‌دهند که ۸ نفر از ۱۰ نفرِ با همین درصدها قرار گرفته‌اند
          {report.gpa ? `؛ با معدل ${toPersianDigits(report.gpa)} پروفایلت.` : `؛ معدل در پروفایلت ثبت نشده، پس معدل ${toPersianDigits(model.gpaRef)} فرض شد.`}
        </p>
      </div>
      {!complete ? (
        <p className="rc-note">
          این آزمون همهٔ شش بخش کنکور را ندارد؛ رتبه فقط برای شبیه‌ساز کامل یک سال تخمین زده می‌شود.
        </p>
      ) : (
        <>
          <div className="rc-quota" role="radiogroup" aria-label="سهمیه">
            {(["free", "5_percent"] as Quota[]).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={quota === value} onClick={() => setQuota(value)}>
                {value === "free" ? "آزاد" : "سهمیهٔ ۵ درصد"}
              </button>
            ))}
          </div>
          <div className="rc-codes">
            {estimates.map((estimate, index) =>
              estimate ? (
                <div className="rc-code" key={CODES[index]}>
                  <span>کد {fa(Number(CODES[index]))} · {CODE_LABELS[CODES[index]].title}</span>
                  <strong className="tnum">≈ {fa(roundRank(estimate.rank))}</strong>
                  <small className="tnum">
                    بین {fa(roundRank(estimate.low80))} تا {fa(roundRank(estimate.high80))}
                    {estimate.edge === "better" ? " · بهتر از همهٔ کارنامه‌های ثبت‌شده" : estimate.edge === "worse" ? " · پایین‌تر از کارنامه‌های ثبت‌شده" : ""}
                  </small>
                </div>
              ) : null,
            )}
          </div>
          {quota === "free" && (() => {
            const matches = admissionMatches(model, estimates.filter((estimate): estimate is NonNullable<typeof estimate> => estimate !== null));
            return (
              <div className="rc-admissions">
                <h3>با این رتبه، کجا قبول شده‌اند؟</h3>
                {matches.length > 0 ? (
                  <AdmissionMatches matches={matches} limit={10} />
                ) : (
                  <p className="rc-note">با این درصدها رتبه‌ات از رتبهٔ قبولی رشته‌محل‌هایی که کارنامه‌شان را داریم عقب‌تر است؛ فهرست کامل را در انتخاب رشته ببین.</p>
                )}
              </div>
            );
          })()}
          <p className="rc-note">
            درصد هر بخش فقط از سؤال‌های درس‌هایی حساب شده که در کنکور ۱۴۰۶ مانده‌اند. برای تخمین دقیق‌تر با درصدهای خودت،{" "}
            <Link href="/rank-calculator/master-computer-engineering">ماشین‌حساب رتبه</Link> را ببین.
          </p>
        </>
      )}
    </section>
  );
}

function Subjects({ report }: { report: CardReport }) {
  const sorted = [...report.subjects].sort((a, b) => a.percent - b.percent);
  if (sorted.length < 2) return null;
  return (
    <section className="rc-block" aria-labelledby="rc-subjects-title">
      <div className="rc-head">
        <h2 id="rc-subjects-title">قوت و ضعف درس‌ها</h2>
        <p>از ضعیف‌ترین به قوی‌ترین؛ برای هر درس، مرور درس و تمرین تست همان درس یک کلیک فاصله دارد.</p>
      </div>
      <ul className="rc-subjects">
        {sorted.map((subject) => {
          const { label, tone } = level(subject.percent);
          return (
            <li key={subject.subjectCode}>
              <span className="rc-subject-name">{subjectName(subject.subjectCode)}</span>
              <span className="rc-subject-score">
                <b className="tnum">{pct(subject.percent)}</b>
                <PercentBar value={subject.percent} />
                <em data-tone={tone}>{label}</em>
              </span>
              <span className="rc-subject-detail">
                {fa(subject.correct)} درست، {fa(subject.wrong)} نادرست، {fa(subject.blank)} نزده از {fa(subject.questions)}
              </span>
              <span className="rc-subject-links">
                <Link href={`/subjects/${subject.subjectCode}`}>مرور درس</Link>
                <Link href={`/questions?subject=${subject.subjectCode}`}>تمرین تست</Link>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TimeAndStrategy({ report, items, onJump }: { report: CardReport; items: CardItem[]; onJump: (index: number) => void }) {
  const total = items.length;
  const wrong = items.filter((item) => item.outcome === "wrong").length;
  const correct = items.filter((item) => item.outcome === "correct").length;
  const changed = items.reduce((sum, item) => sum + item.changeCount, 0);
  const flagged = items.filter((item) => item.flagged).length;
  const lostToWrong = total ? (wrong / (3 * total)) * 100 : 0;
  const tracked = report.timeSpentMs > 0;
  const slowest = [...items].filter((item) => item.timeSpentMs > 0).sort((a, b) => b.timeSpentMs - a.timeSpentMs).slice(0, 3);
  const rushed = items.filter((item) => item.outcome === "wrong" && item.timeSpentMs > 0 && item.timeSpentMs < 20_000);
  const totalQuestions = report.sections.reduce((sum, section) => sum + section.questions, 0);

  return (
    <section className="rc-block" aria-labelledby="rc-time-title">
      <div className="rc-head">
        <h2 id="rc-time-title">زمان و شیوهٔ تست‌زنی</h2>
      </div>
      <div className="rc-facts">
        <div>
          <span>نمرهٔ منفی</span>
          <strong className="tnum">{pct(lostToWrong)}</strong>
          <small>
            {wrong > 0
              ? `${fa(wrong)} پاسخ نادرست، معادل ${toPersianDigits((wrong / 3).toFixed(1))} پاسخ درست، از درصدت کم کرد.`
              : "هیچ پاسخ نادرستی نزدی."}
          </small>
        </div>
        <div>
          <span>دقت پاسخ‌ها</span>
          <strong className="tnum">{correct + wrong > 0 ? pct((correct / (correct + wrong)) * 100) : "—"}</strong>
          <small>از سؤال‌هایی که جواب دادی، چند درصد درست بود. زیر ۵۰٪ یعنی حدس‌زدن به ضررت بوده.</small>
        </div>
        <div>
          <span>زمان کل</span>
          <strong className="tnum">{tracked ? `${minutes(report.timeSpentMs)} دقیقه` : "—"}</strong>
          <small>
            {changed > 0 ? `${fa(changed)} بار جواب را عوض کردی` : "جوابی را عوض نکردی"}
            {flagged > 0 ? `؛ ${fa(flagged)} سؤال را علامت زدی.` : "."}
          </small>
        </div>
      </div>

      {tracked && report.sections.length > 1 && (
        <div className="rc-timeshare">
          <h3>زمانی که به هر بخش دادی، در برابر سهمش از سؤال‌ها</h3>
          {report.sections.map((section) => {
            const timeShare = report.timeSpentMs ? (section.timeSpentMs / report.timeSpentMs) * 100 : 0;
            const questionShare = totalQuestions ? (section.questions / totalQuestions) * 100 : 0;
            return (
              <div className="rc-timeshare-row" key={section.sectionId ?? section.title}>
                <span>{section.title}</span>
                <span className="rc-twin" aria-label={`${toPersianDigits(Math.round(timeShare))}٪ زمان، ${toPersianDigits(Math.round(questionShare))}٪ سؤال‌ها`}>
                  <span className="rc-twin-time" style={{ width: `${timeShare}%` }} />
                  <span className="rc-twin-questions" style={{ width: `${questionShare}%` }} />
                </span>
                <small className="tnum">{fa(Math.round(timeShare))}٪ زمان · {fa(Math.round(questionShare))}٪ سؤال</small>
              </div>
            );
          })}
        </div>
      )}

      {tracked && slowest.length > 0 && (
        <p className="rc-list-line">
          بیشترین زمان:{" "}
          {slowest.map((item, position) => (
            <span key={item.index}>
              {position > 0 && "، "}
              <button type="button" className="rc-link" onClick={() => onJump(item.index)}>
                سؤال {fa(item.index + 1)}
              </button>{" "}
              ({seconds(item.timeSpentMs)}{item.outcome === "correct" ? "، درست" : item.outcome === "wrong" ? "، نادرست" : "، نزده"})
            </span>
          ))}
        </p>
      )}
      {rushed.length > 0 && (
        <p className="rc-list-line">
          نادرست در کمتر از ۲۰ ثانیه (احتمالاً با عجله):{" "}
          {rushed.map((item, position) => (
            <span key={item.index}>
              {position > 0 && "، "}
              <button type="button" className="rc-link" onClick={() => onJump(item.index)}>
                {fa(item.index + 1)}
              </button>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

/** Questions most participants got right and this student did not: the cheapest marks to win back. */
function GoldenMisses({ report, items, onJump }: { report: CardReport; items: CardItem[]; onJump: (index: number) => void }) {
  const ready = items.some((item) => item.crowdCorrectPercent !== null);
  const misses = items
    .filter((item) => item.outcome !== "correct" && (item.crowdCorrectPercent ?? 0) >= 60)
    .sort((a, b) => (b.crowdCorrectPercent ?? 0) - (a.crowdCorrectPercent ?? 0));
  return (
    <section className="rc-block" aria-labelledby="rc-golden-title">
      <div className="rc-head">
        <h2 id="rc-golden-title">سؤال‌های طلایی از دست‌رفته</h2>
        <p>سؤال‌هایی که بیشتر شرکت‌کننده‌ها درست زدند و تو نه؛ کم‌هزینه‌ترین نمره‌ها برای جبران.</p>
      </div>
      {!ready ? (
        <p className="rc-note">وقتی دست‌کم {fa(report.questionStatMinimum)} نفر در این آزمون شرکت کنند، این فهرست ساخته می‌شود.</p>
      ) : misses.length === 0 ? (
        <p className="rc-note">سؤالی نبود که بیشتر شرکت‌کننده‌ها درست زده باشند و تو از دست داده باشی.</p>
      ) : (
        <ul className="rc-golden">
          {misses.slice(0, 8).map((item) => (
            <li key={item.index}>
              <button type="button" className="rc-link" onClick={() => onJump(item.index)}>
                سؤال {fa(item.index + 1)}
              </button>
              <span>{subjectName(item.subjectCode)}</span>
              <span className="tnum">{fa(item.crowdCorrectPercent ?? 0)}٪ درست زدند</span>
              <span>{item.outcome === "wrong" ? "تو نادرست زدی" : "تو نزدی"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Progress({ report }: { report: CardReport }) {
  const points = [...report.history].filter((row) => row.konkurPercent !== null).reverse();
  if (points.length < 2) return null;
  const first = points[0].konkurPercent ?? 0;
  const last = points[points.length - 1].konkurPercent ?? 0;
  const change = Math.round(last - first);
  return (
    <section className="rc-block" aria-labelledby="rc-progress-title">
      <div className="rc-head">
        <h2 id="rc-progress-title">روند تو در آزمون‌های اخیر</h2>
        <p>
          {fa(points.length)} آزمون آخر، از قدیمی به جدید
          {change !== 0 ? `؛ ${fa(Math.abs(change))} درصد ${change > 0 ? "بالاتر" : "پایین‌تر"} از اولین آزمون این فهرست.` : "."}
        </p>
      </div>
      <div className="rx-trend">
        <ScoreTrend points={points.map((row) => ({ value: Math.max(0, row.konkurPercent ?? 0), label: row.examTitle }))} />
        <ol className="rx-trend-labels" aria-hidden="true">
          {points.map((row) => (
            <li key={row.attemptId} className="tnum">{toPersianDigits(Math.round(row.konkurPercent ?? 0))}٪</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function NextSteps({ report }: { report: CardReport }) {
  const weakest = [...report.subjects].sort((a, b) => a.percent - b.percent).slice(0, 3);
  if (weakest.length === 0) return null;
  return (
    <section className="rc-block rc-next" aria-labelledby="rc-next-title">
      <div className="rc-head">
        <h2 id="rc-next-title">قدم بعدی</h2>
      </div>
      <ol>
        {weakest.map((subject) => (
          <li key={subject.subjectCode}>
            <b>{subjectName(subject.subjectCode)}</b> ({pct(subject.percent)}): درس را{" "}
            <Link href={`/subjects/${subject.subjectCode}`}>مرور کن</Link>، بعد{" "}
            <Link href={`/questions?subject=${subject.subjectCode}`}>تست‌های همین درس</Link> را تمرین کن.
          </li>
        ))}
        <li>
          سؤال‌های نادرست و نزده را پایین همین صفحه با راه‌حل مرور کن؛ بعد{" "}
          <Link href="/exams">آزمون بعدی</Link> را بزن تا روندت را ببینی.
        </li>
      </ol>
    </section>
  );
}

export function ReportCard({
  report,
  items,
  onJump,
  charts,
}: {
  report: CardReport;
  items: CardItem[];
  onJump: (index: number) => void;
  /** The report's charts, placed after strengths and weaknesses. */
  charts?: ReactNode;
}) {
  return (
    <>
      {report.sections.length > 0 && <SectionsTable report={report} />}
      <RankEstimate report={report} />
      <Subjects report={report} />
      {charts}
      <TimeAndStrategy report={report} items={items} onJump={onJump} />
      <GoldenMisses report={report} items={items} onJump={onJump} />
      <Progress report={report} />
      <NextSteps report={report} />
    </>
  );
}
