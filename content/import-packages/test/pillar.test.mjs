import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pillarArticle } from "../lib/pillar.mjs";
import { PILLARS } from "../lib/pillars.mjs";

function packageArticle(slug) {
  return JSON.parse(readFileSync(new URL(`../packages/${slug}/payload.json`, import.meta.url), "utf8"))[0];
}

function linkedAnswer(guide, article) {
  const index = guide.content_blocks.findIndex((block) => block.type === "heading" && block.level === 3 && block.text === article.title);
  assert.ok(index >= 0, `${guide.slug} must contain a heading for ${article.slug}`);
  const answer = guide.content_blocks[index + 1];
  assert.equal(answer?.type, "text", `${article.slug} must have a text answer immediately after its heading`);
  return answer.text;
}

test("every pillar copies complete linked quick answers, including math and qualifications", () => {
  for (const pillar of PILLARS) {
    const guide = pillarArticle(pillar.slug);
    for (const [, , slugs] of pillar.clusters) {
      for (const slug of slugs) {
        const article = packageArticle(slug);
        assert.equal(linkedAnswer(guide, article), article.quick_answer, `${pillar.slug} must preserve all of ${slug}'s quick answer`);
      }
    }
  }
});

test("factorial, decimal values and the final context sentence survive in the preparation guide", () => {
  const guide = pillarArticle("master-computer-1406-preparation-guide");
  const factorial = linkedAnswer(guide, packageArticle("union-find-linear-sorting"));
  const decimal = linkedAnswer(guide, packageArticle("value-of-a-test-1406"));
  const context = linkedAnswer(guide, packageArticle("context-free-grammars-pda"));
  assert.match(factorial, /⌈log₂ n!⌉ مقایسه/);
  assert.match(decimal, /۱٫۴۳/);
  assert.match(decimal, /با فرض روش محاسبهٔ سال‌های قبل و تعداد تست ۱۴۰۴/);
  assert.match(context, /زیر اشتراک و مکمل نه\.$/);
});

test("pillar table cells keep their complete Persian lead text", () => {
  for (const pillar of PILLARS) {
    const table = pillarArticle(pillar.slug).content_blocks.find((block) => block.type === "table");
    assert.ok(table, `${pillar.slug} must contain a cluster table`);
    assert.deepEqual(
      table.rows.map((row) => row[2]),
      pillar.clusters.map((cluster) => cluster[1].replace(/:$/, "")),
      `${pillar.slug} must remove only a trailing colon, without removing the last letter or a full stop`,
    );
  }
});
