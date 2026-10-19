// Past-exam question text comes from the booklet PDFs with the printed line
// breaks still in it, so a sentence arrives cut into lines and a formula the
// booklet printed in the sentence arrives as a display formula on its own.
// This joins what the PDF wrapped and leaves alone what is really separate:
// list items (- , • , ۱) , الف -), lines after a full stop or colon, and code.
// Booklets also dash a statement with a kashida «ـ» or a minus sign «−».

const LIST_ITEM = /^([-–—−ـ•▪◦]\s|[0-9۰-۹]+\s*[.)\-–]\s|(الف|ب|ج|د|ه)\s*[-–)]|I{1,3}V?\s*[.)]|\$\$\\begin)/;
const ENDS_SENTENCE = /[.:؟?!؛]$/;
const CODE_FENCE = /(```[^\n]*\n[\s\S]*?```)/g;

function tidyProse(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const joined: string[] = [];
  for (const line of lines) {
    const previous = joined[joined.length - 1];
    if (previous !== undefined && !ENDS_SENTENCE.test(previous) && !LIST_ITEM.test(line)) joined[joined.length - 1] = `${previous} ${line}`;
    else joined.push(line);
  }
  // A $$formula$$ sharing its line with words was part of the sentence.
  return joined
    .map((line) => (line.replace(/\$\$[^$\n]+\$\$/g, "").trim() ? line.replace(/\$\$([^$\n]+)\$\$/g, (_, formula: string) => `$${formula}$`) : line))
    .join("\n");
}

export function tidyQuestionText(text: string) {
  return text
    .split(CODE_FENCE)
    .map((part) => (part.startsWith("```") ? part : tidyProse(part)))
    .filter((part) => part.trim())
    .join("\n");
}

type Block = { type: string; [key: string]: unknown };

/** Text blocks of a question stem or passage, tidied for reading. */
export function tidyQuestionBlocks<T extends Block>(blocks: T[]): T[] {
  return blocks.map((block) => (block.type === "text" && typeof block.text === "string" ? { ...block, text: tidyQuestionText(block.text) } : block));
}
