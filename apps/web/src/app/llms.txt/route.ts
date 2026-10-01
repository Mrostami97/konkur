import { articles, guides, subjects } from "../../content/editorial";
import { phase12EditorialPages } from "../../content/phase12";
import { withoutMergedGuides } from "../../lib/merged-pages";
import { apiGetPublic } from "../../lib/api";
import { absoluteUrl } from "../../lib/seo";

type PublicArticle = { slug: string; title: string; summary: string; contentType?: string | null };
type PublicCatalogItem = {
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  kind?: string;
  externalUrl?: string | null;
};
type PublicUniversity = { code: string; title: string; city: string };
type PublicProgram = {
  code: string;
  title: string;
  degree: string;
  field: string;
  university: { code: string; title: string };
};

async function safeList<T>(path: string): Promise<{ items: T[]; complete: boolean }> {
  try {
    const value = await apiGetPublic<T[]>(path);
    return { items: Array.isArray(value) ? value : [], complete: Array.isArray(value) };
  } catch {
    return { items: [], complete: false };
  }
}

function uniqueBySlug<T extends { slug: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.slug, item])).values()];
}

export async function GET() {
  const [articleResult, subjectResult, topicResult, resourceResult, universityResult, programResult] = await Promise.all([
    safeList<PublicArticle>("/articles"),
    safeList<PublicCatalogItem>("/subjects"),
    safeList<PublicCatalogItem>("/topics"),
    safeList<PublicCatalogItem>("/resources"),
    safeList<PublicUniversity>("/universities"),
    safeList<PublicProgram>("/programs"),
  ]);
  let resultsCount = 0;
  try {
    resultsCount = (await apiGetPublic<{ total: number }>("/achievements/summary"))?.total ?? 0;
  } catch {
    resultsCount = 0;
  }
  const hasFreeVideos = resourceResult.items.some((item) => item.kind === "VIDEO" && Boolean(item.externalUrl));
  const publishedSlugs = new Set(articleResult.items.map((item) => item.slug));
  // A published guide can share a slug with a merged one; its URL redirects too.
  const canonicalGuides = withoutMergedGuides(articleResult.items.filter((item) => item.contentType === "GUIDE"));
  const canonicalArticles = [...articleResult.items.filter((item) => item.contentType !== "GUIDE")];
  const canonicalSubjects = uniqueBySlug([
    ...subjectResult.items,
    ...subjects.filter((item) => !subjectResult.items.some((published) => published.slug === item.slug)).map((item) => ({ slug: item.slug, title: item.title, description: item.status1406 })),
  ]);
  const complete = [
    articleResult,
    subjectResult,
    topicResult,
    resourceResult,
    universityResult,
    programResult,
  ].every((result) => result.complete);
  const body = [
    "# kunkurcomputer",
    "",
    "> مرجع فارسی کنکور ارشد و دکتری مهندسی کامپیوتر، فناوری اطلاعات و علوم کامپیوتر.",
    "",
    "در صفحه‌های محتوایی، انتساب نویسنده، وضعیت بازبینی، تاریخ‌ها و منابعِ ثبت‌شده به میزان دادهٔ موجود نمایش داده می‌شود. برای تاریخ و مواد آزمون، آخرین دفترچه و اصلاحیه سازمان سنجش ملاک نهایی است.",
    "",
    "## راهنماهای ۱۴۰۶",
    ...withoutMergedGuides([...guides, ...phase12EditorialPages]).filter((item) => !publishedSlugs.has(item.slug)).map((item) => `- [${item.title}](${absoluteUrl(`/guides/${item.slug}`)}): ${item.description}`),
    ...canonicalGuides.map((item) => `- [${item.title}](${absoluteUrl(`/guides/${item.slug}`)}): ${item.summary}`),
    "",
    "## درس‌ها",
    ...canonicalSubjects.map((item) => `- [${item.title}](${absoluteUrl(`/subjects/${item.slug}`)}): ${item.description ?? "صفحهٔ درس و محتوای مرتبط"}`),
    "",
    "## مباحث منتشرشده",
    ...uniqueBySlug(topicResult.items).map((item) => `- [${item.title}](${absoluteUrl(`/topics/${item.slug}`)}): ${item.description ?? "مبحث و مسیرهای مرتبط"}`),
    "",
    "## مقاله‌های منتخب",
    ...articles.filter((item) => !publishedSlugs.has(item.slug)).map((item) => `- [${item.title}](${absoluteUrl(`/articles/${item.slug}`)}): ${item.description}`),
    ...canonicalArticles.map((item) => `- [${item.title}](${absoluteUrl(`/articles/${item.slug}`)}): ${item.summary}`),
    "",
    "## منابع آموزشی منتشرشده",
    ...uniqueBySlug(resourceResult.items).map((item) => `- [${item.title}](${absoluteUrl(`/resources/${item.slug}`)}): ${item.summary ?? item.description ?? "منبع آموزشی"}`),
    "",
    "## دانشگاه‌ها و رشته‌محل‌های دارای منبع رسمی",
    ...universityResult.items.map((item) => `- [${item.title}](${absoluteUrl(`/universities/${encodeURIComponent(item.code)}`)}): ${item.city}`),
    ...programResult.items.map((item) => `- [${item.title} — ${item.university.title}](${absoluteUrl(`/programs/${encodeURIComponent(item.code)}`)}): ${item.degree}، ${item.field}`),
    "",
    "اطلاعات دانشگاه، رشته‌محل و ظرفیت تنها هنگامی در این فهرست می‌آید که در سامانه به منبع رسمی فعال متصل باشد؛ تاریخ بررسی و لینک منبع در صفحهٔ همان رکورد نمایش داده می‌شود.",
    "",
    "## سیاست‌ها",
    `- [روش تولید محتوا](${absoluteUrl("/editorial-policy")})`,
    `- [سیاست منابع، انتساب و کپی‌رایت](${absoluteUrl("/source-policy")})`,
    `- [سیاست اصلاح](${absoluteUrl("/corrections")})`,
    `- [دربارهٔ محمد رستمی و تحریریه](${absoluteUrl("/about")})`,
    `- [مستندات آموزشی و نتایج](${absoluteUrl("/evidence")})`,
    ...(resultsCount > 0 ? [`- [نتایج و رتبه‌های شاگردان](${absoluteUrl("/results")}): نتیجه‌های منتشرشده با رضایت خود شاگرد`] : []),
    ...(hasFreeVideos ? [`- [ویدیوی رایگان دروس](${absoluteUrl("/free-videos")}): پیوند به کلاس‌های ضبط‌شدهٔ رایگان دانشگاهی`] : []),
    `- [تخمین رتبهٔ ارشد مهندسی کامپیوتر](${absoluteUrl("/rank-calculator/master-computer-engineering")}): رتبهٔ هر کد ضریب از روی درصدها و معدل، بر پایهٔ کارنامه‌های ۱۴۰۰ تا ۱۴۰۵`,
    `- [کارنامه‌های دارای رضایت انتشار](${absoluteUrl("/report-cards")})`,
    `- [جست‌وجوی محتوای سایت](${absoluteUrl("/search")})`,
    `- [RSS](${absoluteUrl("/rss.xml")})`,
    `- [نقشهٔ سایت](${absoluteUrl("/sitemap.xml")})`,
    "",
    "## استفاده و انتساب",
    "برای نقل واقعیت‌های زمان‌حساس، تاریخ آخرین بررسی و منبع همان صفحه را نیز ذکر کنید. محتوای عمومی برای خواندن و ارجاع در دسترس است؛ بازنشر کامل تابع سیاست منابع و کپی‌رایت سایت است.",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": complete ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" } });
}
