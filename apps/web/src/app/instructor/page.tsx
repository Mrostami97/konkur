"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatPersianNumber, formatRial, formatSharePercent } from "../../lib/format";
import { AdminPageHeader, Badge, BarChart, Card, DataState, Kpi, KpiGrid, TableWrap } from "../../components/ds";
import { PanelIcon } from "../../components/PanelIcons";

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
            <KpiGrid>
              <Kpi
                label="سهم شما از فروش"
                value={formatRial(data.totals.shareRial)}
                hint="مبلغی که بابت این دوره‌ها به شما می‌رسد"
                icon={<PanelIcon name="money" />}
                tone="success"
                small
              />
              <Kpi
                label="فروش ناخالص دوره‌های شما"
                value={formatRial(data.totals.grossRial)}
                hint="کل مبلغی که دانشجویان پرداخت کرده‌اند"
                icon={<PanelIcon name="commerce" />}
                tone="warm"
                small
              />
              <Kpi
                label="دانشجویان ثبت‌نام‌شده"
                value={formatPersianNumber(data.totals.students)}
                hint={`در ${formatPersianNumber(data.courses.length)} دوره`}
                icon={<PanelIcon name="students" />}
                tone="info"
              />
            </KpiGrid>

            <Card>
              <p className="ds-hint" style={{ margin: 0 }}>
                «فروش ناخالص» مبلغی است که دانشجو پرداخت کرده و «سهم شما» همان مبلغ ضرب در درصد قرارداد شما
                برای هر دوره است. در بسته‌هایی که چند دوره را با هم می‌فروشند، مبلغ به‌طور مساوی بین دوره‌های
                همان بسته تقسیم می‌شود و بعد سهم شما حساب می‌گردد. گرد کردن همیشه رو به پایین است.
              </p>
            </Card>

            {data.monthly.length > 0 && (
              <Card padded={false}>
                <div className="ds-card-head">
                  <div>
                    <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                      سهم شما به تفکیک ماه
                    </h2>
                    <p className="ds-subtitle" style={{ marginTop: "var(--sp-1)" }}>
                      دوازده ماه اخیر. روی هر ستون نگه دارید تا مبلغ دقیق را ببینید.
                    </p>
                  </div>
                </div>
                <div style={{ padding: "var(--sp-5)" }}>
                  <BarChart
                    points={data.monthly.slice(-12).map((point) => ({
                      label: point.month.slice(2),
                      value: point.shareRial,
                    }))}
                    formatValue={formatRial}
                  />
                </div>
              </Card>
            )}

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

          </div>
        )}
      </DataState>
    </>
  );
}
