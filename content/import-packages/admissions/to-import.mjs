// Turns the parsed booklet (master-1405-capacities.json) into the
// "admissions-booklet.v1" file that /admin/admissions imports:
//
//   node to-import.mjs <out.json>
//
// The booklet prints one string per institution column: «دانشگاه صنعتی شریف
// - تهران», «دانشگاه تهران (محل تحصیل پردیس فارابی قم)», or just «دانشگاه
// یزد». This splits it into institution, campus and city of study. Where the
// booklet names no city, the city comes from the institution's name (CITY
// below) or from a «محل تحصیل …» note; a row that resolves to no city stops
// the script rather than guess.
import { readFileSync, writeFileSync } from "node:fs";

const rows = JSON.parse(readFileSync(new URL("./master-1405-capacities.json", import.meta.url), "utf8"));

const PERIOD = {
  "روزانه": "DAILY",
  "نوبت دوم": "EVENING",
  "پردیس خودگردان": "SELF_FUNDED_CAMPUS",
  "مجازی": "VIRTUAL",
  "غیرانتفاعی": "NON_PROFIT",
  "مجازی غیرانتفاعی": "VIRTUAL_NON_PROFIT",
  "پیام نور": "PAYAM_NOOR",
  "مجازی پیام نور": "VIRTUAL_PAYAM_NOOR",
};

const FIELDS = {
  "1277": { field: "computer-engineering", prefix: /^مهندسی و علم کامپیوتر گرایش / },
  "1276": { field: "information-technology", prefix: /^مهندسی فنّاوری اطلاعات گرایش / },
  "1209": { field: "computer-science", prefix: /^علوم کامپیوتر گرایش / },
};

/** Institutions the booklet prints without a city: the city their name or main campus is in. */
const CITY = {
  "دانشگاه اراک": "اراک",
  "دانشگاه اردکان": "اردکان",
  "دانشگاه ارومیه": "ارومیه",
  "دانشگاه اصفهان": "اصفهان",
  "دانشگاه ایلام": "ایلام",
  "دانشگاه بجنورد": "بجنورد",
  "دانشگاه بزرگمهر قائنات": "قائن",
  "دانشگاه بناب": "بناب",
  "دانشگاه بیرجند": "بیرجند",
  "دانشگاه تبریز": "تبریز",
  "دانشگاه تحصیلات تکمیلی صنعتی و فنّاوری پیشرفته کرمان": "کرمان",
  "دانشگاه تحصیلات تکمیلی علوم پایه زنجان": "زنجان",
  "دانشگاه تربت حیدریه": "تربت حیدریه",
  "دانشگاه تهران": "تهران",
  "دانشگاه جهرم": "جهرم",
  "دانشگاه دامغان": "دامغان",
  "دانشگاه زابل": "زابل",
  "دانشگاه زنجان": "زنجان",
  "دانشگاه سمنان": "سمنان",
  "دانشگاه شهرکرد": "شهرکرد",
  "دانشگاه شهید باهنر کرمان": "کرمان",
  "دانشگاه شهید چمران اهواز": "اهواز",
  "دانشگاه شیراز": "شیراز",
  "دانشگاه صنعتی ارومیه": "ارومیه",
  "دانشگاه صنعتی بیرجند": "بیرجند",
  "دانشگاه صنعتی سیرجان": "سیرجان",
  "دانشگاه صنعتی شاهرود": "شاهرود",
  "دانشگاه صنعتی شیراز": "شیراز",
  "دانشگاه صنعتی قم": "قم",
  "دانشگاه صنعتی کرمانشاه": "کرمانشاه",
  "دانشگاه صنعتی نوشیروانی بابل": "بابل",
  "دانشگاه صنعتی همدان": "همدان",
  "دانشگاه غیرانتفاعی ایوانکی": "ایوانکی",
  "دانشگاه غیرانتفاعی بین‌المللی اهل بیت علیهم السلام تهران": "تهران",
  "دانشگاه غیرانتفاعی بین‌المللی چابهار": "چابهار",
  "دانشگاه فردوسی مشهد": "مشهد",
  "دانشگاه قم": "قم",
  "دانشگاه کاشان": "کاشان",
  "دانشگاه ملایر": "ملایر",
  "دانشگاه میبد": "میبد",
  "دانشگاه نیشابور": "نیشابور",
  "دانشگاه ولی عصر(عج) رفسنجان": "رفسنجان",
  "دانشگاه یزد": "یزد",
  "مؤسسه غیرانتفاعی زند شیراز": "شیراز",
  "مؤسسه غیرانتفاعی شاهرود": "شاهرود",
  "مؤسسه غیرانتفاعی کیمیای کرمان": "کرمان",
  "مؤسسه غیرانتفاعی معراج علم سلماس": "سلماس",
  "مرکز آموزش عالی لار": "لار",
  // Main campus; rows studying elsewhere say so in a note or in brackets.
  "دانشگاه خوارزمی": "تهران",
  "دانشگاه صنعتی امیرکبیر": "تهران",
  "دانشگاه علم و صنعت ایران": "تهران",
  "دانشگاه محقق اردبیلی": "اردبیل",
  "دانشگاه صنعتی مالک اشتر": "تهران",
  "مؤسسه غیرانتفاعی ارشاد": "دماوند",
};

/** Cities of the campuses the booklet names in «(محل تحصیل …)». */
const CAMPUS_CITY = [
  [/شهرضا/, "شهرضا"],
  [/البرز .*واقع در تهران/, "تهران"],
  [/کیش/, "کیش"],
  [/فارابی قم/, "قم"],
  [/^کرج$/, "کرج"],
  [/گرمسار/, "گرمسار"],
  [/شعبه نور/, "نور"],
  [/نمین/, "نمین"],
  [/واحد تهران/, "تهران"],
];

/** Multi-branch institutions print the branch after the dash, not a city. */
const BRANCH_CITY = {
  "مرکز بین‌المللی عسلویه": "عسلویه",
  "تهران شمال": "تهران",
  "واحد ری": "ری",
  "مرکز نجف آباد": "نجف آباد",
  "واحد قشم": "قشم",
  "خوزستان": "اهواز",
};

const known = new Set([...Object.values(CITY), ...CAMPUS_CITY.map(([, c]) => c)]);

function place(r) {
  // «… (محل تحصیل X)»: the bracket may itself hold brackets.
  const open = r.university.indexOf(" (محل تحصیل ");
  const named = open < 0 ? r.university : r.university.slice(0, open);
  const location = open < 0 ? null : r.university.slice(open + " (محل تحصیل ".length, -1).trim();
  // «دانشگاه X - شهر - وابسته به …»
  const [university, dash] = named.split(" - ").map((s) => s.trim());
  const branch = dash && BRANCH_CITY[dash] ? dash : null;
  const dashCity = branch ? BRANCH_CITY[branch] : dash;
  const campusCity = location ? CAMPUS_CITY.find(([re]) => re.test(location))?.[1] : null;
  const noteCity = r.notes.split(" - ").map((n) => n.match(/^محل تحصیل (?:واحد )?(\S+)$/)?.[1]).find((c) => c && (known.has(c) || c === dashCity));
  const city = campusCity ?? noteCity ?? dashCity ?? CITY[university];
  if (!city || (location && !campusCity)) throw new Error(`${r.code}: no city for «${r.university}»`);
  return { university, location: location ?? branch, city };
}

const notes = (r) => r.notes.split(" - ");
/** Notes that make a code a different seat from a sibling with the same programme: a company grant or a reserved group. */
const variant = (r) => notes(r).filter((n) => /^(بورس|ویژه) /.test(n)).join(" - ");
const out = rows.map((r) => {
  const field = FIELDS[r.fieldCode];
  const period = PERIOD[r.period];
  if (!field || !period) throw new Error(`${r.code}: unknown field or period`);
  const orientation = r.program === r.fieldTitle ? "بدون گرایش" : r.program.replace(field.prefix, "");
  const { university, location, city } = place(r);
  return {
    selectionCode: r.code,
    examSetCode: r.fieldCode,
    coefficientGroup: r.coefficientGroup,
    period,
    university,
    ...(location ? { location } : {}),
    ...(variant(r) ? { variant: variant(r) } : {}),
    city,
    program: r.program,
    orientation,
    field: field.field,
    gender: notes(r).includes("فقط زن") ? "FEMALE" : notes(r).includes("فقط مرد") ? "MALE" : "ANY",
    hasDormitory: notes(r).some((n) => /^دارای خوابگاه/.test(n)),
    capacityFirstTerm: r.capacityFirstTerm,
    capacitySecondTerm: r.capacitySecondTerm,
    ...(r.notes ? { notes: r.notes } : {}),
    bookletPage: r.bookletPage,
  };
});

// An institution's city: the one its name says, else where most of its codes study.
for (const row of out) {
  if (CITY[row.university]) { row.universityCity = CITY[row.university]; continue; }
  const counts = new Map();
  for (const r of out.filter((o) => o.university === row.university)) counts.set(r.city, (counts.get(r.city) ?? 0) + 1);
  row.universityCity = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fa"))[0][0];
}

writeFileSync(process.argv[2], JSON.stringify({ schema_version: "admissions-booklet.v1", examYear: 1405, degree: "MASTER", rows: out }, null, 1) + "\n");
console.log(`${out.length} rows, ${new Set(out.map((r) => r.university)).size} institutions, ${new Set(out.map((r) => r.city)).size} cities`);
