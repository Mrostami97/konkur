export interface EvidenceDocument {
  id: string;
  year: string;
  category: "نتایج دانشجویان" | "تطبیق سؤال" | "طراحی سؤال" | "آموزش" | "کارنامه";
  subject: string;
  title: string;
  metric: string;
  description: string;
  /** The original archive post. Provenance only: the site shows its own copy
   * of the images and does not link to Telegram. */
  telegramUrl?: string;
  featured?: boolean;
  /** Topics the linked post covers, shown as chips. */
  topics?: string[];
  /** The student's name as the original post gives it. */
  student?: string;
  /** A second post that backs part of the claim; provenance only, like telegramUrl. */
  related?: { label: string; url: string };
  /** Copies of the post's images, served from /public/evidence. */
  images?: EvidenceImage[];
  /** The one number the scorecard leads with. Every value below must already appear in the post. */
  hero?: EvidenceFact;
  /** Up to three supporting numbers from the same post. */
  facts?: EvidenceFact[];
  /** How the student worked with me, as the owner described it. */
  role?: string;
}

export interface EvidenceFact {
  value: string;
  label: string;
}

export interface EvidenceImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface EvidenceVideo {
  src: string;
  title: string;
  description: string;
  duration: string;
  telegramUrl: string;
}

export interface EvidenceStat {
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "blue" | "purple";
}

// Every item below was checked against its post in the owner's archive channel
// (t.me/Konkur_answer) on 2026-09-23. Copy must not claim more than the post
// shows. Student names are copied exactly as the original post gives them; the
// owner asked for them to be shown (2026-09-24).

export const evidenceStats: EvidenceStat[] = [
  { label: "سؤالی که تألیف کرده بودم، در کنکور آمد", value: "۱۴۰۱", detail: "ساختمان داده و الگوریتم", tone: "teal" },
  { label: "سؤال‌های کنکور ۱۴۰۵ که در کلاس کار شده بود", value: "۹ از ۱۲", detail: "یعنی ۷۵٪ تست‌های ساختمان داده و الگوریتم", tone: "purple" },
  { label: "نظریه در نتیجهٔ دو شاگرد کلاس ۱۴۰۵", value: "۱۰۰٪", detail: "و یک شاگرد دیگر در ۱۴۰۳", tone: "blue" },
  { label: "پاسخ درست یکی از شاگردها در ساختمان داده و الگوریتم", value: "۱۰ از ۱۱", detail: "سؤال معتبر، کنکور ۱۴۰۵", tone: "teal" },
];

export const questionDesignEvidence: EvidenceDocument = {
  id: "question-design-1401",
  hero: { value: "سؤال ۶۱", label: "کنکور ۱۴۰۱، کنار سؤال تألیفی من" }, facts: [{ value: "سؤال ۶۹", label: "کنار سؤالی که پیش‌تر در کانال بود" }],
  year: "۱۴۰۱",
  category: "طراحی سؤال",
  subject: "ساختمان داده و الگوریتم",
  title: "سؤالی که تألیف کرده بودم، در کنکور ۱۴۰۱ آمد",
  metric: "سؤالی که تألیف کرده بودم، در کنکور ۱۴۰۱ مطرح شد",
  description:
    "در تصویر، سؤال ۶۱ کنکور ۱۴۰۱ کنار سؤالی گذاشته شده که خودم تألیف کرده بودم؛ سؤال ۶۹ همان سال هم کنار سؤالی که پیش‌تر در کانال گذاشته بودم. این دو مورد قول نمی‌دهند سؤال سال بعد را هم بشود حدس زد.",
  telegramUrl: "https://t.me/Konkur_answer/3060",
  featured: true,
  images: [{ src: "/evidence/1401-authored-question.jpg", alt: "سؤال‌های ۶۱ و ۶۹ کنکور ۱۴۰۱ کنار سؤال تألیفی مدرس", width: 556, height: 800 }],
};

export const alignmentEvidence: EvidenceDocument = {
  id: "alignment-1405",
  hero: { value: "۹ از ۱۲", label: "تست ساختمان داده و الگوریتم که در کلاس کار شده بود" }, facts: [{ value: "۱۰ تا ۱۱", label: "تست درست شاگردها، به گزارش خودشان" }],
  year: "۱۴۰۵",
  category: "تطبیق سؤال",
  subject: "ساختمان داده و طراحی الگوریتم",
  title: "از ۱۲ تست ساختمان داده و الگوریتم کنکور ۱۴۰۵، نُه‌تا در کلاس کار شده بود",
  metric: "۹ سؤال از ۱۲ سؤال مشابه یا منطبق با مطالب تدریس‌شده",
  description:
    "بعد از کنکور فایلی منتشر کردم که هر تست را کنار مطلب مشابهش در کلاس گذاشته است: نُه‌تا یا عین مطالب کلاس بود یا مشابهش. شاگردهای کلاس، طبق گزارش خودشان، در این درس ۱۰ تا ۱۱ تست را درست زدند. این مقایسه برای یک درس و یک سال است و نمی‌گوید سال بعد چه می‌آید.",
  telegramUrl: "https://t.me/Konkur_answer/4986",
  featured: true,
  topics: ["مرتب‌سازی سریع به کمک درجی", "هافمن با وزن‌های سری هندسی", "یکتایی درخت پوشای کمینه", "رابطهٔ بازگشتی", "ادغام لیست‌های مرتب"],
  related: { label: "فهرست مبحث‌ها", url: "https://t.me/Konkur_answer/4751" },
};

/** Single konkur questions that had been worked in class, year by year. */
export const matchedQuestions: EvidenceDocument[] = [
  {
    id: "phd-1405-plane-sweep",
    hero: { value: "سؤال ۷", label: "دکتری ۱۴۰۵، همان سؤال حل تمرین" },
    year: "۱۴۰۵",
    category: "تطبیق سؤال",
    subject: "دکتری · ساختمان داده و الگوریتم",
    title: "جاروب صفحه",
    metric: "سخت‌ترین سؤال",
    description: "سخت‌ترین سؤال این درس در دکتری مهندسی کامپیوتر ۱۴۰۵، خودِ همان سؤالی بود که در حل تمرین کلاس حل کرده بودیم.",
    telegramUrl: "https://t.me/Konkur_answer/4544",
    images: [
      { src: "/evidence/1405-phd-sweep-konkur.jpg", alt: "سؤال ۷ دکتری مهندسی کامپیوتر ۱۴۰۵ دربارهٔ نقاط تلاقی پاره‌خط‌های افقی و عمودی", width: 800, height: 222 },
      { src: "/evidence/1405-phd-sweep-class.jpg", alt: "حل همین سؤال با الگوریتم جاروب صفحه در جزوهٔ حل تمرین کلاس", width: 800, height: 681 },
    ],
  },
  {
    id: "master-1405-hash",
    hero: { value: "عین کلاس", label: "سخت‌ترین سؤال ارشد ۱۴۰۵" },
    year: "۱۴۰۵",
    category: "تطبیق سؤال",
    subject: "ارشد مهندسی · ساختمان داده",
    title: "درهم‌سازی",
    metric: "سخت‌ترین سؤال",
    description: "سخت‌ترین سؤال ارشد مهندسی کامپیوتر ۱۴۰۵، از بخش درهم‌سازی، عیناً سر کلاس حل شده بود.",
    telegramUrl: "https://t.me/Konkur_answer/4753",
    images: [{ src: "/evidence/1405-hash-class-problem.jpg", alt: "مسئلهٔ درهم‌سازی با زنجیره که سر کلاس حل شده بود", width: 651, height: 800 }],
  },
  {
    id: "master-1403-theory",
    hero: { value: "۲ از ۴", label: "تست جدید نظریه، مطابق جزوه" }, facts: [{ value: "۱", label: "تست حذف‌شده" }],
    year: "۱۴۰۳",
    category: "تطبیق سؤال",
    subject: "ارشد مهندسی · نظریه زبان‌ها",
    title: "نیمی از سؤال‌های جدید نظریه",
    metric: "۲ از ۴",
    description: "یک تست نظریه حذف شد. از چهار تست باقی‌مانده، دو تستِ جدید مطابق جزوهٔ کلاس بود و جوابشان در جزوه آمده بود.",
    telegramUrl: "https://t.me/Konkur_answer/3822",
    images: [{ src: "/evidence/1403-theory-notes.jpg", alt: "سؤال‌های ۴۷ و ۴۹ نظریهٔ ۱۴۰۳ کنار پاسخشان در جزوهٔ کلاس", width: 678, height: 800 }],
  },
];

export const studentResults: EvidenceDocument[] = [
  {
    id: "phd-1403",
    hero: { value: "۱۷", label: "رتبهٔ نرم‌افزار در دکتری" }, facts: [{ value: "۲۶", label: "رتبهٔ هوش مصنوعی" }, { value: "۱۱", label: "رتبه در کد ترکیب ۳" }, { value: "۱۶ از ۱۹", label: "تست درست ساختمان داده و الگوریتم" }], role: "شاگرد کلاس ساختمان داده و الگوریتم · امروز دکتری هوش مصنوعی شریف",
    student: "آرش ذوالفقاری",
    year: "۱۴۰۳",
    category: "کارنامه",
    subject: "دکتری مهندسی کامپیوتر",
    title: "رتبهٔ ۱۷ نرم‌افزار و ۲۶ هوش مصنوعی",
    metric: "رتبهٔ ۱۷ نرم‌افزار و ۲۶ هوش مصنوعی در دکتری",
    description:
      "شاگرد کلاس ساختمان داده و الگوریتم. از ۱۹ تستی که زد، ۱۶ تا درست بود، ۲ غلط و یکی حذف شد. حالا دانشجوی دکتری هوش مصنوعی دانشگاه شریف است.",
    telegramUrl: "https://t.me/Konkur_answer/3910",
    featured: true,
    related: { label: "پاسخ‌نامه", url: "https://t.me/Konkur_answer/3923" },
    images: [
      { src: "/evidence/phd-1403-karnameh.jpg", alt: "بخش رتبه‌های کارنامهٔ دکتری: رتبهٔ ۱۷، ۲۶ و ۱۱ در سه کد ترکیب", width: 800, height: 369 },
      { src: "/evidence/phd-1403-answers.jpg", alt: "پاسخ‌نامهٔ بیست تست اول دروس تخصصی کنار کلید", width: 800, height: 577 },
    ],
  },
  {
    id: "it-1405",
    hero: { value: "۳۸", label: "رتبهٔ ارشد فناوری اطلاعات" }, facts: [{ value: "کد ۱", label: "کد ضریب" }, { value: "۱۰ سال", label: "دوری از درس پیش از شروع" }], role: "شاگرد مشاوره",
    student: "حسین قبیله",
    year: "۱۴۰۵",
    category: "کارنامه",
    subject: "ارشد فناوری اطلاعات · شاگرد مشاوره",
    title: "رتبهٔ ۳۸ آی‌تی، بعد از ده سال دوری از درس",
    metric: "رتبهٔ ۳۸ ارشد فناوری اطلاعات",
    description: "شاگرد مشاورهٔ من بود. با مشغلهٔ زیاد و بعد از ده سال فاصله از درس، دوباره شروع کرد و در کد ضریب ۱ رتبهٔ ۳۸ آورد.",
    telegramUrl: "https://t.me/Konkur_answer/4981",
    featured: true,
    images: [{ src: "/evidence/1405-it-rank-38.jpg", alt: "کارنامهٔ ارشد فناوری اطلاعات ۱۴۰۵ با رتبهٔ ۳۸ در سهمیه؛ شمارهٔ داوطلبی پوشانده شده", width: 800, height: 450 }],
  },
  {
    id: "it-1403",
    hero: { value: "۸", label: "رتبهٔ ارشد آی‌تی" }, facts: [{ value: "۱۶", label: "بهترین رتبه در مهندسی کامپیوتر" }, { value: "۵۸٫۳۳٪", label: "ساختمان داده و الگوریتم" }], role: "شاگرد کلاس ساختمان داده و طراحی الگوریتم",
    student: "مبین شریفی‌راد",
    year: "۱۴۰۳",
    category: "کارنامه",
    subject: "ارشد آی‌تی و مهندسی کامپیوتر",
    title: "رتبهٔ ۸ آی‌تی و ۱۶ مهندسی کامپیوتر",
    metric: "رتبهٔ ۸ آی‌تی و ۱۶ مهندسی کامپیوتر",
    description:
      "شاگرد کلاس ساختمان داده و طراحی الگوریتم. در کنکور ارشد ۱۴۰۳ در آی‌تی رتبهٔ ۸ آورد و در مهندسی کامپیوتر، بسته به کد ضریب، رتبهٔ ۱۶ تا ۲۲. درصد ساختمان داده و الگوریتمش ۵۸٫۳۳ بود.",
    telegramUrl: "https://t.me/Konkur_answer/3997",
    featured: true,
    images: [{ src: "/evidence/it-1403-karnameh.png", alt: "کارنامهٔ ارشد فناوری اطلاعات ۱۴۰۳ با رتبهٔ ۸ در سهمیه؛ شمارهٔ داوطلبی خط خورده", width: 1011, height: 458 }],
  },
  {
    // Supplied by the owner as a screenshot on 2026-09-24, with its archive post.
    id: "ai-1401",
    hero: { value: "۸", label: "رتبهٔ شبکه و معماری، سهمیهٔ آزاد" }, facts: [{ value: "۱۱", label: "رتبهٔ هوش مصنوعی و نرم‌افزار" }, { value: "آزاد", label: "سهمیه" }], role: "شاگرد کلاس ساختمان داده، کلاس نظریه و مشاوره",
    student: "رضا مدرس",
    year: "۱۴۰۱",
    category: "کارنامه",
    subject: "ارشد مهندسی کامپیوتر · شاگرد کلاس و مشاوره",
    title: "رتبهٔ ۸ شبکه و معماری، ۱۱ هوش مصنوعی و نرم‌افزار",
    metric: "رتبهٔ ۸ شبکه و معماری و ۱۱ هوش مصنوعی و نرم‌افزار در ارشد مهندسی کامپیوتر",
    description:
      "شاگرد هر دو کلاس ساختمان داده و طراحی الگوریتم و نظریه زبان‌ها بود و مشاوره هم با من داشت. در ارشد مهندسی کامپیوتر ۱۴۰۱ با سهمیهٔ آزاد، در کد ضریب ۱، شبکه و امنیت، و کد ۳، معماری، رتبهٔ ۸ و در کد ۲، هوش مصنوعی، و کد ۴، نرم‌افزار، رتبهٔ ۱۱ آورد. درصد باکس ساختمان داده، الگوریتم و هوش مصنوعی ۳۸٫۳۳ و باکس مدار منطقی و معماری ۶۵ بود.",
    telegramUrl: "https://t.me/Konkur_answer/3739",
    featured: true,
    images: [{ src: "/evidence/1401-ai-rank-8.png", alt: "نمره‌ها و رتبه‌های کارنامهٔ ارشد مهندسی کامپیوتر ۱۴۰۱ در سهمیهٔ آزاد: رتبهٔ ۸ در کدهای ۱ و ۳، شبکه و معماری، و ۱۱ در کدهای ۲ و ۴، هوش مصنوعی و نرم‌افزار", width: 410, height: 540 }],
  },
  {
    id: "theory-1405-a",
    hero: { value: "۱۰۰٪", label: "نظریه زبان‌ها و ماشین‌ها" }, facts: [{ value: "۵ از ۵", label: "پاسخ یکی با کلید" }], role: "شاگرد کلاس نظریه",
    student: "آقای کاظمی",
    year: "۱۴۰۵",
    category: "نتایج دانشجویان",
    subject: "نظریه زبان‌ها و ماشین‌ها",
    title: "نظریه، کامل",
    metric: "۱۰۰٪",
    description: "یکی از شاگردهای کلاس نظریه. هر پنج پاسخش با کلید یکی است.",
    telegramUrl: "https://t.me/Konkur_answer/4980",
    images: [{ src: "/evidence/1405-theory-answers-a.jpg", alt: "پاسخ‌های نظریهٔ یکی از شاگردها کنار کلید، سؤال‌های ۴۶ تا ۵۰", width: 692, height: 361 }],
  },
  {
    id: "theory-1405-b",
    hero: { value: "۱۰۰٪", label: "نظریه زبان‌ها و ماشین‌ها" }, facts: [{ value: "۵ از ۵", label: "پاسخ یکی با کلید" }], role: "شاگرد کلاس نظریه",
    student: "آقای احمدی",
    year: "۱۴۰۵",
    category: "نتایج دانشجویان",
    subject: "نظریه زبان‌ها و ماشین‌ها",
    title: "نظریه، کامل",
    metric: "۱۰۰٪",
    description: "شاگرد دیگری از کلاس نظریه، همان سال؛ او هم هر پنج تست را درست زد.",
    telegramUrl: "https://t.me/Konkur_answer/4976",
    images: [{ src: "/evidence/1405-theory-answers-b.jpg", alt: "پاسخ‌های نظریهٔ یک شاگرد دیگر کنار کلید، سؤال‌های ۴۶ تا ۵۰", width: 354, height: 313 }],
  },
  {
    id: "data-1405-a",
    hero: { value: "۱۰ از ۱۱", label: "ساختمان داده و طراحی الگوریتم" }, facts: [{ value: "۱", label: "سؤال حذف‌شده" }],
    student: "سامان",
    year: "۱۴۰۵",
    category: "نتایج دانشجویان",
    subject: "ساختمان داده و طراحی الگوریتم",
    title: "همه‌چیز جز یک تست",
    metric: "۱۰ پاسخ درست از ۱۱ سؤال معتبر",
    description: "سؤال ۶۵ حذف شد و از ۱۱ سؤال باقی‌مانده فقط یکی را از دست داد. شمارهٔ سؤال‌ها در دفترچهٔ او با دفترچهٔ منتشرشدهٔ سنجش فرق دارد.",
    telegramUrl: "https://t.me/Konkur_answer/4978",
    images: [{ src: "/evidence/1405-data-answers-a.jpg", alt: "پاسخ‌های ساختمان داده و الگوریتم کنار کلید، سؤال‌های ۵۶ تا ۶۷", width: 299, height: 511 }],
    featured: true,
  },
  {
    id: "data-1405-b",
    hero: { value: "۹", label: "تست درست ساختمان داده و الگوریتم" }, facts: [{ value: "۰", label: "پاسخ غلط" }, { value: "۲", label: "سؤال سفید" }], role: "شاگرد کلاس",
    student: "آقای کاظمی",
    year: "۱۴۰۵",
    category: "نتایج دانشجویان",
    subject: "ساختمان داده و طراحی الگوریتم",
    title: "نُه تست درست",
    metric: "۹ تست صحیح",
    description: "یکی دیگر از شاگردهای کلاس. نُه تست درست، دو تست سفید و حتی یک غلط هم نداشت.",
    telegramUrl: "https://t.me/Konkur_answer/4979",
    images: [{ src: "/evidence/1405-data-answers-b.jpg", alt: "پاسخ‌های ساختمان داده و الگوریتم کنار کلید، با دو سؤال سفید", width: 247, height: 305 }],
  },
  {
    id: "theory-1403",
    hero: { value: "۱۰۰٪", label: "نظریه زبان‌ها و ماشین‌ها" }, facts: [{ value: "۴ از ۴", label: "تست نظریه" }, { value: "۴۴٫۴۴٪", label: "باکس سیگنال و نظریه" }],
    student: "آقای کریمی",
    year: "۱۴۰۳",
    category: "نتایج دانشجویان",
    subject: "نظریه زبان‌ها و ماشین‌ها",
    title: "نظریه، کامل",
    metric: "۱۰۰٪",
    description: "سؤال اول نظریه حذف شد و درصدش روی بقیهٔ باکس پخش شد. از ۹ تست باکس سیگنال و نظریه، هر ۴ تست نظریه را درست زد.",
    telegramUrl: "https://t.me/Konkur_answer/4014",
    images: [{ src: "/evidence/1403-theory-score.jpg", alt: "درصد ۴۴٫۴۴ در باکس نظریه و سیگنال در کارنامه", width: 400, height: 50 }],
  },
  {
    id: "theory-1403-khoshnam",
    hero: { value: "۱۰۰٪", label: "نظریه زبان‌ها و ماشین‌ها" }, facts: [{ value: "۴۴٫۴۴٪", label: "باکس سیگنال و نظریه" }, { value: "۱ تا ۲ هفته", label: "حل تمرین پیش از کنکور" }], role: "شاگرد کلاس نظریه",
    student: "شیوا خوش‌نام",
    year: "۱۴۰۳",
    category: "نتایج دانشجویان",
    subject: "نظریه زبان‌ها و ماشین‌ها",
    title: "نظریهٔ کامل، فقط با حل تمرین",
    metric: "۱۰۰٪",
    description:
      "شاگرد کلاس نظریه در ارشد مهندسی کامپیوتر ۱۴۰۳. خودش نوشت که فقط یکی دو هفتهٔ آخر مانده به کنکور کلاس حل تمرین نظریه را دید و قبلش تست نزده بود. در کارنامه، باکس نظریه و سیگنال ۴۴٫۴۴ است که با حذف یک سؤال نظریه، معادل ۱۰۰٪ نظریه است.",
    telegramUrl: "https://t.me/Konkur_answer/4016",
    images: [
      { src: "/evidence/1403-theory-khoshnam-score.jpg", alt: "درصد ۴۴٫۴۴ در باکس نظریه و سیگنال در کارنامه", width: 800, height: 101 },
      { src: "/evidence/1403-theory-khoshnam-message.jpg", alt: "پیام شاگرد دربارهٔ دیدن کلاس حل تمرین نظریه در دو هفتهٔ آخر", width: 800, height: 701 },
    ],
  },
];

export const studentVideo: EvidenceVideo = {
  src: "/evidence/phd-student-sources.mp4",
  title: "از زبان خودش: چه خواند و چطور",
  description: "آرش ذوالفقاری، همان شاگردی که در دکتری ۱۶ تست ساختمان داده و الگوریتم را درست زد و حالا دانشجوی دکتری هوش مصنوعی شریف است، دربارهٔ منابعی که خواند می‌گوید.",
  duration: "۱:۳۰",
  telegramUrl: "https://t.me/Konkur_answer/4828",
};

/** The owner's own konkur results, shown on /about. */
export const ownerResults: EvidenceDocument[] = [
  {
    id: "owner-phd-rank",
    year: "۱۴۰۱",
    category: "کارنامه",
    subject: "دکتری · نرم‌افزار و الگوریتم",
    title: "رتبهٔ ۳۲ بین ۱۳۷۰ نفر",
    metric: "رتبهٔ ۳۲",
    description: "کارنامهٔ دکتری ۱۴۰۱ خودم در رشتهٔ نرم‌افزار و الگوریتم؛ رتبهٔ ۳۲ در سهمیهٔ آزاد، بین ۱۳۷۰ نفری که سر جلسه بودند.",
    telegramUrl: "https://t.me/Konkur_answer/4666",
    images: [{ src: "/evidence/owner-phd-1401-karnameh.jpg", alt: "کارنامهٔ دکتری ۱۴۰۱ محمد رستمی با رتبهٔ ۳۲ در سهمیهٔ آزاد؛ شمارهٔ داوطلبی پوشانده شده", width: 800, height: 367 }],
  },
  {
    id: "owner-phd-answers",
    year: "۱۴۰۱",
    category: "کارنامه",
    subject: "دکتری · ساختمان داده و الگوریتم",
    title: "۱۷ از ۲۰ تست ساختمان داده و الگوریتم",
    metric: "۱۷ از ۲۰",
    description: "در کنکور دکتری ۱۴۰۱ از ۲۰ تست ساختمان داده و الگوریتم ۱۷ تا را درست زدم و ۳ تا را غلط. آن سه تا را بی‌دقتی گرفت؛ مطلبشان را در کلاس درس داده بودم.",
    telegramUrl: "https://t.me/Konkur_answer/4817",
    images: [{ src: "/evidence/owner-phd-answers.jpg", alt: "پاسخ‌نامهٔ دکتری ۱۴۰۱ محمد رستمی کنار کلید", width: 747, height: 800 }],
  },
];
