"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { formatPersianNumber, formatRial, formatSharePercent } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Field,
  FieldRow,
  Input,
  Select,
  TableWrap,
} from "../../../components/ds";

interface TaughtCourse {
  revenueShareBp: number;
  sortOrder: number;
  course: { id: string; slug: string; title: string; isPublished: boolean };
}

interface Instructor {
  id: string;
  slug: string;
  displayName: string;
  roleTitle: string | null;
  avatarUrl: string | null;
  isPublished: boolean;
  userId: string | null;
  canSignIn: boolean;
  taughtCourses: TaughtCourse[];
}

interface Contributor {
  id: string;
  displayName: string;
  slug: string;
}

interface Course {
  id: string;
  title: string;
  isPublished: boolean;
}

interface Sales {
  profile: { displayName: string };
  totals: { grossRial: number; shareRial: number; students: number };
  courses: { courseId: string; title: string; grossRial: number; shareRial: number; students: number }[];
}

export default function AdminInstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [detaching, setDetaching] = useState<{ instructor: Instructor; course: TaughtCourse } | null>(null);
  const [sales, setSales] = useState<Sales | null>(null);
  const [salesFor, setSalesFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [instructorList, contributorList, courseList] = await Promise.all([
        apiFetch<Instructor[]>("/admin/instructors"),
        apiFetch<Contributor[]>("/admin/contributors"),
        apiFetch<Course[]>("/admin/courses"),
      ]);
      setInstructors(instructorList);
      setContributors(contributorList);
      setCourses(courseList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست مدرسان ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این عملیات ممکن نشد.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function confirmDetach() {
    const target = detaching;
    if (!target) return;
    const ok = await run(`${target.instructor.id}:detach`, async () => {
      await apiFetch(
        `/admin/courses/${target.course.course.id}/instructors/${target.instructor.id}`,
        { method: "DELETE" },
      );
      return `«${target.instructor.displayName}» از دورهٔ «${target.course.course.title}» برداشته شد. فروش‌های گذشته دست‌نخورده می‌مانند.`;
    });
    if (ok) setDetaching(null);
  }

  async function openSales(instructor: Instructor) {
    setSalesFor(instructor.id);
    setSales(null);
    setActionError(null);
    try {
      setSales(await apiFetch<Sales>(`/admin/instructors/${instructor.id}/sales`));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "خواندن آمار فروش ممکن نشد.");
      setSalesFor(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="مدرسان و سهم درآمد"
        description="هر مدرس یک پروفایل در «نویسندگان و مدرسان» است. اینجا مشخص می‌کنید هر کسی مدرس کدام دوره است و چه سهمی از فروش آن دارد."
      />

      <div className="ds-stack-lg">
        {actionError && <Alert tone="danger">{actionError}</Alert>}
        {notice && !actionError && <Alert tone="success">{notice}</Alert>}

        <AttachForm
          contributors={contributors}
          courses={courses}
          busy={busy === "attach"}
          onSubmit={(body) =>
            run("attach", async () => {
              await apiFetch(`/admin/courses/${body.courseId}/instructors`, {
                method: "POST",
                body: {
                  contributorProfileId: body.contributorProfileId,
                  revenueShareBp: body.revenueShareBp,
                  sortOrder: body.sortOrder,
                },
              });
              return "مدرس به دوره اضافه شد.";
            })
          }
        />

        <DataState
          loading={loading}
          error={error}
          isEmpty={instructors.length === 0}
          onRetry={load}
          emptyTitle="هنوز مدرسی به دوره‌ای وصل نشده"
          emptyDescription="با فرم بالا یک پروفایل را به‌عنوان مدرس یک دوره ثبت کنید. تا آن لحظه، هیچ فروشی به کسی نسبت داده نمی‌شود."
          skeletonRows={4}
        >
          <div className="ds-stack">
            {instructors.map((instructor) => (
              <Card key={instructor.id}>
                <div className="ds-row-between">
                  <div>
                    <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                      {instructor.displayName}
                    </h2>
                    <p className="ds-subtitle" style={{ marginTop: "var(--sp-1)" }}>
                      {instructor.roleTitle || "بدون عنوان"}
                    </p>
                  </div>
                  <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
                    {instructor.isPublished ? (
                      <Badge tone="success">صفحهٔ عمومی فعال</Badge>
                    ) : (
                      <Badge>منتشرنشده</Badge>
                    )}
                    {instructor.canSignIn ? (
                      <Badge tone="info">پنل مدرس دارد</Badge>
                    ) : (
                      <Badge tone="warning">بدون حساب کاربری</Badge>
                    )}
                  </div>
                </div>

                {!instructor.canSignIn && (
                  <div style={{ marginTop: "var(--sp-3)" }}>
                    <Alert tone="warning">
                      این پروفایل به هیچ حساب کاربری وصل نیست، پس صاحبش نمی‌تواند وارد پنل مدرس شود و آمار
                      فروشش را ببیند. در{" "}
                      <Link href="/admin/contributors" className="text-link">
                        نویسندگان و مدرسان
                      </Link>{" "}
                      حسابش را وصل کنید.
                    </Alert>
                  </div>
                )}

                <div style={{ marginTop: "var(--sp-4)" }}>
                  <TableWrap>
                    <thead>
                      <tr>
                        <th>دوره</th>
                        <th>وضعیت</th>
                        <th>سهم از فروش</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instructor.taughtCourses.map((taught) => (
                        <tr key={taught.course.id}>
                          <td>{taught.course.title}</td>
                          <td>
                            {taught.course.isPublished ? (
                              <Badge tone="success">منتشرشده</Badge>
                            ) : (
                              <Badge>پیش‌نویس</Badge>
                            )}
                          </td>
                          <td className="ds-table-numeric">{formatSharePercent(taught.revenueShareBp)}</td>
                          <td>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setActionError(null);
                                setNotice(null);
                                setDetaching({ instructor, course: taught });
                              }}
                              disabled={busy !== null}
                            >
                              برداشتن از دوره
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>

                <div className="ds-row" style={{ marginTop: "var(--sp-4)" }}>
                  <Button size="sm" onClick={() => void openSales(instructor)}>
                    دیدن آمار فروش
                  </Button>
                </div>

                {salesFor === instructor.id && sales && (
                  <div style={{ marginTop: "var(--sp-4)" }}>
                    <div className="ds-stat-row">
                      <div>
                        <span className="ds-stat-label">سهم مدرس</span>
                        <span className="ds-stat-value">{formatRial(sales.totals.shareRial)}</span>
                      </div>
                      <div>
                        <span className="ds-stat-label">فروش ناخالص</span>
                        <span className="ds-stat-value">{formatRial(sales.totals.grossRial)}</span>
                      </div>
                      <div>
                        <span className="ds-stat-label">دانشجو</span>
                        <span className="ds-stat-value">{formatPersianNumber(sales.totals.students)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </DataState>
      </div>

      <ConfirmDialog
        open={detaching !== null}
        title="این مدرس از دوره برداشته شود؟"
        description={`«${detaching?.instructor.displayName ?? ""}» دیگر مدرس «${detaching?.course.course.title ?? ""}» نخواهد بود و این دوره از پنل او حذف می‌شود. فروش‌ها و ثبت‌نام‌های گذشته تغییری نمی‌کنند و سهمی که داشت در تاریخچهٔ ممیزی ثبت می‌ماند.`}
        confirmLabel="بردار"
        tone="danger"
        busy={busy === `${detaching?.instructor.id}:detach`}
        onConfirm={() => void confirmDetach()}
        onCancel={() => setDetaching(null)}
      />
    </>
  );
}

function AttachForm({
  contributors,
  courses,
  busy,
  onSubmit,
}: {
  contributors: Contributor[];
  courses: Course[];
  busy: boolean;
  onSubmit: (body: {
    contributorProfileId: string;
    courseId: string;
    revenueShareBp: number;
    sortOrder: number;
  }) => Promise<boolean>;
}) {
  const [contributorProfileId, setContributorProfileId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [sharePercent, setSharePercent] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const percent = Number(sharePercent);
    if (!Number.isFinite(percent)) return;
    const ok = await onSubmit({
      contributorProfileId,
      courseId,
      // Percent in, basis points out: the API stores an integer so payout
      // arithmetic never touches a float.
      revenueShareBp: Math.round(percent * 100),
      sortOrder: Number(sortOrder) || 0,
    });
    if (ok) {
      setSharePercent("");
      setSortOrder("0");
    }
  }

  return (
    <Card>
      <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
        ثبت مدرس برای یک دوره
      </h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
        اگر همین پروفایل از قبل مدرس این دوره باشد، سهمش به‌روزرسانی می‌شود. مجموع سهم مدرسان یک دوره
        نمی‌تواند از ۱۰۰٪ بیشتر شود.
      </p>

      <form onSubmit={submit} className="ds-stack">
        <FieldRow>
          <Field label="مدرس" hint="از فهرست «نویسندگان و مدرسان»" required>
            {(props) => (
              <Select
                {...props}
                value={contributorProfileId}
                onChange={(event) => setContributorProfileId(event.target.value)}
                required
              >
                <option value="">انتخاب کنید</option>
                {contributors.map((contributor) => (
                  <option key={contributor.id} value={contributor.id}>
                    {contributor.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="دوره" required>
            {(props) => (
              <Select {...props} value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
                <option value="">انتخاب کنید</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                    {course.isPublished ? "" : " (پیش‌نویس)"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="سهم از فروش (درصد)" hint="مثلاً ۴۰ یا ۳۲٫۵" required>
            {(props) => (
              <Input
                {...props}
                value={sharePercent}
                onChange={(event) => setSharePercent(event.target.value)}
                inputMode="decimal"
                required
              />
            )}
          </Field>
          <Field label="ترتیب نمایش" hint="فقط وقتی یک دوره چند مدرس دارد معنا پیدا می‌کند">
            {(props) => (
              <Input
                {...props}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                inputMode="numeric"
              />
            )}
          </Field>
        </FieldRow>

        <div>
          <Button type="submit" variant="primary" loading={busy}>
            ثبت مدرس
          </Button>
        </div>
      </form>
    </Card>
  );
}
