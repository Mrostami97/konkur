import { articles, guides, subjects } from "../../content/editorial";
import { absoluteUrl } from "../../lib/seo";

export function GET() {
  const body = [
    "# kunkur01",
    "",
    "> مرجع فارسی کنکور ارشد و دکتری مهندسی کامپیوتر، فناوری اطلاعات و علوم کامپیوتر.",
    "",
    "اطلاعات زمان‌حساس با نویسنده، بازبین، تاریخ آخرین بررسی و منابع نمایش داده می‌شود. برای تاریخ و مواد آزمون، آخرین دفترچه و اصلاحیه سازمان سنجش ملاک نهایی است.",
    "",
    "## راهنماهای ۱۴۰۶",
    ...guides.map((item) => `- [${item.title}](${absoluteUrl(`/guides/${item.slug}`)}): ${item.description}`),
    "",
    "## درس‌ها",
    ...subjects.map((item) => `- [${item.title}](${absoluteUrl(`/subjects/${item.slug}`)}): ${item.status1406}`),
    "",
    "## مقاله‌های منتخب",
    ...articles.map((item) => `- [${item.title}](${absoluteUrl(`/articles/${item.slug}`)}): ${item.description}`),
    "",
    "## سیاست‌ها",
    `- [روش تولید محتوا](${absoluteUrl("/editorial-policy")})`,
    `- [سیاست اصلاح](${absoluteUrl("/corrections")})`,
    `- [RSS](${absoluteUrl("/rss.xml")})`,
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
