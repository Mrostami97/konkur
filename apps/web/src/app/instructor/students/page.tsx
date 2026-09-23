"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { dayLabel, isoDay } from "../../../lib/coach";
import { formatPersianNumber } from "../../../lib/format";
import { AdminPageHeader, Badge, Card, DataState, TableWrap } from "../../../components/ds";
import { studentDisplayName, studentBackground, type CoachStudentSummary } from "./coach-data";

export default function CoachStudentsPage() {
  const [rows, setRows] = useState<CoachStudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<CoachStudentSummary[]>("/me/instructor/students"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست دانشجوها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AdminPageHeader
        title="دانشجوهای مشاوره"
        description="هر دانشجویی که از شما مشاوره رزرو کرده. برای هرکدام برنامهٔ هفتگی بنویسید؛ دانشجو آن را در پنل خودش می‌بیند و انجام هر کار را تیک می‌زند."
      />
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        onRetry={load}
        emptyTitle="هنوز دانشجویی از شما مشاوره رزرو نکرده"
        emptyDescription="بعد از اولین رزرو مشاوره، دانشجو اینجا اضافه می‌شود و می‌توانید برایش برنامه بنویسید."
        skeletonRows={4}
      >
        <Card padded={false}>
          <TableWrap>
            <thead>
              <tr>
                <th>دانشجو</th>
                <th>سابقه و هدف</th>
                <th>جلسه‌ها</th>
                <th>آخرین برنامه</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id}>
                  <td>
                    <strong>{studentDisplayName(row.student)}</strong>
                    <div className="ds-subtitle" dir="ltr" style={{ textAlign: "right" }}>{row.student.phone}</div>
                  </td>
                  <td className="ds-subtitle">{studentBackground(row.student)}</td>
                  <td>
                    {formatPersianNumber(row.sessions)}
                    {row.nextSessionAt && (
                      <div className="ds-subtitle">
                        بعدی: {new Date(row.nextSessionAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" })}
                      </div>
                    )}
                  </td>
                  <td>
                    {row.latestPlan ? (
                      <div className="pb-latest">
                        <span>
                          {row.latestPlan.title}{" "}
                          {row.latestPlan.status === "DRAFT" ? <Badge>پیش‌نویس</Badge> : <Badge tone="success">منتشرشده</Badge>}
                        </span>
                        <span className="pb-progress"><span style={{ width: `${row.latestPlan.percent}%` }} /></span>
                        <small className="ds-subtitle">
                          {dayLabel(isoDay(row.latestPlan.startsOn), { day: "numeric", month: "long" })} ·{" "}
                          {formatPersianNumber(row.latestPlan.done)} از {formatPersianNumber(row.latestPlan.total)} کار انجام‌شده
                        </small>
                      </div>
                    ) : (
                      <span className="ds-subtitle">هنوز برنامه‌ای ندارد</span>
                    )}
                  </td>
                  <td>
                    <Link className="ds-btn ds-btn-primary ds-btn-sm" href={`/instructor/students/${row.student.id}`}>
                      {row.latestPlan ? "برنامه‌ها" : "نوشتن برنامه"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      </DataState>
    </>
  );
}
