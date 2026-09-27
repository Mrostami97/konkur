"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "../../../components/ds";
import { CoachNote, ReportText, WeekFacts } from "../../../components/WeeklyReportParts";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { weekLabel, type ReportWeek, type WeeklyReport } from "../../../lib/weekly";

/**
 * The student's weekly reports, newest first, for the consultant to read
 * before the weekly session and answer after it. Weeks with nothing written
 * still show what the site logged, so a silent week is visible too.
 */
export function WeeklyReviews({ studentId }: { studentId: string }) {
  const [weeks, setWeeks] = useState<ReportWeek[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await apiFetch<ReportWeek[]>(`/me/instructor/students/${studentId}/weekly-reports`);
      setWeeks(rows);
      setOpen((current) => current ?? rows.find((week) => week.report?.submittedAt && !week.report.reviewedAt)?.weekStart ?? rows[0]?.weekStart ?? null);
    } catch {
      setFailed(true);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
    apiFetch<{ code: string; title: string }[]>("/subjects")
      .then((subjects) => setNames(new Map(subjects.map((item) => [item.code, item.title]))))
      .catch(() => undefined);
  }, [load]);

  function replace(report: WeeklyReport) {
    setWeeks((current) => current?.map((week) => (week.report?.id === report.id ? { ...week, report } : week)) ?? current);
  }

  const waiting = weeks?.filter((week) => week.report?.submittedAt && !week.report.reviewedAt).length ?? 0;
  const shown = weeks?.filter((week, index) => index === 0 || week.report || week.summary.studyMinutes > 0) ?? [];

  return (
    <Card>
      <div className="ds-row-between" style={{ marginBottom: "var(--sp-3)" }}>
        <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>گزارش‌های هفتگی</h2>
        {waiting > 0 && <Badge tone="warning">{toPersianDigits(waiting)} گزارش منتظر پاسخ</Badge>}
      </div>
      {failed ? (
        <Alert tone="danger">گزارش‌های هفتگی بارگذاری نشد.</Alert>
      ) : weeks === null ? (
        <p className="ds-help">در حال بارگذاری…</p>
      ) : (
        <ul className="wr-history">
          {shown.map((week) => (
            <li key={week.weekStart}>
              <details open={open === week.weekStart} onToggle={(event) => (event.currentTarget.open ? setOpen(week.weekStart) : undefined)}>
                <summary>
                  <strong>{weekLabel(week.weekStart)}</strong>
                  {week.report?.testsSolved ? <span>{toPersianDigits(week.report.testsSolved)} تست</span> : null}
                  {week.report?.reviewedAt ? (
                    <Badge tone="success">پاسخ داده شد</Badge>
                  ) : week.report?.submittedAt ? (
                    <Badge tone="warning">منتظر پاسخ شما</Badge>
                  ) : (
                    <Badge>گزارشی نفرستاده</Badge>
                  )}
                </summary>
                <div className="wr-history-body">
                  <WeekFacts week={week} names={names} />
                  {week.report && <ReportText report={week.report} />}
                  {week.report?.coachNote && <CoachNote report={week.report} />}
                  {week.report?.submittedAt && <ReviewForm report={week.report} onSaved={replace} />}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReviewForm({ report, onSaved }: { report: WeeklyReport; onSaved: (report: WeeklyReport) => void }) {
  const [note, setNote] = useState(report.coachNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiFetch<WeeklyReport>(`/me/instructor/weekly-reports/${report.id}/review`, { method: "PUT", body: { coachNote: note } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیرهٔ بازخورد ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ds-stack">
      <label className="ds-help" htmlFor={`note-${report.id}`}>بازخورد شما برای این هفته (دانشجو در پنلش می‌بیند)</label>
      <textarea
        id={`note-${report.id}`}
        className="ds-textarea ds-textarea-sm"
        value={note}
        maxLength={3000}
        onChange={(event) => setNote(event.target.value)}
        placeholder="جمع‌بندی جلسه، کارهای هفتهٔ بعد، نکته‌ای که باید حواسش باشد…"
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Button variant="primary" size="sm" loading={busy} disabled={note.trim().length < 2} onClick={() => void save()}>
          {report.coachNote ? "به‌روزرسانی بازخورد" : "ثبت بازخورد"}
        </Button>
      </div>
    </div>
  );
}
