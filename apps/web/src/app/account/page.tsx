"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";

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

  if (loading) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;
  if (!me) return null;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>حساب من</h1>
      <p>
        {me.user.phone} — نقش‌ها: {me.user.roles.join(", ")}
      </p>
      <button onClick={logout}>خروج</button>
      {me.user.roles.some((r) => ["ADMIN", "AUTHOR", "REVIEWER", "FINANCE", "MENTOR"].includes(r)) && (
        <p>
          <Link href="/admin">ورود به پنل ادمین</Link>
        </p>
      )}

      <h2>پروفایل</h2>
      {profile && (
        <form onSubmit={saveProfile}>
          <label>
            نام نمایشی
            <input
              value={profile.displayName ?? ""}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.5rem" }}
            />
          </label>
          <label>
            مقطع هدف
            <select
              value={profile.targetDegree ?? ""}
              onChange={(e) => setProfile({ ...profile, targetDegree: e.target.value })}
              style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.5rem" }}
            >
              <option value="">—</option>
              <option value="MASTER">ارشد</option>
              <option value="PHD">دکتری</option>
            </select>
          </label>
          <label>
            گرایش هدف
            <input
              value={profile.targetField ?? ""}
              onChange={(e) => setProfile({ ...profile, targetField: e.target.value })}
              style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.5rem" }}
            />
          </label>
          <button type="submit">{saveState === "saving" ? "در حال ذخیره..." : "ذخیره"}</button>
          {saveState === "saved" && <span style={{ color: "green" }}> ذخیره شد</span>}
        </form>
      )}

      <h2>دوره‌های من</h2>
      {enrollments.length === 0 ? (
        <p>هنوز در دوره‌ای ثبت‌نام نکرده‌اید.</p>
      ) : (
        <ul>
          {enrollments.map((e) => (
            <li key={e.id}>
              <Link href={`/courses/${e.course.slug}`}>{e.course.title}</Link>
            </li>
          ))}
        </ul>
      )}

      <h2>دسترسی‌های من</h2>
      {entitlements.length === 0 ? (
        <p>دسترسی فعالی وجود ندارد.</p>
      ) : (
        <ul>
          {entitlements.map((e) => (
            <li key={e.id}>
              {e.product.title} ({e.grantedVia})
            </li>
          ))}
        </ul>
      )}

      <h2>نقشه تسلط</h2>
      {mastery.length === 0 ? (
        <p>هنوز شواهدی برای محاسبه تسلط شما وجود ندارد؛ در آزمون‌ها شرکت کنید.</p>
      ) : (
        <ul>
          {mastery.map((m) => (
            <li key={m.topicCode}>
              {m.subjectCode} / {m.topicCode} — تسلط: {(m.masteryScore * 100).toFixed(0)}٪ (اطمینان: {m.confidence})
            </li>
          ))}
        </ul>
      )}

      <h2>تاریخچه تغییر برنامه</h2>
      {revisions.length === 0 ? (
        <p>هنوز برنامه‌ای ساخته نشده است.</p>
      ) : (
        <ul>
          {revisions.map((r) => (
            <li key={r.id}>
              [{r.reasonCode}] {r.summary} — {new Date(r.createdAt).toLocaleDateString("fa-IR")}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
