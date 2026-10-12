// Builds FAQPage structured data from an article's own visible content: every
// H3 heading phrased as a question, answered by the text blocks under it. No
// extra authoring is needed and nothing appears in the markup that the reader
// cannot see on the page.

type Block = { type?: unknown; level?: unknown; text?: unknown };

export interface FaqPair {
  question: string;
  answer: string;
}

const QUESTION_END = /[؟?]\s*$/;

export function extractFaqPairs(blocks: readonly Block[]): FaqPair[] {
  const pairs: FaqPair[] = [];
  let current: { question: string; parts: string[] } | null = null;
  const close = () => {
    if (current) {
      const answer = current.parts.join(" ").replace(/\s+/g, " ").trim();
      if (answer) pairs.push({ question: current.question, answer });
    }
    current = null;
  };
  for (const block of blocks) {
    if (block.type === "heading") {
      close();
      const text = String(block.text ?? "").trim();
      if (Number(block.level) === 3 && QUESTION_END.test(text)) current = { question: text, parts: [] };
    } else if (current && block.type === "text" && typeof block.text === "string") {
      current.parts.push(block.text.replace(/^[•\-]\s*/gm, ""));
    }
  }
  close();
  return pairs;
}

/** FAQPage schema, or null when the page has fewer than two answered questions. */
export function faqPageSchema(blocks: readonly Block[], pageUrl: string): Record<string, unknown> | null {
  return faqSchemaFromPairs(extractFaqPairs(blocks), pageUrl);
}

/** FAQPage schema from question/answer pairs the page shows as they are. */
export function faqSchemaFromPairs(pairs: readonly FaqPair[], pageUrl: string): Record<string, unknown> | null {
  if (pairs.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    inLanguage: "fa-IR",
    mainEntity: pairs.map((pair) => ({
      "@type": "Question",
      name: pair.question,
      acceptedAnswer: { "@type": "Answer", text: pair.answer },
    })),
  };
}
