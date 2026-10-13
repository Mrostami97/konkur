// Data for the web page /budget («بودجه‌بندی هوشمند»): question counts per
// subject and year (bank_stats.json, track_stats.json) and, for 1277, the
// median section percentages of published report cards per rank band
// (subject_stats.json). Aggregates only. Writes
// apps/web/src/content/budget-data.json.
//
//   node analysis/budget_page_data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const bank = JSON.parse(readFileSync(here("./bank_stats.json"), "utf8"));
const tracks = JSON.parse(readFileSync(here("./track_stats.json"), "utf8"));
const subj = Object.values(JSON.parse(readFileSync(here("./subject_stats.json"), "utf8")));

// Subjects of the 1406 exam per set (Sanjesh 1406 announcement).
const IN1406 = {
  ce: ["زبان", "ریاضیات گسسته", "آمار و احتمال مهندسی", "داده‌ساختارها و الگوریتم‌ها", "نظریه زبان‌ها و ماشین‌ها", "مدار منطقی", "معماری کامپیوتر", "سیستم‌های عامل", "هوش مصنوعی"],
  it: ["زبان", "ریاضیات گسسته", "داده‌ساختارها و الگوریتم‌ها", "سیستم‌های عامل", "شبکه‌های کامپیوتری", "پایگاه داده", "هوش مصنوعی"],
};
const NEW1406 = { ce: ["جبر خطی", "مبانی کامپیوتر و برنامه‌سازی"], it: ["آمار و احتمال مهندسی", "مبانی کامپیوتر و برنامه‌سازی"] };
const PAGE = {
  "زبان": "english", "ریاضیات گسسته": "discrete-math", "آمار و احتمال مهندسی": "statistics", "داده‌ساختارها و الگوریتم‌ها": "data-structures-algorithms",
  "نظریه زبان‌ها و ماشین‌ها": "automata", "مدار منطقی": "digital-logic", "معماری کامپیوتر": "computer-architecture", "سیستم‌های عامل": "operating-systems",
  "هوش مصنوعی": "artificial-intelligence", "شبکه‌های کامپیوتری": "computer-networks", "پایگاه داده": "databases",
};

function track(key, code, name) {
  const years = Object.keys(bank[key]).map(Number).sort((a, b) => a - b);
  const names = new Set();
  for (const y of years) for (const s of Object.keys(bank[key][y].subjects)) names.add(s);
  const subjects = [...names].map((s) => {
    const counts = years.map((y) => bank[key][y].subjects[s] ?? 0);
    return { name: s, counts, total: counts.reduce((a, b) => a + b, 0), in1406: IN1406[key].includes(s), article: PAGE[s] && IN1406[key].includes(s) ? `/articles/${PAGE[s]}-questions-per-year` : null };
  });
  subjects.sort((a, b) => Number(b.in1406) - Number(a.in1406) || b.counts.at(-1) - a.counts.at(-1) || b.total - a.total);
  return { code, name, years, totals: years.map((y) => bank[key][y].total), subjects, new1406: NEW1406[key] };
}

// 1209: only group 3 of the booklet is in the bank for every year.
const csYears = Object.keys(tracks.cs).map(Number).filter((y) => y >= 1386).sort((a, b) => a - b);
const csGroup = ["ساختمان داده و الگوریتم", "نظریهٔ محاسبه و اتوماتا", "مبانی کامپیوتر"];
const cs = {
  code: "1209",
  name: "علوم کامپیوتر",
  years: csYears,
  totals: null,
  subjects: csGroup.map((s) => {
    const counts = csYears.map((y) => tracks.cs[y][s] ?? 0);
    return { name: s, counts, total: counts.reduce((a, b) => a + b, 0), in1406: s !== "مبانی کامپیوتر", article: null };
  }),
  new1406: [],
  note: "برای علوم کامپیوتر فقط گروه ساختمان داده، الگوریتم و نظریهٔ محاسبه در همهٔ سال‌ها در بانک است.",
};

// Rank map, 1277: median section percentage and net correct questions per band.
const BANDS = ["1-30", "31-100", "101-300", "301-1000", "1001-3000"];
const rankMap = {};
for (const year of [1404, 1405]) {
  rankMap[year] = {
    sections: subj.map((s) => s.name),
    bands: BANDS.filter((b) => subj.every((s) => s.recent[`${year}|${b}`])).map((b) => ({
      band: b,
      n: subj[0].recent[`${year}|${b}`].n,
      cells: subj.map((s) => {
        const r = s.recent[`${year}|${b}`];
        return { med: Math.round(r.med * 10) / 10, q1: Math.round(r.q1 * 10) / 10, q3: Math.round(r.q3 * 10) / 10, net: Math.round(r.net * 10) / 10, tests: r.tests, zero: Math.round(r.zero * 100) };
      }),
    })),
  };
}

const out = {
  generatedFrom: "bank_stats.json, track_stats.json, subject_stats.json (aggregates only)",
  tracks: { ce: track("ce", "1277", "مهندسی کامپیوتر"), it: track("it", "1276", "فناوری اطلاعات"), cs },
  rankMap,
  coefficients1406: {
    ce: [["زبان", 1], ["ریاضیات", 2], ["تخصصی", 4]],
    it: [["زبان", 1], ["ریاضیات", 2], ["تخصصی", 4]],
  },
};
const target = fileURLToPath(new URL("../../../apps/web/src/content/budget-data.json", import.meta.url));
writeFileSync(target, JSON.stringify(out) + "\n");
console.log("wrote", target, (JSON.stringify(out).length / 1024).toFixed(1), "KB;", Object.keys(rankMap[1404].bands).length, "bands 1404,", rankMap[1405].bands.length, "bands 1405");
