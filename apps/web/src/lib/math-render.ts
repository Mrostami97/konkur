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

/** The fallback still goes into an HTML sink, so it must contain text only. */
export function renderLatex(source: string, displayMode = false): string {
  try {
    return persianDigits(katex.renderToString(source, { throwOnError: false, output: "html", displayMode }));
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
