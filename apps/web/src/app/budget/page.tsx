import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "../../components/StructuredData";
import budgetData from "../../content/budget-data.json";
import { toPersianDigits } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";
import { BudgetExplorer, type BudgetData } from "./BudgetExplorer";
import "./budget.css";

export const metadata: Metadata = pageMetadata({
  title: "بودجه‌بندی هوشمند کنکور ارشد کامپیوتر برای ۱۴۰۶",
  description: "تعداد تست هر درس در هر سال برای ارشد مهندسی کامپیوتر، IT و علوم کامپیوتر، و اینکه برای هر رتبه در هر بخش چند تست خالص لازم بوده، از کارنامه‌های واقعی.",
  path: "/budget",
});

const data = budgetData as unknown as BudgetData;
const fa = (v: number | string) => toPersianDigits(String(v)).replace(".", "٫");

/** Three facts from the data, computed rather than typed. */
function insights() {
  const ce = data.tracks.ce;
  const dsa = ce.subjects.find((s) => s.name === "داده‌ساختارها و الگوریتم‌ها")!;
  const kept = ce.subjects.filter((s) => s.in1406);
  const last = ce.years.length - 1;
  const dropped = ce.subjects.filter((s) => !s.in1406).reduce((a, s) => a + s.counts[last], 0);
  const r = data.rankMap["1404"];
  const lo = r.bands[r.bands.length - 1].cells;
  const mid = r.bands[2].cells;
  const step = r.sections.map((name, i) => ({ name, d: mid[i].net - lo[i].net })).sort((a, b) => b.d - a.d)[0];
  return [
    `داده‌ساختارها و الگوریتم‌ها در ۱۴۰۵، ${fa(dsa.counts[last])} تست داشت و از ۱۳۸۹ روی هم ${fa(dsa.total)} تست؛ بیش از هر درس تخصصی دیگری که در ۱۴۰۶ مانده است.`,
    `${fa(dropped)} تست از ${fa(ce.totals![last])} تست دفترچهٔ ۱۴۰۵ مهندسی کامپیوتر از درس‌هایی بود که در ۱۴۰۶ نیستند؛ ${fa(kept.length)} درس مانده‌اند و دو درس تازه آمده‌اند.`,
    `در ۱۴۰۴، فاصلهٔ رتبه‌های ۱۰۰۱ تا ۳۰۰۰ با ۱۰۱ تا ۳۰۰ بیش از همه در «${step.name}» بود: حدود ${fa(Math.round(step.d * 10) / 10)} تست خالص.`,
  ];
}

export default function BudgetPage() {
  const facts = insights();
  return (
    <main className="bd">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "بودجه‌بندی کنکور ارشد کامپیوتر",
          description: "تعداد تست هر درس در دفترچه‌های کنکور کارشناسی ارشد مهندسی کامپیوتر (۱۲۷۷)، فناوری اطلاعات (۱۲۷۶) و علوم کامپیوتر (۱۲۰۹)، و میانهٔ درصد بخش‌ها در هر بازهٔ رتبه از کارنامه‌های منتشرشده.",
          url: absoluteUrl("/budget"),
          inLanguage: "fa-IR",
          creator: { "@type": "Organization", name: "کنکور کامپیوتر", url: absoluteUrl("/") },
        }}
      />
      <header className="bd-hero">
        <div className="bd-wrap">
          <nav className="bd-crumbs" aria-label="مسیر صفحه"><Link href="/">خانه</Link><span aria-hidden>/</span><span>بودجه‌بندی</span></nav>
          <p className="bd-kicker">از دفترچه‌ها و کارنامه‌های واقعی</p>
          <h1>بودجه‌بندی هوشمند کنکور ارشد کامپیوتر</h1>
          <p className="bd-hero-lede">فقط نمی‌گوییم هر درس چند تست دارد؛ نشان می‌دهیم کدام درس‌ها در ۱۴۰۶ مانده‌اند، برای هر رتبه در هر بخش چند تست خالص لازم بوده، و برای رسیدن از رتبهٔ فعلی به رتبهٔ هدف، کدام بخش بیشترین فاصله را دارد.</p>
          <ul className="bd-facts">{facts.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      </header>
      <div className="bd-wrap">
        <BudgetExplorer data={data} />
        <section className="bd-card bd-links" aria-labelledby="bd-next-title">
          <h2 id="bd-next-title">قدم بعدی</h2>
          <ul>
            <li><Link href="/articles/konkur-1405-computer-engineering-solutions">پاسخ تشریحی کنکور ۱۴۰۵</Link></li>
            <li><Link href="/articles/master-computer-answer-keys">کلید سؤال‌های ۱۴۰۰ تا ۱۴۰۵</Link></li>
            <li><Link href="/guides/master-exam-changes-1406">تغییرات کنکور ۱۴۰۶</Link></li>
            <li><Link href="/lesson-notes">درس‌نامه‌ها</Link></li>
            <li><Link href="/rank-calculator/master-computer-engineering">تخمین رتبه از درصدها</Link></li>
          </ul>
          <p className="bd-note">تعداد تست‌ها از بانک سؤال کنکور کامپیوتر است که دفترچه‌ها را سؤال‌به‌سؤال با کلید تطبیق داده؛ سؤال‌های حذف‌شده هم شمرده شده‌اند. درصدها میانهٔ کارنامه‌های منتشرشدهٔ قبولی سهمیهٔ آزاد مهندسی کامپیوترند و فقط گروه‌های دست‌کم ۱۰ نفره آمده‌اند. تاریخچه پیش‌بینی قطعی ۱۴۰۶ نیست.</p>
        </section>
      </div>
    </main>
  );
}
