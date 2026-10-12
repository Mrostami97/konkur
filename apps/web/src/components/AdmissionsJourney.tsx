import Link from "next/link";

const steps = [
  { key: "evidence", number: "۱", title: "دیدن کارنامه‌ها", description: "ببین داوطلب‌های سال‌های قبل با چه درصدی کجا قبول شدند.", href: "/report-cards" },
  { key: "estimate", number: "۲", title: "تخمین رتبه", description: "درصدهای خودت را با کارنامه‌های واقعی سال‌های قبل مقایسه کن.", href: "/rank-calculator/master-computer-engineering" },
  { key: "programs", number: "۳", title: "جست‌وجوی دانشگاه", description: "ظرفیت و رشته‌محل‌های هر دانشگاه را از دفترچهٔ رسمی ببین.", href: "/programs" },
  { key: "choices", number: "۴", title: "چینش انتخاب‌ها", description: "رشته‌محل‌ها را به ترتیب علاقه و شانس قبولی بچین.", href: "/choices" },
] as const;

export function AdmissionsJourney({ current }: { current?: typeof steps[number]["key"] }) {
  return (
    <section aria-labelledby="admissions-journey-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">قدم‌به‌قدم</span>
          <h2 id="admissions-journey-title">از کارنامه تا فرم انتخاب رشته</h2>
          <p>این چهار قدم را به ترتیب برو تا انتخاب‌هایت حساب‌شده باشد. یادت باشد هیچ تخمینی تضمین قبولی نیست.</p>
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
