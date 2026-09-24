// Typed reconstructions of the evidence images, so the page can draw each one
// as a clean graphic instead of showing a phone screenshot. Every value was
// transcribed from the image named beside it (2026-09-24) and nothing is added:
// a blank on the scorecard stays "سفید", a deleted question stays "حذف". The
// original image is always one click away from the rebuilt version.
//
// Inline math is written between $…$ and rendered with KaTeX.

export type ScoreValue = number | "سفید";

export interface ScorecardRebuild {
  kind: "scorecard";
  /** The original image this was transcribed from. */
  source: string;
  exam: string;
  attendees?: number;
  subjects?: { name: string; percent: ScoreValue }[];
  codes?: { code: number; label?: string; score?: number; rank: number; rankNoQuota?: number }[];
  /** Label for the codes table; PhD scorecards call them کد ترکیب. */
  codeWord?: "کد ضریب" | "کد ترکیب";
}

export interface AnswerSheetRebuild {
  kind: "answers";
  source: string;
  section: string;
  rows: { q: number; answer: number | "سفید"; key: number | "حذف"; keyNote?: string }[];
}

export interface QuestionPanel {
  label: string;
  tone: "konkur" | "class";
  text: string;
  options?: string[];
  /** Short typed notes from a handwritten page. */
  notes?: string[];
  ltr?: boolean;
}

export interface QuestionsRebuild {
  kind: "questions";
  source: string;
  panels: QuestionPanel[];
}

export interface MessageRebuild {
  kind: "message";
  source: string;
  date: string;
  quoted?: string;
  lines: string[];
}

export type EvidenceRebuild = ScorecardRebuild | AnswerSheetRebuild | QuestionsRebuild | MessageRebuild;

export const evidenceRebuilds: Record<string, EvidenceRebuild[]> = {
  "question-design-1401": [
    {
      kind: "questions",
      source: "/evidence/1401-authored-question.jpg",
      panels: [
        {
          label: "سؤال ۶۱ کنکور ۱۴۰۱",
          tone: "konkur",
          text:
            "گراف جهت‌دار و وزن‌دار $G=(V,E)$ با $n$ رأس و $O(n)$ یال و زیرمجموعهٔ $S\\subseteq V$ از رأس‌های گراف با اندازهٔ حداقل $\\frac{n}{2}$ داده شده است. وزن تمام یال‌ها مثبت است. فاصلهٔ رأس $u$ از مجموعهٔ $S$ برابر است با $d(u,S)=\\min_{v\\in S}\\delta(u,v)$ که $\\delta(u,v)$ طول کوتاه‌ترین مسیر جهت‌دار از $u$ به $v$ است. در چه مرتبهٔ زمانی می‌توان $d(u,S)$ را به‌ازای تمام رأس‌های $u$ محاسبه کرد؟",
          options: ["$O(n^3)$", "$O(n^2)$", "$O(n\\log^2 n)$", "$O(n\\log n)$"],
        },
        {
          label: "سؤال تألیفی من، پیش از کنکور",
          tone: "class",
          text:
            "گراف جهت‌دار و وزن‌دار $G=(V,E)$ با $n$ رأس و وزن یال‌های مثبت داده شده است. زیرمجموعهٔ $S\\subset V$ را در نظر بگیرید. فاصلهٔ هر رأس $u\\in V\\setminus S$ از مجموعهٔ $S$ برابر است با $d(u,S)=\\min_{v\\in S}\\delta(u,v)$. می‌خواهیم به‌ازای تمام رأس‌های $u\\in V\\setminus S$ فاصلهٔ $u$ از $S$ را محاسبه کنیم. الگوریتمی با مرتبهٔ زمانی $O(n^2)$ برای حل این مسئله ارائه دهید.",
        },
        {
          label: "سؤال ۶۹ کنکور ۱۴۰۱",
          tone: "konkur",
          text:
            "جست‌وجوی عنصر $x$ در آرایهٔ $A$ با $n$ عنصر: احتمال حضور $x$ در نیمهٔ دوم آرایه سه برابر نیمهٔ اول است و در هر نیمه، احتمال حضور در هر خانه یکسان است. تعداد مقایسه‌های جست‌وجوی خطی برای یافتن $x$ به‌طور متوسط چقدر است؟ (طول آرایه زوج است، $x$ در آرایه هست و جست‌وجو از ابتدای آرایه شروع می‌شود.)",
          options: ["$n$", "$\\frac{5n}{8}$", "$\\frac{3n}{4}$", "$\\frac{n}{2}$"],
        },
        {
          label: "مسئلهٔ ۱ که پیش‌تر در کانال گذاشته بودم",
          tone: "class",
          text:
            "جست‌وجوی خطی: جست‌وجوی عنصر $x$ در آرایهٔ $A$ با $n$ عنصر. احتمال حضور $x$ در نیمهٔ دوم آرایه سه برابر نیمهٔ اول است و در هر نیمه، احتمال حضور در هر خانه یکسان است. با این فرض، الگوریتم جست‌وجوی خطی را در بدترین، بهترین و حالت متوسط بررسی کنید.",
        },
      ],
    },
  ],

  "phd-1405-plane-sweep": [
    {
      kind: "questions",
      source: "/evidence/1405-phd-sweep-konkur.jpg",
      panels: [
        {
          label: "سؤال ۷ دکتری مهندسی کامپیوتر ۱۴۰۵ (کد ۲۳۵۴)",
          tone: "konkur",
          text:
            "$n$ قطعه‌خط افقی و $m$ قطعه‌خط عمودی داده شده‌اند. می‌خواهیم تعداد نقاط تلاقی آن‌ها را با یک الگوریتم کارا (مستقل از تعداد جواب) به‌دست آوریم. این کار در چه زمانی ممکن است؟",
          options: ["$O(n+m\\log(n+m))$", "$O(n+m\\log n)$", "$O((n+m)\\log(n+m))$", "$O(n+m\\log m)$"],
        },
        {
          label: "جزوهٔ حل تمرین کلاس، پیش از کنکور",
          tone: "class",
          text: "همین سؤال، با همین چهار گزینه، در حل تمرین کلاس حل شده بود و گزینهٔ $O((n+m)\\lg(n+m))$ علامت خورده بود.",
          notes: [
            "تعداد جواب‌ها می‌تواند $O(n\\times m)$ باشد، پس نباید تلاقی‌ها را یکی‌یکی شمرد.",
            "الگوریتم جاروب صفحه (sweep line): ابتدا خطوط افقی و دو سر خطوط عمودی را مرتب کنید: $O((n+m)\\lg(n+m))$.",
            "یک خط افقی و یک خط عمودی وقتی تلاقی دارند که $c\\in[a,b]$.",
          ],
        },
      ],
    },
  ],

  "master-1405-hash": [
    {
      kind: "questions",
      source: "/evidence/1405-hash-class-problem.jpg",
      panels: [
        {
          label: "مسئله‌ای که سر کلاس حل شد",
          tone: "class",
          ltr: true,
          text:
            "Suppose that we have a hash table with $n$ slots, with collisions resolved by chaining, and suppose that $n$ keys are inserted into the table. Each key is equally likely to be hashed to each slot. Let $M$ be the maximum number of keys in any slot after all the keys have been inserted. Your mission is to prove an $O(\\lg n/\\lg\\lg n)$ upper bound on $E[M]$.",
          notes: [
            "a. The probability $Q_k$ that exactly $k$ keys hash to a particular slot is $Q_k=\\left(\\frac{1}{n}\\right)^k\\left(1-\\frac{1}{n}\\right)^{n-k}\\binom{n}{k}$.",
            "b. Let $P_k$ be the probability that $M=k$. Show that $P_k\\le nQ_k$.",
          ],
        },
      ],
    },
  ],

  "master-1403-theory": [
    {
      kind: "questions",
      source: "/evidence/1403-theory-notes.jpg",
      panels: [
        {
          label: "سؤال ۴۷ مهندسی کامپیوتر ۱۴۰۳",
          tone: "konkur",
          text: "کدام مورد، درست است؟",
          options: [
            "زبان‌های شمارش‌پذیر بازگشتی، نسبت به عمل مکمل بسته‌اند.",
            "تعداد ماشین‌های تورینگ غیرهم‌ارز، برابر با تعداد زبان‌هاست.",
            "تمام زبان‌های پذیرفته‌شده توسط ماشین تورینگ، شمارش‌پذیر بازگشتی هستند.",
            "به ازای تمام زبان‌هایی که ماشین تورینگ پذیرنده دارند، می‌توان الگوریتم عضویت پیشنهاد داد.",
          ],
        },
        {
          label: "پاسخ آن در جزوهٔ کلاس",
          tone: "class",
          text: "زبان بازگشتی شمارش‌پذیر (R.E) = تورینگ‌تشخیص‌پذیر = تشخیص‌پذیر.",
          notes: ["یک زبان $L$، R.E است اگر و تنها اگر یک TM برای پذیرش آن باشد.", "مجموعهٔ تمام TMها در $\\Sigma^*$ شماراست."],
        },
        {
          label: "سؤال ۴۹ مهندسی کامپیوتر ۱۴۰۳",
          tone: "konkur",
          text: "کدام مورد، درست است؟",
          options: [
            "الگوریتم پویش (parsing) برای زبان‌های مستقل از متن، همیشه از مرتبهٔ نمایی است و به فرم گرامر وابسته نیست.",
            "اگر گرامر یک زبان مستقل از متن به فرم نرمال چامسکی باشد، می‌توان الگوریتم پویش با مرتبهٔ خطی از طول رشته داشت.",
            "اگر گرامر یک زبان مستقل از متن، گرامری ساده (s-grammar) باشد، می‌توان الگوریتم پویش با مرتبهٔ خطی از طول رشته داشت.",
            "اگر قوانین لامبدا ($\\lambda$-Productions) را از گرامر یک زبان مستقل از متن حذف کنیم، می‌توان الگوریتم پویش با مرتبهٔ خطی از طول رشته داشت.",
          ],
        },
        {
          label: "پاسخ آن در جزوهٔ کلاس",
          tone: "class",
          text: "پارس کردن به روش جست‌وجوی فضای حالت در s-grammar از مرتبهٔ $O(|w|)$ است.",
        },
      ],
    },
  ],

  "phd-1403": [
    {
      kind: "scorecard",
      source: "/evidence/phd-1403-karnameh.jpg",
      exam: "دکتری ۱۴۰۳ · مهندسی کامپیوتر (۲۳۵۴) · سهمیهٔ آزاد",
      attendees: 2990,
      codeWord: "کد ترکیب",
      subjects: [
        { name: "دروس اختصاصی، کد ترکیب ۱", percent: 42.59 },
        { name: "دروس اختصاصی، کد ترکیب ۲", percent: 49.24 },
        { name: "دروس اختصاصی، کد ترکیب ۳", percent: 35.66 },
        { name: "دروس اختصاصی، کد ترکیب ۴", percent: 0 },
        { name: "استعداد تحصیلی", percent: 6.67 },
        { name: "زبان انگلیسی", percent: 5.83 },
      ],
      codes: [
        { code: 1, label: "نرم‌افزار", score: 4654, rank: 17 },
        { code: 2, label: "هوش مصنوعی", score: 4991, rank: 26 },
        { code: 3, score: 5579, rank: 11 },
        { code: 4, score: 230, rank: 2366 },
      ],
    },
    {
      kind: "answers",
      source: "/evidence/phd-1403-answers.jpg",
      section: "دروس تخصصی، بیست تست اول",
      rows: [
        { q: 1, answer: 3, key: 3 },
        { q: 2, answer: 4, key: 4 },
        { q: 3, answer: 3, key: 3, keyNote: "گزینهٔ ۳ با تأثیر مثبت" },
        { q: 4, answer: 1, key: 1 },
        { q: 5, answer: 1, key: 1 },
        { q: 6, answer: 3, key: 3 },
        { q: 7, answer: 2, key: 2 },
        { q: 8, answer: 2, key: "حذف" },
        { q: 9, answer: 4, key: 4 },
        { q: 10, answer: 2, key: 2 },
        { q: 11, answer: 4, key: 1 },
        { q: 12, answer: 2, key: 2 },
        { q: 13, answer: 1, key: 1 },
        { q: 14, answer: 3, key: 3 },
        { q: 15, answer: 4, key: 4 },
        { q: 16, answer: 3, key: 3 },
        { q: 17, answer: "سفید", key: 1 },
        { q: 18, answer: 1, key: 1 },
        { q: 19, answer: 2, key: 2 },
        { q: 20, answer: 1, key: 3 },
      ],
    },
  ],

  "it-1405": [
    {
      kind: "scorecard",
      source: "/evidence/1405-it-rank-38.jpg",
      exam: "ارشد ۱۴۰۵ · مهندسی فناوری اطلاعات (۱۲۷۶)",
      subjects: [
        { name: "زبان عمومی و تخصصی", percent: 48 },
        { name: "دروس مشترک: گسسته، ساختمان داده، الگوریتم، مهندسی نرم‌افزار، شبکه", percent: 37.78 },
        { name: "اصول و مبانی مدیریت", percent: 5 },
        { name: "دروس تخصصی مشترک: پایگاه داده، هوش مصنوعی، سیستم عامل", percent: 22.81 },
      ],
      codes: [
        { code: 1, score: 6475, rank: 38, rankNoQuota: 41 },
        { code: 2, score: 6256, rank: 66, rankNoQuota: 74 },
      ],
    },
  ],

  "it-1403": [
    {
      kind: "scorecard",
      source: "/evidence/it-1403-karnameh.png",
      exam: "ارشد ۱۴۰۳ · مهندسی فناوری اطلاعات (۱۲۷۶)",
      subjects: [
        { name: "زبان عمومی و تخصصی", percent: "سفید" },
        { name: "دروس مشترک: گسسته، ساختمان داده، الگوریتم، مهندسی نرم‌افزار، شبکه", percent: 34.44 },
        { name: "اصول و مبانی مدیریت", percent: "سفید" },
        { name: "دروس تخصصی مشترک: پایگاه داده، هوش مصنوعی، سیستم عامل", percent: 31.67 },
      ],
      codes: [
        { code: 1, score: 8219, rank: 8, rankNoQuota: 9 },
        { code: 2, score: 7478, rank: 18, rankNoQuota: 19 },
      ],
    },
  ],

  "ai-1401": [
    {
      kind: "scorecard",
      source: "/evidence/1401-ai-rank-8.png",
      exam: "ارشد ۱۴۰۱ · مهندسی کامپیوتر",
      subjects: [
        { name: "زبان عمومی و تخصصی", percent: 60 },
        { name: "ریاضیات: ریاضی عمومی، معادلات، آمار و احتمال، گسسته", percent: 10 },
        { name: "نظریه زبان‌ها و ماشین‌ها، سیگنال‌ها و سیستم‌ها", percent: 33.33 },
        { name: "ساختمان داده، طراحی الگوریتم، هوش مصنوعی", percent: 38.33 },
        { name: "مدار منطقی، معماری کامپیوتر، الکترونیک دیجیتال", percent: 65 },
        { name: "سیستم عامل، شبکه، پایگاه داده", percent: 47.37 },
      ],
      codes: [
        { code: 1, label: "هوش مصنوعی", score: 8076, rank: 8, rankNoQuota: 9 },
        { code: 2, label: "نرم‌افزار", score: 7703, rank: 11, rankNoQuota: 12 },
        { code: 3, score: 8016, rank: 8, rankNoQuota: 9 },
        { code: 4, score: 7764, rank: 11, rankNoQuota: 12 },
      ],
    },
  ],

  "theory-1405-a": [
    {
      kind: "answers",
      source: "/evidence/1405-theory-answers-a.jpg",
      section: "نظریه زبان‌ها و ماشین‌ها",
      rows: [
        { q: 46, answer: 2, key: 2 },
        { q: 47, answer: 4, key: 4 },
        { q: 48, answer: 2, key: 2 },
        { q: 49, answer: 1, key: 1 },
        { q: 50, answer: 3, key: 3 },
      ],
    },
  ],

  "theory-1405-b": [
    {
      kind: "answers",
      source: "/evidence/1405-theory-answers-b.jpg",
      section: "نظریه زبان‌ها و ماشین‌ها",
      rows: [
        { q: 46, answer: 4, key: 4 },
        { q: 47, answer: 2, key: 2 },
        { q: 48, answer: 4, key: 4 },
        { q: 49, answer: 3, key: 3 },
        { q: 50, answer: 1, key: 1 },
      ],
    },
  ],

  "data-1405-a": [
    {
      kind: "answers",
      source: "/evidence/1405-data-answers-a.jpg",
      section: "ساختمان داده و طراحی الگوریتم",
      rows: [
        { q: 56, answer: 3, key: 3 },
        { q: 57, answer: 2, key: 2 },
        { q: 58, answer: 4, key: 4 },
        { q: 59, answer: 3, key: 3 },
        { q: 60, answer: 1, key: 1 },
        { q: 61, answer: 2, key: 2 },
        { q: 62, answer: 4, key: 4 },
        { q: 63, answer: 2, key: 2 },
        { q: 64, answer: 3, key: 3 },
        { q: 65, answer: 1, key: "حذف" },
        { q: 66, answer: 4, key: 1 },
        { q: 67, answer: 2, key: 2 },
      ],
    },
  ],

  "data-1405-b": [
    {
      kind: "answers",
      source: "/evidence/1405-data-answers-b.jpg",
      section: "ساختمان داده و طراحی الگوریتم",
      rows: [
        { q: 56, answer: 1, key: 1 },
        { q: 57, answer: 4, key: 4 },
        { q: 58, answer: 2, key: 2 },
        { q: 59, answer: 1, key: 1 },
        { q: 60, answer: "سفید", key: 3 },
        { q: 61, answer: 4, key: 4 },
        { q: 62, answer: 2, key: 2 },
        { q: 63, answer: "سفید", key: 4 },
        { q: 64, answer: 1, key: 1 },
        { q: 65, answer: 2, key: "حذف" },
        { q: 66, answer: 3, key: 3 },
        { q: 67, answer: 4, key: 4 },
      ],
    },
  ],

  "theory-1403": [
    {
      kind: "scorecard",
      source: "/evidence/1403-theory-score.jpg",
      exam: "ارشد ۱۴۰۳ · مهندسی کامپیوتر",
      subjects: [{ name: "نظریه زبان‌ها و ماشین‌ها، سیگنال‌ها و سیستم‌ها", percent: 44.44 }],
    },
  ],

  "theory-1403-khoshnam": [
    {
      kind: "scorecard",
      source: "/evidence/1403-theory-khoshnam-score.jpg",
      exam: "ارشد ۱۴۰۳ · مهندسی کامپیوتر",
      subjects: [{ name: "نظریه زبان‌ها و ماشین‌ها، سیگنال‌ها و سیستم‌ها", percent: 44.44 }],
    },
    {
      kind: "message",
      source: "/evidence/1403-theory-khoshnam-message.jpg",
      date: "۳۱ مه",
      quoted: "نظریه زبان‌ها و ماشین‌ها، سیگنال‌ها و سیستم‌ها",
      lines: [
        "سلام، وقت به خیر.",
        "من یکی دو هفته آخر منتهی به کنکور، کلاس حل تمرین نظریه شما رو دیدم و با توجه به اینکه قبل از اون تست نزده بودم، برای من کامل و جامع به نظر میومد.",
        "ممنون 🙏",
      ],
    },
  ],

  "karnameh-3609": [
    {
      kind: "scorecard",
      source: "/evidence/karnameh-theory-100.jpg",
      exam: "ارشد مهندسی کامپیوتر · منتشرشده در بهمن ۱۴۰۲",
      subjects: [
        { name: "زبان عمومی و تخصصی", percent: 47.78 },
        { name: "ریاضیات", percent: "سفید" },
        { name: "نظریه زبان‌ها", percent: 100 },
        { name: "مدار منطقی", percent: 61.11 },
        { name: "معماری کامپیوتر", percent: 47.22 },
        { name: "ساختمان داده و الگوریتم", percent: 59.52 },
        { name: "سیستم عامل", percent: 40.74 },
        { name: "شبکه‌های کامپیوتری", percent: "سفید" },
        { name: "هوش مصنوعی", percent: 21.21 },
        { name: "کامپایلر", percent: 51.85 },
        { name: "پایگاه داده", percent: 66.67 },
      ],
      codes: [
        { code: 1, score: 6627, rank: 58, rankNoQuota: 67 },
        { code: 2, score: 7271, rank: 29, rankNoQuota: 35 },
        { code: 3, score: 6782, rank: 48, rankNoQuota: 56 },
        { code: 4, score: 6386, rank: 60, rankNoQuota: 70 },
        { code: 5, score: 6772, rank: 42, rankNoQuota: 51 },
        { code: 6, score: 6948, rank: 46, rankNoQuota: 54 },
        { code: 7, score: 7406, rank: 27, rankNoQuota: 32 },
      ],
    },
  ],
};
