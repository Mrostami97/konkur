import Link from "next/link";
import type { ReactNode } from "react";
import "../../app/reading.css";

export type ReadingTone = "teal" | "blue" | "violet" | "amber" | "rose";

/**
 * The top of every reading page -- articles, guides and subject hubs: a
 * coloured band with the breadcrumb, labels, the page's single h1, its deck
 * and the facts that make a reader trust it (review date, reading time).
 * The colour follows the subject family, so a subject reads as its own place.
 */
export function ReadingHero({
  crumbs,
  chips = [],
  title,
  deck,
  meta = [],
  tone = "blue",
  art,
  children,
}: {
  crumbs: { name: string; href?: string }[];
  chips?: string[];
  title: string;
  deck?: string | null;
  meta?: ReactNode[];
  tone?: ReadingTone;
  art?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={`rd-hero rd-tone-${tone}`}>
      <div className="rd-wrap rd-hero-grid">
        <div className="rd-hero-copy">
          <nav className="rd-crumbs" aria-label="مسیر صفحه">
            {crumbs.map((item, index) => (
              <span key={`${item.name}-${index}`}>
                {index > 0 && <i aria-hidden="true">/</i>}
                {item.href ? <Link href={item.href}>{item.name}</Link> : <span aria-current="page">{item.name}</span>}
              </span>
            ))}
          </nav>
          {chips.length > 0 && (
            <div className="rd-chips">
              {chips.map((chip) => <span key={chip}>{chip}</span>)}
            </div>
          )}
          <h1>{title}</h1>
          {deck && <p className="rd-deck">{deck}</p>}
          {meta.length > 0 && <div className="rd-meta">{meta}</div>}
          {children}
        </div>
        {art && <div className="rd-hero-art" aria-hidden="true">{art}</div>}
      </div>
    </header>
  );
}
