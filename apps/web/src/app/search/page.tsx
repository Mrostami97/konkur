import type { Metadata } from "next";
import Link from "next/link";
import { PublicServiceError } from "../../components/PublicContent";
import { EmptyState, PageHeader } from "../../components/ui";
import { articles, findSubject, guides, subjects } from "../../content/editorial";
import { phase11SubjectContent, type Phase11SubjectSlug } from "../../content/phase11";
import { phase12EditorialPages } from "../../content/phase12";
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";

type SearchResultType = "ARTICLE" | "RESOURCE" | "SUBJECT" | "TOPIC" | "CONTRIBUTOR";
interface SearchItem {
  type: SearchResultType;
  slug: string;
  title: string;
  summary: string | null;
  href: string;
  metadata?: Record<string, unknown>;
}
interface SearchResponse {
  items: SearchItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const metadata: Metadata = pageMetadata({
  title: "جست‌وجوی محتوای کنکورصفریک",
  description: "جست‌وجوی یکپارچه میان درس‌ها، مباحث، راهنماها، مقاله‌ها، منابع و نویسندگان کنکورصفریک.",
  path: "/search",
  noIndex: true,
});

const typeLabels: Record<SearchResultType, string> = {
  ARTICLE: "مقاله یا راهنما",
  RESOURCE: "منبع آموزشی",
  SUBJECT: "درس",
  TOPIC: "مبحث",
  CONTRIBUTOR: "نویسنده یا بازبین",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number.parseInt(firstValue(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function searchHref(query: string, page: number) {
  const parameters = new URLSearchParams({ q: query });
  if (page > 1) parameters.set("page", String(page));
  return `/search?${parameters.toString()}`;
}

function normalizePersian(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[​-‍⁠﻿ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

function matchScore(title: string, body: string, query: string) {
  const normalizedTitle = normalizePersian(title);
  const normalizedBody = normalizePersian(body);
  const normalizedQuery = normalizePersian(query);
  const tokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  if (tokens.some((token) => !normalizedTitle.includes(token) && !normalizedBody.includes(token))) return 0;
  let score = normalizedTitle === normalizedQuery ? 1200 : normalizedTitle.startsWith(normalizedQuery) ? 800 : normalizedTitle.includes(normalizedQuery) ? 500 : 0;
  if (normalizedBody.includes(normalizedQuery)) score += 120;
  for (const token of tokens) {
    if (normalizedTitle.includes(token)) score += 90;
    if (normalizedBody.includes(token)) score += 20;
  }
  return score;
}

function legacySearch(query: string): SearchItem[] {
  const candidates = [
    ...[...guides, ...phase12EditorialPages].map((item) => ({
      type: "ARTICLE" as const,
      slug: item.slug,
      title: item.title,
      summary: item.description,
      href: `/guides/${item.slug}`,
      body: [item.category, item.degree, item.field, ...item.sections.flatMap((section) => [section.title, ...(section.paragraphs ?? []), ...(section.bullets ?? []), section.note ?? ""])].join(" "),
    })),
    ...articles.map((item) => ({
      type: "ARTICLE" as const,
      slug: item.slug,
      title: item.title,
      summary: item.description,
      href: `/articles/${item.slug}`,
      body: [item.category, item.degree, item.field, ...item.sections.flatMap((section) => [section.title, ...(section.paragraphs ?? []), ...(section.bullets ?? []), section.note ?? ""])].join(" "),
    })),
    ...subjects.map((source) => findSubject(source.slug) ?? source).map((item) => {
      const phase11 = phase11SubjectContent[item.slug as Phase11SubjectSlug];
      return {
        type: "SUBJECT" as const,
        slug: item.slug,
        title: item.title,
        summary: item.description,
        href: `/subjects/${item.slug}`,
        body: [
          item.shortTitle,
          item.status1406,
          ...item.tracks,
          ...item.focus,
          phase11?.quickAnswer ?? "",
          ...(phase11?.learningPath ?? []).flatMap((step) => [step.title, step.detail]),
          ...(phase11?.commonMistakes ?? []),
          ...(item.syllabus ?? []).flatMap((section) => [section.title, ...section.topics]),
        ].join(" "),
      };
    }),
  ];
  return candidates
    .map((item) => ({ item, score: matchScore(item.title, `${item.summary} ${item.body}`, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title, "fa"))
    .map(({ item: { body: _body, ...item } }) => item);
}

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const query = firstValue(searchParams.q).trim().slice(0, 120);
  const requestedPage = pageNumber(searchParams.page);
  let response: SearchResponse | null = null;
  let unavailable = false;

  if (query) {
    try {
      response = await apiGetPublic<SearchResponse>(`/content/search?q=${encodeURIComponent(query)}&page=${requestedPage}&limit=12`);
    } catch {
      unavailable = true;
    }
  }
  const legacyMatches = query && requestedPage === 1 ? legacySearch(query) : [];
  const apiItems = response?.items ?? [];
  const apiHrefs = new Set(apiItems.map((item) => item.href));
  const visibleItems = [...apiItems, ...legacyMatches.filter((item) => !apiHrefs.has(item.href))];
  const visibleTotal = (response?.total ?? 0) + legacyMatches.filter((item) => !apiHrefs.has(item.href)).length;

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="جست‌وجوی فارسی"
        title="یک عبارت؛ همهٔ مسیرهای مرتبط"
        description="ی و ک عربی، نیم‌فاصله و فاصله‌های اضافی یکسان‌سازی می‌شوند و نتیجهٔ عنوان دقیق، بالاتر از تطبیق متن قرار می‌گیرد."
      />
      <form className="surface-card" action="/search" method="get" role="search">
        <label className="field-label" htmlFor="site-search">عنوان درس، مبحث، راهنما یا منبع</label>
        <div className="content-filter-row">
          <input className="field-input" id="site-search" name="q" type="search" defaultValue={query} maxLength={120} placeholder="مثلاً داده‌ساختار و الگوریتم" autoComplete="off" />
          <button className="button button-primary" type="submit">جست‌وجو</button>
        </div>
      </form>

      {!query ? (
        <EmptyState title="عبارت جست‌وجو را وارد کنید" description="می‌توانید نام درس، مبحث، نوع منبع یا نام نویسنده را جست‌وجو کنید." />
      ) : unavailable && visibleItems.length === 0 ? (
        <PublicServiceError label="جست‌وجو" />
      ) : visibleItems.length === 0 ? (
        <EmptyState title="نتیجه‌ای پیدا نشد" description={`برای «${query}» محتوای منتشرشده‌ای پیدا نشد؛ عبارت کوتاه‌تر یا نام درس را امتحان کنید.`} />
      ) : (
        <section aria-labelledby="search-results-title">
          {unavailable && <aside className="official-disclaimer"><strong>نتایج پایه</strong><p>سرویس جست‌وجو در دسترس نیست؛ نتایج از صفحات عمومیِ موجود در خود سایت پیدا شده‌اند.</p></aside>}
          <div className="section-heading"><div><h2 id="search-results-title">نتایج «{query}»</h2><p>{toPersianDigits(visibleTotal)} نتیجهٔ عمومی</p></div></div>
          <div className="article-grid">
            {visibleItems.map((item) => (
              <Link className="article-card" href={item.href} key={`${item.type}-${item.slug}`}>
                <span className="article-meta">{typeLabels[item.type]}</span>
                <h3>{item.title}</h3>
                {item.summary && <p>{item.summary}</p>}
                <span className="text-link">مشاهده ←</span>
              </Link>
            ))}
          </div>
          {response && response.totalPages > 1 && (
            <nav className="content-filter-row" aria-label="صفحه‌بندی نتایج">
              {response.page > 1 && <Link className="button button-secondary" href={searchHref(query, response.page - 1)}>صفحهٔ قبل</Link>}
              <span aria-current="page">صفحهٔ {toPersianDigits(response.page)} از {toPersianDigits(response.totalPages)}</span>
              {response.page < response.totalPages && <Link className="button button-secondary" href={searchHref(query, response.page + 1)}>صفحهٔ بعد</Link>}
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
