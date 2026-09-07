"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { EmptyState, PageHeader, SectionHeader } from "../../../components/ui";
import { apiFetch } from "../../../lib/api";

type ContributorKind = "PERSON" | "ORGANIZATION";

interface Contributor {
  id: string;
  userId: string | null;
  kind: ContributorKind;
  slug: string;
  displayName: string;
  roleTitle: string | null;
  shortBio: string | null;
  bioBlocks: unknown;
  avatarUrl: string | null;
  thesisUrl: string | null;
  sameAs: string[];
  isPublished: boolean;
  updatedAt: string;
}

interface ContributorForm {
  userId: string;
  kind: ContributorKind;
  slug: string;
  displayName: string;
  roleTitle: string;
  shortBio: string;
  longBio: string;
  avatarUrl: string;
  thesisUrl: string;
  sameAs: string;
  isPublished: boolean;
}

const emptyForm: ContributorForm = {
  userId: "",
  kind: "PERSON",
  slug: "",
  displayName: "",
  roleTitle: "",
  shortBio: "",
  longBio: "",
  avatarUrl: "",
  thesisUrl: "",
  sameAs: "",
  isPublished: false,
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function readBio(blocks: unknown) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => {
      if (typeof block === "string") return block;
      if (block && typeof block === "object" && "text" in block && typeof block.text === "string") return block.text;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function ContributorsAdmin() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [form, setForm] = useState<ContributorForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setContributors(await apiFetch<Contributor[]>("/admin/contributors"));
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError, "بارگذاری مشارکت‌کنندگان ناموفق بود."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateField<K extends keyof ContributorForm>(field: K, value: ContributorForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(contributor: Contributor) {
    setEditingId(contributor.id);
    setForm({
      userId: contributor.userId ?? "",
      kind: contributor.kind,
      slug: contributor.slug,
      displayName: contributor.displayName,
      roleTitle: contributor.roleTitle ?? "",
      shortBio: contributor.shortBio ?? "",
      longBio: readBio(contributor.bioBlocks),
      avatarUrl: contributor.avatarUrl ?? "",
      thesisUrl: contributor.thesisUrl ?? "",
      sameAs: contributor.sameAs.join("\n"),
      isPublished: contributor.isPublished,
    });
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveContributor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const body = {
      userId: form.userId.trim() || undefined,
      kind: form.kind,
      displayName: form.displayName.trim(),
      roleTitle: form.roleTitle.trim() || undefined,
      shortBio: form.shortBio.trim() || undefined,
      bioBlocks: form.longBio.trim() ? [{ type: "text", text: form.longBio.trim() }] : [],
      avatarUrl: form.avatarUrl.trim() || undefined,
      thesisUrl: form.thesisUrl.trim() || undefined,
      sameAs: form.sameAs.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      isPublished: form.isPublished,
      ...(!editingId ? { slug: form.slug.trim() } : {}),
    };

    try {
      if (editingId) {
        await apiFetch(`/admin/contributors/${editingId}`, { method: "PATCH", body });
        setMessage("پروفایل مشارکت‌کننده به‌روزرسانی شد.");
      } else {
        await apiFetch("/admin/contributors", { method: "POST", body });
        setMessage("پروفایل مشارکت‌کننده ساخته شد.");
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, "ذخیرهٔ پروفایل ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(contributor: Contributor) {
    setBusyId(contributor.id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/admin/contributors/${contributor.id}`, {
        method: "PATCH",
        body: { isPublished: !contributor.isPublished },
      });
      setMessage(contributor.isPublished ? "پروفایل از نمایش عمومی خارج شد." : "پروفایل برای نمایش عمومی منتشر شد.");
      if (editingId === contributor.id) updateField("isPublished", !contributor.isPublished);
      await load();
    } catch (toggleError) {
      setError(errorMessage(toggleError, "تغییر وضعیت انتشار ناموفق بود."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="پنل تحریریه"
        title="مشارکت‌کنندگان"
        description="پروفایل نویسنده و بازبین را مدیریت کنید؛ نام افراد فقط پس از انتشار صریح پروفایل در خروجی عمومی دیده می‌شود."
      />

      <section className="surface-card" aria-label="فرم مشارکت‌کننده">
        <SectionHeader
          title={editingId ? "ویرایش پروفایل" : "پروفایل جدید"}
          description={editingId ? "نامک هنگام ویرایش ثابت می‌ماند." : "پروفایل تازه به‌صورت پیش‌نویس ساخته می‌شود، مگر انتشار را فعال کنید."}
          action={editingId ? <button className="button button-secondary" type="button" onClick={resetForm}>انصراف از ویرایش</button> : undefined}
        />

        <form className="field-grid" onSubmit={saveContributor} aria-busy={saving}>
          <div className="field-grid field-grid-two">
            <label className="field-group">
              <span>نوع پروفایل *</span>
              <select className="field-input" value={form.kind} onChange={(event) => updateField("kind", event.target.value as ContributorKind)}>
                <option value="PERSON">شخص</option>
                <option value="ORGANIZATION">سازمان / تحریریه</option>
              </select>
            </label>
            <label className="field-group">
              <span>نام نمایشی *</span>
              <input className="field-input" value={form.displayName} onChange={(event) => updateField("displayName", event.target.value)} required />
            </label>
            <label className="field-group">
              <span>نامک لاتین *</span>
              <input className="field-input" dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => updateField("slug", event.target.value.toLowerCase())} disabled={Boolean(editingId)} required />
            </label>
            <label className="field-group">
              <span>عنوان نقش</span>
              <input className="field-input" value={form.roleTitle} onChange={(event) => updateField("roleTitle", event.target.value)} placeholder="مثلاً نویسنده یا بازبین علمی" />
            </label>
            <label className="field-group">
              <span>شناسهٔ کاربر (UUID)</span>
              <input className="field-input" dir="ltr" value={form.userId} onChange={(event) => updateField("userId", event.target.value)} />
            </label>
            <label className="field-group">
              <span>نشانی تصویر</span>
              <input className="field-input" type="url" dir="ltr" value={form.avatarUrl} onChange={(event) => updateField("avatarUrl", event.target.value)} />
            </label>
            <label className="field-group">
              <span>لینک پایان‌نامه</span>
              <input className="field-input" type="url" dir="ltr" value={form.thesisUrl} onChange={(event) => updateField("thesisUrl", event.target.value)} />
            </label>
            <label className="field-group">
              <span>پیوندهای معتبر (هر خط یک URL)</span>
              <textarea className="field-input" rows={3} dir="ltr" value={form.sameAs} onChange={(event) => updateField("sameAs", event.target.value)} />
            </label>
          </div>

          <label className="field-group">
            <span>معرفی کوتاه</span>
            <textarea className="field-input" rows={3} value={form.shortBio} onChange={(event) => updateField("shortBio", event.target.value)} />
          </label>
          <label className="field-group">
            <span>معرفی کامل</span>
            <textarea className="field-input" rows={7} value={form.longBio} onChange={(event) => updateField("longBio", event.target.value)} />
          </label>
          <label className="field-group">
            <span><input type="checkbox" checked={form.isPublished} onChange={(event) => updateField("isPublished", event.target.checked)} /> پروفایل برای نمایش عمومی تأیید شده است</span>
          </label>

          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? "در حال ذخیره…" : editingId ? "ذخیرهٔ تغییرات" : "ساخت پروفایل"}
          </button>
        </form>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      <section aria-label="فهرست مشارکت‌کنندگان" style={{ marginTop: "2rem" }}>
        <SectionHeader title="فهرست مشارکت‌کنندگان" description={`${contributors.length.toLocaleString("fa-IR")} پروفایل ثبت‌شده`} />
        {loading ? (
          <div className="surface-card loading-state" role="status">در حال بارگذاری پروفایل‌ها…</div>
        ) : contributors.length === 0 ? (
          <EmptyState title="هنوز پروفایلی ساخته نشده است" description="برای انتساب شفاف محتوا، اولین نویسنده یا بازبین را ثبت کنید." />
        ) : (
          <div className="content-grid-wide">
            {contributors.map((contributor) => (
              <article className="surface-card" key={contributor.id}>
                <span className="eyebrow">{contributor.isPublished ? "منتشرشده" : "پیش‌نویس"}</span>
                <h3 style={{ marginTop: "0.8rem" }}>{contributor.displayName}</h3>
                <p className="muted-copy">{contributor.roleTitle || (contributor.kind === "PERSON" ? "شخص" : "سازمان")}</p>
                {contributor.shortBio && <p>{contributor.shortBio}</p>}
                <p className="muted-copy" dir="ltr">/{contributor.slug}</p>
                <div className="hero-actions">
                  <button className="button button-secondary" type="button" onClick={() => startEdit(contributor)} disabled={busyId === contributor.id}>ویرایش</button>
                  <button className={contributor.isPublished ? "button button-danger" : "button button-primary"} type="button" onClick={() => void togglePublished(contributor)} disabled={busyId === contributor.id}>
                    {busyId === contributor.id ? "در حال ثبت…" : contributor.isPublished ? "لغو انتشار" : "انتشار"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ContributorsAdminPage() {
  return (
    <AdminGuard>
      <ContributorsAdmin />
    </AdminGuard>
  );
}
