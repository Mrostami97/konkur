"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { EmptyState, PageHeader, StatCard } from "../../components/ui";

interface Me {
  user: { id: string; phone: string; roles: string[] };
}

interface Profile {
  displayName: string | null;
  targetDegree: string | null;
  targetField: string | null;
}

interface Enrollment {
  id: string;
  course: { slug: string; title: string };
}

interface Entitlement {
  id: string;
  product: { title: string };
  grantedVia: string;
  startAt: string;
}

interface Mastery {
  topicCode: string;
  subjectCode: string;
  masteryScore: number;
  confidence: string;
}

interface PlanRevision {
  id: string;
  reasonCode: string;
  summary: string;
  createdAt: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [mastery, setMastery] = useState<Mastery[]>([]);
  const [revisions, setRevisions] = useState<PlanRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    (async () => {
      try {
        const [meRes, profileRes, enrollmentsRes, entitlementsRes, masteryRes, revisionsRes] = await Promise.all([
          apiFetch<Me>("/auth/me"),
          apiFetch<Profile>("/me/profile"),
          apiFetch<Enrollment[]>("/me/enrollments"),
          apiFetch<Entitlement[]>("/me/entitlements"),
          apiFetch<Mastery[]>("/me/mastery").catch(() => []),
          apiFetch<PlanRevision[]>("/me/plan/revisions").catch(() => []),
        ]);
        setMe(meRes);
        setProfile(profileRes);
        setEnrollments(enrollmentsRes);
        setEntitlements(entitlementsRes);
        setMastery(masteryRes);
        setRevisions(revisionsRes);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaveState("saving");
    const updated = await apiFetch<Profile>("/me/profile", {
      method: "PATCH",
      body: {
        displayName: profile.displayName || undefined,
        targetDegree: profile.targetDegree || undefined,
        targetField: profile.targetField || undefined,
      },
    });
    setProfile(updated);
    setSaveState("saved");
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) return <main className="page-container"><div className="surface-card loading-state">در حال بارگذاری حساب...</div></main>;
  if (!me) return null;

  return (
    <main className="page-container">
      <PageHeader eyebrow="فضای شخصی" title="حساب من" description="پروفایل، دسترسی‌ها و شواهد پیشرفتت را یکجا مدیریت کن." action={<button className="button button-secondary" onClick={logout}>خروج از حساب</button>} />
      <section className="content-grid">
      <div className="surface-card">
      <div className="account-identity"><div className="avatar-placeholder">{me.user.phone.slice(-2)}</div><div><strong>{me.user.phone}</strong><p className="muted-copy">نقش‌ها: {me.user.roles.join(", ")}</p></div></div>
      {me.user.roles.some((r) => ["ADMIN", "AUTHOR", "REVIEWER", "FINANCE", "MENTOR"].includes(r)) && (
        <Link className="quick-link-highlight" href="/admin">ورود به پنل ادمین ←</Link>
      )}

      <h2>پروفایل</h2>
      {profile && (
        <form className="field-grid" onSubmit={saveProfile}>
          <label className="field-group"><span>نام نمایشی</span><input className="field-input"
              value={profile.displayName ?? ""}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            />
          </label>
          <label className="field-group"><span>مقطع هدف</span><select className="field-input"
              value={profile.targetDegree ?? ""}
              onChange={(e) => setProfile({ ...profile, targetDegree: e.target.value })}
            >
              <option value="">—</option>
              <option value="MASTER">ارشد</option>
              <option value="PHD">دکتری</option>
            </select>
          </label>
          <label className="field-group"><span>گرایش هدف</span><input className="field-input"
              value={profile.targetField ?? ""}
              onChange={(e) => setProfile({ ...profile, targetField: e.target.value })}
            />
          </label>
          <button className="button button-primary" type="submit">{saveState === "saving" ? "در حال ذخیره..." : "ذخیره تغییرات"}</button>
          {saveState === "saved" && <span className="success-message">ذخیره شد</span>}
        </form>
      )}
      </div>
      <div className="stats-grid account-stats"><StatCard label="دوره‌های من" value={enrollments.length.toLocaleString("fa-IR")} tone="teal" /><StatCard label="دسترسی‌ها" value={entitlements.length.toLocaleString("fa-IR")} tone="blue" /><StatCard label="موضوعات با شواهد" value={mastery.length.toLocaleString("fa-IR")} tone="purple" /></div>
      </section>

      <section className="content-grid-wide account-sections"><div className="surface-card"><h2>دوره‌های من</h2>
      {enrollments.length === 0 ? (
        <EmptyState title="دوره‌ای در حساب نیست" description="دوره‌های فعال بعد از ثبت‌نام اینجا نمایش داده می‌شوند." action={<Link className="button button-secondary" href="/courses">مشاهده دوره‌ها</Link>} />
      ) : (
        <ul className="quick-links">
          {enrollments.map((e) => (
            <li key={e.id}>
              <Link href={`/courses/${e.course.slug}`}>{e.course.title}</Link>
            </li>
          ))}
        </ul>
      )}</div>

      <div className="surface-card"><h2>دسترسی‌های من</h2>
      {entitlements.length === 0 ? (
        <EmptyState title="دسترسی فعالی نیست" description="دسترسی‌های خریداری یا اعطاشده اینجا قرار می‌گیرند." />
      ) : (
        <ul className="quick-links">
          {entitlements.map((e) => (
            <li key={e.id}>
              {e.product.title} ({e.grantedVia})
            </li>
          ))}
        </ul>
      )}</div>

      <div className="surface-card"><h2>نقشهٔ تسلط</h2>
      {mastery.length === 0 ? (
        <EmptyState title="هنوز داده‌ای برای تسلط نیست" description="با مطالعه و شرکت در آزمون‌ها، این بخش به‌تدریج کامل می‌شود." action={<Link className="button button-secondary" href="/exams">رفتن به آزمون‌ها</Link>} />
      ) : (
        <ul className="quick-links">
          {mastery.map((m) => (
            <li key={m.topicCode}>
              {m.subjectCode} / {m.topicCode} — تسلط: {toPersianDigits((m.masteryScore * 100).toFixed(0))}٪ (اطمینان: {m.confidence})
            </li>
          ))}
        </ul>
      )}</div></section>

      <section className="surface-card revision-section"><h2>تاریخچهٔ تغییر برنامه</h2>
      {revisions.length === 0 ? (
        <EmptyState title="هنوز برنامه‌ای ساخته نشده است" description="تغییرات و بازبرنامه‌ریزی‌های آینده اینجا ثبت می‌شوند." />
      ) : (
        <ul>
          {revisions.map((r) => (
            <li key={r.id}>
              [{r.reasonCode}] {r.summary} — {new Date(r.createdAt).toLocaleDateString("fa-IR")}
            </li>
          ))}
        </ul>
      )}</section>
    </main>
  );
}
