// The "capacity 1405" family: how many seats each master's code (کد رشته‌محل)
// of the three computer fields offered in Sanjesh's 1405 field-selection
// booklet. Every number comes from admissions/master-1405-capacities.json,
// parsed from the booklet pages by admissions/parse-booklet.mjs and checked
// against the printed pages.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROWS = JSON.parse(readFileSync(fileURLToPath(new URL("../admissions/master-1405-capacities.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const pct = (part, whole) => `${fa(Math.round((1000 * part) / whole) / 10)}٪`;
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const seats = (r) => r.capacityFirstTerm + r.capacitySecondTerm;
const sum = (rows) => rows.reduce((a, r) => a + seats(r), 0);
const byFa = (a, b) => a.localeCompare(b, "fa");
/** «الف، ب و ج». */
const andList = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join("، ")} و ${items[items.length - 1]}`);

/** Periods in the booklet's order; روزانه is the only tuition-free one. */
const PERIODS = ["روزانه", "نوبت دوم", "پردیس خودگردان", "مجازی", "غیرانتفاعی", "مجازی غیرانتفاعی", "پیام نور", "مجازی پیام نور"];

export const FIELDS = {
  ce: {
    code: "1277",
    slug: "master-computer-engineering-capacity-1405",
    name: "مهندسی کامپیوتر",
    short: "ارشد مهندسی کامپیوتر",
    full: "مهندسی و علم کامپیوتر",
    prefix: /^مهندسی و علم کامپیوتر گرایش /,
    guide: "/guides/master-computer-engineering-1406",
    groups: {
      1: { label: "شبکه و رایانش امن", href: "/articles/coefficient-code-1-network-security" },
      2: { label: "هوش مصنوعی", href: "/articles/coefficient-code-2-artificial-intelligence" },
      3: { label: "معماری سیستم‌های کامپیوتری", href: "/articles/coefficient-code-3-architecture" },
      4: { label: "نرم‌افزار و علم داده", href: "/articles/coefficient-code-4-software" },
    },
    pages: "۴۷۱ تا ۴۹۰",
  },
  it: {
    code: "1276",
    slug: "master-it-capacity-1405",
    name: "فناوری اطلاعات (IT)",
    short: "ارشد IT",
    full: "مهندسی فناوری اطلاعات",
    prefix: /^مهندسی فنّاوری اطلاعات گرایش /,
    guide: "/guides/master-information-technology-1406",
    groups: {
      1: { label: "فناوری اطلاعات" },
      2: { label: "مهندسی اطلاعات پزشکی" },
    },
    pages: "۴۶۷ تا ۴۷۱",
  },
  cs: {
    code: "1209",
    slug: "master-computer-science-capacity-1405",
    name: "علوم کامپیوتر",
    short: "ارشد علوم کامپیوتر",
    full: "علوم کامپیوتر",
    prefix: /^علوم کامپیوتر گرایش /,
    guide: "/guides/master-computer-science-1406",
    groups: {
      1: { label: "نظریه، محاسبات و هوش مصنوعی" },
      2: { label: "داده‌کاوی، علم داده و بیوانفورماتیک" },
    },
    pages: "۳۱۷ تا ۳۲۰",
  },
};

/** The programme without the field's own name: «نرم‌افزار», or «بدون گرایش». */
const orientation = (field, r) => (r.program === r.fieldTitle ? "بدون گرایش" : r.program.replace(field.prefix, ""));

const SOURCES = (field) => [
  {
    source_external_id: "editorial-source-bd8f7cb1262dd65dec24",
    relation: "SUPPORTS",
    locator: `دفترچهٔ راهنمای انتخاب رشتهٔ آزمون کارشناسی ارشد ناپیوستهٔ ۱۴۰۵، جدول رشته‌محل‌های ${fa(field.code)} - ${field.full}، صفحه‌های ${field.pages}`,
    claim: `ظرفیت، دوره، گرایش و توضیحات هر کد رشته‌محل ${field.name} در ۱۴۰۵`,
    order: 0,
  },
];

const META = (field, tags) => ({
  taxonomy: { major: ["کامپیوتر و IT"], tags: [...tags, "انتخاب رشته", "ظرفیت پذیرش"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
  validity: { exam_year: 1405, time_sensitive: true, source_checked_at: "2026-10-07T00:00:00.000Z", review_due_at: "2027-07-01T00:00:00.000Z" },
  sources: SOURCES(field),
  editorial: { author_slug: "mohammad-rostami" },
  provenance: {
    producer_type: "external_ai",
    producer_name: "شمارش با Claude روی جدول‌های ظرفیت دفترچهٔ انتخاب رشتهٔ ارشد ۱۴۰۵ سازمان سنجش — نیازمند بازبینی و تأیید محمد رستمی",
    source_artifact: `content/import-packages/articles/${field.slug}.mjs`,
  },
  review_status: "draft",
});

/** The restrictions a candidate must see before choosing a code. */
const KEY_NOTES = [
  [/فقط زن/, "فقط زن"],
  [/فقط مرد/, "فقط مرد"],
  [/مصاحبه دارد/, "مصاحبه"],
  [/پیوست شماره یک/, "شرایط ویژه (پیوست ۱)"],
  [/^بورس /, "بورس شرکت"],
  [/^ویژه /, "ویژهٔ گروهی خاص"],
  [/آموزش محور/, "آموزش‌محور"],
];

export function capacityArticle(key) {
  const field = FIELDS[key];
  const rows = ROWS.filter((r) => r.fieldCode === field.code);
  const total = sum(rows);
  const daily = rows.filter((r) => r.period === "روزانه");
  const dailyTotal = sum(daily);
  const institutions = (rs) => new Set(rs.map((r) => r.university)).size;

  const periods = PERIODS.map((p) => [p, rows.filter((r) => r.period === p)]).filter(([, rs]) => rs.length);
  const orientations = new Map();
  for (const r of rows) {
    const o = orientation(field, r);
    const entry = orientations.get(o) ?? { group: r.coefficientGroup, daily: 0, all: 0, codes: 0 };
    entry.all += seats(r);
    entry.codes += 1;
    if (r.period === "روزانه") entry.daily += seats(r);
    orientations.set(o, entry);
  }
  const ranked = [...orientations].sort((a, b) => b[1].all - a[1].all);
  const top = ranked.slice(0, 2);

  const dailyBy = new Map();
  for (const r of daily) dailyBy.set(r.university, (dailyBy.get(r.university) ?? 0) + seats(r));
  const topDaily = [...dailyBy].sort((a, b) => b[1] - a[1] || byFa(a[0], b[0])).slice(0, 5);

  const notesOf = (r) => KEY_NOTES.filter(([re]) => r.notes.split(" - ").some((n) => re.test(n))).map(([, label]) => label);
  const count = (re) => rows.filter((r) => r.notes.split(" - ").some((n) => re.test(n)));
  const women = count(/فقط زن/), men = count(/فقط مرد/), interview = count(/مصاحبه دارد/), annex = count(/پیوست شماره یک/), grants = count(/^بورس /);

  const quick = `در دفترچهٔ انتخاب رشتهٔ ۱۴۰۵، ${field.short} (مجموعهٔ ${fa(field.code)}) ${fa(total)} ظرفیت در ${fa(rows.length)} کد رشته‌محل داشت؛ ${fa(dailyTotal)} ظرفیت آن (${pct(dailyTotal, total)}) روزانه و بدون شهریه بود. بیشترین ظرفیت را ${andList(top.map(([o, e]) => `${o} (${fa(e.all)})`))} داشتند.`;

  const blocks = [];
  blocks.push(text(`این صفحه شمارش جدول‌های ظرفیت ${field.full} در دفترچهٔ راهنمای انتخاب رشتهٔ کارشناسی ارشد ۱۴۰۵ سازمان سنجش است: ${fa(rows.length)} کد رشته‌محل، با دوره، گرایش، ظرفیت و توضیحات هر کد. دفترچهٔ انتخاب رشتهٔ ۱۴۰۶ بعد از اعلام کارنامهٔ اولیهٔ ۱۴۰۶ منتشر می‌شود و ظرفیت‌ها هر سال کمی عوض می‌شوند؛ تا آن موقع، این عددها بهترین تصویر از اندازهٔ هر گرایش و هر دانشگاه است.`));

  blocks.push(h2("ظرفیت به تفکیک دوره"));
  blocks.push({
    type: "table",
    headers: ["دوره", "کد رشته‌محل", "دانشگاه یا مؤسسه", "ظرفیت", "سهم از کل"],
    rows: [
      ...periods.map(([p, rs]) => [p, fa(rs.length), fa(institutions(rs)), fa(sum(rs)), pct(sum(rs), total)]),
      ["جمع", fa(rows.length), fa(institutions(rows)), fa(total), "۱۰۰٪"],
    ],
  });
  blocks.push(text(`فقط دورهٔ روزانه بدون شهریه است؛ ${andList(periods.map(([p]) => p).filter((p) => p !== "روزانه"))} شهریه دارند و میزان شهریه را خود دانشگاه یا مؤسسه اعلام می‌کند. ظرفیت دو نیمسال با هم جمع شده است؛ تقریباً همهٔ کدها فقط در نیمسال اول دانشجو می‌گیرند.`));

  blocks.push(h2("ظرفیت هر گرایش"));
  const groupKeys = Object.keys(field.groups).map(Number);
  if (groupKeys.length > 1) {
    blocks.push(text(`رشته‌محل‌های ${field.name} در دفترچه زیر ${fa(groupKeys.length)} کد ضریب آمده‌اند: ${groupKeys.map((g) => `کد ضریب ${fa(g)} (${field.groups[g].label})`).join("، ")}. هر کد ضریب، درس‌های آزمون را با ضریب‌های خودش حساب می‌کند؛ برای همین رتبهٔ هر داوطلب در هر کد ضریب جداست و هر گرایش را باید با رتبهٔ همان کد سنجید.`));
  }
  blocks.push({
    type: "table",
    headers: ["گرایش", "کد ضریب", "کد رشته‌محل", "ظرفیت روزانه", "ظرفیت همهٔ دوره‌ها"],
    rows: ranked.map(([o, e]) => [o, fa(e.group), fa(e.codes), fa(e.daily), fa(e.all)]),
  });

  blocks.push(h2("ظرفیت روزانه در هر دانشگاه"));
  blocks.push(text(`${fa(daily.length)} کد روزانه در ${fa(institutions(daily))} دانشگاه، با ${fa(dailyTotal)} ظرفیت. بیشترین ظرفیت روزانه: ${andList(topDaily.map(([u, n]) => `${u} (${fa(n)})`))}. ستون «نکته» شرط‌هایی را نشان می‌دهد که پیش از انتخاب باید بدانی؛ توضیح کامل هر کد در دفترچه است.`));
  for (const g of groupKeys) {
    const rs = daily.filter((r) => r.coefficientGroup === g).sort((a, b) => byFa(a.university, b.university) || byFa(orientation(field, a), orientation(field, b)) || a.code.localeCompare(b.code));
    if (!rs.length) continue;
    if (groupKeys.length > 1) blocks.push(h3(`کد ضریب ${fa(g)}: ${field.groups[g].label}`));
    blocks.push({
      type: "table",
      headers: ["دانشگاه", "گرایش", "ظرفیت", "کد رشته‌محل", "نکته"],
      rows: rs.map((r) => [r.university, orientation(field, r), fa(seats(r)), fa(r.code), notesOf(r).join("، ") || "—"]),
    });
  }

  blocks.push(h2("دوره‌های شهریه‌ای"));
  blocks.push(text("ظرفیت دوره‌های شهریه‌ای، جمع همهٔ گرایش‌های هر دانشگاه یا مؤسسه در آن دوره. کد هر رشته‌محل و گرایش‌هایش در دفترچه آمده است."));
  for (const [p, rs] of periods.filter(([p]) => p !== "روزانه")) {
    const by = new Map();
    for (const r of rs) {
      const e = by.get(r.university) ?? { n: 0, o: new Set() };
      e.n += seats(r);
      e.o.add(orientation(field, r));
      by.set(r.university, e);
    }
    blocks.push(h3(`${p}: ${fa(sum(rs))} ظرفیت در ${fa(by.size)} دانشگاه یا مؤسسه`));
    blocks.push({
      type: "table",
      headers: ["دانشگاه یا مؤسسه", "ظرفیت", "گرایش‌ها"],
      rows: [...by].sort((a, b) => b[1].n - a[1].n || byFa(a[0], b[0])).map(([u, e]) => [u, fa(e.n), [...e.o].sort(byFa).join("، ")]),
    });
  }

  blocks.push(h2("پیش از انتخاب رشته به این‌ها دقت کن"));
  blocks.push(text([
    women.length || men.length ? `• ${fa(women.length)} کد فقط زن و ${fa(men.length)} کد فقط مرد می‌پذیرند؛ کدی را که برای تو نیست انتخاب نکن.` : null,
    interview.length ? `• ${fa(interview.length)} کد مصاحبه دارند؛ قبولی نهایی آن‌ها به مصاحبه هم بستگی دارد.` : null,
    annex.length ? `• ${fa(annex.length)} کد شرط‌هایی دارند که در پیوست شمارهٔ یک دفترچه آمده است؛ پیش از انتخاب، شرط همان کد را بخوان.` : null,
    grants.length ? `• ${fa(grants.length)} کد بورسیهٔ یک شرکت‌اند؛ شرط‌های بورس را پیش از انتخاب از همان شرکت یا دانشگاه بپرس.` : null,
    "• ظرفیت زیاد یعنی صندلی بیشتر، نه لزوماً رتبهٔ قبولی بالاتر؛ رقابت هر رشته‌محل را با رتبه‌های قبولی سال‌های قبل بسنج.",
    "• خوابگاه را هم ببین: بسیاری از کدها «فاقد خوابگاه» یا «معرفی به خوابگاه‌های خودگردان» دارند.",
  ].filter(Boolean).join("\n")));

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3(`ارشد ${field.name} ۱۴۰۵ چند ظرفیت داشت؟`));
  blocks.push(text(`${fa(total)} ظرفیت در ${fa(rows.length)} کد رشته‌محل؛ ${fa(dailyTotal)} روزانه و ${fa(total - dailyTotal)} در دوره‌های شهریه‌ای.`));
  blocks.push(h3("کدام گرایش بیشترین ظرفیت را داشت؟"));
  blocks.push(text(`${andList(top.map(([o, e]) => `${o} با ${fa(e.all)} ظرفیت (${fa(e.daily)} روزانه)`))}.`));
  blocks.push(h3("کدام دانشگاه بیشترین ظرفیت روزانه را داشت؟"));
  blocks.push(text(`${topDaily[0][0]} با ${fa(topDaily[0][1])} ظرفیت روزانه در همهٔ گرایش‌ها، و بعد ${andList(topDaily.slice(1, 3).map(([u, n]) => `${u} (${fa(n)})`))}.`));
  blocks.push(h3("ظرفیت ۱۴۰۶ کی اعلام می‌شود؟"));
  blocks.push(text("با دفترچهٔ راهنمای انتخاب رشتهٔ ۱۴۰۶، که سازمان سنجش بعد از اعلام کارنامهٔ اولیه منتشر می‌کند. این صفحه بعد از انتشار آن به‌روز می‌شود. ملاک نهایی، دفترچه و اطلاعیه‌های رسمی سازمان سنجش است."));

  blocks.push(h2("قدم بعدی"));
  blocks.push({
    type: "link_group",
    items: [
      { label: "رتبهٔ قبولی هر دانشگاه در ارشد کامپیوتر", href: "/articles/admitted-ranks-by-university" },
      { label: "جدول کامل رتبه‌های قبولی", href: "/articles/master-computer-admitted-ranks-full-table" },
      { label: "کد ضریب‌ها به زبان ساده", href: "/articles/coefficient-codes-explained" },
      ...groupKeys.filter((g) => field.groups[g].href).map((g) => ({ label: `کد ضریب ${fa(g)}: ${field.groups[g].label}`, href: field.groups[g].href })),
      { label: "راهنمای انتخاب رشتهٔ ارشد کامپیوتر", href: "/guides/master-computer-admissions-guide" },
      { label: `راهنمای کامل ارشد ${field.name} ۱۴۰۶`, href: field.guide },
      ...(key === "ce" ? [{ label: "تخمین رتبه با درصدها", href: "/rank-calculator/master-computer-engineering" }] : []),
      { label: "مشاورهٔ انتخاب رشته", href: "/consultations" },
    ],
  });

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${field.slug}`,
    content_type: "article",
    title: `ظرفیت ارشد ${field.name} ۱۴۰۵: هر گرایش و هر دانشگاه چند ظرفیت داشت؟`,
    slug: field.slug,
    summary: `ظرفیت همهٔ ${fa(rows.length)} کد رشته‌محل ${field.full} (مجموعهٔ ${fa(field.code)}) در دفترچهٔ انتخاب رشتهٔ ارشد ۱۴۰۵: به تفکیک دوره، گرایش و دانشگاه، با شرط‌های هر کد.`,
    quick_answer: quick,
    content_blocks: blocks,
    seo: {
      title: `ظرفیت ارشد ${field.name} ۱۴۰۵ به تفکیک گرایش و دانشگاه`,
      description: `ارشد ${field.name} ۱۴۰۵ چند ظرفیت داشت؟ ${fa(total)} ظرفیت در ${fa(rows.length)} کد رشته‌محل؛ ظرفیت روزانه و شهریه‌ای هر گرایش و هر دانشگاه از دفترچهٔ انتخاب رشته.`,
    },
    ...META(field, [`ارشد ${field.name}`]),
  };
}
