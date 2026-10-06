import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// Text blocks mark bullets with "•" and steps with "۱." on their own lines.
// HTML collapses newlines, so ContentBlocks must turn runs of marked lines into
// real lists and keep other lines as separate paragraphs. Transpiled like
// faq-schema.mjs because CI's Node cannot import .tsx directly.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const source = await readFile(new URL("../src/components/ContentBlocks.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
// The formula splitter is loaded for real, so its handling of $...$ is covered too.
const mathSource = await readFile(new URL("../src/lib/math-text.ts", import.meta.url), "utf8");
const mathModule = { exports: {} };
new Function("module", "exports", ts.transpileModule(mathSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mathModule, mathModule.exports);
const mathRenderSource = await readFile(new URL("../src/lib/math-render.ts", import.meta.url), "utf8");
function loadMathRenderer(renderer) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(mathRenderSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("module", "exports", "require", compiled)(module, module.exports, (id) => id === "katex"
    ? { __esModule: true, default: renderer } : require(id));
  return module.exports;
}
const renderer = { renderToString: (latex) => `[${latex}]` };
const stubs = {
  "next/link": { __esModule: true, default: (props) => React.createElement("a", { href: props.href }, props.children) },
  "../lib/math-render": loadMathRenderer(renderer),
  "../lib/api": { API_URL: "" },
  "../lib/math-text": mathModule.exports,
  "./video/VideoPlayer": { VideoPlayer: (props) => React.createElement("video", { src: props.src }) },
};
const mod = { exports: {} };
new Function("module", "exports", "require", js)(mod, mod.exports, (id) => stubs[id] ?? require(id));
const render = (text) => renderToStaticMarkup(React.createElement(mod.exports.ContentBlocks, { blocks: [{ type: "text", text }] }));

assert.equal(render("یک پاراگراف."), '<div class="cb"><p>یک پاراگراف.</p></div>');
assert.equal(
  render("مقدمه:\n• اول\n• دوم"),
  '<div class="cb"><p>مقدمه:</p><ul class="cb-list"><li>اول</li><li>دوم</li></ul></div>',
  "bullet lines become a list after their lead-in paragraph",
);
assert.equal(
  render("۱. قدم اول\n۲. قدم دوم"),
  '<div class="cb"><ol class="cb-list" start="1"><li>قدم اول</li><li>قدم دوم</li></ol></div>',
  "numbered lines become an ordered list",
);
assert.equal(render("۱. یک خط"), '<div class="cb"><p>۱. یک خط</p></div>', "a single numbered line, such as an answer option, stays a paragraph");
assert.equal(render("خط اول\nخط دوم"), '<div class="cb"><p>خط اول</p><p>خط دوم</p></div>', "plain lines keep their line breaks");
assert.equal(render("−۱۰ درصد منفی است"), '<div class="cb"><p>−۱۰ درصد منفی است</p></div>');
assert.equal(
  render("مرتبهٔ $O(n)$ است"),
  '<div class="cb"><p>مرتبهٔ <span class="cb-imath" dir="ltr">[O(n)]</span> است</p></div>',
  "an inline formula is typeset inside its sentence",
);
assert.equal(
  render("• گام $a$\n• گام $b$"),
  '<div class="cb"><ul class="cb-list"><li>گام <span class="cb-imath" dir="ltr">[a]</span></li><li>گام <span class="cb-imath" dir="ltr">[b]</span></li></ul></div>',
  "formulas work inside list items too",
);
assert.equal(render("قیمت \\$۵"), '<div class="cb"><p>قیمت $۵</p></div>', "an escaped dollar stays a dollar");

// Exercise the original defect: a non-parse exception must not turn a
// formula into executable markup, including staff draft previews.
renderer.renderToString = () => { throw new RangeError("forced render failure"); };
const hostile = '<img src=x onerror="void 0">&\'';
const fallback = renderToStaticMarkup(React.createElement(mod.exports.ContentBlocks, { blocks: [{ type: "latex", latex: hostile }] }));
assert.ok(!fallback.includes("<img"), "formula failure never inserts a raw HTML tag");
assert.ok(fallback.includes("&lt;img"), "formula failure preserves the source as escaped visible text");
assert.ok(!render(`فرمول $${hostile}$`).includes("<img"), "inline formulas share the same safe fallback");
const realRenderer = loadMathRenderer(require("katex"));
const deepFormula = "{".repeat(5000) + hostile;
assert.equal(realRenderer.renderLatex(deepFormula).includes("<img"), false, "real KaTeX recursion errors are escaped too");
assert.ok(realRenderer.renderLatex("x^2+1").includes("katex"), "valid formulas retain real KaTeX rendering");

console.log("ContentBlocks: text layout, valid math and escaped exception fallbacks verified.");
