"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { subjects } from "../../../content/editorial";
import { API_URL, apiFetch, apiUpload } from "../../../lib/api";
import { formatPersianNumber, toPersianDigits } from "../../../lib/format";
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
  Kpi,
  KpiGrid,
  Select,
  TableWrap,
  Textarea,
} from "../../../components/ds";
import { PanelIcon } from "../../../components/PanelIcons";

type Degree = "MASTER" | "PHD";

interface Achievement {
  id: string;
  displayName: string;
  photoArtifactId: string | null;
  photoArtifact: { checksum: string } | null;
  examYear: number;
  degree: Degree;
  field: string;
  rank: number;
  rankLabel: string | null;
  acceptedUniversity: string | null;
  acceptedProgram: string | null;
  quote: string | null;
  subjectSlugs: string[];
  courseId: string | null;
  course: { id: string; title: string } | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  consentConfirmedAt: string | null;
  consentNote: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

interface Course {
  id: string;
  title: string;
  isPublished: boolean;
}

interface FormState {
  displayName: string;
  examYear: string;
  degree: Degree;
  field: string;
  rank: string;
  rankLabel: string;
  acceptedUniversity: string;
  acceptedProgram: string;
  quote: string;
  subjectSlugs: string[];
  courseId: string;
  videoUrl: string;
  sourceUrl: string;
  consentDate: string;
  consentNote: string;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: string;
  photoArtifactId: string | null;
  photoPath: string | null;
}

const EMPTY: FormState = {
  displayName: "",
  examYear: "1404",
  degree: "MASTER",
  field: "مهندسی کامپیوتر",
  rank: "",
  rankLabel: "",
  acceptedUniversity: "",
  acceptedProgram: "",
  quote: "",
  subjectSlugs: [],
  courseId: "",
  videoUrl: "",
  sourceUrl: "",
  consentDate: "",
  consentNote: "",
  isPublished: false,
  isFeatured: false,
  sortOrder: "0",
  photoArtifactId: null,
  photoPath: null,
};

const dateFormat = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function photoPathOf(row: Achievement) {
  return row.photoArtifact ? `/media/${row.photoArtifact.checksum.replace("sha256:", "")}` : null;
}

function toForm(row: Achievement): FormState {
  return {
    displayName: row.displayName,
    examYear: String(row.examYear),
    degree: row.degree,
    field: row.field,
    rank: String(row.rank),
    rankLabel: row.rankLabel ?? "",
    acceptedUniversity: row.acceptedUniversity ?? "",
    acceptedProgram: row.acceptedProgram ?? "",
    quote: row.quote ?? "",
    subjectSlugs: row.subjectSlugs,
    courseId: row.courseId ?? "",
    videoUrl: row.videoUrl ?? "",
    sourceUrl: row.sourceUrl ?? "",
    consentDate: row.consentConfirmedAt ? row.consentConfirmedAt.slice(0, 10) : "",
    consentNote: row.consentNote ?? "",
    isPublished: row.isPublished,
    isFeatured: row.isFeatured,
    sortOrder: String(row.sortOrder),
    photoArtifactId: row.photoArtifactId,
    photoPath: photoPathOf(row),
  };
}

/** The API replaces the whole row on save, so every field is always sent. */
function toBody(form: FormState) {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    displayName: form.displayName.trim(),
    examYear: Number(form.examYear),
    degree: form.degree,
    field: form.field.trim(),
    rank: Number(form.rank),
    rankLabel: optional(form.rankLabel),
    acceptedUniversity: optional(form.acceptedUniversity),
    acceptedProgram: optional(form.acceptedProgram),
    quote: optional(form.quote),
    subjectSlugs: form.subjectSlugs,
    courseId: form.courseId || undefined,
    videoUrl: optional(form.videoUrl),
    sourceUrl: optional(form.sourceUrl),
    consentConfirmedAt: form.consentDate ? new Date(`${form.consentDate}T12:00:00Z`).toISOString() : undefined,
    consentNote: optional(form.consentNote),
    isPublished: form.isPublished,
    isFeatured: form.isFeatured,
    sortOrder: Number(form.sortOrder) || 0,
    photoArtifactId: form.photoArtifactId ?? undefined,
  };
}

export default function AdminAchievementsPage() {
  const [rows, setRows] = useState<Achievement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [erasing, setErasing] = useState<Achievement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, courseList] = await Promise.all([
        apiFetch<Achievement[]>("/admin/achievements"),
        apiFetch<Course[]>("/admin/courses"),
      ]);
      setRows(list);
      setCourses(courseList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست نتایج ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Clearing the consent date takes publication with it, as the API would.
      if (key === "consentDate" && !value) next.isPublished = false;
      return next;
    });
  }

  function toggleSubject(slug: string) {
    setForm((current) => ({
      ...current,
      subjectSlugs: current.subjectSlugs.includes(slug)
        ? current.subjectSlugs.filter((item) => item !== slug)
        : [...current.subjectSlugs, slug],
    }));
  }

  function startEdit(row: Achievement) {
    setEditingId(row.id);
    setForm(toForm(row));
    setNotice(null);
    setActionError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setActionError(null);
    try {
      const result = await apiUpload<{ photoArtifactId: string; photoPath: string }>("/admin/achievements/photo", file);
      setForm((current) => ({ ...current, photoArtifactId: result.photoArtifactId, photoPath: result.photoPath }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "بارگذاری عکس ممکن نشد.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      if (editingId) {
        await apiFetch(`/admin/achievements/${editingId}`, { method: "PATCH", body: toBody(form) });
        setNotice(`نتیجهٔ «${form.displayName}» به‌روز شد.`);
      } else {
        await apiFetch("/admin/achievements", { method: "POST", body: toBody(form) });
        setNotice(
          form.isPublished
            ? `نتیجهٔ «${form.displayName}» ثبت و روی سایت منتشر شد.`
            : `نتیجهٔ «${form.displayName}» به‌صورت پیش‌نویس ثبت شد.`,
        );
      }
      resetForm();
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ذخیرهٔ نتیجه ممکن نشد.");
    } finally {
      setSaving(false);
    }
  }

  async function unpublish(row: Achievement) {
    setBusy(`${row.id}:unpublish`);
    setActionError(null);
    setNotice(null);
    try {
      await apiFetch(`/admin/achievements/${row.id}/unpublish`, { method: "POST" });
      setNotice(`نتیجهٔ «${row.displayName}» از سایت برداشته شد. عکسش هم دیگر برای عموم باز نمی‌شود.`);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "برداشتن نتیجه ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmErase() {
    const target = erasing;
    if (!target) return;
    setBusy(`${target.id}:erase`);
    setActionError(null);
    setNotice(null);
    try {
      await apiFetch(`/admin/achievements/${target.id}`, { method: "DELETE" });
      setNotice(`نتیجهٔ «${target.displayName}» و عکسش برای همیشه پاک شد.`);
      if (editingId === target.id) resetForm();
      setErasing(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "پاک کردن نتیجه ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  const published = rows.filter((row) => row.isPublished);
  const withoutConsent = rows.filter((row) => !row.consentConfirmedAt);
  const bestRank = published.length ? Math.min(...published.map((row) => row.rank)) : null;
  const rankValid = Number.isInteger(Number(form.rank)) && Number(form.rank) >= 1;

  return (
    <>
      <AdminPageHeader
        title="نتایج شاگردان"
        description="رتبه‌ها و قبولی‌هایی که روی صفحهٔ اصلی و صفحهٔ «نتایج شاگردان» نمایش داده می‌شوند. هیچ نتیجه‌ای بدون ثبت تاریخ رضایت خود شاگرد منتشر نمی‌شود."
        action={
          <Link href="/results" className="ds-btn ds-btn-secondary" target="_blank">
            دیدن صفحهٔ عمومی
          </Link>
        }
      />

      <div className="ds-stack-lg">
        <KpiGrid>
          <Kpi label="منتشرشده روی سایت" value={formatPersianNumber(published.length)} icon={<PanelIcon name="trophy" />} />
          <Kpi
            label="بهترین رتبهٔ منتشرشده"
            value={bestRank === null ? "—" : toPersianDigits(bestRank)}
            tone="warm"
            icon={<PanelIcon name="chart" />}
          />
          <Kpi
            label="پیش‌نویس"
            value={formatPersianNumber(rows.length - published.length)}
            tone="info"
            icon={<PanelIcon name="article" />}
          />
          <Kpi
            label="بدون تاریخ رضایت"
            value={formatPersianNumber(withoutConsent.length)}
            hint="تا ثبت رضایت، قابل انتشار نیست"
            tone="success"
            icon={<PanelIcon name="check" />}
          />
        </KpiGrid>

        {actionError && <Alert tone="danger">{actionError}</Alert>}
        {notice && !actionError && <Alert tone="success">{notice}</Alert>}

        <div ref={formRef}>
          <Card>
            <div className="ds-row-between">
              <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                {editingId ? `ویرایش نتیجهٔ «${form.displayName}»` : "ثبت نتیجهٔ تازه"}
              </h2>
              {editingId && (
                <Button type="button" size="sm" onClick={resetForm}>
                  انصراف از ویرایش
                </Button>
              )}
            </div>

            <form onSubmit={submit} className="ds-stack" style={{ marginTop: "var(--sp-5)" }}>
              <FieldRow>
                <Field label="نام نمایشی" hint="همان‌طور که شاگرد اجازه داده: نام کامل یا نام و حرف اول" required>
                  {(props) => (
                    <Input {...props} value={form.displayName} onChange={(e) => update("displayName", e.target.value)} required minLength={2} maxLength={80} />
                  )}
                </Field>
                <Field label="رتبه" required error={form.rank && !rankValid ? "رتبه باید عدد صحیح مثبت باشد." : undefined}>
                  {(props) => (
                    <Input {...props} value={form.rank} onChange={(e) => update("rank", e.target.value)} inputMode="numeric" required dir="ltr" />
                  )}
                </Field>
                <Field label="توضیح رتبه" hint="مثلاً «رتبهٔ کشوری» یا «رتبهٔ منطقه ۲»">
                  {(props) => <Input {...props} value={form.rankLabel} onChange={(e) => update("rankLabel", e.target.value)} maxLength={80} />}
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="سال کنکور" required>
                  {(props) => (
                    <Input {...props} value={form.examYear} onChange={(e) => update("examYear", e.target.value)} inputMode="numeric" required dir="ltr" />
                  )}
                </Field>
                <Field label="مقطع" required>
                  {(props) => (
                    <Select {...props} value={form.degree} onChange={(e) => update("degree", e.target.value as Degree)}>
                      <option value="MASTER">ارشد</option>
                      <option value="PHD">دکتری</option>
                    </Select>
                  )}
                </Field>
                <Field label="رشته" required>
                  {(props) => <Input {...props} value={form.field} onChange={(e) => update("field", e.target.value)} required maxLength={80} />}
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="دانشگاه قبولی">
                  {(props) => (
                    <Input {...props} value={form.acceptedUniversity} onChange={(e) => update("acceptedUniversity", e.target.value)} maxLength={120} />
                  )}
                </Field>
                <Field label="گرایش یا رشته‌محل">
                  {(props) => (
                    <Input {...props} value={form.acceptedProgram} onChange={(e) => update("acceptedProgram", e.target.value)} maxLength={120} />
                  )}
                </Field>
                <Field label="دورهٔ مرتبط" hint="دوره‌ای که شاگرد در آن بوده">
                  {(props) => (
                    <Select {...props} value={form.courseId} onChange={(e) => update("courseId", e.target.value)}>
                      <option value="">بدون دوره</option>
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

              <div className="ds-field">
                <span className="ds-label">درس‌هایی که با شما خوانده</span>
                <div className="ach-subjects">
                  {subjects.map((subject) => (
                    <label key={subject.slug} className={`ach-chip${form.subjectSlugs.includes(subject.slug) ? " ach-chip-on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={form.subjectSlugs.includes(subject.slug)}
                        onChange={() => toggleSubject(subject.slug)}
                      />
                      {subject.shortTitle}
                    </label>
                  ))}
                </div>
                <p className="ds-hint">صفحهٔ نتایج با همین درس‌ها فیلتر می‌شود.</p>
              </div>

              <Field label="جملهٔ شاگرد" hint="اختیاری؛ فقط جمله‌ای که خود شاگرد برای انتشار داده">
                {(props) => <Textarea {...props} value={form.quote} onChange={(e) => update("quote", e.target.value)} rows={3} maxLength={600} />}
              </Field>

              <FieldRow>
                <Field label="لینک پست اصلی" hint="مثلاً پست همین نتیجه در کانال تلگرام">
                  {(props) => (
                    <Input {...props} value={form.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} placeholder="https://t.me/kunkurcomputer/…" dir="ltr" type="url" />
                  )}
                </Field>
                <Field label="لینک ویدیوی گفت‌وگو">
                  {(props) => (
                    <Input {...props} value={form.videoUrl} onChange={(e) => update("videoUrl", e.target.value)} placeholder="https://" dir="ltr" type="url" />
                  )}
                </Field>
              </FieldRow>

              <div className="ach-photo">
                <div className="ach-photo-preview">
                  {form.photoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${API_URL}${form.photoPath}`} alt="" />
                  ) : (
                    <span>{form.displayName.trim().slice(0, 1) || "؟"}</span>
                  )}
                </div>
                <div className="ds-stack" style={{ gap: "var(--sp-2)" }}>
                  <span className="ds-label">عکس شاگرد</span>
                  <p className="ds-hint" style={{ margin: 0 }}>
                    JPEG، PNG یا WebP تا ۵ مگابایت. عکس فقط در فضای ذخیره‌سازی نگه داشته می‌شود و تا وقتی نتیجه
                    منتشر نشده، برای هیچ‌کس جز ادمین باز نمی‌شود.
                  </p>
                  <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
                    <label className="ds-btn ds-btn-secondary ds-btn-sm" style={{ cursor: "pointer" }}>
                      {uploading ? "در حال بارگذاری…" : form.photoPath ? "تعویض عکس" : "انتخاب عکس"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        disabled={uploading}
                        onChange={(e) => {
                          void uploadPhoto(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {form.photoPath && (
                      <Button type="button" size="sm" onClick={() => setForm((current) => ({ ...current, photoArtifactId: null, photoPath: null }))}>
                        بدون عکس
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="ach-consent">
                <FieldRow>
                  <Field label="تاریخ رضایت شاگرد" hint="روزی که شاگرد اجازهٔ انتشار نام و نتیجه‌اش را داد (میلادی)">
                    {(props) => (
                      <Input {...props} type="date" value={form.consentDate} onChange={(e) => update("consentDate", e.target.value)} dir="ltr" />
                    )}
                  </Field>
                  <Field label="یادداشت رضایت" hint="فقط برای ادمین؛ هرگز روی سایت نمایش داده نمی‌شود">
                    {(props) => (
                      <Input {...props} value={form.consentNote} onChange={(e) => update("consentNote", e.target.value)} maxLength={500} placeholder="مثلاً: رضایت در پیام خصوصی تلگرام" />
                    )}
                  </Field>
                </FieldRow>
                <div className="ds-row" style={{ gap: "var(--sp-5)", flexWrap: "wrap" }}>
                  <label className="ach-toggle">
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      disabled={!form.consentDate}
                      onChange={(e) => update("isPublished", e.target.checked)}
                    />
                    انتشار روی سایت
                    {!form.consentDate && <small>(اول تاریخ رضایت را ثبت کنید)</small>}
                  </label>
                  <label className="ach-toggle">
                    <input type="checkbox" checked={form.isFeatured} onChange={(e) => update("isFeatured", e.target.checked)} />
                    ویژه (سه کارت بزرگ صفحهٔ اصلی)
                  </label>
                  <label className="ach-toggle">
                    ترتیب
                    <Input
                      value={form.sortOrder}
                      onChange={(e) => update("sortOrder", e.target.value)}
                      inputMode="numeric"
                      dir="ltr"
                      style={{ width: "5rem" }}
                      aria-label="ترتیب نمایش"
                    />
                  </label>
                </div>
              </div>

              <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
                <Button type="submit" variant="primary" loading={saving} disabled={uploading || !rankValid}>
                  {editingId ? "ذخیرهٔ تغییرات" : "ثبت نتیجه"}
                </Button>
                {!editingId && (
                  <Button type="button" onClick={resetForm} disabled={saving}>
                    پاک کردن فرم
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>

        <DataState
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          onRetry={load}
          emptyTitle="هنوز نتیجه‌ای ثبت نشده"
          emptyDescription="با فرم بالا اولین نتیجه را ثبت کنید. تا وقتی نتیجهٔ منتشرشده‌ای نباشد، بخش نتایج صفحهٔ اصلی نمایش داده نمی‌شود."
          skeletonRows={5}
        >
          <TableWrap>
            <thead>
              <tr>
                <th>شاگرد</th>
                <th>رتبه</th>
                <th>سال و مقطع</th>
                <th>قبولی</th>
                <th>رضایت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const photo = photoPathOf(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="ach-person">
                        <span className="ach-avatar">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${API_URL}${photo}`} alt="" />
                          ) : (
                            row.displayName.trim().slice(0, 1)
                          )}
                        </span>
                        <span>
                          <strong>{row.displayName}</strong>
                          {row.course && <small>{row.course.title}</small>}
                        </span>
                      </div>
                    </td>
                    <td className="ds-table-numeric">
                      {toPersianDigits(row.rank)}
                      {row.rankLabel && <small className="ach-muted"> {row.rankLabel}</small>}
                    </td>
                    <td>
                      {toPersianDigits(row.examYear)} · {row.degree === "PHD" ? "دکتری" : "ارشد"}
                    </td>
                    <td>{row.acceptedUniversity ?? "—"}</td>
                    <td>
                      {row.consentConfirmedAt ? (
                        dateFormat.format(new Date(row.consentConfirmedAt))
                      ) : (
                        <Badge tone="warning">ثبت نشده</Badge>
                      )}
                    </td>
                    <td>
                      <div className="ds-row" style={{ gap: "var(--sp-1)", flexWrap: "wrap" }}>
                        {row.isPublished ? <Badge tone="success">منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
                        {row.isFeatured && <Badge tone="info">ویژه</Badge>}
                      </div>
                    </td>
                    <td>
                      <div className="ds-row" style={{ gap: "var(--sp-1)", flexWrap: "wrap" }}>
                        <Button size="sm" onClick={() => startEdit(row)} disabled={busy !== null}>
                          ویرایش
                        </Button>
                        {row.isPublished && (
                          <Button size="sm" onClick={() => void unpublish(row)} loading={busy === `${row.id}:unpublish`} disabled={busy !== null}>
                            برداشتن از سایت
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setNotice(null);
                            setActionError(null);
                            setErasing(row);
                          }}
                          disabled={busy !== null}
                        >
                          پاک کردن کامل
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </DataState>
      </div>

      <ConfirmDialog
        open={erasing !== null}
        title="این نتیجه برای همیشه پاک شود؟"
        description={`ردیف «${erasing?.displayName ?? ""}» و عکسش از پایگاه داده و فضای ذخیره‌سازی پاک می‌شود و برگشت‌پذیر نیست. اگر شاگرد فقط نمی‌خواهد دیده شود، به‌جای این کار «برداشتن از سایت» را بزنید.`}
        confirmLabel="پاک کن"
        tone="danger"
        busy={busy === `${erasing?.id}:erase`}
        onConfirm={() => void confirmErase()}
        onCancel={() => setErasing(null)}
      />
    </>
  );
}
