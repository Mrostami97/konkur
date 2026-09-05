import Link from "next/link";
import { PageHeader, SectionHeader } from "../../components/ui";

export default function AdmissionsHubPage() {
  return (
    <main className="page-container">
      <PageHeader eyebrow="آیندهٔ تحصیلی" title="انتخاب‌رشته ۳۶۰" description="از تخمین رتبه تا مقایسه و اولویت‌بندی دانشگاه‌ها و گرایش‌ها، مسیر تصمیم‌گیری‌ات را مرحله‌به‌مرحله جلو ببر." />
      <SectionHeader title="سه قدم برای تصمیم بهتر" description="اطلاعات واقعی‌ات را وارد کن و نتیجه را در هر مرحله ذخیره نگه دار." />
      <div className="content-grid-wide admissions-grid">
        <Link className="surface-card admissions-card" href="/rank-estimate"><span className="feature-icon">↗</span><h2>۱. تخمین رتبه</h2><p>با درصد درس‌ها، یک بازهٔ احتمالی و قابل تفسیر بساز.</p><span className="text-link">شروع تحلیل ←</span></Link>
        <Link className="surface-card admissions-card" href="/programs"><span className="feature-icon">⌖</span><h2>۲. جست‌وجوی دانشگاه</h2><p>برنامه‌ها، دانشگاه‌ها و گرایش‌های موجود را فیلتر کن.</p><span className="text-link">مشاهده برنامه‌ها ←</span></Link>
        <Link className="surface-card admissions-card" href="/choices"><span className="feature-icon">☷</span><h2>۳. مقایسه و اولویت</h2><p>انتخاب‌هایت را مرتب کن و وضعیت داده‌های مشابه را ببین.</p><span className="text-link">مشاهده فهرست ←</span></Link>
      </div>
    </main>
  );
}
