import Link from "next/link";
import { TELEGRAM_URL } from "../lib/site-nav";
import { Glyph, type GlyphName } from "./SubjectIcon";

/** Pages that always have content, offered while a feature is not ready. */
const ALWAYS_AVAILABLE = [
  { href: "/guides", label: "راهنمای رسمی ۱۴۰۶" },
  { href: "/subjects", label: "نقشهٔ درس‌ها" },
  { href: "/evidence", label: "مستندات تدریس" },
  { href: "/articles", label: "مقاله‌ها" },
];

/**
 * What a visitor sees where a feature has nothing published yet: plainly
 * "coming soon", not an empty list that reads like a broken page. It is
 * shown only while the feature is empty, so publishing the first item
 * replaces it with no code change.
 */
export function ComingSoon({
  title,
  text,
  icon = "spark",
  alternatives = ALWAYS_AVAILABLE,
}: {
  title: string;
  text: string;
  icon?: GlyphName;
  alternatives?: { href: string; label: string }[];
}) {
  return (
    <section className="soon" aria-label={title}>
      <span className="soon-icon"><Glyph name={icon} /></span>
      <span className="soon-badge">به‌زودی</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <a className="soon-btn" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
        خبر راه‌اندازی را در کانال تلگرام بگیر
      </a>
      {alternatives.length > 0 && (
        <div className="soon-alt">
          <small>تا آن موقع:</small>
          {alternatives.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </div>
      )}
    </section>
  );
}
