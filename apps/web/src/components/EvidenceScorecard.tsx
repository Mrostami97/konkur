import Image from "next/image";
import type { EvidenceDocument } from "../content/evidence";
import { Glyph, type GlyphName } from "./SubjectIcon";

type Kind = "rank" | "percent" | "match" | "design";

const KIND: Record<Kind, { label: string; glyph: GlyphName }> = {
  rank: { label: "رتبه در کارنامه", glyph: "trophy" },
  percent: { label: "درصد درس", glyph: "target" },
  match: { label: "تطبیق با کنکور", glyph: "flow" },
  design: { label: "طراحی سؤال", glyph: "spark" },
};

function kindOf(item: EvidenceDocument): Kind {
  if (item.category === "طراحی سؤال") return "design";
  if (item.category === "تطبیق سؤال") return "match";
  if (item.category === "کارنامه" && !item.hero?.value.includes("٪")) return "rank";
  return "percent";
}

/** "آقای کاظمی" reads as کاظمی on an avatar; everyone else by their first letter. */
function initialOf(name: string) {
  return name.replace(/^(آقای|خانم)\s+/, "").trim().charAt(0);
}

/**
 * A designed card built from the numbers the linked post shows. The original
 * image always sits underneath it, untouched, so the design never replaces
 * the proof.
 */
export function EvidenceScorecard({ item }: { item: EvidenceDocument }) {
  const kind = kindOf(item);
  const proofIsTheStory = kind === "match" || kind === "design";
  // The metric is the post's own claim; repeat it only when the hero and title do not already say it.
  // When the metric already extends the title, it becomes the heading itself.
  const heading = item.metric.includes(item.title) ? item.metric : item.title;
  const showMetric = heading !== item.metric && item.metric !== item.hero?.value && !item.title.includes(item.metric);

  return (
    <article className={`sc sc-${kind}`} id={item.id}>
      <header className="sc-head">
        <span className="sc-kind">
          <Glyph name={KIND[kind].glyph} />
          {KIND[kind].label}
        </span>
        {item.year !== "—" && (
          <span className="sc-seal" aria-label={`کنکور ${item.year}`}>
            <small>کنکور</small>
            {item.year}
          </span>
        )}
        {item.student ? (
          <div className="sc-person">
            <span className="sc-avatar" aria-hidden="true">{initialOf(item.student)}</span>
            <span>
              <strong>{item.student}</strong>
              {item.role && <small>{item.role}</small>}
            </span>
          </div>
        ) : (
          <div className="sc-person sc-person-plain">
            <span>
              <strong>{item.title}</strong>
            </span>
          </div>
        )}
        {item.hero && (
          <div className="sc-hero">
            <b>{item.hero.value}</b>
            <span>{item.hero.label}</span>
          </div>
        )}
      </header>

      <div className="sc-body">
        <span className="sc-subject">{item.subject}</span>
        <h3>{heading}</h3>
        {showMetric && <strong className="sc-metric">{item.metric}</strong>}

        {item.facts && item.facts.length > 0 && (
          <dl className="sc-facts">
            {item.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {item.bars && (
          <div className="sc-bars" aria-label="درصد درس‌ها در کارنامه">
            {item.bars.map((bar) => (
              <div className="sc-bar" key={bar.label}>
                <span>{bar.label}</span>
                <i aria-hidden="true"><em style={{ inlineSize: `${Math.max(bar.percent, 2)}%` }} /></i>
                <b>{bar.percent.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪</b>
              </div>
            ))}
          </div>
        )}

        <p>{item.description}</p>

        {item.topics && (
          <div className="sc-topics" aria-label="مبحث‌هایی که هم در کلاس بود و هم در کنکور">
            {item.topics.map((topic) => <span key={topic}>{topic}</span>)}
          </div>
        )}

        {item.images && item.images.length > 0 && (
          <div className={proofIsTheStory ? "sc-proof sc-proof-large" : "sc-proof"}>
            <span className="sc-proof-label">
              <Glyph name="shield" />
              {proofIsTheStory ? "تصویر اصلی" : "سند اصلی، بدون ویرایش"}
            </span>
            <div className="sc-proof-images">
              {item.images.map((image) => (
                <a href={image.src} target="_blank" rel="noopener" key={image.src} title="نمایش در اندازهٔ کامل">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    sizes={proofIsTheStory ? "(max-width: 720px) 100vw, 520px" : "(max-width: 720px) 50vw, 180px"}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {(item.telegramUrl || item.related) && (
          <footer className="sc-links">
            {item.telegramUrl && (
              <a href={item.telegramUrl} target="_blank" rel="noopener noreferrer">پست اصلی در تلگرام ↗</a>
            )}
            {item.related && (
              <a href={item.related.url} target="_blank" rel="noopener noreferrer">{item.related.label} ↗</a>
            )}
          </footer>
        )}
      </div>
    </article>
  );
}
