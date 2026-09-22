import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { publicArticlePath, type PublicArticleRecord } from "../components/PublicContent";
import { articles as legacyArticles, guides, subjects } from "../content/editorial";
import { apiGetPublic } from "../lib/api";
import { toPersianDigits } from "../lib/format";
import { pageMetadata } from "../lib/seo";
import "./home.css";

interface Product { slug: string; title: string; description: string; }
interface Exam { id: string; title: string; description: string; durationMinutes: number; }

export const metadata: Metadata = pageMetadata({ title: "مرجع کنکور ارشد و دکتری کامپیوتر", description: "راهنمای به‌روز ۱۴۰۶، درس‌ها، منابع رایگان، برنامه‌ریزی و تحلیل برای مهندسی کامپیوتر، IT و علوم کامپیوتر.", path: "/" });

async function safePublic<T>(path: string): Promise<T | null> { try { return await apiGetPublic<T>(path); } catch { return null; } }

/** Each mark is the structure its subject is about -- a binary tree for data
 * structures, a graph for discrete maths -- drawn on one grid at one stroke
 * weight, so a row of them reads as a set rather than collected marks. */
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
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-5 2 2-5z" /></>,
  pace: <><circle cx="12" cy="13" r="8" /><path d="M12 13V8.5M9.5 2h5" /></>,
  flag: <><path d="M5 21V4M5 4h13l-2.5 4L18 12H5" /></>,
};

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

const NEW_IN_1406 = new Set(["linear-algebra", "programming-fundamentals"]);

/** Which exam package a subject sits in. This drives the card tint, so the
 * colour carries the grouping a candidate has to know rather than decorating
 * the grid. Anything unlisted falls back to the core package. */
const SUBJECT_PACKAGE: Record<string, "math" | "core" | "lang" | "it"> = {
  "discrete-math": "math",
  statistics: "math",
  "linear-algebra": "math",
  english: "lang",
  "it-management": "it",
};

/** The page routes by where someone is in their preparation, not by what the
 * site happens to offer: a visitor can tell which of these three describes
 * them, where they could not tell which of six feature cards was for them. */
const STAGES = [
  {
    key: "start",
    icon: "compass" as const,
    step: "مرحلهٔ اول",
    title: "تازه تصمیم گرفته‌ام",
    body: "هنوز نمی‌دانی کدام مجموعه مال توست و چه درس‌هایی باید بخوانی.",
    items: ["مقایسهٔ مجموعه‌های ارشد و دکتری", "مواد و ضرایب رسمی ۱۴۰۶", "نقشهٔ شروع مطالعه"],
    href: "/guides",
    cta: "شروع از راهنما",
  },
  {
    key: "study",
    icon: "pace" as const,
    step: "مرحلهٔ دوم",
    title: "در حال مطالعه‌ام",
    body: "مسیرت مشخص است و می‌خواهی منظم جلو بروی و بدانی کجا ضعف داری.",
    items: ["برنامهٔ روزانه و هفتگی", "بانک سؤال با پاسخ تشریحی", "آزمون و تحلیل عملکرد"],
    href: "/today",
    cta: "ساخت برنامهٔ من",
  },
  {
    key: "final",
    icon: "flag" as const,
    step: "مرحلهٔ سوم",
    title: "نزدیک آزمونم",
    body: "جمع‌بندی می‌کنی و می‌خواهی بدانی با این وضعیت کجا قبول می‌شوی.",
    items: ["تخمین رتبه با بازهٔ اطمینان", "ظرفیت و کارنامهٔ دانشگاه‌ها", "چیدن لیست انتخاب رشته"],
    href: "/admissions",
    cta: "تحلیل و انتخاب رشته",
  },
];

const CHANGES = [
  { kind: "add" as const, name: "جبر خطی", where: "بستهٔ ریاضیات" },
  { kind: "add" as const, name: "مبانی کامپیوتر و برنامه‌سازی", where: "بستهٔ تخصصی" },
  { kind: "cut" as const, name: "۶ درس کنار گذاشته شد", where: "مهندسی کامپیوتر" },
];

function Icon({ name }: { name: keyof typeof ICONS }) {
  return <svg viewBox="0 0 24 24" aria-hidden>{ICONS[name]}</svg>;
}

function Check() {
  return <svg viewBox="0 0 24 24" aria-hidden><path d="m5 13 4 4 10-10" /></svg>;
}

function Arrow() {
  return <svg viewBox="0 0 24 24" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
}

export default async function HomePage() {
  const [products, exams, published] = await Promise.all([
    safePublic<Product[]>("/products"),
    safePublic<Exam[]>("/exams"),
    safePublic<PublicArticleRecord[]>("/articles"),
  ]);

  const featured = subjects.slice(0, 8);
  const latest = published ?? [];
  const fallback = legacyArticles.slice(0, 4);

  return (
    <main className="hp">
      <div className="hp-hero-wrap">
        <section className="hp-shell hp-hero">
          <p className="hp-eyebrow">ویژهٔ داوطلبان ارشد و دکتری مهندسی کامپیوتر، IT و علوم کامپیوتر</p>
          <h1>از انتخاب مسیر تا قبولی، <em>زیر یک حساب</em></h1>
          <p className="hp-lede">
            راهنمای رسمی ۱۴۰۶، نقشهٔ درس‌ها، برنامهٔ مطالعه، بانک سؤال و تخمین رتبه — هرکدام با
            تاریخ بازبینی و منبع.
          </p>
          <p className="hp-alert">
            <b>ساختار آزمون ۱۴۰۶ تغییر کرده.</b>
            <Link href="/articles/computer-exam-changes-1406">ببین چه عوض شده ←</Link>
          </p>
        </section>
      </div>

      <section className="hp-shell hp-sec">
        <div className="hp-stage-head">
          <h2>کجای مسیری؟</h2>
          <p>یکی را انتخاب کن تا از همان‌جا ادامه بدهیم — لازم نیست از اول همه‌چیز را بخوانی.</p>
        </div>
        <div className="hp-stages">
          {STAGES.map((stage) => (
            <Link className={`hp-stage hp-s-${stage.key}`} href={stage.href} key={stage.key}>
              <span className="hp-stage-top">
                <span className="hp-stage-ico"><Icon name={stage.icon} /></span>
                <span>
                  <span className="hp-stage-n">{stage.step}</span>
                  <b>{stage.title}</b>
                </span>
              </span>
              <p>{stage.body}</p>
              <ul className="hp-stage-list">
                {stage.items.map((item) => (
                  <li key={item}><Check />{item}</li>
                ))}
              </ul>
              <span className="hp-stage-go">{stage.cta}<Arrow /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="hp-shell hp-sec hp-sec-line">
        <div className="hp-change">
          <div>
            <h2>آنچه امسال عوض شد</h2>
            <p>
              اگر با سرفصل پارسال می‌خوانی، بخشی از آنچه می‌خوانی امسال امتیازی ندارد و دو درس
              تازه را اصلاً نخوانده‌ای.
            </p>
            <Link className="hp-btn hp-btn-go hp-change-cta" href="/articles/computer-exam-changes-1406">
              همهٔ تغییرات با منبع رسمی ←
            </Link>
          </div>
          <div className="hp-diff">
            {CHANGES.map((change) => (
              <div className={`hp-diff-row ${change.kind === "cut" ? "hp-diff-row-cut" : ""}`} key={change.name}>
                <span className={`hp-diff-sign ${change.kind === "add" ? "hp-diff-add" : "hp-diff-cut"}`} aria-hidden>
                  {change.kind === "add" ? "+" : "−"}
                </span>
                <span className="hp-diff-name">
                  <span className="sr-only">{change.kind === "add" ? "اضافه شد:" : "حذف شد:"} </span>
                  {change.name}
                </span>
                <span className="hp-diff-where">{change.where}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-shell hp-sec hp-sec-line">
        <div className="hp-head">
          <div>
            <h2>درس‌ها، با وضعیت واقعی ۱۴۰۶</h2>
            <p>ضریب، بسته و جایگاه هر درس در ساختار آزمون — بدون اینکه لازم باشد دفترچه را خودت بخوانی.</p>
            <p className="hp-legend">
              <span className="hp-key hp-k-core" />بستهٔ تخصصی
              <span className="hp-key hp-k-math" />بستهٔ ریاضیات
              <span className="hp-key hp-k-lang" />زبان
            </p>
          </div>
          <Link href="/subjects">همهٔ {toPersianDigits(subjects.length)} درس ←</Link>
        </div>
        <div className="hp-subjects">
          {featured.map((subject) => {
            const isNew = NEW_IN_1406.has(subject.slug);
            return (
              <Link
                className={`hp-subject hp-p-${SUBJECT_PACKAGE[subject.slug] ?? "core"} ${isNew ? "hp-subject-new" : ""}`}
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

      <section className="hp-shell hp-sec hp-sec-line">
        <div className="hp-head">
          <div>
            <h2>راهنماهای مسیر</h2>
            <p>هر مجموعه، یک راهنمای کامل با ساختار ۱۴۰۶، ضرایب و منابع.</p>
          </div>
          <Link href="/guides">همهٔ راهنماها ←</Link>
        </div>
        <div className="hp-guides">
          {guides.map((guide) => (
            <Link className="hp-guide" href={`/guides/${guide.slug}`} key={guide.slug}>
              <span className="hp-guide-badge">{guide.degree}</span>
              <b>{guide.field}</b>
              <small>{guide.description}</small>
              <span className="hp-meta">بازبینی {guide.reviewedAt} · {toPersianDigits(guide.readingMinutes)} دقیقه</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="hp-shell hp-sec hp-sec-line">
        <div className="hp-head">
          <div>
            <h2>تازه‌ترین مقاله‌ها</h2>
            <p>هر مقاله با تاریخ بازبینی و منبع رسمی منتشر می‌شود.</p>
          </div>
          <Link href="/articles">همهٔ مقاله‌ها ←</Link>
        </div>
        <div className="hp-articles">
          {latest.length > 0
            ? latest.slice(0, 4).map((article) => (
                <Link className="hp-article" href={publicArticlePath(article)} key={article.slug}>
                  <b>{article.title}</b>
                  <small>{article.summary}</small>
                </Link>
              ))
            : fallback.map((article) => (
                <Link className="hp-article" href={`/articles/${article.slug}`} key={article.slug}>
                  <b>{article.title}</b>
                  <small>{article.description}</small>
                  <span className="hp-meta">بازبینی {article.reviewedAt}</span>
                </Link>
              ))}
        </div>
      </section>

      <section className="hp-shell hp-sec hp-sec-line">
        <div className="hp-trust">
          <div>
            <blockquote className="hp-quote">
              هر عددی که اینجا می‌بینی تاریخ بازبینی و منبع دارد. اگر چیزی را نمی‌دانیم،
              می‌نویسیم نمی‌دانیم.
            </blockquote>
            <div className="hp-by">
              <Image src="/brand/mohammad-rostami.png" alt="" width={48} height={48} />
              <span>
                <strong>محمد رستمی</strong>
                <small>
                  <Link href="/editorial-policy">روش تولید محتوا</Link> · <Link href="/source-policy">سیاست منبع</Link>
                </small>
              </span>
            </div>
          </div>

          {/* Real counts only. A student total or acceptance rate would have to
              be invented, and an empty figure is better than a made-up one. */}
          <div className="hp-facts">
            <div className="hp-fact"><span>هاب درسی</span><strong>{toPersianDigits(subjects.length)}</strong></div>
            <div className="hp-fact"><span>راهنمای مسیر</span><strong>{toPersianDigits(guides.length)}</strong></div>
            <div className="hp-fact"><span>آزمون منتشرشده</span><strong>{toPersianDigits(exams?.length ?? 0)}</strong></div>
            <div className="hp-fact"><span>دورهٔ منتشرشده</span><strong>{toPersianDigits(products?.length ?? 0)}</strong></div>
          </div>
        </div>
      </section>
    </main>
  );
}
