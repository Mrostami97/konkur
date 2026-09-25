"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { API_URL, apiFetch, apiUpload } from "../../../lib/api";
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

type AccessMode = "PUBLIC" | "ACCOUNT" | "ENTITLEMENT";

const ACCESS: { value: AccessMode; label: string; note: string }[] = [
  { value: "ENTITLEMENT", label: "پولی", note: "فقط خریداران؛ درس‌های پیش‌نمایش برای همه باز است." },
  { value: "ACCOUNT", label: "رایگان با ورود", note: "هر کاربری که وارد شده باشد." },
  { value: "PUBLIC", label: "رایگان برای همه", note: "بدون ورود؛ مناسب تدریس رایگان فصل‌ها." },
];

interface ModuleWithLessons {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
}

/** Block types the editor authors. An image is uploaded from here; a video
 * block (a URL) is kept as it is when a lesson is edited. */
const BLOCK_TYPES = [
  { value: "text", label: "پاراگراف" },
  { value: "heading", label: "عنوان" },
  { value: "quote", label: "نقل‌قول" },
  { value: "latex", label: "فرمول (LaTeX)" },
  { value: "image", label: "تصویر" },
] as const;

type BlockType = (typeof BLOCK_TYPES)[number]["value"];
interface LessonImage { media_key: string; checksum: string; url: string }
interface DraftBlock {
  id: number;
  type: BlockType | "kept";
  /** Text, formula, or for an image its description (alt text and caption). */
  value: string;
  image?: LessonImage;
  /** A block this editor does not author, carried through unchanged. */
  kept?: { type: string; [key: string]: unknown };
}
interface LessonRow {
  id: string;
  title: string;
  isPreview: boolean;
  contentBlocks: { type: string; [key: string]: unknown }[];
  assets: { media_key: string; checksum: string }[];
}

let blockId = 0;
const newBlock = (type: BlockType = "text"): DraftBlock => ({ id: (blockId += 1), type, value: "" });

function isFilled(block: DraftBlock) {
  if (block.type === "kept") return true;
  if (block.type === "image") return Boolean(block.image);
  return block.value.trim().length > 0;
}

function toContentBlock(block: DraftBlock) {
  if (block.type === "kept") return block.kept!;
  if (block.type === "heading") return { type: "heading", level: 2, text: block.value };
  if (block.type === "quote") return { type: "quote", text: block.value };
  if (block.type === "latex") return { type: "latex", latex: block.value };
  if (block.type === "image") {
    const text = block.value.trim();
    return { type: "image", media_key: block.image!.media_key, alt: text, ...(text ? { caption: text } : {}) };
  }
  return { type: "text", text: block.value };
}

/** Turns a saved lesson back into editable rows. */
function fromLesson(lesson: LessonRow): DraftBlock[] {
  const checksumOf = new Map(lesson.assets.map((asset) => [asset.media_key, asset.checksum]));
  return lesson.contentBlocks.map((block) => {
    const id = (blockId += 1);
    const text = (key: string) => String(block[key] ?? "");
    if (block.type === "text" || block.type === "heading" || block.type === "quote") return { id, type: block.type, value: text("text") };
    if (block.type === "latex") return { id, type: "latex", value: text("latex") };
    const checksum = block.type === "image" ? checksumOf.get(text("media_key")) : undefined;
    if (checksum) {
      return {
        id,
        type: "image",
        value: text("alt") || text("caption"),
        image: { media_key: text("media_key"), checksum, url: `/media/${checksum.replace("sha256:", "")}` },
      };
    }
    return { id, type: "kept", value: "", kept: block };
  });
}

function ImagePicker({ block, onUploaded }: { block: DraftBlock; onUploaded: (image: LessonImage) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await apiUpload<LessonImage>("/admin/lesson-images", file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "آپلود تصویر ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ds-stack-sm">
      {block.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ds-image-preview" src={`${API_URL}${block.image.url}`} alt="" />
      )}
      <label className={`ds-btn ds-btn-secondary ds-btn-sm ds-file${busy ? " is-busy" : ""}`}>
        <input
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        {busy ? "در حال آپلود…" : block.image ? "تعویض تصویر" : "انتخاب فایل تصویر"}
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

function LessonForm({
  moduleId,
  lessonId,
  onDone,
}: {
  moduleId: string;
  /** Present when editing a saved lesson. */
  lessonId?: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [blocks, setBlocks] = useState<DraftBlock[]>(lessonId ? [] : [newBlock()]);
  const [loading, setLoading] = useState(Boolean(lessonId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    apiFetch<LessonRow>(`/admin/lessons/${lessonId}`)
      .then((lesson) => {
        setTitle(lesson.title);
        setIsPreview(lesson.isPreview);
        setBlocks(fromLesson(lesson));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "خواندن درس ممکن نشد."))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const update = (id: number, patch: Partial<DraftBlock>) =>
    setBlocks((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const filled = blocks.filter(isFilled);
    if (filled.length === 0) {
      setError("درس باید دست‌کم یک بلوک با محتوا داشته باشد.");
      return;
    }
    if (blocks.some((block) => block.type === "image" && !block.image)) {
      setError("برای هر بلوک تصویر، فایلی آپلود کنید یا آن بلوک را حذف کنید.");
      return;
    }
    const assets = filled.flatMap((block) =>
      block.type === "image" && block.image ? [{ media_key: block.image.media_key, checksum: block.image.checksum }] : [],
    );
    const unique = [...new Map(assets.map((asset) => [asset.media_key, asset])).values()];
    setBusy(true);
    setError(null);
    try {
      const body = { title, isPreview, contentBlocks: filled.map(toContentBlock), assets: unique };
      if (lessonId) {
        await apiFetch(`/admin/lessons/${lessonId}`, { method: "PATCH", body });
      } else {
        await apiFetch(`/admin/modules/${moduleId}/lessons`, { method: "POST", body: { ...body, order: 1 } });
        setTitle("");
        setIsPreview(false);
        setBlocks([newBlock()]);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : lessonId ? "ذخیرهٔ درس ناموفق بود." : "افزودن درس ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="ds-hint">در حال خواندن درس…</p>;

  return (
    <form onSubmit={submit} className="ds-form">
      <Field label="عنوان درس" required>
        {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
      </Field>
      <label className="ds-check">
        <input type="checkbox" checked={isPreview} onChange={(event) => setIsPreview(event.target.checked)} />
        درس نمونه (بدون خرید و بدون ورود دیده می‌شود)
      </label>

      <div>
        <span className="ds-label">محتوای درس</span>
        <div className="ds-stack-sm">
          {blocks.map((block, index) => (
            <div className="ds-block-row" key={block.id}>
              <div style={{ width: "10rem" }}>
                {block.type === "kept" ? (
                  <Badge>{block.kept?.type === "video" ? "ویدیو" : "بلوک دیگر"}</Badge>
                ) : (
                  <Select
                    value={block.type}
                    aria-label={`نوع بلوک ${toPersianDigits(index + 1)}`}
                    onChange={(event) => update(block.id, { type: event.target.value as BlockType })}
                  >
                    {BLOCK_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </Select>
                )}
              </div>
              <div className="ds-grow">
                {block.type === "kept" ? (
                  <p className="ds-hint" dir="ltr" style={{ margin: 0 }}>{String(block.kept?.url ?? block.kept?.type ?? "")}</p>
                ) : block.type === "image" ? (
                  <div className="ds-stack-sm">
                    <ImagePicker block={block} onUploaded={(image) => update(block.id, { image })} />
                    <Input
                      value={block.value}
                      placeholder="توضیح تصویر: چه چیزی نشان می‌دهد؟"
                      aria-label={`توضیح تصویر ${toPersianDigits(index + 1)}`}
                      onChange={(event) => update(block.id, { value: event.target.value })}
                    />
                  </div>
                ) : (
                  <Textarea
                    value={block.value}
                    aria-label={`متن بلوک ${toPersianDigits(index + 1)}`}
                    onChange={(event) => update(block.id, { value: event.target.value })}
                  />
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                aria-label="حذف بلوک"
                disabled={blocks.length === 1}
                onClick={() => setBlocks(blocks.filter((item) => item.id !== block.id))}
              >
                حذف
              </Button>
            </div>
          ))}
        </div>
        <p className="ds-hint">تصویر PNG، JPEG یا WebP تا ۵ مگابایت. توضیح تصویر برای کسی که تصویر را نمی‌بیند خوانده می‌شود.</p>
        <div className="ds-row">
          <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock()])}>افزودن بلوک متن</Button>
          <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock("image")])}>افزودن تصویر</Button>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      <div className="ds-row">
        <Button type="submit" variant="primary" loading={busy}>{lessonId ? "ذخیرهٔ درس" : "افزودن درس"}</Button>
        {lessonId && <Button type="button" variant="ghost" onClick={onDone}>انصراف</Button>}
      </div>
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
    <form onSubmit={submit} className="ds-form">
      <Field label="عنوان سرفصل تازه" required>
        {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div><Button type="submit" loading={busy}>افزودن سرفصل</Button></div>
    </form>
  );
}

function CourseEditor({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const modules = course.modules ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ kind: "lessons" | "modules"; id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.includes("already studied")
          ? "دانشجوها این درس را دیده‌اند؛ به‌جای حذف، ویرایشش کنید."
          : message.includes("lessons first")
            ? "اول درس‌های این سرفصل را حذف کنید؛ فقط سرفصل خالی حذف می‌شود."
            : "این کار انجام نشد.",
      );
    }
  }

  const move = (kind: "lessons" | "modules", id: string, direction: "up" | "down") =>
    act(() => apiFetch(`/admin/${kind}/${id}/move`, { method: "POST", body: { direction } }));

  return (
    <div className="ds-stack" style={{ marginTop: "var(--sp-5)" }}>
      {error && <Alert tone="danger">{error}</Alert>}
      {modules.map((module, moduleIndex) => (
        <details className="ds-details" key={module.id}>
          <summary>
            {module.title} — {toPersianDigits(module.lessons.length)} درس
          </summary>
          <div className="ds-details-body">
            <div className="ds-row" style={{ marginBottom: "var(--sp-3)" }}>
              <Button size="sm" variant="ghost" disabled={moduleIndex === 0} onClick={() => void move("modules", module.id, "up")}>سرفصل بالاتر</Button>
              <Button size="sm" variant="ghost" disabled={moduleIndex === modules.length - 1} onClick={() => void move("modules", module.id, "down")}>سرفصل پایین‌تر</Button>
              <Button size="sm" variant="ghost" disabled={module.lessons.length > 0} onClick={() => setRemoving({ kind: "modules", id: module.id, title: module.title })}>حذف سرفصل</Button>
            </div>
            {module.lessons.length > 0 && (
              <ul className="ds-plain-list">
                {module.lessons.map((lesson, lessonIndex) => (
                  <li key={lesson.id}>
                    <div className="ds-row-between">
                      <span>{lesson.title}</span>
                      <span className="ds-row">
                        <Button size="sm" variant="ghost" aria-label="درس بالاتر" disabled={lessonIndex === 0} onClick={() => void move("lessons", lesson.id, "up")}>↑</Button>
                        <Button size="sm" variant="ghost" aria-label="درس پایین‌تر" disabled={lessonIndex === module.lessons.length - 1} onClick={() => void move("lessons", lesson.id, "down")}>↓</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(editing === lesson.id ? null : lesson.id)}>
                          {editing === lesson.id ? "بستن" : "ویرایش"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemoving({ kind: "lessons", id: lesson.id, title: lesson.title })}>حذف</Button>
                      </span>
                    </div>
                    {editing === lesson.id && (
                      <div className="ds-panel" style={{ marginTop: "var(--sp-3)" }}>
                        <LessonForm
                          moduleId={module.id}
                          lessonId={lesson.id}
                          onDone={() => {
                            setEditing(null);
                            onChanged();
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <LessonForm moduleId={module.id} onDone={onChanged} />
          </div>
        </details>
      ))}
      <ModuleForm courseId={course.id} nextOrder={modules.length + 1} onAdded={onChanged} />

      <ConfirmDialog
        open={removing !== null}
        title={`حذف «${removing?.title ?? ""}»؟`}
        description={removing?.kind === "lessons"
          ? "درسی که دانشجویی دیده باشد حذف نمی‌شود. این کار برگشت‌پذیر نیست."
          : "فقط سرفصل خالی حذف می‌شود. این کار برگشت‌پذیر نیست."}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={() => {
          if (!removing) return;
          setBusy(true);
          void act(() => apiFetch(`/admin/${removing.kind}/${removing.id}`, { method: "DELETE" })).finally(() => {
            setBusy(false);
            setRemoving(null);
          });
        }}
        onCancel={() => setRemoving(null)}
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
  const [videoTarget, setVideoTarget] = useState<Course | null>(null);
  const [videoId, setVideoId] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
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

  /** The course update endpoint takes the whole course, so the fields that
   * are not being edited here are sent back unchanged. */
  async function saveVideoId() {
    const course = videoTarget;
    if (!course) return;
    setVideoBusy(true);
    setVideoError(null);
    try {
      await apiFetch(`/admin/courses/${course.id}`, {
        method: "PATCH",
        body: {
          slug: course.slug,
          title: course.title,
          description: course.description ?? "",
          accessMode: course.accessMode,
          ...(videoId.trim() ? { spotPlayerCourseId: videoId.trim() } : {}),
        },
      });
      setVideoTarget(null);
      await load();
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "ذخیرهٔ شناسهٔ ویدیو ممکن نشد.");
    } finally {
      setVideoBusy(false);
    }
  }

  async function publish() {
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
        description="دوره از سرفصل‌ها و هر سرفصل از درس‌ها ساخته می‌شود. درس و سرفصل را می‌شود ویرایش، جابه‌جا و (تا وقتی دانشجویی ندیده) حذف کرد."
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

        <Card padded={false}>
          <div className="ds-card-head"><h2 className="ds-card-title">همهٔ دوره‌ها</h2></div>
          <div className="ds-card-body">
            {/* A reload after an edit keeps the list mounted: swapping it for a
                skeleton would close the lesson being edited. */}
            {error && courses.length > 0 && <Alert tone="danger">{error}</Alert>}
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
                          {course.accessMode && course.accessMode !== "ENTITLEMENT" && (
                            <Badge tone="info">{ACCESS.find((item) => item.value === course.accessMode)?.label}</Badge>
                          )}
                          <span className="ds-hint" style={{ margin: 0 }}>
                            {toPersianDigits(course.modules?.length ?? 0)} سرفصل
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
                        <Button
                          size="sm"
                          onClick={() => {
                            setVideoId(course.spotPlayerCourseId ?? "");
                            setVideoError(null);
                            setVideoTarget(course);
                          }}
                        >
                          تنظیم ویدیو
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
        open={videoTarget !== null}
        title={`ویدیوی «${videoTarget?.title ?? ""}»`}
        description="شناسهٔ دوره را از پنل اسپات‌پلیر بردارید و اینجا بگذارید. خالی گذاشتن یعنی این دوره ویدیو ندارد و بخش ویدیو روی صفحهٔ دوره نشان داده نمی‌شود."
        confirmLabel="ذخیره"
        busy={videoBusy}
        onConfirm={() => void saveVideoId()}
        onCancel={() => {
          setVideoTarget(null);
          setVideoError(null);
        }}
      >
        <Field label="شناسهٔ دوره در اسپات‌پلیر">
          {(props) => (
            <Input {...props} dir="ltr" value={videoId} onChange={(event) => setVideoId(event.target.value)} />
          )}
        </Field>
        {videoError && (
          <div style={{ marginTop: "var(--sp-3)" }}>
            <Alert tone="danger">{videoError}</Alert>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={publishTarget !== null}
        title={publishTarget?.publish ? `انتشار «${publishTarget.course.title}»؟` : `لغو انتشار «${publishTarget?.course.title ?? ""}»؟`}
        description={
          publishTarget?.publish
            ? "پس از انتشار، دوره در فهرست عمومی دیده می‌شود و فروشش ممکن می‌شود. هر زمان می‌توانید انتشار را لغو کنید."
            : "دوره از فهرست عمومی و فروش خارج می‌شود و تا انتشار دوباره، دانشجویان ثبت‌نام‌شده هم به درس‌ها دسترسی ندارند."
        }
        confirmLabel={publishTarget?.publish ? "منتشر کن" : "لغو انتشار"}
        busy={publishing}
        onConfirm={publish}
        onCancel={() => setPublishTarget(null)}
      />
    </>
  );
}
