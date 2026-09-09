import type { Metadata } from "next";
import { PageHeader } from "../../components/ui";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "راهنمای انتخاب‌رشتهٔ کنکور کامپیوتر",
  description: "مسیر شفاف تخمین رتبه، مقایسهٔ دانشگاه‌ها و اولویت‌بندی انتخاب‌های ارشد و دکتری کامپیوتر.",
  path: "/admissions",
});

export default function AdmissionsHubPage() {
  return (
    <main className="page-container">
      <PageHeader eyebrow="آیندهٔ تحصیلی" title="انتخاب‌رشته ۳۶۰" description="از تخمین رتبه تا مقایسه و اولویت‌بندی دانشگاه‌ها و گرایش‌ها، مسیر تصمیم‌گیری‌ات را مرحله‌به‌مرحله جلو ببر." />
      <div className="surface-card surface-card-muted analysis-note">
        <p><strong>مبنای تصمیم را شفاف نگه می‌داریم:</strong> ابتدا نمونه‌های دارای رضایت انتشار را می‌بینی، سپس تخمین بازه‌ای و برنامه‌های متصل به منبع رسمی را بررسی می‌کنی.</p>
        <p>آمار نمونه‌های کوچک نمایش داده نمی‌شود و هیچ درصد یا بازه‌ای تضمین قبولی نیست.</p>
      </div>
      <AdmissionsJourney />
    </main>
  );
}
