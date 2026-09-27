import type { Metadata } from "next";
import Link from "next/link";
import { PublicBreadcrumbs } from "../../../components/PublicContent";
import { StructuredData } from "../../../components/StructuredData";
import modelJson from "../../../content/rank-model-1277.json";
import { formatPersianNumber, toPersianDigits } from "../../../lib/format";
import { BOXES, CODE_LABELS, CODES, type RankModel } from "../../../lib/rank-model";
import { absoluteUrl, pageMetadata, SITE_NAME } from "../../../lib/seo";
import { RankCalculator } from "./RankCalculator";
import "./rank-calculator.css";

const model = modelJson as unknown as RankModel;
const PATH = "/rank-calculator/master-computer-engineering";
const fa = (value: number, digits = 0) => formatPersianNumber(value, { maximumFractionDigits: digits });

const cardCount = model.years.reduce((sum, year) => sum + year.cards, 0);
const firstYear = Math.min(...model.years.map((year) => year.year));
const lastYear = Math.max(...model.years.map((year) => year.year));
const freeShifts = model.years.filter((year) => year.quota === "free").map((year) => year.gpaShift);
const { sameYearMedianErrorPct, sameYearChecks, nextYearMedianErrorPct } = model.accuracy;

export const metadata: Metadata = pageMetadata({
  title: "تخمین رتبه ارشد مهندسی کامپیوتر با درصد و معدل",
  description: `رتبه‌ات را در هر چهار کد ضریب ارشد مهندسی کامپیوتر از روی درصدها و معدل تخمین بزن؛ بر پایهٔ ${fa(cardCount)} کارنامهٔ واقعی ${toPersianDigits(firstYear)} تا ${toPersianDigits(lastYear)}، با بازهٔ رتبه و رشته‌محل‌های قبولی.`,
  path: PATH,
});

const faqs: { question: string; answer: string }[] = [
  {
    question: "این تخمین رتبه چقدر دقیق است؟",
    answer: `وقتی کارنامه با همان سال مقایسه شود، میانهٔ خطا حدود ${fa(sameYearMedianErrorPct, 1)} درصد رتبه است؛ این را روی ${fa(sameYearChecks)} مقایسه با کارنامه‌هایی سنجیدیم که در ساخت مدل نبودند. ولی سال‌ها با هم فرق دارند: اگر الگوی یک سال برای سال بعد به کار برود، میانهٔ خطا به حدود ${fa(nextYearMedianErrorPct)} درصد می‌رسد. برای همین رتبه را برای هر سال جدا نشان می‌دهیم، نه یک عدد قطعی.`,
  },
  {
    question: "برای کنکور ارشد ۱۴۰۶ هم کار می‌کند؟",
    answer: "در ۱۴۰۶ مجموعهٔ ۱۲۷۷ سه بسته دارد: زبان با ضریب ۱، ریاضیات با ضریب ۲ و بستهٔ تخصصی با ضریب ۴. این ابزار با کارنامه‌های ساختار شش‌دسته‌ای ۱۴۰۰ تا ۱۴۰۵ ساخته شده است؛ پس نشان می‌دهد درصدهای تو در آن سال‌ها به چه رتبه‌ای می‌رسید. برای سنجیدن آزمون‌های آزمایشی و مقایسه با سال‌های قبل مناسب است، ولی پیش‌بینی قطعی ۱۴۰۶ نیست.",
  },
  {
    question: "معدل چقدر در رتبهٔ ارشد اثر دارد؟",
    answer: `از کارنامه‌ها معلوم است که در سهمیهٔ آزاد هر یک نمره معدل تقریباً به اندازهٔ ${fa(Math.min(...freeShifts), 2)} تا ${fa(Math.max(...freeShifts), 2)} درصد میانگین وزنی ارزش داشته است. یعنی دو داوطلب با درصدهای یکسان، اگر معدلشان دو نمره فرق کند، می‌توانند رتبه‌های کاملاً متفاوتی بگیرند.`,
  },
  {
    question: "کد ضریب چیست و رتبهٔ کدام کد برایم مهم است؟",
    answer: "ارشد مهندسی کامپیوتر چهار کد ضریب دارد و هر کد درس‌ها را با وزن متفاوتی حساب می‌کند: کد ۱ شبکه و امنیت، کد ۲ هوش مصنوعی، کد ۳ معماری کامپیوتر و کد ۴ نرم‌افزار، بیوانفورماتیک، علوم داده و الگوریتم. برای هر گرایشی که می‌خواهی انتخاب کنی، رتبهٔ همان کد ملاک است.",
  },
  {
    question: "چرا سهمیهٔ ۲۵٪ در ابزار نیست؟",
    answer: "برای سهمیهٔ ۲۵٪ در هر سال حداکثر ده کارنامه پیدا کردیم. با این تعداد نمی‌شود بازهٔ قابل اعتمادی ساخت، پس آن را نشان نمی‌دهیم.",
  },
  {
    question: "درصدهایی که وارد می‌کنم جایی ذخیره می‌شود؟",
    answer: "نه. محاسبه در مرورگر خودت انجام می‌شود و درصدها فقط روی همین دستگاه می‌مانند تا دفعهٔ بعد دوباره تایپشان نکنی. چیزی برای ما فرستاده نمی‌شود و ثبت‌نام هم لازم نیست.",
  },
];

export default function RankCalculatorPage() {
  const url = absoluteUrl(PATH);
  return (
    <main className="rc">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "تخمین رتبهٔ ارشد مهندسی کامپیوتر",
            url,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Any",
            inLanguage: "fa-IR",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: 0, priceCurrency: "IRR" },
            provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: "انتخاب‌رشته", item: absoluteUrl("/admissions") },
              { "@type": "ListItem", position: 3, name: "تخمین رتبهٔ ارشد مهندسی کامپیوتر", item: url },
            ],
          },
        ]}
      />

      <header className="rc-hero">
        <div className="rc-wrap">
          <PublicBreadcrumbs items={[{ name: "خانه", href: "/" }, { name: "انتخاب‌رشته", href: "/admissions" }, { name: "تخمین رتبه" }]} />
          <p className="rc-kicker">ابزار رایگان · ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷)</p>
          <h1>تخمین رتبهٔ ارشد مهندسی کامپیوتر با درصدهایت</h1>
          <p className="rc-lead">
            درصد شش درس و معدلت را بزن تا ببینی همین کارنامه در هر سال و هر چهار کد ضریب به چه رتبه‌ای رسیده است؛ با بازهٔ رتبه و رشته‌محل‌هایی که با این رتبه قبول شده‌اند.
          </p>
          <dl className="rc-stats">
            <div><dt>کارنامهٔ واقعی</dt><dd className="tnum">{fa(cardCount)}</dd></div>
            <div><dt>سال‌های کنکور</dt><dd className="tnum">{toPersianDigits(firstYear)} تا {toPersianDigits(lastYear)}</dd></div>
            <div><dt>میانهٔ خطا در همان سال</dt><dd className="tnum">{fa(sameYearMedianErrorPct, 1)}٪ رتبه</dd></div>
            <div><dt>ثبت‌نام</dt><dd>لازم نیست</dd></div>
          </dl>
        </div>
      </header>

      <div className="rc-wrap">
        <RankCalculator />

        <aside className="rc-notice">
          <strong>کنکور ۱۴۰۶ ساختار تازه‌ای دارد.</strong>{" "}
          درس‌های تخصصی ۱۴۰۶ در یک بسته با ضریب ۴ می‌آیند. این ابزار نشان می‌دهد درصدهایت در کنکورهای {toPersianDigits(firstYear)} تا {toPersianDigits(lastYear)} به چه رتبه‌ای می‌رسید؛ بعد از کنکور ۱۴۰۶ با کارنامه‌های همان سال به‌روز می‌شود.
        </aside>

        <article className="rc-article">
          <section aria-labelledby="rc-how">
            <h2 id="rc-how">این تخمین چطور ساخته شده است؟</h2>
            <p>
              پایهٔ ابزار {fa(cardCount)} کارنامهٔ ارشد مهندسی کامپیوتر است: کارنامه‌هایی که داوطلب‌ها در بانک‌های عمومی کارنامه منتشر کرده‌اند، کارنامه‌های شاگردهای کنکورصفریک و کارنامه‌های ۱۴۰۵ که از روی تصویر خود کارنامه خوانده و درصدهایشان با تعداد تست همان سال کنترل شد. کارنامه‌ای که در چند منبع آمده بود، یک بار حساب شد.
            </p>
            <p>
              رتبهٔ هر کد از میانگین وزنی درصدها با ضرایب همان کد ساخته می‌شود. این ضرایب را از خود کارنامه‌ها بیرون کشیدیم و بدون خطا با میانگین‌های چاپ‌شده در کارنامه‌ها جور درآمدند:
            </p>
            <div className="rc-table-wrap">
              <table className="rc-table rc-weights">
                <caption>ضرایب هر کد در ۱۴۰۰ تا ۱۴۰۵ (جمع هر کد ۱۵)</caption>
                <thead>
                  <tr>
                    <th scope="col">کد</th>
                    {BOXES.map((box) => <th scope="col" key={box.key}>{box.short}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CODES.map((code) => (
                    <tr key={code}>
                      <th scope="row">{toPersianDigits(code)} · {CODE_LABELS[code].title}</th>
                      {model.weights[code].map((weight, index) => <td key={index} className="tnum">{toPersianDigits(weight)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              برای هر سال، سهمیه و کد، رابطهٔ میانگین وزنی و معدل با رتبه را از کارنامه‌های همان سال ساختیم. معدل مثل چند درصد اضافه یا کم روی میانگین وزنی اثر می‌کند و اندازهٔ این اثر را هم خود داده‌ها تعیین کردند. بازهٔ رتبه از خطای واقعی مدل روی کارنامه‌هایی آمده که در ساختنش نبودند: در ۸۰ درصد موارد، رتبهٔ واقعی داخل این بازه بوده است.
            </p>
            <p>
              روی سایت فقط همین جدول‌های جمع‌بندی‌شده هست و هیچ کارنامهٔ تکی منتشر نمی‌شود.
            </p>
          </section>

          <section aria-labelledby="rc-limits">
            <h2 id="rc-limits">محدودیت‌ها را جدی بگیر</h2>
            <ul>
              <li>سال‌ها با هم فرق زیادی دارند. مثلاً در ۱۴۰۴ یک میانگین وزنی ثابت رتبهٔ بدتری از همهٔ سال‌های قبل گرفت؛ جدول سال‌ها را کنار هم ببین.</li>
              <li>کارنامه‌های {toPersianDigits(lastYear)} بیشتر مال رتبه‌های زیر چند صد است؛ برای رتبه‌های بالاتر در آن سال، ابزار می‌گوید داده کافی نیست.</li>
              <li>کارنامه‌های منتشرشده بیشتر مال کسانی است که نتیجهٔ خوبی گرفته‌اند. رتبه‌های چند هزار هم در داده هست، ولی کمتر.</li>
              <li>رتبه تضمین قبولی نیست؛ ظرفیت و رفتار انتخاب‌رشتهٔ هر سال فرق می‌کند.</li>
            </ul>
          </section>

          <section aria-labelledby="rc-faq">
            <h2 id="rc-faq">پرسش‌های پرتکرار</h2>
            {faqs.map((item) => (
              <details key={item.question} className="rc-faq">
                <summary><h3>{item.question}</h3></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>

          <section aria-labelledby="rc-next">
            <h2 id="rc-next">قدم بعدی</h2>
            <ul className="rc-next">
              <li><Link href="/articles/admitted-ranks-by-university">با چه رتبه‌ای کجا قبول شدند؟ رتبهٔ قبولی در ۲۶ رشته‌محل</Link></li>
              <li><Link href="/articles/read-exam-report-card">کارنامهٔ کنکور ارشد را چطور بخوانیم؟</Link></li>
              <li><Link href="/guides/master-computer-engineering-1406">راهنمای ارشد مهندسی کامپیوتر ۱۴۰۶</Link></li>
              <li><Link href="/admissions">مسیر انتخاب‌رشته</Link></li>
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
