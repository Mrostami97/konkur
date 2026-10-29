"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Glyph } from "../../../components/SubjectIcon";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { AccountShell } from "../AccountShell";
import { MyVideoLicense } from "../MyVideoLicense";
import { ProgressRing } from "../charts";
import { faDate, type CourseProgress, type Enrollment, type Entitlement, type LearningProgress } from "../data";

const TONES = ["teal", "blue", "violet", "amber"] as const;

const GRANT_LABEL: Record<string, string> = {
  ORDER: "خرید",
  GIFT: "هدیه",
  MANUAL: "ثبت دستی",
  TRIAL: "دورهٔ آزمایشی",
};

export default function MyCoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Enrollment[]>("/me/enrollments"),
      apiFetch<LearningProgress>("/me/learning-progress"),
      apiFetch<Entitlement[]>("/me/entitlements"),
    ])
      .then(([enrolled, learning, access]) => {
        setEnrollments(enrolled);
        setProgress(learning.courses);
        setEntitlements(access);
      })
      .catch(() => setFailed(true));
  }, []);

  const bySlug = new Map(progress.map((item) => [item.course.slug, item]));
  // Enrolled courses, then any other course this person can study (a gift,
  // a bundle, staff access): the dashboard shows those too, so this page must.
  const enrolledSlugs = new Set((enrollments ?? []).map((enrollment) => enrollment.course.slug));
  const rows =
    enrollments === null
      ? null
      : [
          ...enrollments.map((enrollment) => ({ key: enrollment.id, ...enrollment.course, enrolledAt: enrollment.enrolledAt as string | null })),
          ...progress
            .filter((item) => !enrolledSlugs.has(item.course.slug))
            .map((item) => ({ key: item.course.slug, slug: item.course.slug, title: item.course.title, description: "", enrolledAt: null as string | null })),
        ];
  const now = Date.now();
  const activeAccess = entitlements.filter(
    (item) => !item.revokedAt && (!item.endAt || new Date(item.endAt).getTime() > now),
  );

  return (
    <AccountShell
      title="دوره‌های من"
      subtitle="دوره‌هایی که در آن‌ها ثبت‌نام کرده‌ای، پیشرفتت در هرکدام و دسترسی‌هایی که داری."
      action={<Link href="/courses" className="st-btn st-btn-soft">دیدن همهٔ دوره‌ها</Link>}
    >
      {failed ? (
        <p className="st-alert st-alert-danger">فهرست دوره‌ها الان بارگذاری نشد. صفحه را دوباره باز کن.</p>
      ) : rows === null ? (
        <div className="st-course-grid" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => <div className="st-skel st-skel-card-lg" key={index} />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="st-card">
          <div className="st-empty st-empty-lg">
            <span className="st-empty-icon"><Glyph name="play" /></span>
            <strong>هنوز در دوره‌ای ثبت‌نام نکرده‌ای</strong>
            <p>دوره‌های کامل هر درس را ببین، یا با ویدیوی رایگان دانشگاهی همان درس شروع کن.</p>
            <div className="st-row">
              <Link href="/courses" className="st-btn st-btn-primary">دوره‌ها</Link>
              <Link href="/free-videos" className="st-btn st-btn-soft">ویدیوی رایگان</Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="st-course-grid">
          {rows.map((course, index) => {
            const item = bySlug.get(course.slug);
            const tone = TONES[index % TONES.length];
            return (
              <article className="st-course-card" key={course.key}>
                <div className={`st-course-cover st-cover-${tone}`}>
                  <Glyph name="play" />
                  <ProgressRing percent={item?.progressPercent ?? 0} size={70} stroke={7} tone="light" />
                </div>
                <div className="st-course-body">
                  <h2>
                    <Link href={`/courses/${course.slug}`}>{course.title}</Link>
                  </h2>
                  {course.description && <p>{course.description}</p>}
                  <div className="st-course-meta">
                    <span>
                      <Glyph name="list" />
                      {item
                        ? `${toPersianDigits(item.completedLessons)} از ${toPersianDigits(item.totalLessons)} درس`
                        : "هنوز شروع نشده"}
                    </span>
                    {course.enrolledAt && (
                      <span>
                        <Glyph name="calendar" />
                        ثبت‌نام: {faDate(course.enrolledAt)}
                      </span>
                    )}
                  </div>
                  <div className="st-course-actions">
                    {item?.resumeLesson ? (
                      <Link href={`/lessons/${item.resumeLesson.id}`} className="st-btn st-btn-primary st-btn-sm">
                        ادامه: {item.resumeLesson.title}
                      </Link>
                    ) : (
                      <Link href={`/courses/${course.slug}`} className="st-btn st-btn-primary st-btn-sm">
                        {item ? "مرور دوره" : "شروع دوره"}
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MyVideoLicense />

      {activeAccess.length > 0 && (
        <section className="st-card">
          <header className="st-card-head">
            <h2>
              <span className="st-card-icon"><Glyph name="shield" /></span>
              دسترسی‌های فعال
            </h2>
            <Link href="/account/orders" className="st-link">سفارش‌ها ←</Link>
          </header>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>محصول</th>
                  <th>از طریق</th>
                  <th>شروع</th>
                  <th>پایان</th>
                </tr>
              </thead>
              <tbody>
                {activeAccess.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.product.title}</strong></td>
                    <td>{GRANT_LABEL[item.grantedVia] ?? item.grantedVia}</td>
                    <td>{faDate(item.startAt)}</td>
                    <td>{item.endAt ? faDate(item.endAt) : "بدون محدودیت"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AccountShell>
  );
}
