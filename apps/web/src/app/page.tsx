import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { guides, subjects } from "../content/editorial";
import { apiGetPublic } from "../lib/api";
import { toPersianDigits } from "../lib/format";
import { pageMetadata } from "../lib/seo";
import "./home.css";

interface Product { slug: string; title: string; description: string; prices?: { amountRial: number }[]; }
interface Exam { id: string; title: string; description: string; durationMinutes: number; }

export const metadata: Metadata = pageMetadata({ title: "مرجع کنکور ارشد و دکتری کامپیوتر", description: "راهنمای به‌روز ۱۴۰۶، درس‌ها، منابع رایگان، برنامه‌ریزی و تحلیل برای مهندسی کامپیوتر، IT و علوم کامپیوتر.", path: "/" });

async function safePublic<T>(path: string): Promise<T | null> { try { return await apiGetPublic<T>(path); } catch { return null; } }

/** Each mark is the structure its subject is about -- a binary tree for data
 * structures, a graph for discrete maths -- drawn on one grid at one stroke
 * weight so the row reads as a set rather than a pile of collected marks. */
const ICONS: Record<string, ReactNode> = {
  tree: <><circle cx="12" cy="5" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M10.4 6.7 7.5 16M13.6 6.7 16.5 16" /></>,
  branch: <><path d="M5 4v6a3 3 0 0 0 3 3h11" /><path d="M16 9.5 19.5 13 16 16.5" /><circle cx="5" cy="19" r="2" /><path d="M5 17v-3" /></>,
  chip: <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></>,
  cylinder: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8V6" /><path d="M5 12v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-6" /></>,
  matrix: <><path d="M7 4H4.5v16H7M17 4h2.5v16H17" /><circle cx="9.8" cy="9" r="1" /><circle cx="14.2" cy="9" r="1" /><circle cx="9.8" cy="15" r="1" /><circle cx="14.2" cy="15" r="1" /></>,
  code: <><path d="M8.5 8 4 12l4.5 4M15.5 8 20 12l-4.5 4M13.5 5l-3 14" /></>,
  graph: <><circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="18" r="2" /><path d="M8 7h8M7.1 8.8 11 16.2M16.9 8.8 13 16.2" /></>,
  hub: <><circle cx="12" cy="12" r="2.4" /><circle cx="12" cy="4" r="1.8" /><circle cx="4.5" cy="18" r="1.8" /><circle cx="19.5" cy="18" r="1.8" /><path d="M12 5.8v3.8M10.2 13.6 6 16.6M13.8 13.6 18 16.6" /></>,
  curve: <><path d="M3 18c4 0 5-11 9-11s5 11 9 11" /><path d="M3 21h18" /></>,
  gate: <><path d="M6 6h5a6 6 0 0 1 0 12H6z" /><path d="M2 9h4M2 15h4M17 12h5" /></>,
  automaton: <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v4M18.4 12h3.6" /></>,
  glyph: <><path d="M4 19 9 5l5 14M5.8 15h6.4" /><path d="M17 10v9M17 10c2.5 0 3.5 1.4 3.5 3s-1 3-3.5 3" /></>,
  neural: <><circle cx="5" cy="7" r="1.8" /><circle cx="5" cy="17" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="7" r="1.8" /><circle cx="19" cy="17" r="1.8" /><path d="M6.6 8.1 10.5 10.8M6.6 15.9 10.5 13.2M13.5 10.8 17.4 8.1M13.5 13.2 17.4 15.9" /></>,
  layers: <><path d="M12 3 3 7.5 12 12l9-4.5z" /><path d="m3 12.5 9 4.5 9-4.5" /><path d="m3 17 9 4.5 9-4.5" /></>,
  flow: <><rect x="3" y="4" width="7" height="5" rx="1.4" /><rect x="14" y="15" width="7" height="5" rx="1.4" /><path d="M6.5 9v5.5a2 2 0 0 0 2 2H14" /></>,
};

/** Maps the editorial subject corpus onto an icon. A subject with no entry
 * falls back to the graph mark rather than rendering an empty slot. */
const SUBJECT_ICONS: Record<string, keyof typeof ICONS> = {
  english: "glyph",
  "discrete-math": "graph",
  statistics: "curve",
  "linear-algebra": "matrix",
  "programming-fundamentals": "code",
  "digital-logic": "gate",
  "computer-architecture": "chip",
  "data-structures-algorithms": "tree",
  "data-structures": "tree",
  algorithms: "branch",
  automata: "automaton",
  "operating-systems": "chip",
  "artificial-intelligence": "neural",
  "computer-networks": "hub",
  databases: "cylinder",
  "software-engineering": "layers",
  "it-management": "flow",
};

/** Subjects added to the 1406 structure. Marked in amber so the change reads
 * without relying on colour alone -- each also carries a text flag. */
const NEW_IN_1406 = new Set(["linear-algebra", "programming-fundamentals"]);

const STEPS = [
  { n: "۰۱", title: "مقطع و مجموعه", body: "ارشد مهندسی، IT و علوم کامپیوتر مواد و ضرایب جدا دارند. اول این را قطعی کن.", href: "/guides", cta: "مقایسهٔ مسیرها" },
  { n: "۰۲", title: "سرفصل به برنامه", body: "هر درس با پیش‌نیاز و مبحث کلیدی، تبدیل به برنامهٔ هفتگی قابل اجرا.", href: "/subjects", cta: "نقشهٔ درس‌ها" },
  { n: "۰۳", title: "سنجش، نه حدس", body: "آزمون و تحلیل عملکرد، تا بدانی واقعاً کجایی — نه اینکه حس کنی.", href: "/today", cta: "ساخت برنامهٔ شخصی" },
];

function Icon({ name }: { name: keyof typeof ICONS }) {
  return <svg viewBox="0 0 24 24" aria-hidden>{ICONS[name]}</svg>;
}

export default async function HomePage() {
  const [products, exams] = await Promise.all([safePublic<Product[]>("/products"), safePublic<Exam[]>("/exams")]);
  const featured = subjects.slice(0, 8);

  return (
    <main className="hp">
      <section className="hp-shell hp-hero">
        <div>
          <span className="hp-tag"><i />ارشد مهندسی کامپیوتر · ۱۴۰۶</span>
          <h1>بدان دقیقاً <em>کجای مسیری</em>.</h1>
          <p className="hp-lede">
            برنامهٔ روزانه، بانک سؤال و تحلیل عملکرد — با بازهٔ اطمینان، نه یک عدد جادویی و نه
            حس مبهم «عقبم».
          </p>
          <div className="hp-actions">
            <Link className="hp-btn hp-btn-go" href="/today">ساخت مسیر من ←</Link>
            <Link className="hp-btn hp-btn-quiet" href="/articles/computer-exam-changes-1406">دیدن تغییرات ۱۴۰۶</Link>
          </div>
        </div>

        <div>
          <div className="hp-card">
            <div className="hp-card-h">
              <b>وضعیت آزمون ۱۴۰۶</b>
              <span>بازبینی ۱۵ شهریور ۱۴۰۵</span>
            </div>
            <div className="hp-row">
              <span>درس در ساختار جدید</span>
              <strong>{toPersianDigits(subjects.length)}</strong>
            </div>
            <div className="hp-row hp-row-new">
              <span>درس تازه اضافه‌شده</span>
              <strong>۲<small>جبر خطی، برنامه‌سازی</small></strong>
            </div>
            <div className="hp-row">
              <span>درس کنار گذاشته‌شده</span>
              <strong>۶</strong>
            </div>
            <div className="hp-row">
              <span>مسیر آزمون</span>
              <strong>{toPersianDigits(guides.length)}</strong>
            </div>
            <p className="hp-card-f">
              ساختار مجموعهٔ مهندسی کامپیوتر برای ۱۴۰۶ تغییر کرده.{" "}
              <Link href="/articles/computer-exam-changes-1406">همهٔ تغییرات با منبع رسمی ←</Link>
            </p>
          </div>

          <div className="hp-empty">
            <p>
              <b>پنل شخصی تو هنوز خالی است.</b> تسلط، سؤال‌های حل‌شده و تحلیل عملکرد بعد از اولین
              آزمون اینجا می‌آید — تا آن موقع چیزی نمی‌سازیم که نداریم.
            </p>
            <div className="hp-ghosts" aria-hidden><div className="hp-gh" /><div className="hp-gh" /><div className="hp-gh" /></div>
          </div>
        </div>
      </section>

      <section className="hp-shell hp-sec">
        <div className="hp-head">
          <div>
            <span className="hp-tag"><i />نقشهٔ درس‌ها</span>
            <h2>هر درس، با وضعیت واقعی ۱۴۰۶</h2>
            <p>ضریب، بسته و جایگاه هر درس در ساختار آزمون — بدون اینکه لازم باشد دفترچه را خودت بخوانی.</p>
          </div>
          <Link href="/subjects">همهٔ {toPersianDigits(subjects.length)} درس ←</Link>
        </div>

        <div className="hp-subjects">
          {featured.map((subject) => {
            const isNew = NEW_IN_1406.has(subject.slug);
            return (
              <Link
                className={`hp-subject ${isNew ? "hp-subject-new" : ""}`}
                href={`/subjects/${subject.slug}`}
                key={subject.slug}
              >
                <span className="hp-subject-top">
                  <span className="hp-ico"><Icon name={SUBJECT_ICONS[subject.slug] ?? "graph"} /></span>
                  {isNew && <span className="hp-flag">جدید ۱۴۰۶</span>}
                </span>
                <b>{subject.shortTitle}</b>
                <small>{subject.status1406}</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="hp-shell hp-sec">
        <div className="hp-head">
          <div>
            <span className="hp-tag"><i />مسیر کار</span>
            <h2>سه تصمیم، به همین ترتیب</h2>
          </div>
        </div>
        <div className="hp-steps">
          {STEPS.map((step) => (
            <article className="hp-step" key={step.n}>
              <em>{step.n}</em>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <Link href={step.href}>{step.cta} ←</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="hp-shell hp-sec">
        <div className="hp-trust">
          <div>
            <span className="hp-tag"><i />چرا اینجا</span>
            <blockquote className="hp-quote">
              هر عددی که اینجا می‌بینی تاریخ بازبینی و منبع دارد. اگر چیزی را نمی‌دانیم،
              می‌نویسیم نمی‌دانیم.
            </blockquote>
            <div className="hp-by">
              <Image src="/brand/konkurcom-logo.png" alt="" width={44} height={44} />
              <span>
                <strong>محمد رستمی</strong>
                <small>
                  <Link href="/editorial-policy">روش تولید محتوا</Link> · <Link href="/source-policy">سیاست منبع</Link>
                </small>
              </span>
            </div>
          </div>

          <div className="hp-facts">
            <div className="hp-fact"><span>هاب درسی</span><strong>{toPersianDigits(subjects.length)}</strong></div>
            <div className="hp-fact"><span>مسیر آزمون</span><strong>{toPersianDigits(guides.length)}</strong></div>
            {exams && exams.length > 0 && (
              <div className="hp-fact"><span>آزمون منتشرشده</span><strong>{toPersianDigits(exams.length)}</strong></div>
            )}
            {products && products.length > 0 && (
              <div className="hp-fact"><span>دورهٔ منتشرشده</span><strong>{toPersianDigits(products.length)}</strong></div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
