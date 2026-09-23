import type { Metadata } from "next";
import Link from "next/link";
import { Glyph } from "../../components/SubjectIcon";
import { subjects } from "../../content/editorial";
import { API_URL, apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";
import { TELEGRAM_URL } from "../../lib/site-nav";
import "../home.css";
import "../landing.css";

interface Achievement {
  id: string;
  displayName: string;
  examYear: number;
  degree: "MASTER" | "PHD";
  field: string;
  rank: number;
  rankLabel: string | null;
  acceptedUniversity: string | null;
  acceptedProgram: string | null;
  quote: string | null;
  subjectSlugs: string[];
  videoUrl: string | null;
  sourceUrl: string | null;
  photoPath: string | null;
  course: { slug: string; title: string } | null;
}

interface Summary {
  total: number;
  under10: number;
  under100: number;
  under1000: number;
  bestRank: number | null;
  years: { examYear: number; count: number; bestRank: number }[];
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function load<T>(path: string): Promise<T | null> {
  try {
    return await apiGetPublic<T>(path);
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const summary = await load<Summary>("/achievements/summary");
  const filtered = Boolean(first(searchParams.year) || first(searchParams.subject));
  return pageMetadata({
    title: "نتایج و رتبه‌های شاگردان کلاس‌های کنکور کامپیوتر",
    description:
      "رتبه‌ها و قبولی‌های شاگردان کلاس‌های کنکور ارشد و دکتری کامپیوتر، به تفکیک سال و درس؛ هر نتیجه با رضایت خود شاگرد منتشر شده است.",
    path: "/results",
    // A filtered view repeats rows of the full list; only the full list is indexed.
    noIndex: filtered || summary === null || summary.total === 0,
  });
}

function degreeLabel(degree: Achievement["degree"]) {
  return degree === "PHD" ? "دکتری" : "ارشد";
}

function filterHref(year: string | undefined, subject: string | undefined) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (subject) params.set("subject", subject);
  const query = params.toString();
  return query ? `/results?${query}` : "/results";
}

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const [rows, summary] = await Promise.all([
    load<Achievement[]>("/achievements?limit=200"),
    load<Summary>("/achievements/summary"),
  ]);
  const all = rows ?? [];
  const year = first(searchParams.year);
  const subject = first(searchParams.subject);

  const shown = all.filter(
    (row) => (!year || String(row.examYear) === year) && (!subject || row.subjectSlugs.includes(subject)),
  );
  const years = [...new Set(shown.map((row) => row.examYear))].sort((a, b) => b - a);
  const subjectFilters = subjects.filter((item) => all.some((row) => row.subjectSlugs.includes(item.slug)));

  return (
    <main className="h">
      <section className="lp-hero lp-hero-gold">
        <div className="h-wrap">
          <nav className="lp-crumbs" aria-label="مسیر صفحه">
            <Link href="/">خانه</Link>
            <span aria-hidden="true">/</span>
            <span>نتایج شاگردان</span>
          </nav>
          <p className="h-kicker h-kicker-light">
            <Glyph name="trophy" className="lp-kicker-icon" /> نتایج شاگردان
          </p>
          <h1>رتبه‌هایی که از همین کلاس‌ها بیرون آمد</h1>
          <p className="lp-lede">
            هر کارت یک شاگرد واقعی است که خودش رضایت داده نام و نتیجه‌اش اینجا دیده شود. نتیجه‌ها اول در کانال
            تلگرام منتشر شده‌اند و هر جا پست اصلی‌اش را داریم، کنار کارت لینک شده است.
          </p>
          {summary && summary.total > 0 && (
            <div className="lp-facts">
              {summary.bestRank !== null && <span><b>{toPersianDigits(summary.bestRank)}</b> بهترین رتبه</span>}
              {summary.under10 > 0 && <span><b>{toPersianDigits(summary.under10)}</b> رتبهٔ تک‌رقمی</span>}
              <span><b>{toPersianDigits(summary.under100)}</b> رتبهٔ زیر ۱۰۰</span>
              <span><b>{toPersianDigits(summary.under1000)}</b> رتبهٔ زیر ۱۰۰۰</span>
              <span><b>{toPersianDigits(summary.total)}</b> نتیجهٔ ثبت‌شده</span>
            </div>
          )}
        </div>
      </section>

      <div className="h-wrap lp-body">
        {all.length === 0 ? (
          <div className="lp-empty">
            <h2>{rows === null ? "فهرست نتایج الان در دسترس نیست" : "نتایج به‌زودی اینجا منتشر می‌شود"}</h2>
            <p>
              {rows === null
                ? "چند دقیقهٔ دیگر دوباره سر بزن."
                : "نتیجهٔ هر شاگرد فقط بعد از رضایت خودش اینجا می‌آید. تا آن موقع، نتیجه‌های منتشرشده را در کانال تلگرام ببین."}
            </p>
            <a className="h-btn h-btn-primary" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              کانال تلگرام ‎@konkurcom
            </a>
          </div>
        ) : (
          <>
            {(summary?.years.length ?? 0) > 1 && (
              <nav className="lp-filters" aria-label="فیلتر سال">
                <span>سال کنکور:</span>
                <Link href={filterHref(undefined, subject)} className="lp-filter" aria-current={!year ? "page" : undefined}>
                  همه
                </Link>
                {summary!.years.map((item) => (
                  <Link
                    key={item.examYear}
                    href={filterHref(String(item.examYear), subject)}
                    className="lp-filter"
                    aria-current={year === String(item.examYear) ? "page" : undefined}
                  >
                    {toPersianDigits(item.examYear)}
                  </Link>
                ))}
              </nav>
            )}

            {subjectFilters.length > 0 && (
              <nav className="lp-filters" aria-label="فیلتر درس">
                <span>درس:</span>
                <Link href={filterHref(year, undefined)} className="lp-filter" aria-current={!subject ? "page" : undefined}>
                  همه
                </Link>
                {subjectFilters.map((item) => (
                  <Link
                    key={item.slug}
                    href={filterHref(year, item.slug)}
                    className="lp-filter"
                    aria-current={subject === item.slug ? "page" : undefined}
                  >
                    {item.shortTitle}
                  </Link>
                ))}
              </nav>
            )}

            {shown.length === 0 && (
              <div className="lp-empty">
                <h2>با این فیلتر نتیجه‌ای ثبت نشده</h2>
                <p>فیلتر را بردار تا همهٔ نتیجه‌ها را ببینی.</p>
                <Link href="/results" className="h-btn h-btn-primary">همهٔ نتایج</Link>
              </div>
            )}

            {years.map((examYear) => {
              const inYear = shown.filter((row) => row.examYear === examYear).sort((a, b) => a.rank - b.rank);
              return (
                <section className="lp-year" key={examYear} aria-labelledby={`year-${examYear}`}>
                  <header className="lp-year-head">
                    <h2 id={`year-${examYear}`}>کنکور {toPersianDigits(examYear)}</h2>
                    <span>{toPersianDigits(inYear.length)} نتیجه</span>
                  </header>
                  <div className="lp-results">
                    {inYear.map((row) => (
                      <article className={`lp-result ${row.rank <= 10 ? "lp-rank-top" : ""}`} key={row.id}>
                        <div className="lp-result-photo">
                          {row.photoPath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${API_URL}${row.photoPath}`} alt={row.displayName} loading="lazy" />
                          ) : (
                            <span className="lp-result-initial" aria-hidden="true">{row.displayName.trim().slice(0, 1)}</span>
                          )}
                          <span className="lp-result-rank">
                            <small>رتبهٔ</small>
                            <b>{toPersianDigits(row.rank)}</b>
                          </span>
                        </div>
                        <div className="lp-result-body">
                          <h3>{row.displayName}</h3>
                          <p className="lp-result-meta">
                            {degreeLabel(row.degree)} {row.field} · {toPersianDigits(row.examYear)}
                            {row.rankLabel ? ` · ${row.rankLabel}` : ""}
                          </p>
                          {row.acceptedUniversity && (
                            <p className="lp-result-uni">
                              <Glyph name="building" />
                              {row.acceptedUniversity}
                              {row.acceptedProgram ? ` — ${row.acceptedProgram}` : ""}
                            </p>
                          )}
                          {row.quote && <blockquote>«{row.quote}»</blockquote>}
                          {(row.course || row.sourceUrl || row.videoUrl) && (
                            <div className="lp-result-links">
                              {row.course && <Link href={`/courses/${row.course.slug}`}>دورهٔ {row.course.title}</Link>}
                              {row.videoUrl && (
                                <a href={row.videoUrl} target="_blank" rel="noopener noreferrer">ویدیوی گفت‌وگو ↗</a>
                              )}
                              {row.sourceUrl && (
                                <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">پست اصلی ↗</a>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}

            <aside className="lp-note">
              <strong>این نتیجه‌ها چطور اینجا آمده‌اند؟</strong>
              <p>
                هر ردیف را ادمین با رضایت ثبت‌شدهٔ خود شاگرد منتشر می‌کند و شاگرد هر وقت بخواهد می‌تواند حذفش را
                بخواهد. آمار بالای صفحه از همین ردیف‌ها حساب می‌شود، نه عددی که دستی نوشته شده باشد. مستندات دیگر
                تدریس را در <Link href="/evidence">صفحهٔ مستندات</Link> ببین.
              </p>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
