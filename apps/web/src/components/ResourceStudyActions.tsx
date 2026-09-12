"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";

interface SavedResourceItem {
  resourceSlug?: string;
  slug?: string;
  resource?: { slug?: string };
}

function savedItems(value: unknown): SavedResourceItem[] {
  if (Array.isArray(value)) return value as SavedResourceItem[];
  if (!value || typeof value !== "object") return [];
  const record = value as { items?: unknown; resources?: unknown };
  if (Array.isArray(record.items)) return record.items as SavedResourceItem[];
  if (Array.isArray(record.resources)) return record.resources as SavedResourceItem[];
  return [];
}

function matchesSlug(item: SavedResourceItem, slug: string) {
  return item.resourceSlug === slug || item.slug === slug || item.resource?.slug === slug;
}

export function ResourceStudyActions({ slug }: { slug: string }) {
  const [authState, setAuthState] = useState<"loading" | "guest" | "member" | "unavailable">("loading");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<"save" | "plan" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiFetch<unknown>("/me/resources/saved");
        if (!active) return;
        setSaved(savedItems(response).some((item) => matchesSlug(item, slug)));
        setAuthState("member");
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) setAuthState("guest");
        else setAuthState("unavailable");
      }
    })();
    return () => { active = false; };
  }, [slug]);

  async function toggleSaved() {
    setBusy("save");
    setMessage(null);
    try {
      await apiFetch("/me/resources/saved", {
        method: saved ? "DELETE" : "POST",
        body: { resourceSlug: slug },
      });
      setSaved((current) => !current);
      setMessage(saved ? "از فهرست ذخیره‌شده‌ها برداشته شد." : "برای ادامهٔ بعدی ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیرهٔ منبع انجام نشد.");
    } finally {
      setBusy(null);
    }
  }

  async function addToPlan() {
    setBusy("plan");
    setMessage(null);
    try {
      await apiFetch(`/me/plan/resources/${encodeURIComponent(slug)}`, { method: "POST" });
      setSaved(true);
      setMessage("این منبع در نخستین ظرفیت آزاد برنامهٔ مطالعه قرار گرفت.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "افزودن منبع به برنامه انجام نشد.");
    } finally {
      setBusy(null);
    }
  }

  if (authState === "loading") return <section className="surface-card loading-state">در حال بررسی فهرست مطالعه…</section>;
  if (authState === "unavailable") return null;
  if (authState === "guest") {
    return (
      <section className="surface-card" aria-labelledby="resource-study-actions-title">
        <span className="eyebrow">فهرست مطالعه</span>
        <h2 id="resource-study-actions-title">این منبع را برای بعد نگه دار</h2>
        <p className="muted-copy">برای ذخیرهٔ منبع یا افزودن آن به برنامهٔ شخصی وارد حساب شو.</p>
        <Link className="button button-secondary" href="/login">ورود به حساب ←</Link>
      </section>
    );
  }

  return (
    <section className="surface-card" aria-labelledby="resource-study-actions-title">
      <span className="eyebrow">فهرست مطالعه</span>
      <h2 id="resource-study-actions-title">این منبع را به مسیرت وصل کن</h2>
      <p className="muted-copy">ذخیره‌کردن یعنی نگه‌داشتن برای مراجعهٔ بعد؛ افزودن به برنامه، آن را به یک اقدام واقعی تبدیل می‌کند.</p>
      <div className="cluster">
        <button className="button button-secondary" type="button" onClick={toggleSaved} disabled={busy !== null} aria-pressed={saved}>
          {busy === "save" ? "در حال ثبت…" : saved ? "حذف از ذخیره‌شده‌ها" : "ذخیره برای بعد"}
        </button>
        <button className="button button-primary" type="button" onClick={addToPlan} disabled={busy !== null}>
          {busy === "plan" ? "در حال افزودن…" : "افزودن به برنامهٔ مطالعه"}
        </button>
      </div>
      {message && <p className="success-message" role="status">{message}</p>}
    </section>
  );
}
