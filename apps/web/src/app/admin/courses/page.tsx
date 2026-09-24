"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
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
  Textarea,
} from "../../../components/ds";
import { BlockList, blockProblem, LessonEditor, newBlock, toContentBlock, type DraftBlock } from "./LessonEditor";

interface Course {
  id: string;
  slug: string;
  title: string;
  description?: string;
  spotPlayerCourseId?: string | null;
  accessMode?: AccessMode;
  isPublished: boolean;
  modules?: ModuleWithLessons[];
}

interface ModuleWithLessons {
  id: string;
  title: string;
  lessons: { id: string; title: string; isPreview: boolean }[];
}

type AccessMode = "PUBLIC" | "ACCOUNT" | "ENTITLEMENT";

const ACCESS: { value: AccessMode; label: string; note: string }[] = [
  { value: "ENTITLEMENT", label: "پولی", note: "فقط خریداران (جلسه‌های پیش‌نمایش برای همه باز است)" },
  { value: "ACCOUNT", label: "رایگان با ورود", note: "هر کاربر واردشده" },
  { value: "PUBLIC", label: "رایگان برای همه", note: "بدون ورود؛ مناسب تدریس رایگان فصل‌ها" },
];
const accessLabel = (mode?: AccessMode) => ACCESS.find((item) => item.value === (mode ?? "ENTITLEMENT"))?.label ?? "پولی";

function NewLessonForm({ moduleId, onAdded }: { moduleId: string; onAdded: (lessonId: string) => void }) {
  const [title, setTitle] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [blocks, setBlocks] = useState<DraftBlock[]>([newBlock()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const filled = blocks.filter((block) => block.value.trim().length > 0);
    if (filled.length === 0) {
      setError("درس باید دست‌کم یک بلوک با محتوا داشته باشد.");
      return;
    }
    const problems = filled.map(blockProblem).filter(Boolean);
    if (problems.length) {
      setError(String(problems[0]));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const lesson = await apiFetch<{ id: string }>(`/admin/modules/${moduleId}/lessons`, {
        method: "POST",
        body: { title, isPreview, contentBlocks: filled.map(toContentBlock) },
      });
      setTitle("");
      setIsPreview(false);
      setBlocks([newBlock()]);
      onAdded(lesson.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "افزودن درس ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="ds-form le-new">
      <h4 className="le-new-title">درس تازه در این سرفصل</h4>
      <Field label="عنوان درس" required>
        {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
      </Field>
      <label className="ds-checkbox-row">
        <input type="checkbox" checked={isPreview} onChange={(event) => setIsPreview(event.target.checked)} />
        جلسهٔ رایگان (پیش‌نمایش برای همه)
      </label>
      <div>
        <span className="ds-label">محتوای درس</span>
        <BlockList blocks={blocks} setBlocks={setBlocks} assets={[]} />
        <p className="ds-hint">تصویرها پس از ساخت درس، از «ویرایش» اضافه می‌شوند.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div><Button type="submit" variant="primary" loading={busy}>افزودن درس</Button></div>
    </form>
  );
}

function ModuleForm({ courseId, nextOrder, onAdded }: { courseId: string; nextOrder: number; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/courses/${courseId}/modules`, { method: "POST", body: { title, order: nextOrder } });
      setTitle("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "افزودن سرفصل ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="ds-form le-module-form">
      <Field label="سرفصل تازه" required>
        {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً فصل ۳: درخت‌ها" required />}
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div><Button type="submit" loading={busy}>افزودن سرفصل</Button></div>
    </form>
  );
}

function explainDelete(err: unknown) {
  if (err instanceof Error && err.message.includes("already studied")) return "دانشجوها این درس را دیده‌اند؛ به‌جای حذف، ویرایشش کنید.";
  if (err instanceof Error && err.message.includes("lessons first")) return "اول درس‌های این سرفصل را حذف یا جابه‌جا کنید.";
  return "حذف ممکن نشد.";
}

function CourseEditor({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const modules = course.modules ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "lesson" | "module"; id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(explainDelete(err));
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    await act(() => apiFetch(`/admin/${confirmDelete.kind === "lesson" ? "lessons" : "modules"}/${confirmDelete.id}`, { method: "DELETE" }));
    if (editing === confirmDelete.id) setEditing(null);
    setBusy(false);
    setConfirmDelete(null);
  }

  return (
    <div className="ds-stack" style={{ marginTop: "var(--sp-5)" }}>
      {error && <Alert tone="danger">{error}</Alert>}
      {modules.length === 0 && <p className="ds-hint">این دوره هنوز سرفصلی ندارد؛ از فرم پایین اولین سرفصل را بسازید.</p>}
      {modules.map((module, moduleIndex) => (
        <details className="ds-details" key={module.id} open={modules.length === 1 || module.lessons.some((lesson) => lesson.id === editing)}>
          <summary>
            <span className="le-summary">
              <span>{toPersianDigits(moduleIndex + 1)}. {module.title}</span>
              <small>{toPersianDigits(module.lessons.length)} درس</small>
            </span>
          </summary>
          <div className="ds-details-body ds-stack">
            <div className="ds-row le-module-tools">
              {renaming?.id === module.id ? (
                <>
                  <Input aria-label="عنوان سرفصل" value={renaming.title} onChange={(event) => setRenaming({ id: module.id, title: event.target.value })} />
                  <Button size="sm" variant="primary" onClick={() => void act(async () => {
                    await apiFetch(`/admin/modules/${module.id}`, { method: "PATCH", body: { title: renaming.title } });
                    setRenaming(null);
                  })}>ذخیره</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>انصراف</Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => setRenaming({ id: module.id, title: module.title })}>تغییر نام</Button>
                  <Button size="sm" variant="ghost" disabled={moduleIndex === 0} onClick={() => void act(() => apiFetch(`/admin/modules/${module.id}/move`, { method: "POST", body: { direction: "up" } }))}>سرفصل بالاتر</Button>
                  <Button size="sm" variant="ghost" disabled={moduleIndex === modules.length - 1} onClick={() => void act(() => apiFetch(`/admin/modules/${module.id}/move`, { method: "POST", body: { direction: "down" } }))}>سرفصل پایین‌تر</Button>
                  <Button size="sm" variant="ghost" disabled={module.lessons.length > 0} title={module.lessons.length ? "فقط سرفصل خالی حذف می‌شود" : undefined} onClick={() => setConfirmDelete({ kind: "module", id: module.id, title: module.title })}>حذف سرفصل</Button>
                </>
              )}
            </div>

            {module.lessons.length > 0 && (
              <ol className="le-lessons">
                {module.lessons.map((lesson, lessonIndex) => (
                  <li key={lesson.id}>
                    <div className="le-lesson-row">
                      <span className="le-lesson-title">
                        {lesson.title}
                        {lesson.isPreview && <Badge tone="success">رایگان</Badge>}
                      </span>
                      <span className="ds-row">
                        <Button size="sm" variant="ghost" aria-label="درس بالاتر" disabled={lessonIndex === 0} onClick={() => void act(() => apiFetch(`/admin/lessons/${lesson.id}/move`, { method: "POST", body: { direction: "up" } }))}>↑</Button>
                        <Button size="sm" variant="ghost" aria-label="درس پایین‌تر" disabled={lessonIndex === module.lessons.length - 1} onClick={() => void act(() => apiFetch(`/admin/lessons/${lesson.id}/move`, { method: "POST", body: { direction: "down" } }))}>↓</Button>
                        <Button size="sm" onClick={() => setEditing(editing === lesson.id ? null : lesson.id)}>{editing === lesson.id ? "بستن" : "ویرایش"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ kind: "lesson", id: lesson.id, title: lesson.title })}>حذف</Button>
                      </span>
                    </div>
                    {editing === lesson.id && (
                      <LessonEditor lessonId={lesson.id} onSaved={onChanged} onClose={() => setEditing(null)} />
                    )}
                  </li>
                ))}
              </ol>
            )}
            <NewLessonForm moduleId={module.id} onAdded={(lessonId) => { setEditing(lessonId); onChanged(); }} />
          </div>
        </details>
      ))}
      <ModuleForm courseId={course.id} nextOrder={modules.length + 1} onAdded={onChanged} />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`حذف «${confirmDelete?.title ?? ""}»؟`}
        description={confirmDelete?.kind === "lesson"
          ? "درسی که دانشجویی دیده باشد حذف نمی‌شود. این کار برگشت‌پذیر نیست."
          : "فقط سرفصل خالی حذف می‌شود. این کار برگشت‌پذیر نیست."}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default function CoursesAdminPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spotPlayerCourseId, setSpotPlayerCourseId] = useState("");
  const [accessMode, setAccessMode] = useState<AccessMode>("ENTITLEMENT");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<{ course: Course; publish: boolean } | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Course | null>(null);
  const [details, setDetails] = useState({ title: "", description: "", accessMode: "ENTITLEMENT" as AccessMode, spotPlayerCourseId: "" });
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await apiFetch<Course[]>("/admin/courses"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست دوره‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch("/admin/courses", {
        method: "POST",
        body: {
          slug,
          title,
          description,
          accessMode,
          ...(spotPlayerCourseId.trim() ? { spotPlayerCourseId: spotPlayerCourseId.trim() } : {}),
        },
      });
      setSlug("");
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "ساخت دوره ناموفق بود.");
    } finally {
      setCreating(false);
    }
  }

  /** The course update endpoint takes the whole course, so the slug is sent
   * back unchanged -- it is the public URL and is not edited here. */
  async function saveDetails() {
    const course = detailsTarget;
    if (!course) return;
    setDetailsBusy(true);
    setDetailsError(null);
    try {
      await apiFetch(`/admin/courses/${course.id}`, {
        method: "PATCH",
        body: {
          slug: course.slug,
          title: details.title,
          description: details.description,
          accessMode: details.accessMode,
          ...(details.spotPlayerCourseId.trim() ? { spotPlayerCourseId: details.spotPlayerCourseId.trim() } : {}),
        },
      });
      setDetailsTarget(null);
      await load();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "ذخیرهٔ مشخصات ممکن نشد.");
    } finally {
      setDetailsBusy(false);
    }
  }

  async function togglePublish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await apiFetch(`/admin/courses/${publishTarget.course.id}/${publishTarget.publish ? "publish" : "unpublish"}`, { method: "POST" });
      setPublishTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر وضعیت انتشار ناموفق بود.");
      setPublishTarget(null);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="دوره‌ها"
        description="دوره از سرفصل‌ها و هر سرفصل از درس‌ها ساخته می‌شود؛ درس‌ها متن، فرمول، تصویر و ویدیوی آپارات می‌گیرند و هر درس می‌تواند جلسهٔ رایگان باشد."
      />

      <div className="ds-stack-lg">
        <Card>
          <h2 className="ds-card-title">دورهٔ تازه</h2>
          <form onSubmit={createCourse} className="ds-form">
            <FieldRow>
              <Field label="نشانی یکتا (slug)" hint="در نشانی صفحهٔ دوره استفاده می‌شود؛ لاتین و بدون فاصله" required>
                {(props) => <Input {...props} value={slug} onChange={(event) => setSlug(event.target.value)} required />}
              </Field>
              <Field label="عنوان دوره" required>
                {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
              </Field>
            </FieldRow>
            <Field label="توضیح" hint="در فهرست عمومی دوره‌ها دیده می‌شود" required>
              {(props) => <Textarea {...props} value={description} onChange={(event) => setDescription(event.target.value)} required />}
            </Field>
            <Field label="دسترسی" hint={ACCESS.find((item) => item.value === accessMode)?.note}>
              {(props) => (
                <Select {...props} value={accessMode} onChange={(event) => setAccessMode(event.target.value as AccessMode)}>
                  {ACCESS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              )}
            </Field>
            <Field
              label="شناسهٔ دوره در اسپات‌پلیر"
              hint="اگر ویدیوهای این دوره در اسپات‌پلیر هستند، شناسهٔ دوره را از پنل اسپات‌پلیر اینجا بگذارید. خالی یعنی این دوره ویدیو ندارد."
            >
              {(props) => (
                <Input
                  {...props}
                  dir="ltr"
                  value={spotPlayerCourseId}
                  onChange={(event) => setSpotPlayerCourseId(event.target.value)}
                />
              )}
            </Field>
            {createError && <Alert tone="danger">{createError}</Alert>}
            <div><Button type="submit" variant="primary" loading={creating}>ساخت دوره</Button></div>
          </form>
        </Card>

        {error && courses.length > 0 && <Alert tone="danger">{error}</Alert>}
        <Card padded={false}>
          <div className="ds-card-head"><h2 className="ds-card-title">همهٔ دوره‌ها</h2></div>
          <div className="ds-card-body">
            {/* A reload after an edit keeps the list mounted: swapping it for
                a skeleton would close the lesson being edited. */}
            <DataState
              loading={loading && courses.length === 0}
              error={courses.length === 0 ? error : null}
              isEmpty={courses.length === 0}
              onRetry={load}
              emptyTitle="هنوز دوره‌ای ساخته نشده"
              emptyDescription="با فرم بالا اولین دوره را بسازید."
            >
              <div className="ds-stack">
                {courses.map((course) => (
                  <div className="ds-panel" key={course.id}>
                    <div className="ds-row-between">
                      <div>
                        <strong>{course.title}</strong>
                        <div className="ds-row" style={{ marginTop: "var(--sp-2)" }}>
                          <Badge tone={course.isPublished ? "success" : "neutral"}>
                            {course.isPublished ? "منتشرشده" : "پیش‌نویس"}
                          </Badge>
                          <Badge tone={course.accessMode === "ENTITLEMENT" || !course.accessMode ? "neutral" : "info"}>{accessLabel(course.accessMode)}</Badge>
                          <span className="ds-hint" style={{ margin: 0 }}>
                            {toPersianDigits(course.modules?.length ?? 0)} سرفصل ·{" "}
                            {toPersianDigits((course.modules ?? []).reduce((sum, module) => sum + module.lessons.length, 0))} درس
                          </span>
                          {course.spotPlayerCourseId ? (
                            <Badge tone="info">ویدیو در اسپات‌پلیر</Badge>
                          ) : (
                            <Badge>بدون ویدیو</Badge>
                          )}
                        </div>
                      </div>
                      <div className="ds-row">
                        {course.isPublished ? (
                          <Button size="sm" variant="ghost" onClick={() => setPublishTarget({ course, publish: false })}>لغو انتشار</Button>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => setPublishTarget({ course, publish: true })}>انتشار</Button>
                        )}
                        <a className="ds-btn ds-btn-ghost ds-btn-sm" href={`/courses/${course.slug}`} target="_blank" rel="noreferrer">صفحهٔ دوره</a>
                        <Button
                          size="sm"
                          onClick={() => {
                            setDetails({
                              title: course.title,
                              description: course.description ?? "",
                              accessMode: course.accessMode ?? "ENTITLEMENT",
                              spotPlayerCourseId: course.spotPlayerCourseId ?? "",
                            });
                            setDetailsError(null);
                            setDetailsTarget(course);
                          }}
                        >
                          مشخصات و ویدیو
                        </Button>
                        <Button size="sm" onClick={() => setExpanded(expanded === course.id ? null : course.id)}>
                          {expanded === course.id ? "بستن" : "سرفصل‌ها و درس‌ها"}
                        </Button>
                      </div>
                    </div>
                    {expanded === course.id && <CourseEditor course={course} onChanged={load} />}
                  </div>
                ))}
              </div>
            </DataState>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={detailsTarget !== null}
        title={`مشخصات «${detailsTarget?.title ?? ""}»`}
        description="نشانی صفحهٔ دوره (slug) تغییر نمی‌کند تا پیوندها و رتبهٔ جست‌وجو از دست نرود."
        confirmLabel="ذخیره"
        busy={detailsBusy}
        onConfirm={() => void saveDetails()}
        onCancel={() => {
          setDetailsTarget(null);
          setDetailsError(null);
        }}
      >
        <div className="ds-stack-sm">
          <Field label="عنوان دوره" required>
            {(props) => <Input {...props} value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} />}
          </Field>
          <Field label="توضیح" required>
            {(props) => <Textarea {...props} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} />}
          </Field>
          <Field label="دسترسی" hint={ACCESS.find((item) => item.value === details.accessMode)?.note}>
            {(props) => (
              <Select {...props} value={details.accessMode} onChange={(event) => setDetails({ ...details, accessMode: event.target.value as AccessMode })}>
                {ACCESS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="شناسهٔ دوره در اسپات‌پلیر" hint="خالی یعنی این دوره ویدیوی اسپات‌پلیر ندارد.">
            {(props) => (
              <Input {...props} dir="ltr" value={details.spotPlayerCourseId} onChange={(event) => setDetails({ ...details, spotPlayerCourseId: event.target.value })} />
            )}
          </Field>
          {detailsError && <Alert tone="danger">{detailsError}</Alert>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={publishTarget !== null}
        title={publishTarget?.publish ? `انتشار «${publishTarget.course.title}»؟` : `لغو انتشار «${publishTarget?.course.title ?? ""}»؟`}
        description={
          publishTarget?.publish
            ? "پس از انتشار، دوره در فهرست عمومی دیده می‌شود و فروش آن ممکن می‌شود. هر زمان می‌توانید انتشار را لغو کنید."
            : "دوره از فهرست عمومی و فروش خارج می‌شود و تا انتشار دوباره، دانشجویان ثبت‌نام‌شده هم به درس‌ها دسترسی ندارند."
        }
        confirmLabel={publishTarget?.publish ? "منتشر کن" : "لغو انتشار"}
        busy={publishing}
        onConfirm={togglePublish}
        onCancel={() => setPublishTarget(null)}
      />
    </>
  );
}
