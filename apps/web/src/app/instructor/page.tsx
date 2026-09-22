"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatPersianNumber, formatRial, formatSharePercent } from "../../lib/format";
import { AdminPageHeader, Badge, Card, DataState, TableWrap } from "../../components/ds";

interface CourseSales {
  courseId: string;
  slug: string;
  title: string;
  isPublished: boolean;
  revenueShareBp: number;
  students: number;
  grossRial: number;
  shareRial: number;
}

interface SalesResponse {
  profile: { displayName: string; roleTitle: string | null };
  courses: CourseSales[];
  totals: { grossRial: number; shareRial: number; students: number };
  monthly: { month: string; grossRial: number; shareRial: number; orders: number }[];
}

export default function InstructorSalesPage() {
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<SalesResponse>("/me/instructor/sales"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن آمار فروش ممکن نشد.");
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
        title="دوره‌ها و درآمد"
        description="فروش دوره‌هایی که مدرس آن‌ها هستید و سهمی که از هر کدام به شما می‌رسد. اعداد فقط مربوط به دوره‌های خودتان است."
      />

      <DataState
        loading={loading}
        error={error}
        isEmpty={data !== null && data.courses.length === 0}
        onRetry={load}
        emptyTitle="هنوز دوره‌ای به نام شما ثبت نشده"
        emptyDescription="وقتی مدیر شما را به‌عنوان مدرس یک دوره ثبت کند، فروش و سهم شما از همان لحظه اینجا شمرده می‌شود."
        skeletonRows={5}
      >
        {data && (
          <div className="ds-stack-lg">
            <Card>
              <div className="ds-stat-row">
                <div>
                  <span className="ds-stat-label">سهم شما از فروش</span>
                  <span className="ds-stat-value">{formatRial(data.totals.shareRial)}</span>
                </div>
                <div>
                  <span className="ds-stat-label">فروش ناخالص دوره‌های شما</span>
                  <span className="ds-stat-value">{formatRial(data.totals.grossRial)}</span>
                </div>
                <div>
                  <span className="ds-stat-label">دانشجویان ثبت‌نام‌شده</span>
                  <span className="ds-stat-value">{formatPersianNumber(data.totals.students)}</span>
                </div>
              </div>
              <p className="ds-hint" style={{ marginTop: "var(--sp-4)" }}>
                «فروش ناخالص» مبلغی است که دانشجو پرداخت کرده و «سهم شما» همان مبلغ ضرب در درصد قرارداد شما
                برای هر دوره است. در بسته‌هایی که چند دوره را با هم می‌فروشند، مبلغ به‌طور مساوی بین دوره‌های
                همان بسته تقسیم می‌شود و بعد سهم شما حساب می‌گردد. گرد کردن همیشه رو به پایین است.
              </p>
            </Card>

            <Card padded={false}>
              <div className="ds-card-head">
                <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                  به تفکیک دوره
                </h2>
              </div>
              <TableWrap>
                <thead>
                  <tr>
                    <th>دوره</th>
                    <th>وضعیت</th>
                    <th>سهم قراردادی</th>
                    <th>دانشجو</th>
                    <th>فروش ناخالص</th>
                    <th>سهم شما</th>
                  </tr>
                </thead>
                <tbody>
                  {data.courses.map((course) => (
                    <tr key={course.courseId}>
                      <td>
                        {course.isPublished ? (
                          <Link href={`/courses/${course.slug}`} className="text-link">
                            {course.title}
                          </Link>
                        ) : (
                          course.title
                        )}
                      </td>
                      <td>
                        {course.isPublished ? <Badge tone="success">منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
                      </td>
                      <td className="ds-table-numeric">{formatSharePercent(course.revenueShareBp)}</td>
                      <td className="ds-table-numeric">{formatPersianNumber(course.students)}</td>
                      <td className="ds-table-numeric">{formatRial(course.grossRial)}</td>
                      <td className="ds-table-numeric">
                        <strong>{formatRial(course.shareRial)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>

            {data.monthly.length > 0 && (
              <Card padded={false}>
                <div className="ds-card-head">
                  <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                    روند ماهانه
                  </h2>
                </div>
                <TableWrap>
                  <thead>
                    <tr>
                      <th>ماه</th>
                      <th>تعداد خرید</th>
                      <th>فروش ناخالص</th>
                      <th>سهم شما</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((point) => (
                      <tr key={point.month}>
                        <td className="ds-table-numeric">{point.month}</td>
                        <td className="ds-table-numeric">{formatPersianNumber(point.orders)}</td>
                        <td className="ds-table-numeric">{formatRial(point.grossRial)}</td>
                        <td className="ds-table-numeric">{formatRial(point.shareRial)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </Card>
            )}
          </div>
        )}
      </DataState>
    </>
  );
}
