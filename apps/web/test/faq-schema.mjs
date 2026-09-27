import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// CI runs Node 20, which cannot import .ts directly; transpile the module the
// same way scripts/generate-editorial-drafts.mjs does.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../src/lib/faq-schema.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { extractFaqPairs, faqPageSchema } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const h2 = (text) => ({ type: "heading", level: 2, text });
const h3 = (text) => ({ type: "heading", level: 3, text });
const p = (text) => ({ type: "text", text });

const blocks = [
  p("مقدمه که سؤال نیست."),
  h2("سؤال‌هایی که احتمالاً داری"),
  h3("ریاضی‌ام ضعیف است. شانسی دارم؟"),
  p("بله."),
  p("• ریاضیات گسسته را اول بخوان."),
  h3("شاغلم. می‌توانم هم‌زمان بخوانم؟"),
  p("می‌توانی."),
  h3("این تیتر سؤال نیست"),
  p("این متن جواب هیچ سؤالی نیست."),
  h3("سؤال بی‌جواب؟"),
  h2("قدم بعدی"),
  p("متن پایانی."),
];

const pairs = extractFaqPairs(blocks);
assert.deepEqual(pairs, [
  { question: "ریاضی‌ام ضعیف است. شانسی دارم؟", answer: "بله. ریاضیات گسسته را اول بخوان." },
  { question: "شاغلم. می‌توانم هم‌زمان بخوانم؟", answer: "می‌توانی." },
], "only question-shaped H3 headings with a visible answer become FAQ entries, and bullet marks are dropped");

const schema = faqPageSchema(blocks, "https://kunkurcomputer.ir/articles/x");
assert.equal(schema["@type"], "FAQPage");
assert.equal(schema["@id"], "https://kunkurcomputer.ir/articles/x#faq");
assert.equal(schema.mainEntity.length, 2);
assert.equal(schema.mainEntity[0].acceptedAnswer.text, "بله. ریاضیات گسسته را اول بخوان.");

assert.equal(faqPageSchema([h3("فقط یک سؤال؟"), p("یک جواب.")], "https://kunkurcomputer.ir/a"), null, "a single question is not an FAQ page");
assert.equal(faqPageSchema([h2("یک سؤال؟"), p("H2 is not a FAQ question."), h2("دو؟"), p("x")], "https://kunkurcomputer.ir/a"), null, "only H3 headings count");

console.log("FAQ schema tests passed: question headings, answers, bullets and the two-question minimum were verified.");
