import type { Metadata } from "next";
import Link from "next/link";
import { Glyph, type GlyphName } from "../../components/SubjectIcon";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";
import "./tg.css";

export const metadata: Metadata = { ...PRIVATE_PAGE_METADATA, title: { absolute: "کنکور کامپیوتر" } };

const TILES: { href: string; title: string; note: string; glyph: GlyphName }[] = [
  { href: "/questions", title: "بانک سؤال", note: "تست‌های کنکورهای قبل با پاسخ تشریحی", glyph: "list" },
  { href: "/exams", title: "آزمون‌ها", note: "شبیه‌ساز کنکور با کارنامه و رتبه", glyph: "pace" },
  { href: "/account", title: "پنل من", note: "پیشرفت، برنامه و آزمون‌های من", glyph: "target" },
  { href: "/courses", title: "دوره‌ها", note: "کلاس‌های درس‌به‌درس", glyph: "play" },
  { href: "/free-videos", title: "ویدیوی رایگان", note: "جلسه‌های نمونهٔ دوره‌ها", glyph: "spark" },
  { href: "/report-cards", title: "کارنامه‌ها", note: "رتبه و درصد قبولی‌های سال‌های قبل", glyph: "trophy" },
  { href: "/rank-estimate", title: "تخمین رتبه", note: "با درصدهایت رتبه‌ات را ببین", glyph: "curve" },
  { href: "/choices", title: "انتخاب رشته", note: "ظرفیت‌ها و رشته‌محل‌های ۱۴۰۶", glyph: "building" },
];

/** The Telegram mini app's home: the site's main sections as one tap each. */
export default function TelegramHome() {
  return (
    <main className="tg-home">
      <header className="tg-hero">
        <div>
          <h1>از کجا شروع کنیم؟</h1>
          <p>ارشد و دکتری کامپیوتر، IT و علوم کامپیوتر</p>
        </div>
      </header>
      <nav className="tg-grid" aria-label="بخش‌های سایت">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="tg-tile">
            <span className="tg-tile-icon"><Glyph name={tile.glyph} /></span>
            <strong>{tile.title}</strong>
            <small>{tile.note}</small>
          </Link>
        ))}
      </nav>
      <p className="tg-foot">
        بار اول با شمارهٔ موبایلت وارد شو؛ بعد از آن همین‌جا وارد می‌مانی.
        <Link href="/login?next=/account">ورود</Link>
      </p>
    </main>
  );
}
