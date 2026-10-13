// «Konkur tests on one topic, with worked solutions»: a family of articles, each
// a handful of real past master's questions from the owner's bank (text and
// key checked against the booklets) with a solution that reaches the key. Every
// solution was worked through independently (by hand or by simulation) and must
// land on the key; a question whose key could not be reproduced is left out.
const FA = "۰۱۲۳۴۵۶۷۸۹";
export const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });

const TRACK = { ce: "مهندسی کامپیوتر", it: "فناوری اطلاعات", cs: "علوم کامپیوتر" };
/** «مهندسی کامپیوتر ۱۳۹۵، سؤال ۷۱». */
export const sourceOf = (track, year, n) => `کنکور ارشد ${TRACK[track]} ${fa(year)}، سؤال ${fa(n)}`;

/**
 * spec: { slug, title, summary, quick, seo, intro, methods: string[], tests: [{ track, year, n, method, stem, tables?, options, answer, solution }],
 *         after?: blocks[], faq: [{ q, a }], links, tags, subjectCodes, subjectName, lessonHref? }
 */
export function topicTestsArticle(spec) {
  const { slug, tests } = spec;
  for (const t of tests) if (!(t.answer >= 1 && t.answer <= t.options.length)) throw new Error(`${slug}: bad answer for ${t.year}/${t.n}`);
  const years = [...new Set(tests.map((t) => t.year))].sort((a, b) => a - b);
  const tracks = [...new Set(tests.map((t) => t.track))];
  const blocks = [];
  blocks.push(text(spec.intro));
  blocks.push(text(`این صفحه ${fa(tests.length)} تست واقعی کنکور ارشد ${tracks.map((k) => TRACK[k]).join(" و ")} را از ${fa(years[0])} تا ${fa(years.at(-1))} با حل قدم‌به‌قدم آورده است. صورت و گزینه‌ها از دفترچهٔ همان سال است و جواب هر حل با کلید سازمان سنجش یکی است.`));
  if (spec.methods?.length) {
    blocks.push(h2("پیش از تست‌ها: چه چیزی را باید بلد باشی"));
    blocks.push(text(spec.methods.map((m) => `• ${m}`).join("\n")));
  }
  tests.forEach((t, i) => {
    blocks.push(h2(`تست ${fa(i + 1)}: ${t.method}`));
    blocks.push(text(`${sourceOf(t.track, t.year, t.n)}.`));
    blocks.push(text(t.stem));
    for (const tb of t.tables ?? []) {
      if (tb.caption) blocks.push(text(tb.caption));
      blocks.push({ type: "table", headers: tb.headers, rows: tb.rows });
    }
    blocks.push(text(t.options.map((o, k) => `${fa(k + 1)}) ${o}`).join("\n")));
    blocks.push(text(`پاسخ: گزینهٔ ${fa(t.answer)}. ${t.solution}`));
  });
  if (spec.after) blocks.push(...spec.after);
  blocks.push(h2("پرسش‌های رایج"));
  for (const { q, a } of spec.faq) {
    blocks.push(h3(q));
    blocks.push(text(a));
  }
  blocks.push(h2("قدم بعدی"));
  blocks.push({ type: "link_group", items: spec.links });

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-lesson-${slug}`,
    content_type: "article",
    title: spec.title,
    slug,
    summary: spec.summary,
    quick_answer: spec.quick,
    content_blocks: blocks,
    seo: spec.seo,
    taxonomy: { major: ["کامپیوتر و IT"], tags: [...spec.tags, "حل تست"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: spec.subjectCodes, topic_codes: [] },
    validity: { exam_year: 1406, time_sensitive: false, source_checked_at: "2026-10-13T00:00:00.000Z" },
    sources: [
      {
        source_external_id: "editorial-source-bd8f7cb1262dd65dec24",
        relation: "SUPPORTS",
        locator: `دفترچه‌های سؤال و کلیدهای کنکور کارشناسی ارشد ${tracks.map((k) => TRACK[k]).join(" و ")}، ${fa(years[0])} تا ${fa(years.at(-1))}`,
        claim: "صورت، گزینه‌ها و کلید هر تست",
        order: 0,
      },
      {
        source_external_id: "editorial-source-50f3b52142efac0715d8",
        relation: "SUPPORTS",
        locator: "اطلاعیه و جدول مجموعه‌های امتحانی کارشناسی ارشد ناپیوسته سال ۱۴۰۶",
        claim: `جای ${spec.subjectName} در کنکور ۱۴۰۶`,
        order: 1,
      },
    ],
    editorial: { author_slug: "mohammad-rostami" },
    provenance: {
      producer_type: "external_ai",
      producer_name: "انتخاب تست از بانک سؤال کنکور کامپیوتر و حل تشریحی با Claude، هم‌خوان با کلید هر تست — نیازمند بازبینی و تأیید محمد رستمی",
      source_artifact: `content/import-packages/articles/${slug}.mjs`,
    },
    review_status: "draft",
  };
}
