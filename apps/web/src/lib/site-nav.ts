import type { GlyphName } from "../components/SubjectIcon";

/**
 * Every public destination, grouped the way a candidate looks for it.
 *
 * The header's mega menu, the mobile drawer and the footer all read this one
 * list, so a page is either reachable from all three or from none -- the
 * previous nine flat links left the results, free videos, tools and
 * instructors reachable only by typing the address.
 */
export interface NavLink {
  href: string;
  label: string;
  hint?: string;
  glyph?: GlyphName;
}

export interface NavColumn {
  title: string;
  links: NavLink[];
}

export interface NavMenu {
  id: string;
  label: string;
  /** Where the top-level item itself leads; also its "see all" link. */
  href: string;
  allLabel: string;
  columns: NavColumn[];
}

export const LEARN_MENU: NavMenu = {
  id: "learn",
  label: "دوره‌ها",
  href: "/courses",
  allLabel: "همهٔ دوره‌ها",
  columns: [
    {
      title: "یادگیری",
      links: [
        { href: "/courses", label: "دوره‌های کامل", hint: "کلاس درس‌به‌درس تا تست کنکور", glyph: "play" },
        { href: "/free-videos", label: "ویدیوی رایگان هر درس", hint: "کلاس ضبط‌شدهٔ دانشگاه‌های برتر", glyph: "spark" },
        { href: "/resources", label: "منابع مطالعه", hint: "جزوه، کتاب و منبع بازبینی‌شده", glyph: "book" },
      ],
    },
    {
      title: "با مدرس",
      links: [
        { href: "/instructors", label: "مدرسان", hint: "سوابق، دوره‌ها و مشاوره", glyph: "building" },
        { href: "/consultations", label: "مشاوره و رفع اشکال", hint: "تک‌جلسه‌ای یا سالیانه تا کنکور", glyph: "chat" },
      ],
    },
    {
      title: "تمرین",
      links: [
        { href: "/questions", label: "بانک سؤال", hint: "تست‌های کنکور به تفکیک مبحث", glyph: "list" },
        { href: "/exams", label: "آزمون‌ها", hint: "آزمون زمان‌دار با کارنامه", glyph: "target" },
      ],
    },
  ],
};

export const GUIDES_MENU: NavMenu = {
  id: "guides",
  label: "راهنمای ۱۴۰۶",
  href: "/guides",
  allLabel: "همهٔ راهنماها",
  columns: [
    {
      title: "رشتهٔ من",
      links: [
        { href: "/guides/master-computer-engineering-1406", label: "مهندسی کامپیوتر", hint: "مجموعهٔ ۱۲۷۷" },
        { href: "/guides/master-information-technology-1406", label: "فناوری اطلاعات (IT)", hint: "مجموعهٔ ۱۲۷۶" },
        { href: "/guides/master-computer-science-1406", label: "علوم کامپیوتر", hint: "مجموعهٔ ۱۲۰۹" },
        { href: "/guides/registration-calendar-1406", label: "تقویم ثبت‌نام و آزمون", hint: "تاریخ‌های رسمی سنجش" },
      ],
    },
    {
      title: "برنامه‌ریزی",
      links: [
        { href: "/articles/study-plan-from-zero", label: "شروع از صفر" },
        { href: "/guides/twelve-month-study-plan", label: "برنامهٔ دوازده‌ماهه" },
        { href: "/guides/six-month-study-plan", label: "برنامهٔ شش‌ماهه" },
        { href: "/guides/three-month-study-plan", label: "برنامهٔ سه‌ماهه" },
        { href: "/guides/working-candidate-study-plan", label: "داوطلب شاغل" },
      ],
    },
    {
      title: "رسمی و تحلیلی",
      links: [
        { href: "/guides/master-exam-changes-1406", label: "تغییرات کنکور ۱۴۰۶" },
        { href: "/guides/historical-budget-computer-engineering", label: "بودجه‌بندی سال‌های قبل" },
        { href: "/guides/booklets-and-answer-keys", label: "دفترچه و کلید آزمون" },
        { href: "/guides/official-notices-and-corrections", label: "اطلاعیه‌ها و اصلاحیه‌ها" },
      ],
    },
  ],
};

export const TOOLS_MENU: NavMenu = {
  id: "tools",
  label: "ابزارها",
  href: "/admissions",
  allLabel: "مسیر انتخاب‌رشته",
  columns: [
    {
      title: "رتبه و انتخاب‌رشته",
      links: [
        { href: "/rank-calculator/master-computer-engineering", label: "تخمین رتبه", hint: "از درصدها به رتبهٔ هر کد", glyph: "target" },
        { href: "/report-cards", label: "کارنامه‌های قبولی", hint: "درصد، تراز و رتبهٔ پذیرفته‌شده‌ها", glyph: "trophy" },
        { href: "/admissions", label: "انتخاب‌رشته", hint: "از رتبه تا فهرست نهایی", glyph: "compass" },
        { href: "/choices", label: "فهرست انتخاب‌های من", hint: "بچین، مرتب کن، ذخیره کن", glyph: "list" },
      ],
    },
    {
      title: "برنامه و اطلاعات",
      links: [
        { href: "/programs", label: "ظرفیت و گرایش‌ها", hint: "کدام دانشگاه چه گرایشی دارد", glyph: "building" },
        { href: "/today", label: "برنامهٔ امروز من", hint: "کار امروزت را بدان", glyph: "calendar" },
        { href: "/evidence", label: "مستندات تدریس", hint: "نتیجه‌ها با لینک منبع", glyph: "shield" },
      ],
    },
  ],
};

export const MEGA_MENUS: NavMenu[] = [LEARN_MENU, GUIDES_MENU, TOOLS_MENU];

/** Subject families, in the order the header lists them. */
export const SUBJECT_FAMILIES: { tone: "violet" | "teal" | "blue" | "rose" | "amber"; title: string }[] = [
  { tone: "teal", title: "هستهٔ کامپیوتر" },
  { tone: "blue", title: "سخت‌افزار و سیستم" },
  { tone: "violet", title: "ریاضیات" },
  { tone: "rose", title: "فناوری اطلاعات و نرم‌افزار" },
  { tone: "amber", title: "زبان" },
];

export const TELEGRAM_URL = "https://t.me/konkurcom";
