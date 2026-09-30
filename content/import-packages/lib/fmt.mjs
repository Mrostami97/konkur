// Small helpers shared by the hand-written data articles: Persian numerals,
// block constructors and the standard article.v2 envelope.
export const FA = "۰۱۲۳۴۵۶۷۸۹";
export const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
export const int = (v) => fa(Math.round(v));
export const dec = (v) => fa(v.toFixed(1));
export const pct = (v) => `${int(v)}٪`;
export const text = (t) => ({ type: "text", text: t });
export const h2 = (t) => ({ type: "heading", level: 2, text: t });
export const h3 = (t) => ({ type: "heading", level: 3, text: t });
export const UNI = { "صنعتی شریف": "شریف", "تهران": "دانشگاه تهران", "امیرکبیر": "امیرکبیر", "علم و صنعت": "علم و صنعت", "شهید بهشتی": "شهید بهشتی", "خواجه‌نصیر": "خواجه‌نصیر", "تربیت مدرس": "تربیت مدرس", "فردوسی مشهد": "فردوسی مشهد", "خوارزمی": "خوارزمی", "صنعتی اصفهان": "صنعتی اصفهان", "الزهرا": "الزهرا", "تبریز": "دانشگاه تبریز", "دانشگاه اصفهان": "دانشگاه اصفهان", "مالک اشتر": "مالک اشتر", "شیراز": "دانشگاه شیراز", "آزاد علوم و تحقیقات": "آزاد علوم و تحقیقات", "امیرکبیر (واحد گرمسار)": "امیرکبیر (واحد گرمسار)" };
export const uni = (u) => UNI[u] || u;
export const LINKS = {
  calc: { label: "ابزار تخمین رتبهٔ ارشد مهندسی کامپیوتر", href: "/rank-calculator/master-computer-engineering" },
  value: { label: "ارزش هر تست در ۱۴۰۶", href: "/articles/value-of-a-test-1406" },
  coeffs: { label: "تعداد تست و ضریب دروس", href: "/articles/questions-and-coefficients" },
  skip: { label: "کدام درس را می‌شود نخواند؟", href: "/articles/which-subject-to-skip" },
  ranks: { label: "رتبهٔ قبولی ارشد کامپیوتر به تفکیک دانشگاه", href: "/articles/admitted-ranks-by-university" },
  perc: { label: "میانگین وزنی لازم برای قبولی هر دانشگاه", href: "/articles/admission-percentages-by-university" },
  orient: { label: "گرایش‌های ارشد کامپیوتر", href: "/articles/master-computer-orientations" },
  top: { label: "رتبهٔ زیر ۱۰۰ چند درصد می‌خواهد؟", href: "/articles/top-rank-percentages" },
  net: { label: "برای هر رتبه چند تست خالص لازم است؟", href: "/articles/net-tests-per-rank" },
  lang: { label: "درصد زبان هر رتبه", href: "/articles/language-percentage-by-rank" },
  consult: { label: "مشاوره", href: "/consultations" },
};
export function envelope({ contentType, slug, title, summary, answer, blocks, tags, seoTitle, seoDescription, claim, sourceLocator, extraSources = [], validity }) {
  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: contentType || "article",
    title,
    slug,
    summary,
    quick_answer: answer,
    content_blocks: blocks,
    taxonomy: { major: ["کامپیوتر و IT"], tags: [...tags, "کارنامه و رتبه"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
    seo: { title: seoTitle, description: seoDescription },
    validity: validity || { exam_year: 1406, time_sensitive: false },
    sources: [
      {
        source_external_id: "editorial-source-08110ffe99548a591190",
        relation: "SUPPORTS",
        locator: sourceLocator || "کارنامه‌های ارشد مهندسی کامپیوتر ۱۴۰۰ تا ۱۴۰۵ کانال Konkur_answer و کارنامه‌های عمومی؛ فقط آمار تجمیعی",
        claim,
        order: 0,
      },
      ...extraSources.map((s, i) => ({ ...s, order: i + 1 })),
    ],
    editorial: { author_slug: "mohammad-rostami" },
    provenance: {
      producer_type: "external_ai",
      producer_name: "تحلیل داده با Claude روی پایگاه کارنامه‌های محمد رستمی؛ فقط آمار تجمیعی — نیازمند بازبینی و تأیید محمد رستمی",
      source_artifact: `content/import-packages/articles/${slug}.mjs`,
    },
    review_status: "draft",
  };
}
export const SRC_1406 = {
  source_external_id: "editorial-source-50f3b52142efac0715d8",
  relation: "SUPPORTS",
  locator: "اطلاعیه و جدول مجموعه‌های امتحانی کارشناسی ارشد ناپیوسته سال ۱۴۰۶",
  claim: "ضرایب زبان ۱، ریاضیات ۲ و بستهٔ تخصصی ۴ در مجموعهٔ ۱۲۷۷ در ۱۴۰۶",
};
export const load = (rel, base) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, base)), "utf8"));
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
