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

interface Course {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  modules?: ModuleWithLessons[];
}

interface ModuleWithLessons {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
}

/** Only the block types that can be authored from text alone. image, video
 * and chart carry an asset reference, and the panel has no media upload, so
 * offering them here would produce blocks that render as "media not found". */
const BLOCK_TYPES = [
  { value: "text", label: "پاراگراف" },
  { value: "heading", label: "عنوان" },
  { value: "quote", label: "نقل‌قول" },
  { value: "latex", label: "فرمول (LaTeX)" },
] as const;

type BlockType = (typeof BLOCK_TYPES)[number]["value"];
interface DraftBlock { id: number; type: BlockType; value: string }

let blockId = 0;
const newBlock = (): DraftBlock => ({ id: (blockId += 1), type: "text", value: "" });

function toContentBlock(block: DraftBlock) {
  if (block.type === "heading") return { type: "heading", level: 2, text: block.value };
  if (block.type === "quote") return { type: "quote", text: block.value };
  if (block.type === "latex") return { type: "latex", latex: block.value };
  return { type: "text", text: block.value };
}

function LessonForm({ moduleId, onAdded }: { moduleId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
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
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/modules/${moduleId}/lessons`, {
        method: "POST",
        body: { title, order: 1, contentBlocks: filled.map(toContentBlock) },
      });
      setTitle("");
      setBlocks([newBlock()]);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "افزودن درس ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="ds-form">
      <Field label="عنوان درس" required>
        {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
      </Field>

      <div>
        <span className="ds-label">محتوای درس</span>
        <div className="ds-stack-sm">
          {blocks.map((block, index) => (
            <div className="ds-block-row" key={block.id}>
              <div style={{ width: "10rem" }}>
                <Select
                  value={block.type}
                  aria-label={`نوع بلوک ${toPersianDigits(index + 1)}`}
                  onChange={(event) =>
                    setBlocks(blocks.map((item) => (item.id === block.id ? { ...item, type: event.target.value as BlockType } : item)))
                  }
                >
                  {BLOCK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
              </div>
              <div className="ds-grow">
                <Textarea
                  value={block.value}
                  aria-label={`متن بلوک ${toPersianDigits(index + 1)}`}
                  onChange={(event) =>
                    setBlocks(blocks.map((item) => (item.id === block.id ? { ...item, value: event.target.value } : item)))
                  }
                />
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
          تصویر، ویدئو و نمودار از این فرم ساخته نمی‌شوند چون به فایل رسانه نیاز دارند و پنل هنوز
          آپلود رسانه ندارد؛ این بلوک‌ها فقط از مسیر ورود دادهٔ zip وارد می‌شوند.
        </p>
        <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock()])}>
          افزودن بلوک
        </Button>
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
  return (
    <div className="ds-stack" style={{ marginTop: "var(--sp-5)" }}>
      {modules.map((module) => (
        <details className="ds-details" key={module.id}>
          <summary>
            {module.title} — {toPersianDigits(module.lessons.length)} درس
          </summary>
          <div className="ds-details-body">
            {module.lessons.length > 0 && (
              <ul className="ds-plain-list">
                {module.lessons.map((lesson) => <li key={lesson.id}>{lesson.title}</li>)}
              </ul>
            )}
            <LessonForm moduleId={module.id} onAdded={onChanged} />
          </div>
        </details>
      ))}
      <ModuleForm courseId={course.id} nextOrder={modules.length + 1} onAdded={onChanged} />
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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<Course | null>(null);
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
      await apiFetch("/admin/courses", { method: "POST", body: { slug, title, description } });
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
        description="دوره از سرفصل‌ها و هر سرفصل از درس‌ها ساخته می‌شود. ویرایش و حذف پس از ساخت هنوز از پنل ممکن نیست."
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
                        </div>
                      </div>
                      <div className="ds-row">
                        {!course.isPublished && (
                          <Button size="sm" variant="primary" onClick={() => setPublishTarget(course)}>انتشار</Button>
                        )}
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
        open={publishTarget !== null}
        title={`انتشار «${publishTarget?.title ?? ""}»؟`}
        description="پس از انتشار، دوره در فهرست عمومی دیده می‌شود و لغو انتشار از پنل ممکن نیست."
        confirmLabel="منتشر کن"
        busy={publishing}
        onConfirm={publish}
        onCancel={() => setPublishTarget(null)}
      />
    </>
  );
}
