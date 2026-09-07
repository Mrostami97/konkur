"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { EmptyState, PageHeader, SectionHeader } from "../../../components/ui";
import { apiFetch } from "../../../lib/api";

type ReviewStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED";
type ContentType = "ARTICLE" | "GUIDE" | "NEWS" | "CASE_STUDY";
type Degree = "MASTER" | "PHD";
type SourceRelation =
  | "DEFINES"
  | "SUPPORTS"
  | "DERIVED_FROM"
  | "TRANSLATION_OF"
  | "ANSWER_KEY_FOR"
  | "CORRECTS"
  | "SUPERSEDES";

interface ContentSource {
  id: string;
  externalId: string | null;
  title: string;
  publisher: string;
  archivedAt: string | null;
}

interface Contributor {
  id: string;
  slug: string;
  displayName: string;
  isPublished: boolean;
}

interface SourceLink {
  sourceId: string;
  relation: string;
  locator: string | null;
  claim: string | null;
  source: ContentSource;
}

interface ContentVersion {
  version: number;
  schemaVersion: string;
  reviewStatus: ReviewStatus;
  reviewNote?: string | null;
  payload: unknown;
}

interface Article {
  id: string;
  externalId: string | null;
  slug: string;
  title: string;
  summary: string;
  contentType: ContentType;
  quickAnswer: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  contentBlocks: unknown;
  taxonomyMajor: string[];
  taxonomyTags: string[];
  taxonomyDegrees: Degree[];
  taxonomyFields: string[];
  subjectCodes: string[];
  topicCodes: string[];
  validForYear: number | null;
  sourceValidatedAt: string | null;
  reviewDueAt: string | null;
  authorProfileId: string | null;
  reviewStatus: ReviewStatus;
  version: number;
  sources: SourceLink[];
  latestRevision: ContentVersion | null;
}

interface SourceRow {
  sourceId: string;
  relation: SourceRelation;
  locator: string;
  claim: string;
}

interface ArticleFormState {
  slug: string;
  title: string;
  summary: string;
  quickAnswer: string;
  contentType: ContentType;
  contentJson: string;
  taxonomyMajor: string;
  taxonomyTags: string;
  taxonomyFields: string;
  subjectCodes: string;
  topicCodes: string;
  degrees: Degree[];
  seoTitle: string;
  seoDescription: string;
  validForYear: string;
  sourceValidatedAt: string;
  reviewDueAt: string;
  authorProfileId: string;
  sources: SourceRow[];
}

const EMPTY_SOURCE: SourceRow = { sourceId: "", relation: "SUPPORTS", locator: "", claim: "" };

const EMPTY_FORM: ArticleFormState = {
  slug: "",
  title: "",
  summary: "",
  quickAnswer: "",
  contentType: "ARTICLE",
  contentJson: JSON.stringify([{ type: "text", text: "" }], null, 2),
  taxonomyMajor: "computer-engineering",
  taxonomyTags: "",
  taxonomyFields: "computer-engineering",
  subjectCodes: "",
  topicCodes: "",
  degrees: ["MASTER"],
  seoTitle: "",
  seoDescription: "",
  validForYear: "",
  sourceValidatedAt: "",
  reviewDueAt: "",
  authorProfileId: "",
  sources: [{ ...EMPTY_SOURCE }],
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  DRAFT: "پیش‌نویس",
  IN_REVIEW: "در حال بررسی",
  PUBLISHED: "منتشرشده",
  REJECTED: "نیازمند اصلاح",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  ARTICLE: "مقاله",
  GUIDE: "راهنما",
  NEWS: "خبر",
  CASE_STUDY: "مطالعهٔ موردی",
};

const RELATION_LABELS: Record<SourceRelation, string> = {
  DEFINES: "تعریف رسمی",
  SUPPORTS: "پشتیبان ادعا",
  DERIVED_FROM: "برگرفته از",
  TRANSLATION_OF: "ترجمهٔ",
  ANSWER_KEY_FOR: "کلید پاسخ",
  CORRECTS: "اصلاح‌کننده",
  SUPERSEDES: "جایگزین منبع پیشین",
};

function splitCsv(value: string) {
  return Array.from(new Set(value.split(",").map((part) => part.trim()).filter(Boolean)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toLocalDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function toIsoOrUndefined(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function parseContentBlocks(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("محتوا باید یک آرایهٔ JSON غیرخالی از بلوک‌ها باشد.");
  }
  return parsed;
}

function articleDisplay(article: Article) {
  const payload = asRecord(article.latestRevision?.payload);
  return {
    title: typeof payload?.title === "string" ? payload.title : article.title,
    contentType:
      typeof payload?.content_type === "string"
        ? payload.content_type.toUpperCase().replace("-", "_")
        : article.contentType,
  };
}

function effectiveRevisionStatus(article: Article) {
  return article.latestRevision?.reviewStatus ?? article.reviewStatus;
}

function ArticlesAdmin() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [form, setForm] = useState<ArticleFormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<{ articleId: string; version: number } | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [articleList, sourceList, contributorList] = await Promise.all([
        apiFetch<Article[]>("/admin/articles"),
        apiFetch<ContentSource[]>("/admin/content-sources"),
        apiFetch<Contributor[]>("/admin/contributors"),
      ]);
      setArticles(articleList);
      setSources(sourceList);
      setContributors(contributorList);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "بارگذاری پنل تحریریه انجام نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const availableSources = useMemo(
    () => sources.filter((source) => !source.archivedAt && source.externalId),
    [sources],
  );

  function updateField<K extends keyof ArticleFormState>(key: K, value: ArticleFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetEditor() {
    setForm({ ...EMPTY_FORM, degrees: [...EMPTY_FORM.degrees], sources: [{ ...EMPTY_SOURCE }] });
    setEditing(null);
    setError(null);
  }

  function updateSourceRow(index: number, patch: Partial<SourceRow>) {
    setForm((current) => ({
      ...current,
      sources: current.sources.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    }));
  }

  function addSourceRow() {
    setForm((current) => ({ ...current, sources: [...current.sources, { ...EMPTY_SOURCE }] }));
  }

  function removeSourceRow(index: number) {
    setForm((current) => ({
      ...current,
      sources: current.sources.length === 1
        ? [{ ...EMPTY_SOURCE }]
        : current.sources.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function toggleDegree(degree: Degree) {
    setForm((current) => ({
      ...current,
      degrees: current.degrees.includes(degree)
        ? current.degrees.filter((item) => item !== degree)
        : [...current.degrees, degree],
    }));
  }

  function sourceLinks() {
    const selected = form.sources.filter((row) => row.sourceId);
    if (selected.length === 0) throw new Error("حداقل یک منبع فعال برای مقاله انتخاب کنید.");
    if (new Set(selected.map((row) => row.sourceId)).size !== selected.length) {
      throw new Error("هر منبع را فقط یک بار به مقاله متصل کنید.");
    }
    return selected.map((row, order) => ({
      sourceId: row.sourceId,
      relation: row.relation,
      locator: row.locator || undefined,
      claim: row.claim || undefined,
      order,
    }));
  }

  function createDto() {
    const major = splitCsv(form.taxonomyMajor);
    if (major.length === 0) throw new Error("حداقل یک حوزهٔ اصلی وارد کنید.");
    if (form.validForYear && (!form.sourceValidatedAt || !form.reviewDueAt)) {
      throw new Error("برای محتوای وابسته به سال، تاریخ بررسی منبع و موعد بازبینی لازم است.");
    }
    return {
      slug: form.slug,
      title: form.title,
      summary: form.summary,
      contentBlocks: parseContentBlocks(form.contentJson),
      taxonomyMajor: major,
      taxonomyTags: splitCsv(form.taxonomyTags),
      contentType: form.contentType,
      quickAnswer: form.quickAnswer,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      taxonomyDegrees: form.degrees,
      taxonomyFields: splitCsv(form.taxonomyFields),
      subjectCodes: splitCsv(form.subjectCodes),
      topicCodes: splitCsv(form.topicCodes),
      validForYear: form.validForYear ? Number(form.validForYear) : undefined,
      authorProfileId: form.authorProfileId || undefined,
      sourceValidatedAt: toIsoOrUndefined(form.sourceValidatedAt),
      reviewDueAt: toIsoOrUndefined(form.reviewDueAt),
      sourceLinks: sourceLinks(),
    };
  }

  function revisionPayload(article: Article) {
    const dto = createDto();
    const previous = asRecord(article.latestRevision?.payload);
    const selectedSources = sourceLinks().map((link) => {
      const source = sources.find((item) => item.id === link.sourceId);
      if (!source?.externalId) throw new Error("منبع انتخاب‌شده شناسهٔ خارجی معتبر ندارد.");
      return {
        source_external_id: source.externalId,
        relation: link.relation,
        ...(link.locator ? { locator: link.locator } : {}),
        ...(link.claim ? { claim: link.claim } : {}),
        order: link.order,
      };
    });
    const validity = {
      ...(dto.validForYear ? { exam_year: dto.validForYear } : {}),
      time_sensitive: Boolean(dto.validForYear),
      ...(dto.sourceValidatedAt ? { source_checked_at: dto.sourceValidatedAt } : {}),
      ...(dto.reviewDueAt ? { review_due_at: dto.reviewDueAt } : {}),
    };
    const author = contributors.find((item) => item.id === form.authorProfileId);
    return {
      schema_version: "article.v2",
      external_id:
        typeof previous?.external_id === "string"
          ? previous.external_id
          : article.externalId ?? `admin-article-${article.id}`,
      content_type: form.contentType.toLowerCase(),
      title: form.title,
      slug: article.slug,
      summary: form.summary,
      quick_answer: form.quickAnswer,
      content_blocks: dto.contentBlocks,
      taxonomy: {
        major: dto.taxonomyMajor,
        tags: dto.taxonomyTags,
        degrees: form.degrees.map((degree) => degree.toLowerCase()),
        fields: dto.taxonomyFields,
        subject_codes: dto.subjectCodes,
        topic_codes: dto.topicCodes,
      },
      seo: { title: form.seoTitle, description: form.seoDescription },
      validity,
      sources: selectedSources,
      ...(author ? { editorial: { author_slug: author.slug } } : {}),
      assets: Array.isArray(previous?.assets) ? previous.assets : [],
      provenance:
        asRecord(previous?.provenance) ?? {
          producer_type: "human",
          producer_name: "تحریریه kunkur01",
          source_artifact: "admin-editor",
        },
      review_status: "draft",
    };
  }

  async function saveArticle(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusyKey("editor");
    try {
      if (editing) {
        const article = articles.find((item) => item.id === editing.articleId);
        if (!article) throw new Error("مقاله برای ویرایش پیدا نشد.");
        await apiFetch(`/admin/articles/${editing.articleId}/versions/${editing.version}`, {
          method: "PATCH",
          body: revisionPayload(article),
        });
        setNotice("نسخهٔ تحریریه ذخیره شد؛ نسخهٔ عمومی تا زمان تأیید تغییر نمی‌کند.");
      } else {
        await apiFetch("/admin/articles", { method: "POST", body: createDto() });
        setNotice("مقاله به‌صورت پیش‌نویس article.v2 ایجاد شد.");
      }
      resetEditor();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ذخیرهٔ مقاله انجام نشد.");
    } finally {
      setBusyKey(null);
    }
  }

  function populateEditor(article: Article, revision: ContentVersion) {
    const payload = asRecord(revision.payload);
    if (payload?.schema_version !== "article.v2") {
      setError("این نسخه با قرارداد قدیمی ذخیره شده است؛ ابتدا برای مقالهٔ منتشرشده نسخهٔ جدید بسازید.");
      return;
    }
    const taxonomy = asRecord(payload.taxonomy);
    const seo = asRecord(payload.seo);
    const validity = asRecord(payload.validity);
    const editorial = asRecord(payload.editorial);
    const author = contributors.find((item) => item.slug === editorial?.author_slug);
    const payloadSources = Array.isArray(payload.sources) ? payload.sources.map(asRecord).filter(Boolean) : [];
    const rows = payloadSources.map((item) => {
      const source = sources.find((candidate) => candidate.externalId === item?.source_external_id);
      return {
        sourceId: source?.id ?? "",
        relation: (typeof item?.relation === "string" ? item.relation : "SUPPORTS") as SourceRelation,
        locator: typeof item?.locator === "string" ? item.locator : "",
        claim: typeof item?.claim === "string" ? item.claim : "",
      };
    });
    const degrees = stringArray(taxonomy?.degrees)
      .map((degree) => degree.toUpperCase())
      .filter((degree): degree is Degree => degree === "MASTER" || degree === "PHD");
    setForm({
      slug: article.slug,
      title: typeof payload.title === "string" ? payload.title : article.title,
      summary: typeof payload.summary === "string" ? payload.summary : article.summary,
      quickAnswer: typeof payload.quick_answer === "string" ? payload.quick_answer : "",
      contentType: (typeof payload.content_type === "string"
        ? payload.content_type.toUpperCase()
        : "ARTICLE") as ContentType,
      contentJson: JSON.stringify(Array.isArray(payload.content_blocks) ? payload.content_blocks : [], null, 2),
      taxonomyMajor: stringArray(taxonomy?.major).join(", "),
      taxonomyTags: stringArray(taxonomy?.tags).join(", "),
      taxonomyFields: stringArray(taxonomy?.fields).join(", "),
      subjectCodes: stringArray(taxonomy?.subject_codes).join(", "),
      topicCodes: stringArray(taxonomy?.topic_codes).join(", "),
      degrees,
      seoTitle: typeof seo?.title === "string" ? seo.title : "",
      seoDescription: typeof seo?.description === "string" ? seo.description : "",
      validForYear: typeof validity?.exam_year === "number" ? String(validity.exam_year) : "",
      sourceValidatedAt: toLocalDateTime(validity?.source_checked_at),
      reviewDueAt: toLocalDateTime(validity?.review_due_at),
      authorProfileId: author?.id ?? "",
      sources: rows.length ? rows : [{ ...EMPTY_SOURCE }],
    });
    setEditing({ articleId: article.id, version: revision.version });
    setError(null);
    setNotice(`در حال ویرایش نسخهٔ ${revision.version.toLocaleString("fa-IR")} مقاله.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function beginRevision(article: Article) {
    setBusyKey(`revise-${article.id}`);
    setError(null);
    try {
      const revision = await apiFetch<ContentVersion>(`/admin/articles/${article.id}/revise`, { method: "POST" });
      await load();
      populateEditor(article, revision);
    } catch (revisionError) {
      setError(revisionError instanceof Error ? revisionError.message : "ساخت نسخهٔ جدید انجام نشد.");
    } finally {
      setBusyKey(null);
    }
  }

  async function transition(article: Article, action: "submit" | "approve" | "reject") {
    const revision = article.latestRevision;
    if (!revision) return;
    if (action === "reject" && !rejectionReason.trim()) {
      setError("برای رد نسخه، دلیل اصلاح را بنویسید.");
      return;
    }
    setBusyKey(`${action}-${article.id}`);
    setError(null);
    try {
      await apiFetch(`/admin/articles/${article.id}/versions/${revision.version}/${action}`, {
        method: "POST",
        body: action === "reject" ? { reason: rejectionReason.trim() } : undefined,
      });
      setRejectingId(null);
      setRejectionReason("");
      setNotice(
        action === "submit"
          ? "نسخه برای بازبینی ارسال شد."
          : action === "approve"
            ? "نسخه تأیید و به محتوای عمومی منتقل شد."
            : "نسخه با توضیح بازبین برای اصلاح برگشت خورد.",
      );
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "تغییر وضعیت انجام نشد.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="تحریریهٔ نسخه‌دار"
        title="مدیریت مقاله‌های article.v2"
        description="متن، سئو، طبقه‌بندی، اعتبار زمانی و منبع را یک‌جا ثبت کنید. انتشار فقط از مسیر ارسال، بازبینی و تأیید انجام می‌شود."
        action={<Link className="button button-secondary" href="/admin">بازگشت به پنل</Link>}
      />

      <form className="field-grid" onSubmit={saveArticle}>
        <section className="surface-card">
          <SectionHeader
            title={editing ? "ویرایش نسخهٔ تحریریه" : "پیش‌نویس جدید"}
            description={editing ? "تغییرها فقط روی نسخهٔ در حال ویرایش ذخیره می‌شوند." : "شناسهٔ مسیر پس از ایجاد تغییر نمی‌کند."}
            action={editing ? <button className="button button-secondary" type="button" onClick={resetEditor}>انصراف</button> : undefined}
          />
          <div className="field-grid field-grid-two">
            <label className="field-group">
              <span>شناسهٔ مسیر (slug)</span>
              <input className="field-input" dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => updateField("slug", event.target.value)} disabled={Boolean(editing)} required />
            </label>
            <label className="field-group">
              <span>نوع محتوا</span>
              <select className="field-input" value={form.contentType} onChange={(event) => updateField("contentType", event.target.value as ContentType)}>
                {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span>عنوان</span>
              <input className="field-input" value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>نویسندهٔ تأییدشده</span>
              <select className="field-input" value={form.authorProfileId} onChange={(event) => updateField("authorProfileId", event.target.value)}>
                <option value="">بدون انتساب عمومی</option>
                {contributors.map((contributor) => (
                  <option key={contributor.id} value={contributor.id}>
                    {contributor.displayName}{contributor.isPublished ? "" : " (بدون انتساب عمومی)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-group">
            <span>خلاصه</span>
            <textarea className="field-input" rows={3} value={form.summary} onChange={(event) => updateField("summary", event.target.value)} required />
          </label>
          <label className="field-group">
            <span>پاسخ کوتاه ابتدای صفحه</span>
            <textarea className="field-input" rows={3} value={form.quickAnswer} onChange={(event) => updateField("quickAnswer", event.target.value)} required />
          </label>
          <label className="field-group">
            <span>بلوک‌های محتوا (JSON)</span>
            <textarea className="field-input" dir="ltr" rows={12} spellCheck={false} value={form.contentJson} onChange={(event) => updateField("contentJson", event.target.value)} required />
          </label>
        </section>

        <section className="surface-card">
          <SectionHeader title="سئو و طبقه‌بندی" description="مقادیر چندتایی را با ویرگول انگلیسی جدا کنید." />
          <div className="field-grid field-grid-two">
            <label className="field-group">
              <span>عنوان سئو (حداکثر ۷۰ نویسه)</span>
              <input className="field-input" maxLength={70} value={form.seoTitle} onChange={(event) => updateField("seoTitle", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>توضیح سئو (حداکثر ۱۸۰ نویسه)</span>
              <textarea className="field-input" maxLength={180} rows={2} value={form.seoDescription} onChange={(event) => updateField("seoDescription", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>حوزهٔ اصلی</span>
              <input className="field-input" dir="ltr" value={form.taxonomyMajor} onChange={(event) => updateField("taxonomyMajor", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>برچسب‌ها</span>
              <input className="field-input" value={form.taxonomyTags} onChange={(event) => updateField("taxonomyTags", event.target.value)} />
            </label>
            <label className="field-group">
              <span>رشته‌ها</span>
              <input className="field-input" dir="ltr" value={form.taxonomyFields} onChange={(event) => updateField("taxonomyFields", event.target.value)} />
            </label>
            <label className="field-group">
              <span>کد درس‌ها</span>
              <input className="field-input" dir="ltr" value={form.subjectCodes} onChange={(event) => updateField("subjectCodes", event.target.value)} />
            </label>
            <label className="field-group">
              <span>کد مبحث‌ها</span>
              <input className="field-input" dir="ltr" value={form.topicCodes} onChange={(event) => updateField("topicCodes", event.target.value)} />
            </label>
            <fieldset className="field-group" style={{ border: 0, padding: 0, margin: 0 }}>
              <span>مقطع</span>
              <div style={{ display: "flex", gap: "1rem", minHeight: 44, alignItems: "center" }}>
                <label><input type="checkbox" checked={form.degrees.includes("MASTER")} onChange={() => toggleDegree("MASTER")} /> ارشد</label>
                <label><input type="checkbox" checked={form.degrees.includes("PHD")} onChange={() => toggleDegree("PHD")} /> دکتری</label>
              </div>
            </fieldset>
          </div>
        </section>

        <section className="surface-card">
          <SectionHeader title="اعتبار زمانی و منابع" description="در محتوای وابسته به آزمون سالانه، تاریخ بازبینی و موعد کنترل دوباره الزامی است." />
          <div className="field-grid field-grid-two">
            <label className="field-group">
              <span>سال آزمون (اختیاری)</span>
              <input className="field-input" type="number" min={1300} max={1600} value={form.validForYear} onChange={(event) => updateField("validForYear", event.target.value)} />
            </label>
            <span />
            <label className="field-group">
              <span>آخرین بررسی منبع</span>
              <input className="field-input" type="datetime-local" value={form.sourceValidatedAt} onChange={(event) => updateField("sourceValidatedAt", event.target.value)} required={Boolean(form.validForYear)} />
            </label>
            <label className="field-group">
              <span>موعد بازبینی بعدی</span>
              <input className="field-input" type="datetime-local" value={form.reviewDueAt} onChange={(event) => updateField("reviewDueAt", event.target.value)} required={Boolean(form.validForYear)} />
            </label>
          </div>

          <div className="field-grid" style={{ marginTop: "1rem" }}>
            {form.sources.map((row, index) => (
              <div className="surface-card surface-card-muted" key={`${index}-${row.sourceId}`}>
                <div className="field-grid field-grid-two">
                  <label className="field-group">
                    <span>منبع {Number(index + 1).toLocaleString("fa-IR")}</span>
                    <select className="field-input" value={row.sourceId} onChange={(event) => updateSourceRow(index, { sourceId: event.target.value })} required>
                      <option value="">انتخاب منبع فعال</option>
                      {availableSources.map((source) => <option key={source.id} value={source.id}>{source.title} — {source.publisher}</option>)}
                    </select>
                  </label>
                  <label className="field-group">
                    <span>نوع ارتباط</span>
                    <select className="field-input" value={row.relation} onChange={(event) => updateSourceRow(index, { relation: event.target.value as SourceRelation })}>
                      {Object.entries(RELATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="field-group">
                    <span>محل استناد (اختیاری)</span>
                    <input className="field-input" value={row.locator} onChange={(event) => updateSourceRow(index, { locator: event.target.value })} />
                  </label>
                  <label className="field-group">
                    <span>ادعای پشتیبانی‌شده (اختیاری)</span>
                    <input className="field-input" value={row.claim} onChange={(event) => updateSourceRow(index, { claim: event.target.value })} />
                  </label>
                </div>
                <button className="button button-danger" type="button" onClick={() => removeSourceRow(index)}>حذف این اتصال</button>
              </div>
            ))}
            <button className="button button-secondary" type="button" onClick={addSourceRow}>افزودن منبع دیگر</button>
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        <button className="button button-primary" type="submit" disabled={busyKey === "editor"}>
          {busyKey === "editor" ? "در حال ذخیره…" : editing ? "ذخیرهٔ نسخه" : "ایجاد پیش‌نویس"}
        </button>
      </form>

      <section style={{ marginTop: "3rem" }}>
        <SectionHeader title="صف انتشار" description="وضعیت نسخهٔ عمومی و آخرین نسخهٔ تحریریه جداگانه نمایش داده می‌شوند." />
        {loading ? (
          <p className="loading-state">در حال بارگذاری مقاله‌ها…</p>
        ) : articles.length === 0 ? (
          <EmptyState title="هنوز مقاله‌ای ثبت نشده است" description="اولین article.v2 را از فرم بالا بسازید." />
        ) : (
          <div className="field-grid">
            {articles.map((article) => {
              const display = articleDisplay(article);
              const revision = article.latestRevision;
              const status = effectiveRevisionStatus(article);
              const isLegacy = revision?.schemaVersion !== "article.v2";
              return (
                <article className="surface-card" key={article.id}>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">{CONTENT_TYPE_LABELS[display.contentType as ContentType] ?? display.contentType}</span>
                      <h2>{display.title}</h2>
                      <p dir="ltr">/{article.slug}</p>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <strong>{STATUS_LABELS[status]}</strong>
                      <p>نسخهٔ تحریریه: {revision?.version.toLocaleString("fa-IR") ?? "—"}</p>
                      {article.reviewStatus === "PUBLISHED" && status !== "PUBLISHED" && <small>نسخهٔ عمومی همچنان منتشر است</small>}
                    </div>
                  </div>

                  {revision?.reviewNote && <p className="form-error">یادداشت بازبین: {revision.reviewNote}</p>}
                  {isLegacy && <p className="muted-copy">این رکورد با قرارداد قدیمی ثبت شده و برای ویرایش باید به نسخهٔ جدید منتقل شود.</p>}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <Link className="button button-secondary" href={`/admin/articles/${article.id}/preview`}>پیش‌نمایش کارکنان</Link>
                    {article.reviewStatus === "PUBLISHED" && status === "PUBLISHED" && (
                      <button className="button button-primary" type="button" disabled={Boolean(busyKey)} onClick={() => void beginRevision(article)}>
                        {busyKey === `revise-${article.id}` ? "در حال ساخت…" : "ساخت نسخهٔ جدید"}
                      </button>
                    )}
                    {revision && !isLegacy && (status === "DRAFT" || status === "REJECTED") && (
                      <button className="button button-primary" type="button" disabled={Boolean(busyKey)} onClick={() => void transition(article, "submit")}>ارسال برای بررسی</button>
                    )}
                    {revision && !isLegacy && (status === "DRAFT" || status === "REJECTED") && (
                      <button className="button button-secondary" type="button" onClick={() => populateEditor(article, revision)}>ویرایش نسخه</button>
                    )}
                    {revision && status === "IN_REVIEW" && (
                      <>
                        <button className="button button-primary" type="button" disabled={Boolean(busyKey)} onClick={() => void transition(article, "approve")}>تأیید</button>
                        <button className="button button-danger" type="button" onClick={() => setRejectingId(article.id)}>رد با دلیل</button>
                      </>
                    )}
                  </div>

                  {rejectingId === article.id && (
                    <div className="field-grid" style={{ marginTop: "1rem" }}>
                      <label className="field-group">
                        <span>دلیل اصلاح</span>
                        <input className="field-input" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
                      </label>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="button button-danger" type="button" onClick={() => void transition(article, "reject")}>ثبت رد</button>
                        <button className="button button-secondary" type="button" onClick={() => { setRejectingId(null); setRejectionReason(""); }}>انصراف</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ArticlesAdminPage() {
  return (
    <AdminGuard>
      <ArticlesAdmin />
    </AdminGuard>
  );
}
