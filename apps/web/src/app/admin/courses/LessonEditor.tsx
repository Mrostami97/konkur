"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { API_URL, apiFetch, apiUpload } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { Alert, Button, Field, Input, Select, Textarea } from "../../../components/ds";

/** The block kinds a lesson can hold, and what the author types for each. */
export const LESSON_BLOCKS = [
  { value: "text", label: "پاراگراف" },
  { value: "heading", label: "عنوان" },
  { value: "quote", label: "نقل‌قول / نکته" },
  { value: "latex", label: "فرمول (LaTeX)" },
  { value: "image", label: "تصویر" },
  { value: "video", label: "ویدیو (آپارات یا فایل)" },
] as const;

export type LessonBlockType = (typeof LESSON_BLOCKS)[number]["value"];

export interface DraftBlock {
  id: number;
  type: LessonBlockType;
  /** Text, LaTeX source or video URL; for an image, the alt text. */
  value: string;
  /** Image blocks only. */
  mediaKey?: string;
}

interface Asset { media_key: string; checksum: string }

export interface LessonRecord {
  id: string;
  title: string;
  isPreview: boolean;
  contentBlocks: { type: string; [key: string]: unknown }[];
  assets: Asset[];
  _count?: { progress: number };
}

let nextId = 0;
export const newBlock = (type: LessonBlockType = "text"): DraftBlock => ({ id: (nextId += 1), type, value: "" });

function fromContentBlock(block: { type: string; [key: string]: unknown }): DraftBlock {
  const type = (LESSON_BLOCKS.some((item) => item.value === block.type) ? block.type : "text") as LessonBlockType;
  if (type === "latex") return { ...newBlock(type), value: String(block.latex ?? "") };
  if (type === "video") return { ...newBlock(type), value: String(block.url ?? "") };
  if (type === "image") return { ...newBlock(type), value: String(block.alt ?? ""), mediaKey: String(block.media_key ?? "") };
  return { ...newBlock(type), value: String(block.text ?? "") };
}

export function toContentBlock(block: DraftBlock) {
  if (block.type === "heading") return { type: "heading", level: 2, text: block.value };
  if (block.type === "quote") return { type: "quote", text: block.value };
  if (block.type === "latex") return { type: "latex", latex: block.value };
  if (block.type === "video") return { type: "video", url: block.value.trim() };
  if (block.type === "image") return { type: "image", media_key: block.mediaKey, alt: block.value };
  return { type: "text", text: block.value };
}

/** What the API will refuse, said before the request so the author sees it
 * next to the block. */
export function blockProblem(block: DraftBlock): string | null {
  if (block.type === "image") return block.mediaKey ? null : "تصویر هنوز بارگذاری نشده است.";
  if (block.type === "video") {
    const url = block.value.trim();
    if (/^https:\/\/(www\.)?aparat\.com\/(v|video\/video\/embed\/videohash)\/[A-Za-z0-9]+/.test(url)) return null;
    if (/^https:\/\/.+\.(mp4|webm|m3u8)$/i.test(url)) return null;
    return "نشانی آپارات (مثل aparat.com/v/…) یا فایل ویدیوی https با پسوند mp4 بدهید.";
  }
  return block.value.trim() ? null : "این بلوک خالی است.";
}

export function BlockList({
  blocks,
  setBlocks,
  assets,
  onUpload,
}: {
  blocks: DraftBlock[];
  setBlocks: (blocks: DraftBlock[]) => void;
  assets: Asset[];
  /** Absent before the lesson exists: images need a lesson to belong to. */
  onUpload?: (file: File) => Promise<string>;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputs = useRef(new Map<number, HTMLInputElement | null>());

  const update = (id: number, patch: Partial<DraftBlock>) =>
    setBlocks(blocks.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };
  const imageUrl = (mediaKey?: string) => {
    const asset = assets.find((item) => item.media_key === mediaKey);
    return asset ? `${API_URL}/media/${asset.checksum.replace("sha256:", "")}` : null;
  };

  async function upload(block: DraftBlock, file: File | undefined) {
    if (!file || !onUpload) return;
    setUploading(block.id);
    setUploadError(null);
    try {
      update(block.id, { mediaKey: await onUpload(file) });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "بارگذاری تصویر ممکن نشد.");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="ds-stack-sm">
      {blocks.map((block, index) => {
        const problem = blockProblem(block);
        const url = block.type === "image" ? imageUrl(block.mediaKey) : null;
        return (
          <div className="le-block" key={block.id}>
            <div className="le-block-head">
              <span className="le-block-n">{toPersianDigits(index + 1)}</span>
              <Select
                value={block.type}
                aria-label={`نوع بلوک ${toPersianDigits(index + 1)}`}
                onChange={(event) => update(block.id, { type: event.target.value as LessonBlockType })}
                disabled={block.type === "image" && Boolean(block.mediaKey)}
              >
                {LESSON_BLOCKS.map((type) => (
                  <option key={type.value} value={type.value} disabled={type.value === "image" && !onUpload}>
                    {type.label}{type.value === "image" && !onUpload ? " (پس از ساخت درس)" : ""}
                  </option>
                ))}
              </Select>
              <div className="le-block-tools">
                <Button size="sm" variant="ghost" type="button" aria-label="بالا" disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
                <Button size="sm" variant="ghost" type="button" aria-label="پایین" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>↓</Button>
                <Button size="sm" variant="ghost" type="button" disabled={blocks.length === 1} onClick={() => setBlocks(blocks.filter((item) => item.id !== block.id))}>حذف</Button>
              </div>
            </div>

            {block.type === "image" ? (
              <div className="le-image">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={block.value || "پیش‌نمایش تصویر"} />
                ) : (
                  <span className="ds-hint">تصویری انتخاب نشده</span>
                )}
                <div className="le-image-side">
                  <input
                    ref={(node) => { fileInputs.current.set(block.id, node); }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    onChange={(event) => void upload(block, event.target.files?.[0])}
                  />
                  <Button size="sm" type="button" loading={uploading === block.id} onClick={() => fileInputs.current.get(block.id)?.click()}>
                    {block.mediaKey ? "تعویض تصویر" : "انتخاب تصویر"}
                  </Button>
                  <Input
                    value={block.value}
                    placeholder="متن جایگزین (برای صفحه‌خوان)"
                    aria-label="متن جایگزین تصویر"
                    onChange={(event) => update(block.id, { value: event.target.value })}
                  />
                  <span className="ds-hint">JPEG، PNG، WebP یا GIF، حداکثر ۵ مگابایت.</span>
                </div>
              </div>
            ) : block.type === "video" ? (
              <Input
                dir="ltr"
                value={block.value}
                placeholder="https://www.aparat.com/v/..."
                aria-label="نشانی ویدیو"
                onChange={(event) => update(block.id, { value: event.target.value })}
              />
            ) : (
              <Textarea
                value={block.value}
                dir={block.type === "latex" ? "ltr" : undefined}
                className={block.type === "heading" ? "ds-textarea-sm" : undefined}
                aria-label={`متن بلوک ${toPersianDigits(index + 1)}`}
                onChange={(event) => update(block.id, { value: event.target.value })}
              />
            )}
            {problem && block.value !== "" && <p className="ds-error-text">{problem}</p>}
          </div>
        );
      })}
      {uploadError && <Alert tone="danger">{uploadError}</Alert>}
      <div className="ds-row">
        <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock()])}>+ پاراگراف</Button>
        <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock("heading")])}>+ عنوان</Button>
        <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock("video")])}>+ ویدیو</Button>
        <Button size="sm" type="button" disabled={!onUpload} onClick={() => setBlocks([...blocks, newBlock("image")])}>+ تصویر</Button>
        <Button size="sm" type="button" onClick={() => setBlocks([...blocks, newBlock("latex")])}>+ فرمول</Button>
      </div>
    </div>
  );
}

/** Edits a saved lesson: title, free-preview flag and every block,
 * including images, which are uploaded to this lesson. */
export function LessonEditor({ lessonId, onSaved, onClose }: { lessonId: string; onSaved: () => void; onClose: () => void }) {
  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [title, setTitle] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [blocks, setBlocks] = useState<DraftBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<LessonRecord>(`/admin/lessons/${lessonId}`)
      .then((record) => {
        setLesson(record);
        setTitle(record.title);
        setIsPreview(record.isPreview);
        setBlocks(record.contentBlocks.length ? record.contentBlocks.map(fromContentBlock) : [newBlock()]);
      })
      .catch(() => setError("خواندن درس ممکن نشد."));
  }, [lessonId]);

  async function uploadImage(file: File) {
    const result = await apiUpload<{ media_key: string; checksum: string }>(`/admin/lessons/${lessonId}/images`, file);
    setLesson((current) =>
      current && !current.assets.some((asset) => asset.media_key === result.media_key)
        ? { ...current, assets: [...current.assets, { media_key: result.media_key, checksum: result.checksum }] }
        : current,
    );
    return result.media_key;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const problems = blocks.map(blockProblem).filter(Boolean);
    if (problems.length) {
      setError(`${toPersianDigits(problems.length)} بلوک مشکل دارد؛ کنار هرکدام نوشته شده است.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/lessons/${lessonId}`, {
        method: "PATCH",
        body: { title, isPreview, contentBlocks: blocks.map(toContentBlock) },
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیرهٔ درس ممکن نشد.");
    } finally {
      setSaving(false);
    }
  }

  if (!lesson) return error ? <Alert tone="danger">{error}</Alert> : <p className="ds-hint">در حال خواندن درس…</p>;

  return (
    <form className="ds-form le-editor" onSubmit={save}>
      <div className="ds-row-between">
        <h3 className="ds-card-title">ویرایش درس</h3>
        <Button size="sm" variant="ghost" type="button" onClick={onClose}>بستن</Button>
      </div>
      <Field label="عنوان درس" required>
        {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
      </Field>
      <label className="ds-checkbox-row">
        <input type="checkbox" checked={isPreview} onChange={(event) => setIsPreview(event.target.checked)} />
        <span>
          جلسهٔ رایگان (پیش‌نمایش)
          <span className="ds-hint" style={{ display: "block", marginTop: 0 }}>برای همه، حتی بدون ورود، باز است؛ تصویرهایش هم عمومی می‌شوند.</span>
        </span>
      </label>
      <div>
        <span className="ds-label">محتوای درس</span>
        <BlockList blocks={blocks} setBlocks={setBlocks} assets={lesson.assets} onUpload={uploadImage} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">درس ذخیره شد.</Alert>}
      <div className="ds-row">
        <Button type="submit" variant="primary" loading={saving}>ذخیرهٔ درس</Button>
        <a className="ds-btn ds-btn-ghost" href={`/lessons/${lessonId}`} target="_blank" rel="noreferrer">دیدن درس</a>
      </div>
    </form>
  );
}
