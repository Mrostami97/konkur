/**
 * Splits authored text into plain runs and formulas, so a question typed in
 * the admin form can carry math without a separate block per formula:
 *
 *   $...$    an inline formula, in the flow of the sentence
 *   $$...$$  a formula on its own line
 *   \$       a literal dollar sign
 *
 * A `$` with no closing partner stays plain text, so ordinary prose is never
 * swallowed by a stray symbol.
 */
export type MathSegment =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean };

export function splitMath(source: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let text = "";
  let index = 0;

  const flush = () => {
    if (text) segments.push({ kind: "text", value: text });
    text = "";
  };

  while (index < source.length) {
    const char = source[index];
    if (char === "\\" && source[index + 1] === "$") {
      text += "$";
      index += 2;
      continue;
    }
    if (char === "$") {
      const display = source[index + 1] === "$";
      const open = display ? 2 : 1;
      const close = findClose(source, index + open, display);
      if (close > index + open) {
        flush();
        segments.push({ kind: "math", value: source.slice(index + open, close).trim(), display });
        index = close + open;
        continue;
      }
    }
    text += char;
    index += 1;
  }
  flush();
  return segments;
}

/** Index of the closing delimiter, skipping escaped dollars; -1 when unclosed. */
function findClose(source: string, from: number, display: boolean): number {
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] !== "$") continue;
    if (!display) return index;
    if (source[index + 1] === "$") return index;
  }
  return -1;
}

export function hasMath(source: string): boolean {
  return splitMath(source).some((segment) => segment.kind === "math");
}
