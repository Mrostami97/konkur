import katex from "katex";

/** The fallback still goes into an HTML sink, so it must contain text only. */
export function renderLatex(source: string, displayMode = false): string {
  try {
    return katex.renderToString(source, { throwOnError: false, output: "html", displayMode });
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
