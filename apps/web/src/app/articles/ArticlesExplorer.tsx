"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Glyph } from "../../components/SubjectIcon";
import { toPersianDigits } from "../../lib/format";
import { SHELVES } from "./shelves";

export interface ArticleRow {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  shelves: string[];
  byline: string;
  date: string | null;
  minutes: number;
}

/** Arabic letters and spacing typed on a non-Persian keyboard still match. */
function normalise(value: string) {
  return value
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌ً-ٟ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function shelfOf(row: ArticleRow) {
  return SHELVES.find((shelf) => shelf.key === row.shelves[0]) ?? SHELVES[0];
}

function ArticleCard({ row, lead = false }: { row: ArticleRow; lead?: boolean }) {
  const shelf = shelfOf(row);
  return (
    <Link href={`/articles/${row.slug}`} className={`al-card${lead ? " al-card-lead" : ""}`} data-tone={shelf.tone}>
      <span className="al-card-shelf">
        <span className="al-card-icon"><Glyph name={shelf.icon} /></span>
        {shelf.label}
      </span>
      <h2 className="al-card-title">{row.title}</h2>
      <p className="al-card-summary">{row.summary}</p>
      <span className="al-card-meta">
        <span>{row.byline}{row.date ? ` · ${row.date}` : ""}</span>
        <span className="al-card-time">
          <Glyph name="pace" />
          {toPersianDigits(row.minutes)} دقیقه
        </span>
      </span>
    </Link>
  );
}

/**
 * The library: shelves to narrow by, a search over titles and summaries, and
 * the newest article leading when nothing is filtered. Every card is in the
 * server-rendered page; filtering only hides some, so crawlers see them all.
 */
export function ArticlesExplorer({ rows }: { rows: ArticleRow[] }) {
  const [shelf, setShelf] = useState("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) for (const key of row.shelves) map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, [rows]);

  const needle = normalise(query);
  const visible = rows.filter(
    (row) =>
      (shelf === "all" || row.shelves.includes(shelf)) &&
      (!needle || normalise(`${row.title} ${row.summary} ${row.tags.join(" ")}`).includes(needle)),
  );
  const featured = shelf === "all" && !needle && visible.length >= 4;
  const lead = featured ? visible[0] : null;
  const side = featured ? visible.slice(1, 3) : [];
  const rest = featured ? visible.slice(3) : visible;

  return (
    <div className="al-wrap al-body">
      <div className="al-toolbar">
        <label className="al-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو در مقاله‌ها؛ مثلاً «شریف» یا «رتبهٔ ۱۰۰۰»"
            aria-label="جست‌وجو در مقاله‌ها"
          />
        </label>
        <div className="al-shelves" role="group" aria-label="دسته‌بندی مقاله‌ها">
          <button type="button" aria-pressed={shelf === "all"} onClick={() => setShelf("all")}>
            همه <span>{toPersianDigits(rows.length)}</span>
          </button>
          {SHELVES.filter((item) => counts.get(item.key)).map((item) => (
            <button type="button" key={item.key} aria-pressed={shelf === item.key} data-tone={item.tone} onClick={() => setShelf(item.key)}>
              <Glyph name={item.icon} />
              {item.label} <span>{toPersianDigits(counts.get(item.key) ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>

      {(shelf !== "all" || needle) && (
        <p className="al-result" role="status">
          {visible.length > 0 ? `${toPersianDigits(visible.length)} مقاله` : "مقاله‌ای پیدا نشد."}
          {(shelf !== "all" || needle) && (
            <button type="button" onClick={() => { setShelf("all"); setQuery(""); }}>
              نمایش همه
            </button>
          )}
        </p>
      )}

      {lead && (
        <section className="al-featured" aria-label="تازه‌ترین مقاله‌ها">
          <ArticleCard row={lead} lead />
          <div className="al-featured-side">
            {side.map((row) => <ArticleCard row={row} key={row.slug} />)}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <div className="al-grid">
          {rest.map((row) => <ArticleCard row={row} key={row.slug} />)}
        </div>
      )}
    </div>
  );
}
