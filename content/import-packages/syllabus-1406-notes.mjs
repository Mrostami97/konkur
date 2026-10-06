// The 1406 syllabus of «داده‌ساختارها و الگوریتم‌ها» (official post t.me/kunkurcomputer/138,
// listed on /subjects/data-structures-algorithms from apps/web/src/content/editorial.ts)
// dropped several topics the site's lessons still teach. The owner chose (2026-10-07) to
// keep those lessons published with a note saying so. This adds the notes to the live
// text kept in live-overrides/ (pull it first with sync-live.mjs), so a build never
// reverts the owner's edits:  node syllabus-1406-notes.mjs
import { readFileSync, writeFileSync } from "node:fs";

/** Topics a konkur DS & algorithms course used to cover that the 1406 syllabus list does not name. */
export const OFF_SYLLABUS =
  "الگوریتم‌های حریصانه (از جمله کد هافمن)، برنامه‌ریزی پویا، NP-کامل و کاهش، درخت پوشای کمینه (پریم و کراسکال)، کوتاه‌ترین مسیر بین همهٔ زوج‌ها (فلوید)، شار شبکه، عقبگرد و شاخه‌وکران، تطابق رشته، درخت AVL، درخت B و هرم‌های دوجمله‌ای و فیبوناچی";

export const GENERAL_NOTE = `سرفصل «داده‌ساختارها و الگوریتم‌ها» در ۱۴۰۶ عوض شده است. این مباحث در فهرست سرفصل تازه نیامده‌اند: ${OFF_SYLLABUS}. فهرست کامل سرفصل در صفحهٔ درس داده‌ساختارها و الگوریتم‌ها آمده است. برای ارشد ۱۴۰۶ اول مباحث سرفصل را تمام کن؛ درس‌نامه‌های بیرون از سرفصل برای مرور تست‌های سال‌های قبل منتشر مانده‌اند.`;

const note = (topic) => ({ type: "text", text: `برای ارشد ۱۴۰۶: ${topic} در سرفصل تازهٔ «داده‌ساختارها و الگوریتم‌ها» نیامده‌اند. این بخش برای مرور تست‌های سال‌های قبل مانده است.` });

const file = "live-overrides/master-computer-1406-preparation-guide.json";
const guide = JSON.parse(readFileSync(file, "utf8"));
const blocks = guide.content_blocks;
if (blocks.some((b) => typeof b.text === "string" && b.text.startsWith("سرفصل «داده‌ساختارها و الگوریتم‌ها» در ۱۴۰۶ عوض شده است"))) {
  console.log("already noted");
} else {
  const at = (pred, label) => {
    const i = blocks.findIndex(pred);
    if (i < 0) throw new Error(`block not found: ${label}`);
    return i;
  };
  // Bottom up, so earlier indexes stay valid.
  const np = at((b) => b.type === "heading" && b.text.startsWith("NP-کامل و کاهش"), "NP heading");
  blocks.splice(np + 2, 0, note("NP-کامل و کاهش"));
  const huffman = at((b) => b.type === "heading" && b.text.startsWith("کد هافمن"), "Huffman heading");
  blocks.splice(huffman + 2, 0, note("کد هافمن و الگوریتم‌های حریصانه"));
  const lessons = at((b) => b.type === "heading" && b.level === 2 && b.text === "درس‌نامه‌های کوتاه", "lessons section");
  blocks.splice(lessons + 1, 0, { type: "text", text: GENERAL_NOTE });
  writeFileSync(file, JSON.stringify(guide, null, 2));
  console.log("noted: general, Huffman, NP");
}
