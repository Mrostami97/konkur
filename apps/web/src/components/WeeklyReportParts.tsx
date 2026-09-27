import { Glyph } from "./SubjectIcon";
import "./weekly-report.css";
import { subjectName } from "../content/subject-names";
import { toPersianDigits } from "../lib/format";
import { ENERGY_LABEL, hoursLabel, type ReportWeek, type WeeklyReport } from "../lib/weekly";

const shortDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "Asia/Tehran" });

/** What the site itself recorded for the week. */
export function WeekFacts({ week, names }: { week: ReportWeek; names: Map<string, string> }) {
  const { summary } = week;
  return (
    <div className="wr-facts">
      <dl className="wr-stats">
        <div>
          <dt>ساعت مطالعهٔ ثبت‌شده</dt>
          <dd>{hoursLabel(summary.studyMinutes)}</dd>
        </div>
        <div>
          <dt>کارهای برنامهٔ مشاور</dt>
          <dd>{summary.planTasks > 0 ? `${toPersianDigits(summary.planTasksDone)} از ${toPersianDigits(summary.planTasks)}` : "برنامه‌ای برای این هفته نبود"}</dd>
        </div>
        <div>
          <dt>آزمون‌های سایت</dt>
          <dd>{summary.exams.length > 0 ? `${toPersianDigits(summary.exams.length)} آزمون` : "آزمونی ثبت نشده"}</dd>
        </div>
      </dl>
      {summary.studyBySubject.length > 0 && (
        <div className="wr-chips">
          {summary.studyBySubject.map((row) => (
            <span className="wr-chip" key={row.subjectCode}>
              {names.get(row.subjectCode) ?? subjectName(row.subjectCode)} · {hoursLabel(row.minutes)}
            </span>
          ))}
        </div>
      )}
      {summary.exams.length > 0 && (
        <ul className="wr-exams">
          {summary.exams.map((exam, index) => (
            <li key={`${exam.title}-${index}`}>
              {exam.title}
              {exam.percentCorrect !== null && <b>{toPersianDigits(Math.round(exam.percentCorrect))}٪</b>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportText({ report }: { report: WeeklyReport }) {
  return (
    <dl className="wr-text">
      {report.energy && (
        <div>
          <dt>حال و انرژی</dt>
          <dd>{ENERGY_LABEL[report.energy]}</dd>
        </div>
      )}
      {report.wentWell && (
        <div>
          <dt>خوب پیش رفت</dt>
          <dd>{report.wentWell}</dd>
        </div>
      )}
      {report.obstacles && (
        <div>
          <dt>گیر کرد یا عقب ماند</dt>
          <dd>{report.obstacles}</dd>
        </div>
      )}
      {report.questions && (
        <div>
          <dt>سؤال‌ها</dt>
          <dd>{report.questions}</dd>
        </div>
      )}
    </dl>
  );
}

export function CoachNote({ report }: { report: WeeklyReport }) {
  return (
    <section className="wr-coach" aria-label="بازخورد مشاور">
      <span className="wr-coach-mark" aria-hidden="true"><Glyph name="chat" /></span>
      <div>
        <strong>بازخورد {report.reviewedBy?.displayName ?? "مشاور"}</strong>
        <p>{report.coachNote}</p>
        {report.reviewedAt && <small>{shortDate.format(new Date(report.reviewedAt))}</small>}
      </div>
    </section>
  );
}
