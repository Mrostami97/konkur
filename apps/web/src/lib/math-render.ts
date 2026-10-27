import katex from "katex";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * KaTeX writes digits in Latin, in its own font, which has no Persian ones.
 * Each run of digits in the formula's text -- never in its markup, whose
 * sizes and offsets are numbers too, nor inside an HTML entity -- becomes
 * Persian, with the Persian decimal mark, and is marked so the site's font
 * draws it.
 */
function persianDigits(html: string): string {
  return html.replace(/>([^<]+)</g, (_, text: string) =>
    `>${text.replace(/&[#\w]+;|\d+(?:\.\d+)?/g, (run) =>
      run.startsWith("&")
        ? run
        : `<span class="katex-fa">${run.replace(".", "٫").replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)])}</span>`,
    )}<`,
  );
}

/**
 * KaTeX sets the spaces of \texttt (a line of code) as non-breaking, so a long
 * line can only scroll. Inside those spans they become plain spaces, so the
 * line may wrap between words where its box allows it.
 */
function breakableCode(html: string): string {
  const open = '<span class="mord texttt">';
  let out = "";
  let at = 0;
  for (let start = html.indexOf(open); start !== -1; start = html.indexOf(open, at)) {
    let depth = 0;
    let end = start;
    const tag = /<\/?span\b[^>]*>/g;
    tag.lastIndex = start;
    for (let match = tag.exec(html); match; match = tag.exec(html)) {
      depth += match[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = tag.lastIndex;
        break;
      }
    }
    if (end === start) break;
    out += html.slice(at, start) + html.slice(start, end).replace(/>([^<]*)</g, (_, text: string) => `>${text.replace(/&nbsp;| /g, " ")}<`);
    at = end;
  }
  return out + html.slice(at);
}

/** The fallback still goes into an HTML sink, so it must contain text only. */
export function renderLatex(source: string, displayMode = false): string {
  try {
    return persianDigits(breakableCode(katex.renderToString(source, { throwOnError: false, output: "html", displayMode })));
  } catch {
    return source.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]!);
  }
}
