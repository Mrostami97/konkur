"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Glyph, type GlyphName } from "../../components/SubjectIcon";
import { loadWebApp } from "../../components/TelegramBridge";
import { apiFetch } from "../../lib/api";
import { EXAM_DATES, daysUntil } from "../../lib/exam-dates";
import { toPersianDigits } from "../../lib/format";
import type { MyAttempt } from "../account/data";

export interface FreshItem {
  href: string;
  title: string;
  summary: string;
}

const TILES: { href: string; title: string; note: string; glyph: GlyphName; tone: string }[] = [
  { href: "/questions", title: "بانک سؤال", note: "تست‌های کنکورهای قبل با پاسخ تشریحی", glyph: "list", tone: "teal" },
  { href: "/exams", title: "آزمون‌ها", note: "شبیه‌ساز کنکور با کارنامه و رتبه", glyph: "pace", tone: "violet" },
  { href: "/rank-estimate", title: "تخمین رتبه", note: "با درصدهایت رتبه‌ات را ببین", glyph: "curve", tone: "amber" },
  { href: "/choices", title: "انتخاب رشته", note: "ظرفیت‌ها و رشته‌محل‌ها", glyph: "building", tone: "blue" },
  { href: "/courses", title: "دوره‌ها", note: "کلاس‌های درس‌به‌درس", glyph: "play", tone: "rose" },
  { href: "/free-videos", title: "ویدیوی رایگان", note: "جلسه‌های نمونهٔ دوره‌ها", glyph: "spark", tone: "teal" },
  { href: "/report-cards", title: "کارنامه‌ها", note: "رتبه و درصد قبولی‌های سال‌های قبل", glyph: "trophy", tone: "amber" },
  { href: "/guides", title: "راهنماها", note: "دروس، ضرایب، تقویم و برنامه", glyph: "book", tone: "blue" },
];

type Session = { signedIn: false } | { signedIn: true; latest: MyAttempt | null };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Tehran" }).format(new Date()));
  if (hour < 5) return "شب بخیر";
  if (hour < 12) return "صبح بخیر";
  if (hour < 17) return "روز بخیر";
  return "عصر بخیر";
}

/** The mini app's home: who you are, how long is left, where you stopped, and the site one tap away. */
export function TelegramHome({ fresh }: { fresh: FreshItem[] }) {
  const [name, setName] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [days, setDays] = useState<{ master: number; phd: number } | null>(null);

  const loadSession = useCallback(async () => {
    try {
      await apiFetch("/auth/me");
    } catch {
      setSession({ signedIn: false });
      return;
    }
    try {
      const attempts = await apiFetch<MyAttempt[]>("/me/attempts");
      const latest = [...attempts].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null;
      setSession({ signedIn: true, latest });
    } catch {
      setSession({ signedIn: true, latest: null });
    }
  }, []);

  useEffect(() => {
    setDays({ master: daysUntil(EXAM_DATES.master1406.iso), phd: daysUntil(EXAM_DATES.phd1406.iso) });
    void loadWebApp().then((webApp) => setName(webApp?.initDataUnsafe?.user?.first_name ?? null));
    void loadSession();
    const again = () => void loadSession();
    window.addEventListener("kk-signed-in", again);
    return () => window.removeEventListener("kk-signed-in", again);
  }, [loadSession]);

  const latest = session?.signedIn ? session.latest : null;

  return (
    <main className="tg-home">
      <section className="tg-hero">
        <p className="tg-hello">{greeting()}{name ? `، ${name}` : ""}</p>
        <h1>کنکور ۱۴۰۶ نزدیک است؛ امروز چه کنیم؟</h1>
        <div className="tg-count">
          <div>
            <b>{days ? toPersianDigits(days.master) : "—"}</b>
            <span>روز تا ارشد</span>
          </div>
          <div>
            <b>{days ? toPersianDigits(days.phd) : "—"}</b>
            <span>روز تا دکتری</span>
          </div>
        </div>
      </section>

      {session && !session.signedIn && (
        <Link href="/login?next=/tg" className="tg-card tg-signin">
          <span className="tg-tile-icon tg-tone-teal"><Glyph name="target" /></span>
          <div>
            <strong>یک بار وارد شو</strong>
            <small>با شمارهٔ موبایلت وارد شو؛ از دفعهٔ بعد مینی‌اپ خودش تو را می‌شناسد.</small>
          </div>
          <span className="tg-go">←</span>
        </Link>
      )}

      {session?.signedIn && (
        <section className="tg-card tg-progress">
          {latest ? (
            latest.status === "IN_PROGRESS" ? (
              <Link href={`/attempts/${latest.id}`}>
                <small>آزمون نیمه‌تمام</small>
                <strong>{latest.exam.title}</strong>
                <span className="tg-go">ادامهٔ آزمون ←</span>
              </Link>
            ) : (
              <Link href={`/attempts/${latest.id}/report`}>
                <small>آخرین آزمونت</small>
                <strong>{latest.exam.title}</strong>
                {latest.standing && <span className="tg-score">{toPersianDigits(Math.round(latest.standing.konkurPercent))}٪</span>}
                <span className="tg-go">کارنامه ←</span>
              </Link>
            )
          ) : (
            <Link href="/exams">
              <small>هنوز آزمونی نداده‌ای</small>
              <strong>اولین آزمون را بزن تا جایگاهت را ببینی</strong>
              <span className="tg-go">آزمون‌ها ←</span>
            </Link>
          )}
          <Link href="/account" className="tg-panel-link">پنل من</Link>
        </section>
      )}

      <nav className="tg-grid" aria-label="بخش‌های سایت">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="tg-tile">
            <span className={`tg-tile-icon tg-tone-${tile.tone}`}><Glyph name={tile.glyph} /></span>
            <strong>{tile.title}</strong>
            <small>{tile.note}</small>
          </Link>
        ))}
      </nav>

      {fresh.length > 0 && (
        <section className="tg-fresh">
          <div className="tg-section-head">
            <h2>تازه‌های سایت</h2>
            <Link href="/articles">همه ←</Link>
          </div>
          <ul>
            {fresh.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
