import type { Metadata } from "next";
import Link from "next/link";
import { Glyph } from "../../components/SubjectIcon";
import { pageMetadata } from "../../lib/seo";
import { PracticeBuilder } from "./PracticeBuilder";

export const metadata: Metadata = pageMetadata({
  title: "آزمون‌ساز: آزمون تمرینی از بانک تست کنکور کامپیوتر",
  description:
    "درس و مبحث را انتخاب کن، تعداد تست و زمان را تعیین کن و یک آزمون زمان‌دار از بانک سؤال کنکور بساز؛ فقط سؤال‌های ندیده یا فقط اشتباه‌های قبلی را هم می‌شود تمرین کرد.",
  path: "/practice",
});

const STEPS = [
  { glyph: "book" as const, title: "درس و مبحث", text: "یک درس را انتخاب کن و اگر خواستی به چند مبحث محدودش کن." },
  { glyph: "list" as const, title: "کدام سؤال‌ها", text: "همه، فقط سؤال‌هایی که ندیده‌ای، یا فقط آن‌هایی که قبلاً اشتباه زده‌ای." },
  { glyph: "target" as const, title: "زمان‌دار و با کارنامه", text: "مثل جلسهٔ کنکور با زمان‌سنج؛ بعد از پایان، پاسخ تشریحی هر تست را می‌بینی." },
];

export default function PracticePage() {
  return (
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">تمرین هدفمند</p>
          <h1>آزمون‌ساز</h1>
          <p className="pg-lede">
            آزمون تمرینی خودت را از بانک تست کنکور بساز: درس، مبحث، تعداد تست و زمان با تو. هر آزمون کارنامه و پاسخ
            تشریحی دارد و در «آزمون‌های من» می‌ماند.
          </p>
        </div>
      </div>

      <section className="pg-shell pg-band" aria-label="آزمون‌ساز چطور کار می‌کند">
        <ol className="pr-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="pr-step-num" aria-hidden>{["۱", "۲", "۳"][index]}</span>
              <span className="pg-ico"><Glyph name={step.glyph} /></span>
              <div>
                <b>{step.title}</b>
                <small>{step.text}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pg-shell pg-sec">
        <PracticeBuilder />
      </section>

      <section className="pg-shell pg-sec pg-sec-line">
        <div className="pg-panel">
          <div className="pg-head" style={{ marginBottom: 0 }}>
            <div>
              <h2>سؤال‌ها از کجا می‌آیند؟</h2>
              <p>
                از بانک سؤال کنکورصفریک: تست‌های نمونهٔ هر درس برای همه باز است و با خرید بانک سؤال یک درس، یا دوره‌ای که
                بانک آن درس را همراه دارد، همهٔ تست‌های آن درس به آزمون‌ساز اضافه می‌شود.
              </p>
            </div>
            <Link href="/questions">دیدن بانک سؤال</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
