"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TARGET_FIELDS } from "../app/account/profile-options";
import { apiFetch } from "../lib/api";
import { toPersianDigits } from "../lib/format";

type ActivityEvent =
  | { id: string; kind: "signup"; at: string; degree: "MASTER" | "PHD" | null; field: string | null }
  | { id: string; kind: "purchase"; at: string; product: string };

const FIRST_DELAY_MS = 9_000;
const GAP_MS = 32_000;
const VISIBLE_MS = 7_000;
/** Across the whole visit, not per page, so moving around never floods anyone. */
const MAX_PER_VISIT = 3;
const STORE = "kz-activity";

/** Pages where a notice would interrupt: signing in, and the pages behind it. */
const QUIET = /^\/(login|onboarding)(\/|$)/;

function readStore(): { seen: string[]; shown: number; off: boolean } {
  try {
    const raw = window.sessionStorage.getItem(STORE);
    if (raw) return { seen: [], shown: 0, off: false, ...JSON.parse(raw) };
  } catch {
    // Storage blocked: the notices still work, just without memory.
  }
  return { seen: [], shown: 0, off: false };
}

function writeStore(value: { seen: string[]; shown: number; off: boolean }) {
  try {
    window.sessionStorage.setItem(STORE, JSON.stringify(value));
  } catch {
    // Ignored for the same reason as above.
  }
}

function ago(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  return `${toPersianDigits(Math.round(hours / 24))} روز پیش`;
}

function describe(event: ActivityEvent) {
  if (event.kind === "purchase") {
    return { line: <>یک نفر <b>«{event.product}»</b> را تهیه کرد</>, cta: "دیدن دوره‌ها", href: "/courses" };
  }
  const degree = event.degree === "PHD" ? "دکتری" : event.degree === "MASTER" ? "ارشد" : null;
  const field = TARGET_FIELDS.find((option) => option.value === event.field)?.label ?? null;
  const who = degree ? `یک داوطلب ${degree}${field ? ` ${field}` : ""}` : "یک داوطلب تازه";
  return { line: <>{who} به <b>کنکورصفریک</b> پیوست</>, cta: "تو هم شروع کن", href: "/login" };
}

/**
 * "Someone just joined / bought" notices, from real recent activity only.
 * The API sends nothing that identifies a person; with no recent activity
 * nothing appears. At most three per visit, one at a time, and closing one
 * ends them for the visit.
 */
export function ActivityToasts() {
  const pathname = usePathname() ?? "";
  const [current, setCurrent] = useState<ActivityEvent | null>(null);
  const queue = useRef<ActivityEvent[] | null>(null);
  const timers = useRef<number[]>([]);
  const quiet = QUIET.test(pathname);

  useEffect(() => {
    if (quiet) return;
    const store = readStore();
    if (store.off || store.shown >= MAX_PER_VISIT) return;
    let cancelled = false;

    const later = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    };

    const showNext = () => {
      if (cancelled) return;
      const state = readStore();
      if (state.off || state.shown >= MAX_PER_VISIT) return;
      const next = (queue.current ?? []).find((event) => !state.seen.includes(event.id));
      if (!next) return;
      writeStore({ ...state, seen: [...state.seen, next.id].slice(-40), shown: state.shown + 1 });
      setCurrent(next);
      later(() => setCurrent(null), VISIBLE_MS);
      later(showNext, GAP_MS);
    };

    later(async () => {
      if (queue.current === null) {
        queue.current = await apiFetch<ActivityEvent[]>("/site/activity").catch(() => []);
      }
      showNext();
    }, FIRST_DELAY_MS);

    return () => {
      cancelled = true;
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
      setCurrent(null);
    };
  }, [pathname, quiet]);

  if (!current || quiet) return null;
  const { line, cta, href } = describe(current);

  return (
    <div className="act-toast" role="status" aria-live="polite">
      <span className={`act-toast-icon act-toast-${current.kind}`} aria-hidden="true">
        {current.kind === "purchase" ? (
          <svg viewBox="0 0 24 24"><path d="M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8zM9 7a3 3 0 0 1 6 0" /></svg>
        ) : (
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
        )}
      </span>
      <div className="act-toast-body">
        <p>{line}</p>
        <small>
          {ago(current.at)} · <Link href={href}>{cta}</Link>
        </small>
      </div>
      <button
        type="button"
        className="act-toast-close"
        aria-label="بستن و نشان‌ندادن دوباره در این بازدید"
        onClick={() => {
          writeStore({ ...readStore(), off: true });
          setCurrent(null);
        }}
      >
        ×
      </button>
    </div>
  );
}
