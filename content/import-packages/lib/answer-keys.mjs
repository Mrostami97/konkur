// The master's answer keys (analysis/keys.json) as answer-sheet blocks, shared
// by the answer-keys article and the year pages.
//
// Which keys are final: the source file says so (CE 1400, 1402, 1403: «کلید
// نهایی»; CE 1405: final key of booklet 135B), or the key carries deletions,
// multiple keys or positive effects, which only a final key announces. CE 1404
// and IT 1404/1405 are Sanjesh's initial key sheets.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const KEYS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/keys.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);

export const TRACK = { ce: { name: "مهندسی کامپیوتر", code: "۱۲۷۷" }, it: { name: "فناوری اطلاعات (IT)", code: "۱۲۷۶" } };
// keys.json keeps «1» as the CE booklet; the codes of the booklets themselves.
export const CE_BOOKLETS = { 1400: "830A", 1402: "934C", 1403: "164C", 1404: "335C", 1405: "135A" };
const FINAL_BY_SOURCE = { ce: [1400, 1402, 1403, 1405] };
// The final key of CE 1405 (booklet 135B) made q86 two-key; in 135A that is
// options 2 and 3 (confirmed by the owner, 2026-10-13).
const OVERRIDES = { ce: { 1405: { 86: [2, 3] } } };

export const bookletOf = (track, year) => (track === "ce" ? CE_BOOKLETS[year] : KEYS[track][year].booklet);

export function stage(track, year) {
  const y = KEYS[track][year];
  if (FINAL_BY_SOURCE[track]?.includes(year) || y.stages.final) return "final";
  if (y.questions.some((q) => q.deleted || q.positive || q.accepted.length > 1)) return "final";
  return "initial";
}

/** One plain line about a year's key: its stage, size and what the final key changed. */
export function keyLine(track, year) {
  const y = KEYS[track][year];
  const deleted = y.questions.filter((q) => q.deleted).map((q) => fa(q.n));
  const multi = y.questions.filter((q) => q.accepted.length > 1 || OVERRIDES[track]?.[year]?.[q.n]).map((q) => fa(q.n));
  const positive = y.questions.filter((q) => q.positive).map((q) => fa(q.n));
  const list = (ns) => (ns.length === 1 ? ns[0] : `${ns.slice(0, -1).join("، ")} و ${ns.at(-1)}`);
  const say = (ns, one, many) => `${ns.length === 1 ? "سؤال" : "سؤال‌های"} ${list(ns)} ${ns.length === 1 ? one : many}`;
  const parts = [];
  if (deleted.length) parts.push(say(deleted, "حذف شد", "حذف شدند"));
  if (multi.length) parts.push(say(multi, "دوکلیدی شد", "دوکلیدی شدند"));
  if (positive.length) parts.push(say(positive, "تأثیر مثبت گرفت", "تأثیر مثبت گرفتند"));
  const head = stage(track, year) === "final" ? "کلید نهایی سنجش" : "کلید اولیهٔ سنجش";
  return `${head}؛ ${fa(y.total)} سؤال.${parts.length ? ` ${parts.join("؛ ")}.` : ""}`;
}

/** A year's key as an answer sheet, grouped by the booklet's own sections. */
export function keyBlock(track, year) {
  const y = KEYS[track][year];
  const mixed = stage(track, year) === "final" && Boolean(y.stages.initial) && y.stages.initial < y.total && year !== 1405;
  const groups = [];
  for (const q of y.questions) {
    const name = (q.subject ?? "بدون عنوان").replace(/\s*\(.*?\)\s*$/, "");
    if (groups.at(-1)?.title !== name) groups.push({ title: name, items: [] });
    const override = OVERRIDES[track]?.[year]?.[q.n];
    const answer = q.deleted ? [] : override ?? q.accepted;
    const mark = q.deleted ? "deleted" : answer.length > 1 ? "multi" : q.positive ? "positive" : mixed && q.stage === "initial" ? "initial" : undefined;
    groups.at(-1).items.push({ n: q.n, answer, ...(mark ? { mark } : {}) });
  }
  return { type: "answer_key", groups, ...(mixed ? { caption: "خانه‌هایی که «اولیه» خورده‌اند در برگهٔ کلید نهایی ردیف نداشتند و پاسخشان از کلید اولیه است." } : {}) };
}
