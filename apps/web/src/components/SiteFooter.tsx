import Image from "next/image";
import Link from "next/link";
import { GUIDES_MENU, LEARN_MENU, PRACTICE_MENU, TELEGRAM_URL, TOOLS_MENU } from "../lib/site-nav";
import { SoonMark } from "./SoonMark";
import { Glyph, SubjectGlyph } from "./SubjectIcon";

interface FooterSubject {
  slug: string;
  title: string;
}

const TRUST_LINKS = [
  { href: "/about", label: "دربارهٔ محمد رستمی" },
  { href: "/evidence", label: "مستندات تدریس و نتایج" },
  { href: "/editorial-policy", label: "روش تولید محتوا" },
  { href: "/source-policy", label: "سیاست منبع و حق نشر" },
  { href: "/corrections", label: "سیاست اصلاح" },
];

/**
 * The footer is the second site map: every column reads the same nav data as
 * the header, so a destination added there shows up here too. It closes the
 * page on the two things the brand is built on -- the Telegram channel the
 * classes started from, and where the numbers on the site come from.
 */
export function SiteFooter({ subjects }: { subjects: FooterSubject[] }) {
  const learn = LEARN_MENU.columns.flatMap((column) => column.links);
  const guides = GUIDES_MENU.columns[0].links.concat(GUIDES_MENU.columns[1].links.slice(0, 2));
  const tools = TOOLS_MENU.columns.flatMap((column) => column.links).filter((link) => link.href !== "/evidence" && link.href !== "/rank-estimate");
  // The account page is not a public destination; the footer is a site map.
  const practice = PRACTICE_MENU.columns.flatMap((column) => column.links).filter((link) => !link.href.startsWith("/account") && link.href !== "/subjects");

  return (
    <footer className="ft">
      <div className="ft-cta">
        <div>
          <p className="ft-cta-kicker">کانال رسمی کنکورصفریک</p>
          <h2>نتیجه‌ها، جزوه‌ها و خبرهای کنکور را از خود کانال بگیر</h2>
          <p>هر رتبه‌ای که در سایت می‌بینی اول همان‌جا منتشر شده؛ اطلاعیه‌های سنجش هم با منبع می‌آید.</p>
        </div>
        <a className="ft-cta-btn" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden><path d="M21 4 3 11l6 2 2 6 3-4 5 4z" /><path d="m9 13 8-6" /></svg>
          عضویت در ‎@konkurcom
        </a>
      </div>

      <div className="ft-grid">
        <div className="ft-brand">
          <Link href="/" className="ft-logo" aria-label="کنکورصفریک">
            <Image src="/brand/konkurcom-logo.png" alt="" width={56} height={56} />
            <span>
              <strong>کنکورصفریک</strong>
              <small>kunkur01.ir</small>
            </span>
          </Link>
          <p>کلاس درس‌به‌درس، ویدیوی رایگان، راهنمای رسمی ۱۴۰۶ و ابزار انتخاب‌رشته برای ارشد و دکتری مهندسی کامپیوتر، IT و علوم کامپیوتر.</p>
          <ul className="ft-badges">
            <li><Glyph name="shield" /> هر عدد با منبع و تاریخ بازبینی</li>
            <li><Glyph name="trophy" /> نتیجهٔ شاگرد فقط با رضایت خودش</li>
          </ul>
        </div>

        <nav className="ft-col" aria-label="یادگیری">
          <strong>یادگیری</strong>
          {learn.map((link) => <Link key={link.href} href={link.href}>{link.label}<SoonMark href={link.href} /></Link>)}
          <Link href="/results">نتایج شاگردان<SoonMark href="/results" /></Link>
          <strong className="ft-sub">تمرین و آزمون</strong>
          {practice.map((link) => <Link key={link.href} href={link.href}>{link.label}<SoonMark href={link.href} /></Link>)}
        </nav>

        <nav className="ft-col" aria-label="درس‌ها">
          <strong>درس‌ها</strong>
          {subjects.map((subject) => (
            <Link key={subject.slug} href={`/subjects/${subject.slug}`} className="ft-subject">
              <SubjectGlyph slug={subject.slug} />
              {subject.title}
            </Link>
          ))}
          <Link href="/subjects" className="ft-more">همهٔ درس‌ها ←</Link>
        </nav>

        <nav className="ft-col" aria-label="راهنما و ابزار">
          <strong>راهنمای ۱۴۰۶</strong>
          {guides.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <strong className="ft-sub">ابزارها</strong>
          {tools.map((link) => <Link key={link.href} href={link.href}>{link.label}<SoonMark href={link.href} /></Link>)}
        </nav>

        <nav className="ft-col" aria-label="اعتماد و شفافیت">
          <strong>اعتماد و شفافیت</strong>
          {TRUST_LINKS.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <Link href="/articles">مقاله‌ها</Link>
          <Link href="/rss.xml">خوراک RSS</Link>
        </nav>
      </div>

      <div className="ft-bottom">
        <span>© ۱۴۰۵ کنکورصفریک · kunkur01</span>
        <span>اطلاعات زمان‌حساس با تاریخ بازبینی و منبع منتشر می‌شوند؛ پیش از هر اقدام، اطلاعیهٔ رسمی سنجش را هم ببین.</span>
      </div>
    </footer>
  );
}
