"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { COACH_KINDS, dayLabel, isoDay, type CoachPlan } from "../../../../lib/coach";
import { formatPersianNumber } from "../../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
} from "../../../../components/ds";
import { studentBackground, studentDisplayName, type CoachStudentDetail } from "../coach-data";
import { blankDraft, draftFromPlan, PlanEditor, type PlanDraft } from "../PlanEditor";
import { WeeklyReviews } from "../WeeklyReviews";

const STATUS: Record<CoachPlan["status"], { label: string; tone: "neutral" | "success" | "warning" }> = {
  DRAFT: { label: "پیش‌نویس — دانشجو نمی‌بیند", tone: "warning" },
  PUBLISHED: { label: "ارسال‌شده", tone: "success" },
  ARCHIVED: { label: "بایگانی", tone: "neutral" },
};

function withProgress(plan: CoachPlan): CoachPlan {
  const done = plan.items.filter((item) => item.completedAt).length;
  return { ...plan, progress: { total: plan.items.length, done, percent: plan.items.length ? Math.round((done / plan.items.length) * 100) : 0 } };
}

export default function CoachStudentPage({ params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = use(pendingParams);
  const [detail, setDetail] = useState<CoachStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CoachPlan | null>(null);
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await apiFetch<CoachStudentDetail>(`/me/instructor/students/${params.id}`));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "این دانشجو از شما مشاوره نخریده و رزرو هم نکرده است."
          : err instanceof Error
            ? err.message
            : "خواندن اطلاعات دانشجو ممکن نشد.",
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  function replacePlan(plan: CoachPlan) {
    setDetail((current) => {
      if (!current) return current;
      const exists = current.plans.some((item) => item.id === plan.id);
      const plans = exists ? current.plans.map((item) => (item.id === plan.id ? withProgress(plan) : item)) : [withProgress(plan), ...current.plans];
      return { ...current, plans: plans.sort((left, right) => right.startsOn.localeCompare(left.startsOn)) };
    });
  }

  async function setStatus(plan: CoachPlan, action: "publish" | "archive") {
    setBusy(`${plan.id}:${action}`);
    setActionError(null);
    setNotice(null);
    try {
      replacePlan(await apiFetch<CoachPlan>(`/me/instructor/plans/${plan.id}/${action}`, { method: "POST" }));
      setNotice(action === "publish" ? `«${plan.title}» برای دانشجو ارسال شد.` : `«${plan.title}» بایگانی شد.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این عملیات ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    const plan = deleting;
    if (!plan) return;
    setBusy(`${plan.id}:delete`);
    try {
      await apiFetch(`/me/instructor/plans/${plan.id}`, { method: "DELETE" });
      setDetail((current) => (current ? { ...current, plans: current.plans.filter((item) => item.id !== plan.id) } : current));
      setNotice(`پیش‌نویس «${plan.title}» حذف شد.`);
      setDeleting(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "حذف ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  const name = detail ? studentDisplayName(detail.student) : "دانشجو";

  return (
    <>
      <AdminPageHeader
        title={name}
        description={detail ? studentBackground(detail.student) : undefined}
        action={
          <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
            <Link className="ds-btn ds-btn-ghost ds-btn-sm" href="/instructor/students">همهٔ دانشجوها</Link>
            {detail && !editing && (
              <Button variant="primary" onClick={() => { setNotice(null); setEditing(blankDraft()); }}>
                برنامهٔ جدید
              </Button>
            )}
          </div>
        }
      />

      <DataState loading={loading} error={error} onRetry={load} skeletonRows={5}>
        {detail && (
          <div className="pb-layout">
            <div className="ds-stack-lg">
              {notice && !actionError && <Alert tone="success">{notice}</Alert>}
              {actionError && <Alert tone="danger">{actionError}</Alert>}

              <WeeklyReviews studentId={params.id} />

              {editing ? (
                <PlanEditor
                  studentId={params.id}
                  initial={editing}
                  onCancel={() => setEditing(null)}
                  onSaved={(plan) => {
                    replacePlan(plan);
                    setEditing(null);
                    setOpenPlan(plan.id);
                    setNotice(plan.status === "PUBLISHED" ? `«${plan.title}» ذخیره و برای دانشجو ارسال شد.` : `«${plan.title}» به‌صورت پیش‌نویس ذخیره شد.`);
                  }}
                />
              ) : detail.plans.length === 0 ? (
                <Card>
                  <div className="ds-empty">
                    <strong>هنوز برای {name} برنامه‌ای ننوشته‌اید</strong>
                    <p>برنامهٔ هفتگی را روز به روز بچینید؛ بعد از ارسال، دانشجو آن را در داشبوردش می‌بیند و انجام هر کار را ثبت می‌کند.</p>
                    <Button variant="primary" onClick={() => setEditing(blankDraft())}>نوشتن اولین برنامه</Button>
                  </div>
                </Card>
              ) : (
                detail.plans.map((plan) => {
                  const status = STATUS[plan.status];
                  const expanded = openPlan === plan.id;
                  return (
                    <Card key={plan.id}>
                      <div className="pb-plan">
                        <div className="pb-plan-head">
                          <div>
                            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>{plan.title}</h2>
                            <p className="ds-subtitle">
                              {dayLabel(isoDay(plan.startsOn), { day: "numeric", month: "long" })} تا{" "}
                              {dayLabel(isoDay(plan.endsOn), { day: "numeric", month: "long" })} ·{" "}
                              {formatPersianNumber(plan.progress.done)} از {formatPersianNumber(plan.progress.total)} کار انجام‌شده
                            </p>
                          </div>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </div>
                        <span className="pb-progress pb-progress-lg"><span style={{ width: `${plan.progress.percent}%` }} /></span>

                        <div className="ds-row" style={{ gap: "var(--sp-2)", flexWrap: "wrap" }}>
                          <Button size="sm" onClick={() => setOpenPlan(expanded ? null : plan.id)}>
                            {expanded ? "بستن جزئیات" : "کارها و گزارش دانشجو"}
                          </Button>
                          {plan.status !== "ARCHIVED" && (
                            <Button size="sm" onClick={() => { setNotice(null); setEditing(draftFromPlan(plan)); }} disabled={busy !== null}>
                              ویرایش
                            </Button>
                          )}
                          <Button size="sm" onClick={() => { setNotice(null); setEditing(draftFromPlan(plan, 7)); }} disabled={busy !== null}>
                            کپی برای هفتهٔ بعد
                          </Button>
                          {plan.status === "DRAFT" && (
                            <Button size="sm" variant="primary" onClick={() => void setStatus(plan, "publish")} loading={busy === `${plan.id}:publish`} disabled={busy !== null}>
                              ارسال برای دانشجو
                            </Button>
                          )}
                          {plan.status === "PUBLISHED" && (
                            <Button size="sm" onClick={() => void setStatus(plan, "archive")} loading={busy === `${plan.id}:archive`} disabled={busy !== null}>
                              بایگانی
                            </Button>
                          )}
                          {plan.status === "DRAFT" && (
                            <Button size="sm" variant="danger" onClick={() => setDeleting(plan)} disabled={busy !== null}>
                              حذف پیش‌نویس
                            </Button>
                          )}
                        </div>

                        {expanded && (
                          <ul className="pb-report">
                            {plan.items.map((item) => (
                              <li key={item.id} className={item.completedAt ? "pb-report-done" : ""}>
                                <span className="pb-report-check" aria-hidden>{item.completedAt ? "✓" : ""}</span>
                                <div>
                                  <strong>{item.title}</strong>
                                  <small>
                                    {dayLabel(isoDay(item.day), { weekday: "long", day: "numeric", month: "long" })} · {COACH_KINDS[item.kind].label}
                                    {item.targetMinutes ? ` · هدف ${formatPersianNumber(item.targetMinutes)} دقیقه` : ""}
                                  </small>
                                  {item.completedAt && (
                                    <small className="pb-report-student">
                                      انجام شد{item.actualMinutes !== null ? ` در ${formatPersianNumber(item.actualMinutes)} دقیقه` : ""}
                                      {item.studentNote ? ` — «${item.studentNote}»` : ""}
                                    </small>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            <aside className="ds-stack">
              <Card>
                <h2 className="ds-title" style={{ fontSize: "var(--text-md)" }}>آزمون‌های اخیر</h2>
                {detail.attempts.length === 0 ? (
                  <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>هنوز آزمونی نداده است.</p>
                ) : (
                  <ul className="pb-attempts">
                    {detail.attempts.map((attempt) => (
                      <li key={attempt.id}>
                        <span>
                          <strong>{attempt.exam.title}</strong>
                          <small>
                            {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString("fa-IR", { dateStyle: "medium" }) : "—"}
                          </small>
                        </span>
                        {attempt.score && (
                          <b>{formatPersianNumber(Math.round(attempt.score.percentCorrect))}٪</b>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="ds-title" style={{ fontSize: "var(--text-md)" }}>تماس</h2>
                <p className="ds-subtitle" dir="ltr" style={{ textAlign: "right", marginTop: "var(--sp-2)" }}>{detail.student.phone}</p>
                <Link className="ds-btn ds-btn-ghost ds-btn-sm" href="/instructor/consultations" style={{ marginTop: "var(--sp-3)" }}>
                  جلسه‌های مشاوره
                </Link>
              </Card>
            </aside>
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={deleting !== null}
        title="این پیش‌نویس حذف شود؟"
        description={`پیش‌نویس «${deleting?.title ?? ""}» هنوز برای دانشجو ارسال نشده و با حذف، برای همیشه پاک می‌شود.`}
        confirmLabel="حذف"
        tone="danger"
        busy={busy === `${deleting?.id}:delete`}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
