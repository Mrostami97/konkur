"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

export interface HeroEntry {
  title: string;
  href: string;
  /** What kind of page it is, shown as a small label: درس، راهنما، مقاله… */
  kind: string;
}

/** Folds the spellings people type interchangeably, so «كنكور» finds «کنکور». */
function fold(text: string) {
  return text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎]/g, " ")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const MAX_SUGGESTIONS = 6;
const EXAMPLE_INTERVAL_MS = 3200;

/**
 * The first thing a student meets: one search box that answers as they type
 * from the site's own pages, and below it the pages worth knowing about,
 * drifting past slowly so the site shows what it has without a wall of cards.
 */
export function HeroSearch({ entries, examples, rows }: { entries: HeroEntry[]; examples: string[]; rows: HeroEntry[][] }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [example, setExample] = useState(0);

  // The example in the box changes while it is empty; typing stops it.
  useEffect(() => {
    if (query || examples.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => setExample((index) => (index + 1) % examples.length), EXAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [query, examples.length]);

  const folded = useMemo(() => entries.map((entry) => ({ entry, key: fold(entry.title) })), [entries]);
  const suggestions = useMemo(() => {
    const needle = fold(query);
    if (needle.length < 2) return [];
    const words = needle.split(" ");
    const starts = folded.filter((row) => row.key.startsWith(needle));
    const contains = folded.filter((row) => !row.key.startsWith(needle) && words.every((word) => row.key.includes(word)));
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS).map((row) => row.entry);
  }, [folded, query]);

  const showList = open && suggestions.length > 0;

  function submit(value: string) {
    const text = value.trim();
    router.push(text ? `/search?q=${encodeURIComponent(text)}` : "/search");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (event.key === "Enter" && showList && active >= 0) {
      event.preventDefault();
      router.push(suggestions[active].href);
    }
  }

  return (
    <div className="hs">
      <form
        className="hs-box"
        role="search"
        action="/search"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          submit(query);
        }}
      >
        <label htmlFor="hs-q" className="sr-only">جست‌وجو در درس‌ها، راهنماها و مقاله‌ها</label>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <div className="hs-field">
          <input
            ref={inputRef}
            id="hs-q"
            name="q"
            type="search"
            autoComplete="off"
            value={query}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
          />
          {!query && examples.length > 0 && (
            <span className="hs-example" aria-hidden="true">
              چه می‌خواهی یاد بگیری؟ مثلاً <b key={example}>«{examples[example]}»</b>
            </span>
          )}
        </div>
        <button type="submit">جست‌وجو</button>

        {showList && (
          <ul className="hs-list" id={listId} role="listbox" aria-label="پیشنهادها">
            {suggestions.map((entry, index) => (
              <li
                key={entry.href}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                data-active={index === active || undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  router.push(entry.href);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span className="hs-kind">{entry.kind}</span>
                <span className="hs-title">{entry.title}</span>
              </li>
            ))}
            <li
              role="option"
              aria-selected={false}
              className="hs-all"
              onMouseDown={(event) => {
                event.preventDefault();
                submit(query);
              }}
            >
              همهٔ نتیجه‌ها برای «{query}» ←
            </li>
          </ul>
        )}
      </form>

      <div className="hs-rails" aria-label="صفحه‌های مهم سایت">
        {rows.map((row, rowIndex) =>
          row.length === 0 ? null : (
            <div className={`hs-rail ${rowIndex % 2 ? "hs-rail-reverse" : ""}`} key={rowIndex}>
              {/* The list twice, so the loop has no seam; the copy is hidden from screen readers. */}
              <div className="hs-track">
                {[...row, ...row].map((entry, index) => (
                  <Link
                    href={entry.href}
                    className="hs-chip"
                    key={`${entry.href}-${index}`}
                    aria-hidden={index >= row.length || undefined}
                    tabIndex={index >= row.length ? -1 : undefined}
                  >
                    <span className="hs-chip-kind">{entry.kind}</span>
                    {entry.title}
                  </Link>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
