type Block = { type: string; [key: string]: unknown };

function renderBlock(block: Block, index: number) {
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
      return (
        <div key={index} style={{ background: "#F4F8FB", padding: "0.5rem", fontSize: "0.85rem" }}>
          [تصویر: {String(block.media_key ?? block.alt ?? "")}]
        </div>
      );
    case "video":
      return (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video key={index} controls style={{ width: "100%" }} src={String(block.url ?? "")} />
      );
    case "table": {
      const rows = Array.isArray(block.rows) ? (block.rows as string[][]) : [];
      return (
        <table key={index} style={{ borderCollapse: "collapse", width: "100%" }}>
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
        <pre key={index} style={{ background: "#F4F8FB", padding: "0.5rem", direction: "ltr" }}>
          {String(block.latex ?? "")}
        </pre>
      );
    default:
      return null;
  }
}

export function ContentBlocks({ blocks }: { blocks: Block[] }) {
  return <div>{blocks.map((block, index) => renderBlock(block, index))}</div>;
}
