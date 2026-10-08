"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { API_URL, ApiError, apiFetch, apiUpload, uploadInPieces } from "../../../lib/api";
import { formatDuration, toEnglishDigits, toPersianDigits } from "../../../lib/format";
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
  durationMinutes?: number | null;
  isPublished: boolean;
  modules?: ModuleWithLessons[];
  materials?: { resource: Handout }[];
}

interface Handout {
  id: string;
  slug: string;
  title: string;
  reviewStatus: string;
  accessMode: string;
  hostingMode: string;
}

/** Only these can come with a course: a published file the site keeps, not free to all. */
/** Hours and minutes as typed (Persian or Latin digits) to whole minutes; null when both are empty or zero. */
function minutesOf(hours: string, minutes: string): number | null {
  const h = Number(toEnglishDigits(hours.trim()) || 0);
  const m = Number(toEnglishDigits(minutes.trim()) || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = Math.round(h * 60 + m);
  return total > 0 ? total : null;
}

/** The course's length, as shown on its card and page. */
function DurationFields({
  hours,
  minutes,
  onHours,
  onMinutes,
}: {
  hours: string;
  minutes: string;
  onHours: (value: string) => void;
  onMinutes: (value: string) => void;
}) {
  const total = minutesOf(hours, minutes);
  return (
    <FieldRow>
      <Field label="مدت دوره: ساعت" hint={total ? `روی سایت: ${formatDuration(total)}` : "مجموع ویدیوهای دوره؛ روی کارت و صفحهٔ دوره نوشته می‌شود"}>
        {(props) => <Input {...props} inputMode="numeric" value={hours} onChange={(event) => onHours(event.target.value)} placeholder="مثلاً ۴۰" />}
      </Field>
      <Field label="و دقیقه">
        {(props) => <Input {...props} inputMode="numeric" value={minutes} onChange={(event) => onMinutes(event.target.value)} placeholder="مثلاً ۳۰" />}
      </Field>
    </FieldRow>
  );
}

function isAttachable(resource: Handout) {
  return (
    resource.reviewStatus === "PUBLISHED" &&
    (resource.hostingMode === "USER_UPLOAD" || resource.hostingMode === "MIRRORED_WITH_PERMISSION") &&
    resource.accessMode !== "PUBLIC"
  );
}

interface ModuleWithLessons {
  id: string;
  title: string;
  lessons: { id: string; title: string; isPreview?: boolean }[];
}

/** Block types the editor authors. Images and videos are uploaded from
 * here; an older video block that is only a URL is kept as it is. */
const BLOCK_TYPES = [
  { value: "text", label: "پاراگراف" },
  { value: "heading", label: "عنوان" },
  { value: "quote", label: "نقل‌قول" },
  { value: "latex", label: "فرمول (LaTeX)" },
  { value: "image", label: "تصویر" },
  { value: "video", label: "ویدیو" },
] as const;

/** Matches the API's limit; a free sample is a short clip, not a whole session. */
const MAX_VIDEO_MB = 300;

type BlockType = (typeof BLOCK_TYPES)[number]["value"];
interface LessonImage { media_key: string; checksum: string; url: string }
interface LessonVideo { media_key: string; checksum: string; url: string }
interface DraftBlock {
  id: number;
  type: BlockType | "kept";
  /** Text, formula, for an image its description (alt text and caption),
   * or for a video its caption. */
  value: string;
  image?: LessonImage;
  video?: LessonVideo;
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
  if (block.type === "video") return Boolean(block.video);
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
  if (block.type === "video") {
    const text = block.value.trim();
    return { type: "video", media_key: block.video!.media_key, ...(text ? { caption: text } : {}) };
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
    if (block.type === "video" && checksumOf.has(text("media_key"))) {
      const checksum = checksumOf.get(text("media_key"))!;
      return {
        id,
        type: "video",
        value: text("caption"),
        video: { media_key: text("media_key"), checksum, url: `/media/${checksum.replace("sha256:", "")}` },
      };
    }
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

function VideoPicker({ block, onUploaded }: { block: DraftBlock; onUploaded: (video: LessonVideo) => void }) {
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;
  const mb = (bytes: number) => toPersianDigits((bytes / 1024 / 1024).toFixed(1));

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`حجم ویدیو بیش از ${toPersianDigits(MAX_VIDEO_MB)} مگابایت است. نمونه را کوتاه‌تر یا با کیفیت کمتر خروجی بگیرید.`);
      return;
    }
    setProgress({ loaded: 0, total: file.size });
    try {
      onUploaded(await uploadInPieces<LessonVideo>("/admin/lesson-videos/uploads", file, setProgress));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const reason = err instanceof ApiError ? err.reason : message;
      setError(
        /MOV/.test(reason)
          ? "فایل MOV در مرورگرها درست پخش نمی‌شود؛ ویدیو را با فرمت MP4 (H.264) خروجی بگیرید و دوباره آپلود کنید."
          : /MP4 or WebM/.test(reason)
            ? "این فایل MP4 یا WebM نیست. ویدیو را با فرمت MP4 (H.264) خروجی بگیرید."
            : /damaged|incomplete/.test(reason)
              ? "فایل MP4 ناقص یا خراب است؛ دوباره از نرم‌افزار ویرایش خروجی بگیرید."
              : message
                ? `آپلود ویدیو ناموفق بود: ${message}`
                : "آپلود ویدیو ناموفق بود. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
      );
    } finally {
      setProgress(null);
    }
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  return (
    <div className="ds-stack-sm">
      {block.video && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video className="ds-video-preview" src={`${API_URL}${block.video.url}`} controls preload="metadata" playsInline />
      )}
      <label className={`ds-btn ds-btn-secondary ds-btn-sm ds-file${busy ? " is-busy" : ""}`}>
        <input
          type="file"
          className="sr-only"
          accept="video/mp4,video/webm"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        {busy
          ? percent < 100
            ? `در حال آپلود… ${toPersianDigits(percent)}٪ (${mb(progress.loaded)} از ${mb(progress.total)} مگابایت)`
            : "در حال آماده‌سازی ویدیو…"
          : block.video
            ? "تعویض ویدیو"
            : "انتخاب فایل ویدیو"}
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

function LessonForm({
  moduleId,
  lessonId,
  nextOrder = 1,
  onDone,
}: {
  moduleId: string;
  /** Present when editing a saved lesson. */
  lessonId?: string;
  /** Where a new lesson goes: after the module's last lesson. */
  nextOrder?: number;
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
    if (blocks.some((block) => block.type === "video" && !block.video)) {
      setError("برای هر بلوک ویدیو، فایلی آپلود کنید یا آن بلوک را حذف کنید.");
      return;
    }
    const assets = filled.flatMap((block) => {
      const file = block.type === "image" ? block.image : block.type === "video" ? block.video : undefined;
      return file ? [{ media_key: file.media_key, checksum: file.checksum }] : [];
    });
    const unique = [...new Map(assets.map((asset) => [asset.media_key, asset])).values()];
    setBusy(true);
    setError(null);
    try {
      const body = { title, isPreview, contentBlocks: filled.map(toContentBlock), assets: unique };
      if (lessonId) {
        await apiFetch(`/admin/lessons/${lessonId}`, { method: "PATCH", body });
      } else {
        await apiFetch(`/admin/modules/${moduleId}/lessons`, { method: "POST", body: { ...body, order: nextOrder } });
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
                ) : block.type === "video" ? (
                  <div className="ds-stack-sm">
                    <VideoPicker block={block} onUploaded={(video) => update(block.id, { video })} />
                    <Input
                      value={block.value}
                      placeholder="توضیح کوتاه زیر ویدیو (اختیاری)"
                      aria-label={`توضیح ویدیو ${toPersianDigits(index + 1)}`}
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
        <p className="ds-hint">
          تصویر PNG، JPEG یا WebP تا ۵ مگابایت؛ توضیح تصویر برای کسی که تصویر را نمی‌بیند خوانده می‌شود. ویدیو MP4 یا WebM تا
          ۳۰۰ مگابایت؛ برای نمونهٔ رایگان یک تکهٔ کوتاه ۷۲۰p کافی است و روی اینترنت کند هم روان پخش می‌شود.
        </p>
        <div className="ds-row">
          <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock()])}>افزودن بلوک متن</Button>
          <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock("image")])}>افزودن تصویر</Button>
          <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock("video")])}>افزودن ویدیو</Button>
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

/**
 * The handouts that come with a course. Whoever gets the course -- bought
 * directly or in a bundle -- reads these in their panel with no extra
 * purchase. The list is saved whole, in the order shown.
 */
function CourseMaterials({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const attached = (course.materials ?? []).map((row) => row.resource);
  const [candidates, setCandidates] = useState<Handout[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Handout[]>("/admin/resources")
      .then((resources) => setCandidates(resources.filter(isAttachable)))
      .catch(() => setError("فهرست جزوه‌ها بارگذاری نشد."));
  }, []);

  async function save(ids: string[]) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/courses/${course.id}/materials`, { method: "PUT", body: { resourceIds: ids } });
      setChoice("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیرهٔ جزوه‌های دوره ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  const ids = attached.map((resource) => resource.id);
  const available = (candidates ?? []).filter((resource) => !ids.includes(resource.id));

  function move(index: number, delta: -1 | 1) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void save(next);
  }

  return (
    <details className="ds-details" open={attached.length > 0}>
      <summary>جزوه‌های دوره — {toPersianDigits(attached.length)} جزوه</summary>
      <div className="ds-details-body ds-stack">
        <p className="ds-help">
          خریدار دوره این جزوه‌ها را بدون خرید جداگانه در پنلش می‌خواند، بدون نام روی صفحه‌ها؛ فقط کسی که خود جزوه را جدا خریده نسخهٔ به‌نام می‌گیرد. جزوه را اول در «منابع آموزشی» با فایل PDF و
          سطح دسترسی «پولی؛ با دسترسی فعال» یا «رایگان؛ با حساب» منتشر کنید تا این‌جا قابل انتخاب باشد.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        {attached.length > 0 && (
          <ul className="ds-plain-list">
            {attached.map((resource, index) => (
              <li key={resource.id}>
                <div className="ds-row-between">
                  <span>
                    <span className="ds-lesson-n">{toPersianDigits(index + 1)}</span>
                    {resource.title}
                    {!isAttachable(resource) && <Badge tone="warning">دیگر منتشرشده نیست</Badge>}
                  </span>
                  <div className="ds-table-actions">
                    <Button size="sm" variant="ghost" aria-label={`بالا بردن ${resource.title}`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</Button>
                    <Button size="sm" variant="ghost" aria-label={`پایین بردن ${resource.title}`} disabled={busy || index === attached.length - 1} onClick={() => move(index, 1)}>↓</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(ids.filter((id) => id !== resource.id))}>برداشتن</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="ds-row">
          <div className="ds-grow">
            <Select aria-label="جزوه برای افزودن" value={choice} disabled={candidates === null || available.length === 0} onChange={(event) => setChoice(event.target.value)}>
              <option value="">
                {candidates === null ? "در حال بارگذاری…" : available.length === 0 ? "جزوهٔ منتشرشدهٔ دیگری نیست" : "انتخاب جزوه…"}
              </option>
              {available.map((resource) => (
                <option key={resource.id} value={resource.id}>{resource.title}</option>
              ))}
            </Select>
          </div>
          <Button variant="primary" disabled={!choice} loading={busy} onClick={() => void save([...ids, choice])}>افزودن به دوره</Button>
        </div>
      </div>
    </details>
  );
}

/** A destructive or state-changing step waiting for the operator's yes. */
type Pending = { title: string; description: string; confirmLabel: string; run: () => Promise<unknown> } | null;

function CourseEditor({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const modules = course.modules ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      setPending(null);
      setRenaming(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "انجام این کار ممکن نشد.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  /** Moves one lesson up or down by rewriting the module's whole order. */
  function move(module: ModuleWithLessons, index: number, delta: -1 | 1) {
    const ids = module.lessons.map((lesson) => lesson.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void act(() => apiFetch(`/admin/modules/${module.id}/lesson-order`, { method: "PUT", body: { lessonIds: ids } }));
  }

  return (
    <div className="ds-stack" style={{ marginTop: "var(--sp-5)" }}>
      {error && <Alert tone="danger">{error}</Alert>}
      <CourseMaterials course={course} onChanged={onChanged} />
      {modules.map((module) => (
        <details className="ds-details" key={module.id}>
          <summary>
            {module.title} — {toPersianDigits(module.lessons.length)} درس
          </summary>
          <div className="ds-details-body">
            <div className="ds-row" style={{ marginBottom: "var(--sp-3)" }}>
              {renaming?.id === module.id ? (
                <form
                  className="ds-row ds-grow"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = renaming.title.trim();
                    if (title) void act(() => apiFetch(`/admin/modules/${module.id}`, { method: "PATCH", body: { title } }));
                  }}
                >
                  <div className="ds-grow">
                    <Input
                      value={renaming.title}
                      aria-label="نام تازهٔ سرفصل"
                      onChange={(event) => setRenaming({ id: module.id, title: event.target.value })}
                    />
                  </div>
                  <Button size="sm" type="submit" variant="primary" loading={busy}>ذخیره</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>انصراف</Button>
                </form>
              ) : (
                <>
                  <Button size="sm" onClick={() => setRenaming({ id: module.id, title: module.title })}>تغییر نام سرفصل</Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      setPending({
                        title: `حذف سرفصل «${module.title}»؟`,
                        description: `سرفصل و ${toPersianDigits(module.lessons.length)} درسش پاک می‌شوند. اگر دانشجویی درس‌هایش را خوانده باشد، حذف انجام نمی‌شود.`,
                        confirmLabel: "حذف سرفصل",
                        run: () => apiFetch(`/admin/modules/${module.id}`, { method: "DELETE" }),
                      })
                    }
                  >
                    حذف سرفصل
                  </Button>
                </>
              )}
            </div>
            {module.lessons.length > 0 && (
              <ul className="ds-plain-list">
                {module.lessons.map((lesson, index) => (
                  <li key={lesson.id}>
                    <div className="ds-row-between">
                      <span>
                        <span className="ds-lesson-n">{toPersianDigits(index + 1)}</span>
                        {lesson.title}
                        {lesson.isPreview && <Badge tone="info">نمونه</Badge>}
                      </span>
                      <div className="ds-table-actions">
                        <Button size="sm" variant="ghost" aria-label={`بالا بردن ${lesson.title}`} disabled={busy || index === 0} onClick={() => move(module, index, -1)}>↑</Button>
                        <Button size="sm" variant="ghost" aria-label={`پایین بردن ${lesson.title}`} disabled={busy || index === module.lessons.length - 1} onClick={() => move(module, index, 1)}>↓</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(editing === lesson.id ? null : lesson.id)}>
                          {editing === lesson.id ? "بستن" : "ویرایش"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setPending({
                              title: `حذف درس «${lesson.title}»؟`,
                              description: "درس و تصویرهایش از دوره برداشته می‌شوند. اگر دانشجویی این درس را خوانده باشد، حذف انجام نمی‌شود.",
                              confirmLabel: "حذف درس",
                              run: () => apiFetch(`/admin/lessons/${lesson.id}`, { method: "DELETE" }),
                            })
                          }
                        >
                          حذف
                        </Button>
                      </div>
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
            <LessonForm moduleId={module.id} nextOrder={module.lessons.length + 1} onDone={onChanged} />
          </div>
        </details>
      ))}
      <ModuleForm courseId={course.id} nextOrder={modules.length + 1} onAdded={onChanged} />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        tone="danger"
        busy={busy}
        onConfirm={() => pending && void act(pending.run)}
        onCancel={() => setPending(null)}
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
  const [durationHours, setDurationHours] = useState("");
  const [durationRest, setDurationRest] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<Course | null>(null);
  const [videoTarget, setVideoTarget] = useState<Course | null>(null);
  const [videoId, setVideoId] = useState("");
  const [videoHours, setVideoHours] = useState("");
  const [videoRest, setVideoRest] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [courseAction, setCourseAction] = useState<{ course: Course; kind: "unpublish" | "delete" } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
          ...(spotPlayerCourseId.trim() ? { spotPlayerCourseId: spotPlayerCourseId.trim() } : {}),
          ...(minutesOf(durationHours, durationRest) !== null ? { durationMinutes: minutesOf(durationHours, durationRest) } : {}),
        },
      });
      setSlug("");
      setDurationHours("");
      setDurationRest("");
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
          ...(videoId.trim() ? { spotPlayerCourseId: videoId.trim() } : {}),
          // Empty hours and minutes clear the duration.
          durationMinutes: minutesOf(videoHours, videoRest),
        },
      });
      setVideoTarget(null);
      await load();
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "ذخیرهٔ ویدیو و مدت دوره ممکن نشد.");
    } finally {
      setVideoBusy(false);
    }
  }

  async function runCourseAction() {
    const action = courseAction;
    if (!action) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (action.kind === "unpublish") {
        await apiFetch(`/admin/courses/${action.course.id}/unpublish`, { method: "POST" });
      } else {
        await apiFetch(`/admin/courses/${action.course.id}`, { method: "DELETE" });
      }
      setCourseAction(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این کار ممکن نشد.");
      setCourseAction(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function publish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await apiFetch(`/admin/courses/${publishTarget.id}/publish`, { method: "POST" });
      setPublishTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "انتشار دوره ناموفق بود.");
      setPublishTarget(null);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="دوره‌ها"
        description="دوره از سرفصل‌ها و هر سرفصل از درس‌ها ساخته می‌شود. درس‌ها ویرایش، جابه‌جا و حذف می‌شوند؛ دوره‌ای که دانشجو دارد به‌جای حذف، از انتشار خارج می‌شود."
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
            <DurationFields hours={durationHours} minutes={durationRest} onHours={setDurationHours} onMinutes={setDurationRest} />
            {createError && <Alert tone="danger">{createError}</Alert>}
            <div><Button type="submit" variant="primary" loading={creating}>ساخت دوره</Button></div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head"><h2 className="ds-card-title">همهٔ دوره‌ها</h2></div>
          <div className="ds-card-body">
            <DataState
              loading={loading}
              error={error}
              isEmpty={courses.length === 0}
              onRetry={load}
              emptyTitle="هنوز دوره‌ای ساخته نشده"
              emptyDescription="با فرم بالا اولین دوره را بسازید."
            >
              <div className="ds-stack">
                {actionError && <Alert tone="danger">{actionError}</Alert>}
                {courses.map((course) => (
                  <div className="ds-panel" key={course.id}>
                    <div className="ds-row-between">
                      <div>
                        <strong>{course.title}</strong>
                        <div className="ds-row" style={{ marginTop: "var(--sp-2)" }}>
                          <Badge tone={course.isPublished ? "success" : "neutral"}>
                            {course.isPublished ? "منتشرشده" : "پیش‌نویس"}
                          </Badge>
                          <span className="ds-hint" style={{ margin: 0 }}>
                            {toPersianDigits(course.modules?.length ?? 0)} سرفصل
                          </span>
                          {course.spotPlayerCourseId ? (
                            <Badge tone="info">ویدیو در اسپات‌پلیر</Badge>
                          ) : (
                            <Badge>بدون ویدیو</Badge>
                          )}
                          {course.durationMinutes ? <Badge>{formatDuration(course.durationMinutes)}</Badge> : <Badge tone="warning">مدت ثبت نشده</Badge>}
                        </div>
                      </div>
                      <div className="ds-row">
                        {!course.isPublished && (
                          <Button size="sm" variant="primary" onClick={() => setPublishTarget(course)}>انتشار</Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            setVideoId(course.spotPlayerCourseId ?? "");
                            setVideoHours(course.durationMinutes ? String(Math.floor(course.durationMinutes / 60)) : "");
                            setVideoRest(course.durationMinutes ? String(course.durationMinutes % 60) : "");
                            setVideoError(null);
                            setVideoTarget(course);
                          }}
                        >
                          ویدیو و مدت
                        </Button>
                        <Button size="sm" onClick={() => setExpanded(expanded === course.id ? null : course.id)}>
                          {expanded === course.id ? "بستن" : "سرفصل‌ها و درس‌ها"}
                        </Button>
                        {course.isPublished ? (
                          <Button size="sm" variant="ghost" onClick={() => { setActionError(null); setCourseAction({ course, kind: "unpublish" }); }}>
                            لغو انتشار
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setActionError(null); setCourseAction({ course, kind: "delete" }); }}>
                            حذف
                          </Button>
                        )}
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
        title={`ویدیو و مدت «${videoTarget?.title ?? ""}»`}
        description="شناسهٔ دوره را از پنل اسپات‌پلیر بردارید و اینجا بگذارید؛ خالی یعنی این دوره ویدیو ندارد. مدت دوره روی کارت و صفحهٔ دوره نوشته می‌شود؛ خالی گذاشتن ساعت و دقیقه آن را پاک می‌کند."
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
        <DurationFields hours={videoHours} minutes={videoRest} onHours={setVideoHours} onMinutes={setVideoRest} />
        {videoError && (
          <div style={{ marginTop: "var(--sp-3)" }}>
            <Alert tone="danger">{videoError}</Alert>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={publishTarget !== null}
        title={`انتشار «${publishTarget?.title ?? ""}»؟`}
        description="پس از انتشار، دوره در فهرست عمومی دیده می‌شود. هر وقت لازم شد می‌توانید انتشارش را لغو کنید."
        confirmLabel="منتشر کن"
        busy={publishing}
        onConfirm={publish}
        onCancel={() => setPublishTarget(null)}
      />

      <ConfirmDialog
        open={courseAction !== null}
        title={
          courseAction?.kind === "unpublish"
            ? `لغو انتشار «${courseAction.course.title}»؟`
            : `حذف «${courseAction?.course.title ?? ""}»؟`
        }
        description={
          courseAction?.kind === "unpublish"
            ? "دوره از فهرست عمومی برداشته می‌شود و درس‌هایش تا انتشار دوباره برای هیچ‌کس، حتی خریداران، باز نمی‌شود. چیزی حذف نمی‌شود."
            : "دوره با همهٔ سرفصل‌ها و درس‌هایش پاک می‌شود. اگر ثبت‌نام، سابقهٔ مطالعه یا محصول فروش داشته باشد، حذف انجام نمی‌شود."
        }
        confirmLabel={courseAction?.kind === "unpublish" ? "لغو انتشار" : "حذف دوره"}
        tone="danger"
        busy={actionBusy}
        onConfirm={() => void runCourseAction()}
        onCancel={() => setCourseAction(null)}
      />
    </>
  );
}
