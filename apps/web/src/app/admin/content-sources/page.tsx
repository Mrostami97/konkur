"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { EmptyState, PageHeader, SectionHeader } from "../../../components/ui";
import { apiFetch } from "../../../lib/api";

interface ContentSource {
  id: string;
  externalId: string | null;
  kind: string;
  title: string;
  publisher: string;
  creator: string | null;
  canonicalUrl: string;
  sourceTier: string;
  authorityScopes: string[];
  sourceStatus: string;
  checkedAt: string;
  rightsBasis: string;
  attributionText: string | null;
  mayLink: boolean;
  mayEmbed: boolean;
  mayQuote: boolean;
  mayReproduce: boolean;
  mayAdapt: boolean;
  mayTranslate: boolean;
  mayHost: boolean;
  commercialUseAllowed: boolean;
  archivedAt: string | null;
}

interface SourceForm {
  externalId: string;
  kind: string;
  title: string;
  publisher: string;
  creator: string;
  canonicalUrl: string;
  sourceTier: string;
  authorityScopes: string;
  checkedAt: string;
  rightsBasis: string;
  attributionText: string;
  mayLink: boolean;
  mayEmbed: boolean;
  mayQuote: boolean;
  mayReproduce: boolean;
  mayAdapt: boolean;
  mayTranslate: boolean;
  mayHost: boolean;
  commercialUseAllowed: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

function emptyForm(): SourceForm {
  return {
    externalId: "",
    kind: "WEB_PAGE",
    title: "",
    publisher: "",
    creator: "",
    canonicalUrl: "",
    sourceTier: "PRIMARY",
    authorityScopes: "",
    checkedAt: today(),
    rightsBasis: "LINK_ONLY",
    attributionText: "",
    mayLink: true,
    mayEmbed: false,
    mayQuote: false,
    mayReproduce: false,
    mayAdapt: false,
    mayTranslate: false,
    mayHost: false,
    commercialUseAllowed: false,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ContentSourcesAdmin() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [form, setForm] = useState<SourceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setSources(await apiFetch<ContentSource[]>("/admin/content-sources"));
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError, "بارگذاری منابع محتوا ناموفق بود."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateField<K extends keyof SourceForm>(field: K, value: SourceForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(source: ContentSource) {
    setEditingId(source.id);
    setForm({
      externalId: source.externalId ?? "",
      kind: source.kind,
      title: source.title,
      publisher: source.publisher,
      creator: source.creator ?? "",
      canonicalUrl: source.canonicalUrl,
      sourceTier: source.sourceTier,
      authorityScopes: source.authorityScopes.join(", "),
      checkedAt: source.checkedAt.slice(0, 10),
      rightsBasis: source.rightsBasis,
      attributionText: source.attributionText ?? "",
      mayLink: source.mayLink,
      mayEmbed: source.mayEmbed,
      mayQuote: source.mayQuote,
      mayReproduce: source.mayReproduce,
      mayAdapt: source.mayAdapt,
      mayTranslate: source.mayTranslate,
      mayHost: source.mayHost,
      commercialUseAllowed: source.commercialUseAllowed,
    });
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const body = {
      kind: form.kind.trim(),
      title: form.title.trim(),
      publisher: form.publisher.trim(),
      creator: form.creator.trim() || undefined,
      canonicalUrl: form.canonicalUrl.trim(),
      sourceTier: form.sourceTier,
      authorityScopes: form.authorityScopes.split(",").map((item) => item.trim()).filter(Boolean),
      checkedAt: `${form.checkedAt}T00:00:00.000Z`,
      rightsBasis: form.rightsBasis,
      attributionText: form.attributionText.trim() || undefined,
      mayLink: form.mayLink,
      mayEmbed: form.mayEmbed,
      mayQuote: form.mayQuote,
      mayReproduce: form.mayReproduce,
      mayAdapt: form.mayAdapt,
      mayTranslate: form.mayTranslate,
      mayHost: form.mayHost,
      commercialUseAllowed: form.commercialUseAllowed,
      ...(!editingId && form.externalId.trim() ? { externalId: form.externalId.trim() } : {}),
    };

    try {
      if (editingId) {
        await apiFetch(`/admin/content-sources/${editingId}`, { method: "PATCH", body });
        setMessage("تغییرات منبع ذخیره شد.");
      } else {
        await apiFetch("/admin/content-sources", { method: "POST", body });
        setMessage("منبع جدید ثبت شد.");
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, "ذخیرهٔ منبع ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  async function archiveSource(source: ContentSource) {
    if (!window.confirm(`منبع «${source.title}» آرشیو شود؟`)) return;
    setBusyId(source.id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/admin/content-sources/${source.id}/archive`, { method: "POST" });
      if (editingId === source.id) resetForm();
      setMessage("منبع آرشیو شد و دیگر برای انتشار جدید قابل انتخاب نیست.");
      await load();
    } catch (archiveError) {
      setError(errorMessage(archiveError, "آرشیو منبع ناموفق بود."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="پنل تحریریه"
        title="منابع محتوا"
        description="منبع، تاریخ بررسی و مجوز استفاده را پیش از اتصال به مقاله یا منبع آموزشی ثبت کنید."
      />

      <section className="surface-card" aria-label="فرم منبع محتوا">
        <SectionHeader
          title={editingId ? "ویرایش منبع" : "ثبت منبع جدید"}
          description={editingId ? "شناسهٔ خارجی هنگام ویرایش ثابت می‌ماند." : "فیلدهای ستاره‌دار برای ثبت اولیه ضروری‌اند."}
          action={editingId ? <button className="button button-secondary" type="button" onClick={resetForm}>انصراف از ویرایش</button> : undefined}
        />
        <form className="field-grid" onSubmit={saveSource} aria-busy={saving}>
          <div className="field-grid field-grid-two">
            <label className="field-group">
              <span>عنوان منبع *</span>
              <input className="field-input" value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>ناشر *</span>
              <input className="field-input" value={form.publisher} onChange={(event) => updateField("publisher", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>نوع منبع *</span>
              <select className="field-input" value={form.kind} onChange={(event) => updateField("kind", event.target.value)} required>
                <option value="OFFICIAL_NOTICE">اطلاعیهٔ رسمی</option>
                <option value="WEB_PAGE">صفحهٔ وب</option>
                <option value="TELEGRAM_POST">پست تلگرام</option>
                <option value="BOOK">کتاب</option>
                <option value="PAPER">مقالهٔ علمی</option>
                <option value="VIDEO">ویدئو</option>
                <option value="OTHER">سایر</option>
              </select>
            </label>
            <label className="field-group">
              <span>سطح اعتبار *</span>
              <select className="field-input" value={form.sourceTier} onChange={(event) => updateField("sourceTier", event.target.value)} required>
                <option value="PRIMARY">اولیه / رسمی</option>
                <option value="SECONDARY">ثانویه</option>
                <option value="OWNED">متعلق به kunkur01</option>
              </select>
            </label>
            <label className="field-group">
              <span>نشانی اصلی *</span>
              <input className="field-input" type="url" dir="ltr" value={form.canonicalUrl} onChange={(event) => updateField("canonicalUrl", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>تاریخ آخرین بررسی *</span>
              <input className="field-input" type="date" dir="ltr" value={form.checkedAt} onChange={(event) => updateField("checkedAt", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>پدیدآورنده</span>
              <input className="field-input" value={form.creator} onChange={(event) => updateField("creator", event.target.value)} />
            </label>
            <label className="field-group">
              <span>شناسهٔ خارجی</span>
              <input className="field-input" dir="ltr" value={form.externalId} onChange={(event) => updateField("externalId", event.target.value)} disabled={Boolean(editingId)} />
            </label>
            <label className="field-group">
              <span>دامنه‌های اعتبار (با ویرگول)</span>
              <input className="field-input" value={form.authorityScopes} onChange={(event) => updateField("authorityScopes", event.target.value)} placeholder="مثلاً مواد آزمون، تاریخ ثبت‌نام" />
            </label>
            <label className="field-group">
              <span>مبنای حقوقی استفاده</span>
              <select className="field-input" value={form.rightsBasis} onChange={(event) => updateField("rightsBasis", event.target.value)}>
                <option value="LINK_ONLY">فقط پیوند</option>
                <option value="OWNED">مالکیت kunkur01</option>
                <option value="LICENSED">دارای مجوز</option>
                <option value="PUBLIC_DOMAIN">مالکیت عمومی</option>
                <option value="FAIR_QUOTATION">نقل‌قول محدود</option>
              </select>
            </label>
          </div>

          <label className="field-group">
            <span>متن انتساب</span>
            <textarea className="field-input" rows={3} value={form.attributionText} onChange={(event) => updateField("attributionText", event.target.value)} />
          </label>

          <fieldset className="surface-card surface-card-muted">
            <legend>مجوزهای ثبت‌شده</legend>
            <div className="field-grid field-grid-two">
              {([
                ["mayLink", "پیوند دادن"],
                ["mayEmbed", "نمایش جاسازی‌شده"],
                ["mayQuote", "نقل‌قول"],
                ["mayReproduce", "بازنشر"],
                ["mayAdapt", "بازآفرینی"],
                ["mayTranslate", "ترجمه"],
                ["mayHost", "میزبانی فایل"],
                ["commercialUseAllowed", "استفادهٔ تجاری"],
              ] as const).map(([field, label]) => (
                <label className="field-group" key={field}>
                  <span><input type="checkbox" checked={form[field]} onChange={(event) => updateField(field, event.target.checked)} /> {label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? "در حال ذخیره…" : editingId ? "ذخیرهٔ تغییرات" : "ثبت منبع"}
          </button>
        </form>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      <section aria-label="فهرست منابع محتوا" style={{ marginTop: "2rem" }}>
        <SectionHeader title="فهرست منابع" description={`${sources.length.toLocaleString("fa-IR")} منبع ثبت‌شده`} />
        {loading ? (
          <div className="surface-card loading-state" role="status">در حال بارگذاری منابع…</div>
        ) : sources.length === 0 ? (
          <EmptyState title="هنوز منبعی ثبت نشده است" description="برای ساخت زنجیرهٔ استناد، اولین منبع را از فرم بالا ثبت کنید." />
        ) : (
          <div className="content-grid-wide">
            {sources.map((source) => (
              <article className="surface-card" key={source.id}>
                <span className="eyebrow">{source.archivedAt ? "آرشیوشده" : source.sourceTier}</span>
                <h3 style={{ marginTop: "0.8rem" }}>{source.title}</h3>
                <p className="muted-copy">{source.publisher} · بررسی {new Date(source.checkedAt).toLocaleDateString("fa-IR")}</p>
                <p className="muted-copy">{source.kind} · {source.rightsBasis}</p>
                <a className="text-link" href={source.canonicalUrl} target="_blank" rel="noreferrer">مشاهدهٔ منبع اصلی ↗</a>
                <div className="hero-actions">
                  <button className="button button-secondary" type="button" onClick={() => startEdit(source)} disabled={Boolean(source.archivedAt) || busyId === source.id}>ویرایش</button>
                  {!source.archivedAt && (
                    <button className="button button-danger" type="button" onClick={() => void archiveSource(source)} disabled={busyId === source.id}>
                      {busyId === source.id ? "در حال آرشیو…" : "آرشیو"}
                    </button>
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

export default function ContentSourcesAdminPage() {
  return (
    <AdminGuard>
      <ContentSourcesAdmin />
    </AdminGuard>
  );
}
