import katex from "katex";
import Link from "next/link";
import { API_URL } from "../lib/api";

type Block = { type: string; [key: string]: unknown };
type Asset = { media_key: string; checksum: string };

function mediaUrl(assets: Asset[], mediaKey: string): string | null {
  const asset = assets.find((a) => a.media_key === mediaKey);
  if (!asset) return null;
  return `${API_URL}/media/${asset.checksum.replace("sha256:", "")}`;
}

function renderLatex(source: string): string {
  try {
    return katex.renderToString(source, { throwOnError: false, output: "html" });
  } catch {
    return source;
  }
}

function renderBlock(block: Block, index: number, assets: Asset[]) {
  switch (block.type) {
    case "heading": {
      const level = typeof block.level === "number" ? block.level : 2;
      const Tag = (`h${Math.min(Math.max(level, 1), 6)}` as unknown) as keyof JSX.IntrinsicElements;
      return <Tag key={index}>{String(block.text ?? "")}</Tag>;
    }
    case "text":
      return <p key={index}>{String(block.text ?? "")}</p>;
    case "quote":
      return (
        <blockquote key={index} style={{ borderInlineStart: "3px solid #D7E2EA", paddingInlineStart: "1rem" }}>
          {String(block.text ?? "")}
          {typeof block.cite === "string" && <footer>— {block.cite}</footer>}
        </blockquote>
      );
    case "image":
    case "chart": {
      const mediaKey = String(block.media_key ?? "");
      const url = mediaUrl(assets, mediaKey);
      if (!url) {
        return (
          <div key={index} style={{ background: "#F4F8FB", padding: "0.5rem", fontSize: "0.85rem" }}>
            [رسانه یافت نشد: {mediaKey}]
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={index} src={url} alt={String(block.alt ?? block.caption ?? mediaKey)} style={{ maxWidth: "100%" }} />
      );
    }
    case "video":
      return (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video key={index} controls style={{ width: "100%" }} src={String(block.url ?? "")} />
      );
    case "table": {
      const rows = Array.isArray(block.rows) ? (block.rows as string[][]) : [];
      const headers = Array.isArray(block.headers) ? (block.headers as string[]) : [];
      return (
        <table key={index} style={{ borderCollapse: "collapse", width: "100%" }}>
          {headers.length > 0 && (
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} style={{ border: "1px solid #D7E2EA", padding: "0.4rem" }}>
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
                  <td key={cellIndex} style={{ border: "1px solid #D7E2EA", padding: "0.4rem" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "latex":
      return (
        <div
          key={index}
          style={{ direction: "ltr", textAlign: "center", margin: "0.5rem 0" }}
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
  return <div>{blocks.map((block, index) => renderBlock(block, index, assets))}</div>;
}
