import Link from "next/link";

const steps = [
  { key: "evidence", number: "۱", title: "دیدن کارنامه‌ها", description: "نمونه‌های رضایت‌دار و محدودیت داده را ببین.", href: "/report-cards" },
  { key: "estimate", number: "۲", title: "تخمین بازه‌ای رتبه", description: "درصدهای خودت را با نمونه‌های مشابه مقایسه کن.", href: "/rank-estimate" },
  { key: "programs", number: "۳", title: "جست‌وجوی دانشگاه", description: "فقط برنامه‌های متصل به منبع رسمی را بررسی کن.", href: "/programs" },
  { key: "choices", number: "۴", title: "چینش انتخاب‌ها", description: "گزینه‌ها را مقایسه و اولویت‌بندی کن.", href: "/choices" },
] as const;

export function AdmissionsJourney({ current }: { current?: typeof steps[number]["key"] }) {
  return (
    <section aria-labelledby="admissions-journey-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">مسیر تصمیم</span>
          <h2 id="admissions-journey-title">از سند تا انتخاب؛ بدون پرش</h2>
          <p>هر مرحله خروجی مرحلهٔ قبل را دقیق‌تر می‌کند؛ هیچ درصد یا رتبه‌ای تضمین قبولی نیست.</p>
        </div>
      </div>
      <div className="content-grid-wide admissions-grid">
        {steps.map((step) => (
          <Link
            className={`surface-card admissions-card${current === step.key ? " surface-card-muted" : ""}`}
            href={step.href}
            aria-current={current === step.key ? "step" : undefined}
            key={step.key}
          >
            <span className="feature-icon">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <span className="text-link">رفتن به این مرحله ←</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
