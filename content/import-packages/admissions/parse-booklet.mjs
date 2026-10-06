// Reads the capacity tables of Sanjesh's 1405 master's field-selection booklet
// (دفترچهٔ راهنمای انتخاب رشته، کارشناسی ارشد ناپیوسته ۱۴۰۵) from PDF pages the
// owner extracted, and writes one JSON row per code (کد رشته‌محل):
//
//   node parse-booklet.mjs <out.json> <booklet-pages.pdf>...
//
// Only the computer fields are kept (FIELDS below); pages the owner cut out
// also hold the end or start of neighbouring fields' tables.
//
// The tables are read by position, not by text order: pdf.js returns the
// cells of a right-to-left table interleaved. Every row is anchored on its
// five-digit code; a cell that wraps over several lines is centred on its
// row, so each column's lines are split between rows by least squares.
// pdfjs-dist comes from apps/web (run from there or have it resolvable).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../../../apps/web/package.json", import.meta.url));
const { getDocument } = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

/**
 * Words whose «لا» the booklet's font maps to «ال». Every word with «ال» in the
 * 1405 pages was checked by hand; the rest (الکترونیکی، امسال، مالک اشتر، چالوس…)
 * are spelled that way.
 */
export const LAM_ALEF = {
  "اطالعات": "اطلاعات",
  "تحصيالت": "تحصیلات",
  "انقالب": "انقلاب",
  "اسالمي": "اسلامی",
  "كالس": "کلاس",
  "گيالن": "گیلان",
  "عالمه": "علامه",
  "مالير": "ملایر",
  "اعالمي": "اعلامی",
  "الهوري": "لاهوری",
  "الهيجان": "لاهیجان",
  "اميركال": "امیرکلا",
  "ايالم": "ایلام",
  "الر": "لار",
  "السالم": "السلام",
  "المعي": "لامعی",
  "سرخنكالته": "سرخنکلاته",
};

const persian = (s) => s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();

/** The booklet prints half-spaces (ورودی‌های، نرم‌افزار); text extraction turns them into spaces. */
const HALF_SPACES = [
  [/ (های|ها)(?![؀-ۿ])/g, "‌$1"],
  [/(?<![؀-ۿ])می (شود|باشد)/g, "می‌$1"],
  [/نرم افزار/g, "نرم‌افزار"],
  [/(داده|قرآن) کاوی/g, "$1‌کاوی"],
  [/جرم یابی/g, "جرم‌یابی"],
  [/(رایانه|رشته) ای/g, "$1‌ای"],
  [/بین رشته/g, "بین‌رشته"],
  [/بین (المللی|الملل)/g, "بین‌$1"],
];
const halfSpaces = (s) => HALF_SPACES.reduce((t, [from, to]) => t.replace(from, to), s);
// The booklet mixes Arabic ي/ك with Persian ی/ک, so words are matched after normalising.
const LAM_ALEF_FIXES = new Map(Object.entries(LAM_ALEF).map(([broken, word]) => [persian(broken), word]));
const LAM_ALEF_WORD = new RegExp(`(?<![\\u0600-\\u06FF])(${[...LAM_ALEF_FIXES.keys()].join("|")})(?![\\u0600-\\u06FF])`, "g");
const fix = (s) => halfSpaces(persian(s).replace(LAM_ALEF_WORD, (w) => LAM_ALEF_FIXES.get(w)));

// Column limits on the 595-pt page, by the right edge of a text run (the
// table is right-aligned); the code column is matched by its five digits.
const COLUMNS = [
  ["period", 462, Infinity],
  ["university", 300, 432],
  ["field", 186, 300],
  ["first", 166, 186],
  ["second", 151, 166],
  ["notes", 0, 151],
];

/** Splits lines (sorted top to bottom) into one contiguous run per anchor, minimising each run's distance from its anchor (and, lightly, its height, or one tall run could straddle several rows). */
function assign(lines, anchors) {
  const n = lines.length, m = anchors.length;
  const cost = (i, j, a) => { const ys = lines.slice(i, j).map((l) => l.y); const top = Math.max(...ys), bottom = Math.min(...ys); return ((top + bottom) / 2 - anchors[a]) ** 2 + 0.01 * (top - bottom) ** 2; };
  const best = Array.from({ length: m + 1 }, () => Array(n + 1).fill(Infinity));
  const from = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let a = 1; a <= m; a++) for (let j = 0; j <= n; j++) for (let i = 0; i <= j; i++) {
    const c = best[a - 1][i] + (i === j ? 0 : cost(i, j, a - 1));
    if (c < best[a][j]) { best[a][j] = c; from[a][j] = i; }
  }
  const out = Array.from({ length: m }, () => []);
  for (let a = m, j = n; a > 0; a--) { const i = from[a][j]; out[a - 1] = lines.slice(i, j); j = i; }
  return out;
}

/** Field codes kept: علوم کامپیوتر، مهندسی فناوری اطلاعات، مهندسی و علم کامپیوتر. */
const FIELDS = new Set(["1209", "1276", "1277"]);

const rows = [];
for (const file of process.argv.slice(3)) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true, verbosity: 0 }).promise;
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items
      .filter((it) => it.str.trim())
      .map((it) => ({ x: it.transform[4], y: it.transform[5], right: it.transform[4] + it.width, str: it.str }));
    // A page can hold several tables, each under a title naming the field
    // code and coefficient group. Only the page top repeats the column header.
    const titles = [];
    for (const it of items) if (/كد ضريب/.test(it.str)) {
      const line = items.filter((o) => Math.abs(o.y - it.y) < 2).sort((a, b) => b.x - a.x).map((o) => o.str).join(" ");
      const m = line.match(/(\d{4})\s*-\s*(.+?)\s*\(\s*كد ضريب\s*(\d+)\s*\)/);
      if (!m) throw new Error(`${file} p${p}: unreadable table title «${line}»`);
      titles.push({ y: it.y, fieldCode: m[1], fieldTitle: fix(m[2]), coefficientGroup: Number(m[3]) });
    }
    titles.sort((a, b) => b.y - a.y);
    const tableOf = (y) => titles.filter((t) => t.y > y).at(-1);
    // The printed page number, bottom of the page: the citation for each row.
    const bookletPage = Number(items.find((it) => it.y < 75 && /^\d{3}$/.test(it.str.trim()))?.str.trim()) || null;
    const header = items.find((it) => it.str.trim() === "دوم");
    const body = items.filter((it) => it.y > 75 && it.y < (header ? header.y - 3 : 790) && !titles.some((t) => Math.abs(t.y - it.y) < 2));
    const anchors = body.filter((it) => /^\d{5}$/.test(it.str.trim()) && it.x > 425 && it.x < 445).sort((a, b) => b.y - a.y);
    if (anchors.length === 0) continue;
    const cells = anchors.map(() => ({}));
    for (const [name, lo, hi] of COLUMNS) {
      // Merge the runs of one printed line, right to left.
      const lines = [];
      for (const it of body.filter((o) => !anchors.includes(o) && o.right > lo && o.right <= hi && o.y < anchors[0].y + 30).sort((a, b) => b.y - a.y || b.x - a.x)) {
        const last = lines.at(-1);
        if (last && Math.abs(last.y - it.y) < 3) last.text += " " + it.str; else lines.push({ y: it.y, text: it.str });
      }
      // A line belongs to the table it is printed under.
      const groups = new Map();
      for (const l of lines) { const t = tableOf(l.y); (groups.get(t) ?? groups.set(t, []).get(t)).push(l); }
      for (const [t, ls] of groups) {
        const idx = anchors.map((a, i) => i).filter((i) => tableOf(anchors[i].y) === t);
        assign(ls, idx.map((i) => anchors[i].y))
          .forEach((run, k) => { cells[idx[k]][name] = run.map((l) => l.text).join(" "); });
      }
    }
    anchors.forEach((a, i) => {
      const t = tableOf(a.y);
      if (!t) throw new Error(`${file} p${p}: code ${a.str} outside any table`);
      const c = cells[i];
      // A term with no intake prints «-»; anything else means a misread cell.
      const num = (s = "") => {
        if (/^\d+$/.test(s.trim())) return Number(s.trim());
        if (/^-?$/.test(s.trim())) return 0;
        throw new Error(`${file} p${p}: code ${a.str} has capacity «${s}»`);
      };
      const university = fix(c.university ?? "");
      if (num(c.first) + num(c.second) === 0 || !university || !c.field || !c.period) throw new Error(`${file} p${p}: code ${a.str} is incomplete`);
      rows.push({
        code: a.str.trim(),
        examYear: 1405,
        fieldCode: t.fieldCode,
        fieldTitle: t.fieldTitle,
        coefficientGroup: t.coefficientGroup,
        period: fix(c.period ?? ""),
        university,
        program: fix(c.field ?? ""),
        capacityFirstTerm: num(c.first),
        capacitySecondTerm: num(c.second),
        notes: fix(c.notes ?? ""),
        bookletPage,
      });
    });
  }
}
const kept = rows.filter((r) => FIELDS.has(r.fieldCode)).sort((a, b) => a.code.localeCompare(b.code));
writeFileSync(process.argv[2], JSON.stringify(kept, null, 1) + "\n");
console.log(`${kept.length} rows of ${rows.length}`);
