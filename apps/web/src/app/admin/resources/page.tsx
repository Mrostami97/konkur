"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { EmptyState, PageHeader, SectionHeader } from "../../../components/ui";
import { apiFetch } from "../../../lib/api";

const RESOURCE_KINDS = [
  "NOTE",
  "VIDEO",
  "PDF",
  "EXTERNAL_LINK",
  "OFFICIAL_NOTICE",
  "EXAM_PROGRAM",
  "REGISTRATION_BOOKLET",
  "QUESTION_BOOKLET",
  "ANSWER_KEY",
  "CORRECTION",
  "ACADEMIC_SYLLABUS",
  "OPEN_TEXTBOOK",
  "OLYMPIAD_PROBLEM_SET",
  "OLYMPIAD_SOLUTION",
  "TELEGRAM_POST",
  "TRANSCRIPT",
] as const;

const ACCESS_MODES = ["PUBLIC", "ACCOUNT", "ENTITLEMENT"] as const;
const HOSTING_MODES = [
  "METADATA_ONLY",
  "EXTERNAL_LINK",
  "OFFICIAL_EMBED",
  "USER_UPLOAD",
  "MIRRORED_WITH_PERMISSION",
] as const;

type ResourceKind = (typeof RESOURCE_KINDS)[number];
type AccessMode = (typeof ACCESS_MODES)[number];
type HostingMode = (typeof HOSTING_MODES)[number];
type ReviewStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED";
type Degree = "MASTER" | "PHD";

interface ContentSource {
  id: string;
  title: string;
  publisher: string;
  canonicalUrl: string;
  sourceStatus: string;
  archivedAt?: string | null;
  mayHost: boolean;
  rightsBasis: string;
}

interface Contributor {
  id: string;
  displayName: string;
  roleTitle?: string | null;
  isPublished: boolean;
}

interface ResourceSource {
  sourceId: string;
  relation: string;
  locator?: string | null;
  claim?: string | null;
  order: number;
  source: ContentSource;
}

interface ResourceRecord {
  id: string;
  externalId?: string | null;
  slug: string;
  title: string;
  summary: string;
  description?: string | null;
  kind: ResourceKind;
  accessMode: AccessMode;
  hostingMode: HostingMode;
  contentBlocks: unknown;
  externalUrl?: string | null;
  sourceArtifactId?: string | null;
  taxonomyDegrees: Degree[];
  taxonomyFields: string[];
  subjectCodes: string[];
  topicCodes: string[];
  authorProfileId?: string | null;
  authorProfile?: Contributor | null;
  reviewerProfile?: Contributor | null;
  sources: ResourceSource[];
  reviewStatus: ReviewStatus;
  version: number;
  updatedAt: string;
}

interface SourceDraft {
  sourceId: string;
  relation: string;
  locator: string;
  claim: string;
  order: number;
}

interface ResourceFormState {
  externalId: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  kind: ResourceKind;
  accessMode: AccessMode;
  hostingMode: HostingMode;
  contentBlocks: string;
  externalUrl: string;
  sourceArtifactId: string;
  taxonomyDegrees: Degree[];
  taxonomyFields: string;
  subjectCodes: string;
  topicCodes: string;
  authorProfileId: string;
  sources: SourceDraft[];
}

const KIND_LABELS: Record<ResourceKind, string> = {
  NOTE: "جزوه",
  VIDEO: "ویدئو",
  PDF: "فایل PDF",
  EXTERNAL_LINK: "پیوند بیرونی",
  OFFICIAL_NOTICE: "اطلاعیهٔ رسمی",
  EXAM_PROGRAM: "برنامهٔ آزمون",
  REGISTRATION_BOOKLET: "دفترچهٔ ثبت‌نام",
  QUESTION_BOOKLET: "دفترچهٔ سؤال",
  ANSWER_KEY: "کلید پاسخ",
  CORRECTION: "اصلاحیه",
  ACADEMIC_SYLLABUS: "سرفصل دانشگاهی",
  OPEN_TEXTBOOK: "کتاب آزاد",
  OLYMPIAD_PROBLEM_SET: "مجموعه‌مسئلهٔ المپیاد",
  OLYMPIAD_SOLUTION: "حل مسئلهٔ المپیاد",
  TELEGRAM_POST: "پست تلگرام",
  TRANSCRIPT: "متن پیاده‌شده",
};

const ACCESS_LABELS: Record<AccessMode, string> = {
  PUBLIC: "عمومی؛ بدون ورود",
  ACCOUNT: "رایگان؛ با حساب",
  ENTITLEMENT: "پولی؛ با دسترسی فعال",
};

const HOSTING_LABELS: Record<HostingMode, string> = {
  METADATA_ONLY: "فقط شناسنامه",
  EXTERNAL_LINK: "لینک خارجی",
  OFFICIAL_EMBED: "نمایش رسمی",
  USER_UPLOAD: "فایل متعلق به kunkur01",
  MIRRORED_WITH_PERMISSION: "نسخهٔ میزبانی‌شده با مجوز",
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  DRAFT: "پیش‌نویس",
  IN_REVIEW: "در انتظار بررسی",
  PUBLISHED: "منتشرشده",
  REJECTED: "نیازمند اصلاح",
};

const EMPTY_FORM: ResourceFormState = {
  externalId: "",
  slug: "",
  title: "",
  summary: "",
  description: "",
  kind: "NOTE",
  accessMode: "PUBLIC",
  hostingMode: "METADATA_ONLY",
  contentBlocks: '[\n  {\n    "type": "text",\n    "text": ""\n  }\n]',
  externalUrl: "",
  sourceArtifactId: "",
  taxonomyDegrees: [],
  taxonomyFields: "",
  subjectCodes: "",
  topicCodes: "",
  authorProfileId: "",
  sources: [],
};

const PROTECTED_HOSTING_MODES = new Set<HostingMode>(["USER_UPLOAD", "MIRRORED_WITH_PERMISSION"]);
const EXTERNAL_HOSTING_MODES = new Set<HostingMode>(["EXTERNAL_LINK", "OFFICIAL_EMBED"]);
const DOCUMENTED_HOSTING_RIGHTS = new Set(["OWNED_BY_PUBLISHER", "USER_DECLARATION", "SIGNED_PERMISSION", "OPEN_LICENSE"]);

function splitValues(value: string) {
  return value
    .split(/[،,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ResourcesAdmin() {
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [contentSources, setContentSources] = useState<ContentSource[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [form, setForm] = useState<ResourceFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sourceToAdd, setSourceToAdd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resourceList, sourceList, contributorList] = await Promise.all([
        apiFetch<ResourceRecord[]>("/admin/resources"),
        apiFetch<ContentSource[]>("/admin/content-sources"),
        apiFetch<Contributor[]>("/admin/contributors"),
      ]);
      setResources(resourceList);
      setContentSources(sourceList);
      setContributors(contributorList);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "دریافت اطلاعات منابع ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const availableSources = useMemo(
    () => contentSources.filter((source) =>
      !source.archivedAt &&
      source.sourceStatus === "ACTIVE" &&
      !form.sources.some((item) => item.sourceId === source.id),
    ),
    [contentSources, form.sources],
  );

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSourceToAdd("");
    setError(null);
    setNotice(null);
  }

  function addSource() {
    if (!sourceToAdd) return;
    setForm((current) => ({
      ...current,
      sources: [
        ...current.sources,
        { sourceId: sourceToAdd, relation: "PRIMARY", locator: "", claim: "", order: current.sources.length },
      ],
    }));
    setSourceToAdd("");
  }

  function updateSource(index: number, patch: Partial<SourceDraft>) {
    setForm((current) => ({
      ...current,
      sources: current.sources.map((source, sourceIndex) => (sourceIndex === index ? { ...source, ...patch } : source)),
    }));
  }

  function removeSource(index: number) {
    setForm((current) => ({
      ...current,
      sources: current.sources
        .filter((_, sourceIndex) => sourceIndex !== index)
        .map((source, sourceIndex) => ({ ...source, order: sourceIndex })),
    }));
  }

  function toggleDegree(degree: Degree) {
    setForm((current) => ({
      ...current,
      taxonomyDegrees: current.taxonomyDegrees.includes(degree)
        ? current.taxonomyDegrees.filter((item) => item !== degree)
        : [...current.taxonomyDegrees, degree],
    }));
  }

  function changeHostingMode(hostingMode: HostingMode) {
    setForm((current) => ({
      ...current,
      hostingMode,
      sourceArtifactId: PROTECTED_HOSTING_MODES.has(hostingMode) ? current.sourceArtifactId : "",
      externalUrl: EXTERNAL_HOSTING_MODES.has(hostingMode) ? current.externalUrl : "",
    }));
  }

  async function beginEdit(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const resource = await apiFetch<ResourceRecord>(`/admin/resources/${id}`);
      setEditingId(resource.id);
      setForm({
        externalId: resource.externalId ?? "",
        slug: resource.slug,
        title: resource.title,
        summary: resource.summary,
        description: resource.description ?? "",
        kind: resource.kind,
        accessMode: resource.accessMode,
        hostingMode: resource.hostingMode,
        contentBlocks: JSON.stringify(resource.contentBlocks ?? [], null, 2),
        externalUrl: resource.externalUrl ?? "",
        sourceArtifactId: resource.sourceArtifactId ?? "",
        taxonomyDegrees: resource.taxonomyDegrees ?? [],
        taxonomyFields: (resource.taxonomyFields ?? []).join("، "),
        subjectCodes: (resource.subjectCodes ?? []).join("، "),
        topicCodes: (resource.topicCodes ?? []).join("، "),
        authorProfileId: resource.authorProfileId ?? "",
        sources: resource.sources.map((source) => ({
          sourceId: source.sourceId,
          relation: source.relation,
          locator: source.locator ?? "",
          claim: source.claim ?? "",
          order: source.order,
        })),
      });
      setNotice(`در حال ویرایش «${resource.title}» هستید.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "بازکردن منبع برای ویرایش ممکن نشد.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const parsedBlocks: unknown = form.contentBlocks.trim() ? JSON.parse(form.contentBlocks) : [];
      if (!Array.isArray(parsedBlocks)) throw new Error("بلوک‌های محتوا باید یک آرایهٔ JSON باشند.");
      if (form.sources.length === 0) throw new Error("حداقل یک منبع مستند را متصل کنید.");

      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
        accessMode: form.accessMode,
        hostingMode: form.hostingMode,
        contentBlocks: parsedBlocks,
        externalUrl: form.externalUrl.trim() || null,
        sourceArtifactId: form.sourceArtifactId.trim() || null,
        taxonomyDegrees: form.taxonomyDegrees,
        taxonomyFields: splitValues(form.taxonomyFields),
        subjectCodes: splitValues(form.subjectCodes),
        topicCodes: splitValues(form.topicCodes),
        authorProfileId: form.authorProfileId || null,
        sources: form.sources.map((source, index) => ({
          sourceId: source.sourceId,
          relation: source.relation.trim() || "PRIMARY",
          locator: source.locator.trim() || undefined,
          claim: source.claim.trim() || undefined,
          order: index,
        })),
      };

      if (editingId) {
        await apiFetch(`/admin/resources/${editingId}`, { method: "PATCH", body: payload });
        setNotice("تغییرات منبع در نسخهٔ پیش‌نویس ذخیره شد.");
      } else {
        await apiFetch("/admin/resources", {
          method: "POST",
          body: {
            ...payload,
            externalId: form.externalId.trim() || undefined,
            slug: form.slug.trim(),
          },
        });
        setNotice("منبع تازه به‌صورت پیش‌نویس ساخته شد.");
        setForm(EMPTY_FORM);
      }
      setEditingId(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ذخیرهٔ منبع ممکن نشد.");
    } finally {
      setSaving(false);
    }
  }

  async function transition(resource: ResourceRecord, action: "submit" | "approve" | "reject" | "revise") {
    let body: { reason: string } | undefined;
    if (action === "reject") {
      const reason = window.prompt("دلیل رد را برای نویسنده بنویسید:")?.trim();
      if (!reason) return;
      body = { reason };
    }

    setBusyId(resource.id);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/admin/resources/${resource.id}/${action}`, { method: "POST", body });
      setNotice(
        action === "submit"
          ? "منبع برای بررسی ارسال شد."
          : action === "approve"
            ? "منبع تأیید و منتشر شد."
            : action === "reject"
              ? "منبع همراه با دلیل برای اصلاح بازگردانده شد."
              : "نسخهٔ تازهٔ قابل ویرایش ساخته شد.",
      );
      await load();
      if (action === "revise") await beginEdit(resource.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تغییر وضعیت منبع ممکن نشد.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="تحریریه و کتابخانه"
        title="مدیریت منابع آموزشی"
        description="جزوه، ویدئو، دفترچه و پیوندهای معتبر را با سطح دسترسی، مستندات و چرخهٔ بازبینی مدیریت کنید."
        action={editingId ? <button className="button button-secondary" onClick={resetForm}>انصراف از ویرایش</button> : undefined}
      />

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <div className="content-grid">
        <form className="surface-card" onSubmit={saveResource}>
          <SectionHeader
            title={editingId ? "ویرایش پیش‌نویس" : "منبع تازه"}
            description="فیلدهای ستاره‌دار و دست‌کم یک سند منبع الزامی‌اند."
          />

          <div className="field-grid field-grid-two">
            <label className="field-group">
              <span>عنوان *</span>
              <input className="field-input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label className="field-group">
              <span>نامک لاتین *</span>
              <input
                className="field-input"
                dir="ltr"
                required
                disabled={Boolean(editingId)}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
              />
            </label>
            {!editingId && (
              <label className="field-group">
                <span>شناسهٔ بیرونی (اختیاری)</span>
                <input className="field-input" dir="ltr" value={form.externalId} onChange={(event) => setForm({ ...form, externalId: event.target.value })} />
              </label>
            )}
            <label className="field-group">
              <span>نویسنده</span>
              <select className="field-input" value={form.authorProfileId} onChange={(event) => setForm({ ...form, authorProfileId: event.target.value })}>
                <option value="">بدون انتساب عمومی</option>
                {contributors.map((contributor) => (
                  <option key={contributor.id} value={contributor.id}>
                    {contributor.displayName}{contributor.isPublished ? "" : " (پروفایل منتشرنشده)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-group">
            <span>خلاصه *</span>
            <textarea className="field-input" style={{ minHeight: 88 }} required value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
          </label>
          <label className="field-group">
            <span>توضیح تکمیلی</span>
            <textarea className="field-input" style={{ minHeight: 110 }} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>

          <div className="field-grid field-grid-two">
            <label className="field-group">
              <span>نوع منبع *</span>
              <select className="field-input" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ResourceKind })}>
                {RESOURCE_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span>سطح دسترسی *</span>
              <select className="field-input" value={form.accessMode} onChange={(event) => setForm({ ...form, accessMode: event.target.value as AccessMode })}>
                {ACCESS_MODES.map((mode) => <option key={mode} value={mode}>{ACCESS_LABELS[mode]}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span>روش میزبانی *</span>
              <select className="field-input" value={form.hostingMode} onChange={(event) => changeHostingMode(event.target.value as HostingMode)}>
                {HOSTING_MODES.map((mode) => <option key={mode} value={mode}>{HOSTING_LABELS[mode]}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span>شناسهٔ فایل بارگذاری‌شده</span>
              <input
                className="field-input"
                dir="ltr"
                placeholder="UUID"
                disabled={!PROTECTED_HOSTING_MODES.has(form.hostingMode)}
                value={form.sourceArtifactId}
                onChange={(event) => setForm({ ...form, sourceArtifactId: event.target.value })}
              />
            </label>
          </div>

          <label className="field-group">
            <span>نشانی بیرونی</span>
            <input
              className="field-input"
              dir="ltr"
              type="url"
              placeholder="https://..."
              disabled={!EXTERNAL_HOSTING_MODES.has(form.hostingMode)}
              value={form.externalUrl}
              onChange={(event) => setForm({ ...form, externalUrl: event.target.value })}
            />
          </label>
          <label className="field-group">
            <span>بلوک‌های محتوا (JSON)</span>
            <textarea
              className="field-input"
              dir="ltr"
              spellCheck={false}
              style={{ minHeight: 190, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", lineHeight: 1.6 }}
              value={form.contentBlocks}
              onChange={(event) => setForm({ ...form, contentBlocks: event.target.value })}
            />
          </label>

          <SectionHeader title="طبقه‌بندی" description="مقادیر چندتایی را با ویرگول جدا کنید." />
          <div className="field-group">
            <span>مقطع‌ها</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
              <label><input type="checkbox" checked={form.taxonomyDegrees.includes("MASTER")} onChange={() => toggleDegree("MASTER")} /> ارشد</label>
              <label><input type="checkbox" checked={form.taxonomyDegrees.includes("PHD")} onChange={() => toggleDegree("PHD")} /> دکتری</label>
            </div>
          </div>
          <div className="field-grid field-grid-two">
            <label className="field-group"><span>رشته‌ها</span><input className="field-input" value={form.taxonomyFields} onChange={(event) => setForm({ ...form, taxonomyFields: event.target.value })} /></label>
            <label className="field-group"><span>کد درس‌ها</span><input className="field-input" dir="ltr" value={form.subjectCodes} onChange={(event) => setForm({ ...form, subjectCodes: event.target.value })} /></label>
            <label className="field-group"><span>کد مبحث‌ها</span><input className="field-input" dir="ltr" value={form.topicCodes} onChange={(event) => setForm({ ...form, topicCodes: event.target.value })} /></label>
          </div>

          <SectionHeader title="اسناد و منابع" description="رابطه، محل استناد و ادعای پشتیبانی‌شده برای هر سند مستقل ثبت می‌شود." />
          <div style={{ display: "flex", alignItems: "end", gap: "0.65rem", flexWrap: "wrap" }}>
            <label className="field-group" style={{ flex: "1 1 260px" }}>
              <span>افزودن سند</span>
              <select className="field-input" value={sourceToAdd} onChange={(event) => setSourceToAdd(event.target.value)}>
                <option value="">یک منبع را انتخاب کنید</option>
                {availableSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.title} — {source.publisher}
                    {source.mayHost && DOCUMENTED_HOSTING_RIGHTS.has(source.rightsBasis) ? " — مجوز میزبانی ثبت‌شده" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-secondary" type="button" disabled={!sourceToAdd} onClick={addSource}>اتصال منبع</button>
          </div>

          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            {form.sources.map((source, index) => {
              const sourceInfo = contentSources.find((item) => item.id === source.sourceId);
              return (
                <div className="surface-card surface-card-muted" key={source.sourceId}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "1rem" }}>
                    <div><strong>{sourceInfo?.title ?? source.sourceId}</strong><div className="muted-copy">{sourceInfo?.publisher}</div></div>
                    <button className="button button-danger" type="button" onClick={() => removeSource(index)}>حذف اتصال</button>
                  </div>
                  <div className="field-grid field-grid-two">
                    <label className="field-group"><span>نوع رابطه *</span><input className="field-input" dir="ltr" value={source.relation} onChange={(event) => updateSource(index, { relation: event.target.value })} /></label>
                    <label className="field-group"><span>محل استناد</span><input className="field-input" value={source.locator} onChange={(event) => updateSource(index, { locator: event.target.value })} /></label>
                  </div>
                  <label className="field-group"><span>ادعای پشتیبانی‌شده</span><textarea className="field-input" value={source.claim} onChange={(event) => updateSource(index, { claim: event.target.value })} /></label>
                </div>
              );
            })}
          </div>

          <button className="button button-primary" style={{ marginTop: "1.25rem" }} type="submit" disabled={saving}>
            {saving ? "در حال ذخیره..." : editingId ? "ذخیرهٔ پیش‌نویس" : "ساخت پیش‌نویس"}
          </button>
        </form>

        <aside className="surface-card surface-card-muted" style={{ alignSelf: "start" }}>
          <h2>پیش از ارسال برای بررسی</h2>
          <ul className="quick-links">
            <li>حداقل یک سند معتبر و فعال متصل باشد.</li>
            <li>منبع خارجی باید نشانی قابل بازکردن داشته باشد.</li>
            <li>نمایش رسمی فقط با مجوز Embed همان سند انجام می‌شود.</li>
            <li>فایل فقط در دو حالت «متعلق به kunkur01» یا «میزبانی با مجوز» قابل اتصال است.</li>
            <li>میزبانی فایل به سند فعال با mayHost و مبنای حقوقی ثبت‌شده نیاز دارد.</li>
            <li>منبع پولی علاوه بر مجوز میزبانی، باید اجازهٔ استفادهٔ تجاری صریح داشته باشد.</li>
            <li>پروفایل منتشرنشده در خروجی عمومی نمایش داده نمی‌شود.</li>
          </ul>
          <p className="muted-copy">فایل پولی به‌صورت inline ارائه می‌شود؛ این سازوکار DRM یا مانع قطعی ذخیره و تصویرگرفتن نیست.</p>
        </aside>
      </div>

      <section style={{ marginTop: "2.5rem" }}>
        <SectionHeader title="همهٔ منابع" description="وضعیت تحریریه و نسخهٔ فعال هر مورد را از اینجا پیگیری کنید." />
        {loading ? (
          <p className="loading-state">در حال دریافت منابع...</p>
        ) : resources.length === 0 ? (
          <EmptyState title="هنوز منبعی ثبت نشده است" description="فرم بالا نخستین منبع مستند کتابخانه را می‌سازد." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {resources.map((resource) => (
              <article className="surface-card" key={resource.id}>
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div>
                    <span className="eyebrow">{STATUS_LABELS[resource.reviewStatus]}</span>
                    <h3 style={{ marginTop: "0.8rem", marginBottom: "0.25rem" }}>{resource.title}</h3>
                  </div>
                  <strong className="muted-copy">نسخهٔ {new Intl.NumberFormat("fa-IR").format(resource.version)}</strong>
                </div>
                <p className="muted-copy">{resource.summary}</p>
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 0.65rem", margin: "1rem 0", fontSize: "0.78rem" }}>
                  <dt>نوع</dt><dd style={{ margin: 0 }}>{KIND_LABELS[resource.kind]}</dd>
                  <dt>دسترسی</dt><dd style={{ margin: 0 }}>{ACCESS_LABELS[resource.accessMode]}</dd>
                  <dt>میزبانی</dt><dd style={{ margin: 0 }}>{HOSTING_LABELS[resource.hostingMode]}</dd>
                  <dt>اسناد</dt><dd style={{ margin: 0 }}>{new Intl.NumberFormat("fa-IR").format(resource.sources.length)}</dd>
                  <dt>آخرین تغییر</dt><dd style={{ margin: 0 }}>{formatDate(resource.updatedAt)}</dd>
                </dl>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {(resource.reviewStatus === "DRAFT" || resource.reviewStatus === "REJECTED") && (
                    <>
                      <button className="button button-secondary" disabled={busyId === resource.id} onClick={() => void beginEdit(resource.id)}>ویرایش</button>
                      <button className="button button-primary" disabled={busyId === resource.id} onClick={() => void transition(resource, "submit")}>ارسال برای بررسی</button>
                    </>
                  )}
                  {resource.reviewStatus === "IN_REVIEW" && (
                    <>
                      <button className="button button-primary" disabled={busyId === resource.id} onClick={() => void transition(resource, "approve")}>تأیید و انتشار</button>
                      <button className="button button-danger" disabled={busyId === resource.id} onClick={() => void transition(resource, "reject")}>رد با دلیل</button>
                    </>
                  )}
                  {resource.reviewStatus === "PUBLISHED" && (
                    <button className="button button-secondary" disabled={busyId === resource.id} onClick={() => void transition(resource, "revise")}>ساخت نسخهٔ تازه</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ResourcesAdminPage() {
  return (
    <AdminGuard>
      <ResourcesAdmin />
    </AdminGuard>
  );
}
