export interface EvidenceDocument {
  id: string;
  year: string;
  category: "نتایج دانشجویان" | "تطبیق سؤال" | "طراحی سؤال" | "آموزش" | "کارنامه";
  subject: string;
  title: string;
  metric: string;
  description: string;
  telegramUrl: string;
  featured?: boolean;
}

export interface EvidenceStat {
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "blue" | "purple";
}

export const evidenceStats: EvidenceStat[] = [
  { label: "نمونه نتیجهٔ نظریه زبان‌ها و ماشین‌ها", value: "۱۰۰٪", detail: "یک نمونهٔ ثبت‌شده؛ نه تضمین نتیجهٔ مشابه", tone: "teal" },
  { label: "پاسخ صحیح ساختمان داده و الگوریتم", value: "۱۰ از ۱۱", detail: "سؤال معتبر در نمونهٔ منتشرشده", tone: "blue" },
  { label: "سؤال مشابه یا منطبق با مطالب کلاس", value: "۹ از ۱۲", detail: "نمونهٔ تطبیق برای کنکور ۱۴۰۵", tone: "purple" },
  { label: "تطبیق مطالب کلاس با سؤالات کنکور ۱۴۰۵", value: "۷۵٪", detail: "بر پایهٔ همان نمونهٔ ۱۲ سؤالی", tone: "teal" },
];

export const studentResults: EvidenceDocument[] = [
  { id: "theory-1405", year: "۱۴۰۵", category: "نتایج دانشجویان", subject: "نظریه زبان‌ها و ماشین‌ها", title: "نتیجهٔ نظریه", metric: "۱۰۰٪", description: "نمونهٔ نتیجهٔ منتشرشده از عملکرد درس نظریه.", telegramUrl: "https://t.me/Konkur_answer/4666", featured: true },
  { id: "data-11-1405", year: "۱۴۰۵", category: "نتایج دانشجویان", subject: "ساختمان داده و طراحی الگوریتم", title: "نتیجهٔ ساختمان داده", metric: "۱۰ پاسخ صحیح از ۱۱ سؤال معتبر", description: "نمونهٔ کارنامه/نتیجهٔ منتشرشده برای درس ساختمان داده و طراحی الگوریتم.", telegramUrl: "https://t.me/Konkur_answer/3609", featured: true },
  { id: "data-9-1405", year: "۱۴۰۵", category: "نتایج دانشجویان", subject: "ساختمان داده و طراحی الگوریتم", title: "نتیجهٔ ساختمان داده", metric: "۹ تست صحیح", description: "نمونهٔ دیگری از نتیجهٔ ثبت‌شدهٔ دانشجویان.", telegramUrl: "https://t.me/Konkur_answer/4767" },
  { id: "theory-students", year: "—", category: "نتایج دانشجویان", subject: "نظریه", title: "نمونه‌های نظریه", metric: "۱۰۰٪ نظریه", description: "نمونه‌های نام‌برده‌شده در مستندات آموزشی: آقای کریمی و شیوا خوش‌نام.", telegramUrl: "https://t.me/Konkur_answer/4751" },
  { id: "phd-results", year: "—", category: "کارنامه", subject: "نتیجهٔ دکتری", title: "نتیجهٔ دکتری", metric: "۱۶ پاسخ صحیح از ۱۹ تست", description: "همراه با رتبهٔ ۱۷ نرم‌افزار و رتبهٔ ۲۶ هوش در مستند منتشرشده.", telegramUrl: "https://t.me/Konkur_answer/4753", featured: true },
];

export const alignmentEvidence: EvidenceDocument = {
  id: "alignment-1405",
  year: "۱۴۰۵",
  category: "تطبیق سؤال",
  subject: "ساختمان داده و طراحی الگوریتم",
  title: "تطبیق آموزش با سؤالات واقعی کنکور",
  metric: "۹ سؤال از ۱۲ سؤال مشابه یا منطبق با مطالب تدریس‌شده",
  description: "این تطبیق برای نشان‌دادن هم‌پوشانی یک نمونهٔ آموزشی با آزمون واقعی ثبت شده است؛ به‌معنای پیش‌بینی یا تضمین نیست.",
  telegramUrl: "https://t.me/Konkur_answer/4767",
  featured: true,
};

export const questionDesignEvidence: EvidenceDocument = {
  id: "question-design-1401",
  year: "۱۴۰۱",
  category: "طراحی سؤال",
  subject: "ساختمان داده و الگوریتم",
  title: "از تحلیل سؤال تا طراحی سؤال",
  metric: "نمونه سؤال طراحی‌شده توسط مدرس که در کنکور مطرح شده است",
  description: "این سابقه برای شناخت سبک تحلیل و طراحی سؤال نمایش داده می‌شود، نه به‌عنوان تضمین پیش‌بینی آزمون.",
  telegramUrl: "https://t.me/Konkur_answer/3922",
  featured: true,
};

export const learningEvidence: EvidenceDocument[] = [
  { id: "amortized", year: "—", category: "آموزش", subject: "ساختمان داده", title: "تحلیل استهلاکی ساختمان داده", metric: "ویدئو / تحلیل سؤال", description: "مستند آموزشی مرتبط با تحلیل استهلاکی.", telegramUrl: "https://t.me/Konkur_answer/4014" },
  { id: "hash", year: "—", category: "آموزش", subject: "ساختمان داده", title: "Hash", metric: "جزوه / حل تمرین", description: "محتوای آموزشی مرتبط با Hash.", telegramUrl: "https://t.me/Konkur_answer/4050" },
  { id: "huffman", year: "—", category: "آموزش", subject: "الگوریتم", title: "Huffman", metric: "تحلیل سؤال", description: "محتوای آموزشی مرتبط با Huffman.", telegramUrl: "https://t.me/Konkur_answer/4049" },
  { id: "mst", year: "—", category: "آموزش", subject: "الگوریتم", title: "MST", metric: "ویدئو / حل تمرین", description: "محتوای آموزشی مرتبط با درخت پوشای کمینه.", telegramUrl: "https://t.me/Konkur_answer/4544" },
  { id: "recurrences", year: "—", category: "آموزش", subject: "الگوریتم", title: "روابط بازگشتی", metric: "جزوه / تحلیل", description: "محتوای آموزشی مرتبط با روابط بازگشتی.", telegramUrl: "https://t.me/Konkur_answer/4976" },
  { id: "quick-sort", year: "—", category: "آموزش", subject: "الگوریتم", title: "Quick Sort", metric: "حل تمرین", description: "محتوای آموزشی مرتبط با Quick Sort.", telegramUrl: "https://t.me/Konkur_answer/4978" },
  { id: "automata", year: "—", category: "آموزش", subject: "نظریه زبان‌ها", title: "نظریه زبان‌ها", metric: "ویدئو / جزوه", description: "نمونه‌ای از مسیر آموزش نظریه زبان‌ها.", telegramUrl: "https://t.me/Konkur_answer/4979" },
];

export const sourceDocuments: EvidenceDocument[] = [
  { id: "source-4980", year: "—", category: "آموزش", subject: "مستندات آموزشی", title: "مستند آموزشی ۴۹۸۰", metric: "مشاهدهٔ مستند", description: "لینک مستند اصلی ثبت‌شده در آرشیو.", telegramUrl: "https://t.me/Konkur_answer/4980" },
  { id: "source-4981", year: "—", category: "آموزش", subject: "مستندات آموزشی", title: "مستند آموزشی ۴۹۸۱", metric: "مشاهدهٔ مستند", description: "لینک مستند اصلی ثبت‌شده در آرشیو.", telegramUrl: "https://t.me/Konkur_answer/4981" },
  { id: "source-4986", year: "—", category: "آموزش", subject: "مستندات آموزشی", title: "مستند آموزشی ۴۹۸۶", metric: "مشاهدهٔ مستند", description: "لینک مستند اصلی ثبت‌شده در آرشیو.", telegramUrl: "https://t.me/Konkur_answer/4986" },
];
