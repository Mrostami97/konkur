import Link from "next/link";
import { Fragment, type JSX } from "react";
import { API_URL } from "../lib/api";
import { splitMath } from "../lib/math-text";
import { renderLatex } from "../lib/math-render";
import { VideoPlayer } from "./video/VideoPlayer";

type Block = { type: string; [key: string]: unknown };
type Asset = { media_key: string; checksum: string };

function mediaUrl(assets: Asset[], mediaKey: string): string | null {
  const asset = assets.find((a) => a.media_key === mediaKey);
  if (!asset) return null;
  return `${API_URL}/media/${asset.checksum.replace("sha256:", "")}`;
}

/** Text with inline ($...$) and display ($$...$$) formulas typeset in place. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {splitMath(text).map((segment, index) =>
        segment.kind === "text" ? (
          segment.value
        ) : (
          <span
            key={index}
            className={segment.display ? "cb-dmath" : "cb-imath"}
            dir="ltr"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: renderLatex(segment.value, segment.display) }}
          />
        ),
      )}
    </>
  );
}

// Authored text marks bullets with "• " and steps with "۱." / "1." at the start
// of a line. HTML would collapse those lines into one paragraph, so each line
// becomes its own paragraph and runs of two or more marked lines become a real
// list. A single marked line (an answer option, say) stays a plain paragraph.
const BULLET = /^[•▪◦]\s*/;
const NUMBERED = /^([0-9۰-۹]+)[.)]\s*/;
const toAsciiDigits = (value: string) => value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

function renderText(text: string, key: number) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return <p key={key}><RichText text={text} /></p>;
  const kindOf = (line: string) => (BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : "p");
  const groups: { kind: "ul" | "ol" | "p"; lines: string[] }[] = [];
  for (const line of lines) {
    const kind = kindOf(line);
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && kind !== "p") last.lines.push(line);
    else groups.push({ kind, lines: [line] });
  }
  return (
    <Fragment key={key}>
      {groups.map((group, groupIndex) => {
        if (group.kind === "p" || group.lines.length < 2) {
          return group.lines.map((line, lineIndex) => <p key={`${groupIndex}-${lineIndex}`}><RichText text={line} /></p>);
        }
        const marker = group.kind === "ul" ? BULLET : NUMBERED;
        const items = group.lines.map((line) => line.replace(marker, ""));
        if (group.kind === "ul") {
          return (
            <ul key={groupIndex} className="cb-list">
              {items.map((item, i) => <li key={i}><RichText text={item} /></li>)}
            </ul>
          );
        }
        const start = Number(toAsciiDigits(group.lines[0].match(NUMBERED)?.[1] ?? "1"));
        return (
          <ol key={groupIndex} className="cb-list" start={start}>
            {items.map((item, i) => <li key={i}><RichText text={item} /></li>)}
          </ol>
        );
      })}
    </Fragment>
  );
}

function renderBlock(block: Block, index: number, assets: Asset[]) {
  switch (block.type) {
    case "heading": {
      const level = typeof block.level === "number" ? block.level : 2;
      const Tag = (`h${Math.min(Math.max(level, 1), 6)}` as unknown) as keyof JSX.IntrinsicElements;
      return <Tag key={index}>{String(block.text ?? "")}</Tag>;
    }
    case "text":
      return renderText(String(block.text ?? ""), index);
    case "quote":
      return (
        <blockquote key={index} className="cb-quote">
          <RichText text={String(block.text ?? "")} />
          {typeof block.cite === "string" && <footer>— {block.cite}</footer>}
        </blockquote>
      );
    case "image":
    case "chart": {
      const mediaKey = String(block.media_key ?? "");
      const url = mediaUrl(assets, mediaKey);
      if (!url) {
        // A student sees a plain note; the missing key stays in a tooltip
        // for whoever authored the content.
        return (
          <p key={index} className="cb-missing" title={mediaKey}>
            تصویر این بخش بارگذاری نشد.
          </p>
        );
      }
      const caption = typeof block.caption === "string" ? block.caption : null;
      return (
        <figure key={index} className="cb-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={String(block.alt ?? block.caption ?? "")} loading="lazy" />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    case "video": {
      // An uploaded video (media_key) is served by the API in byte ranges;
      // older imported blocks carry a plain url.
      const src = block.media_key ? mediaUrl(assets, String(block.media_key)) : String(block.url ?? "");
      if (!src) {
        return (
          <p key={index} className="cb-missing" title={String(block.media_key)}>
            ویدیوی این بخش بارگذاری نشد.
          </p>
        );
      }
      const caption = typeof block.caption === "string" && block.caption.trim() ? block.caption : null;
      return (
        <figure key={index} className="cb-figure">
          <VideoPlayer src={src} title={caption ?? undefined} />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    case "table": {
      const rows = Array.isArray(block.rows) ? (block.rows as string[][]) : [];
      const headers = Array.isArray(block.headers) ? (block.headers as string[]) : [];
      // Wide tables scroll sideways on a phone instead of squeezing every
      // column to a few characters.
      return (
        <div key={index} className="cb-table">
        <table data-wide={headers.length >= 4 || undefined}>
          {headers.length > 0 && (
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      );
    }
    case "latex":
      return (
        <div
          key={index}
          className="cb-math"
          dir="ltr"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: renderLatex(String(block.latex ?? "")) }}
        />
      );
    case "link_group": {
      const items = Array.isArray(block.items)
        ? block.items.filter((item): item is { label: string; href: string } => {
          if (!item || typeof item !== "object") return false;
          const candidate = item as { label?: unknown; href?: unknown };
          return typeof candidate.label === "string"
            && typeof candidate.href === "string"
            && /^\/[A-Za-z0-9][A-Za-z0-9/_-]*(?:[?#][^\s]*)?$/.test(candidate.href);
        })
        : [];
      if (items.length === 0) return null;
      return (
        <nav key={index} aria-label="مسیرهای مرتبط">
          <ul>
            {items.map((item) => (
              <li key={`${item.href}-${item.label}`}>
                <Link className="text-link" href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      );
    }
    default:
      return null;
  }
}

export function ContentBlocks({ blocks, assets = [] }: { blocks: Block[]; assets?: Asset[] }) {
  return <div className="cb">{blocks.map((block, index) => renderBlock(block, index, assets))}</div>;
}
