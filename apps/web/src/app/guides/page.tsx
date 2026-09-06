import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { guides } from "../../content/editorial";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({ title: "راهنمای کنکور ۱۴۰۶ کامپیوتر، IT و علوم کامپیوتر", description: "شش راهنمای منبع‌دار برای ارشد و دکتری مهندسی کامپیوتر، فناوری اطلاعات و علوم کامپیوتر در سال ۱۴۰۶.", path: "/guides" });

export default function GuidesPage() {
  return <main className="page-container">
    <PageHeader eyebrow="نقشهٔ رسمی ۱۴۰۶" title="مقطع و مجموعهٔ خودت را دقیق انتخاب کن" description="دروس، ضرایب و تغییرات هر مسیر جداگانه بررسی شده‌اند؛ چون یک جدول قدیمی می‌تواند کل برنامه را منحرف کند." />
    <section className="track-snapshot" aria-labelledby="track-snapshot-title">
      <div className="track-snapshot-heading"><span className="eyebrow">نمای سریع</span><h2 id="track-snapshot-title">وزن آزمون‌ها در یک نگاه</h2><p>این کارت‌ها جهت برنامه‌ریزی‌اند؛ برای نام نهایی مواد، دفترچه و اصلاحیهٔ همان سال را ببین.</p></div>
      <div className="track-snapshot-grid">
        <div className="track-snapshot-card track-snapshot-card-featured"><span>ارشد مهندسی کامپیوتر</span><strong>۱ / ۲ / ۴</strong><small>زبان · ریاضیات · تخصصی</small></div>
        <div className="track-snapshot-card"><span>ارشد فناوری اطلاعات</span><strong>۱ / ۲ / ۴</strong><small>زبان · ریاضیات · تخصصی</small></div>
        <div className="track-snapshot-card"><span>دکتری کامپیوتر و IT</span><strong>۱ / ۵</strong><small>زبان · تخصصی؛ استعداد تحصیلی حذف‌شده</small></div>
        <div className="track-snapshot-card track-snapshot-card-muted"><span>ارشد علوم کامپیوتر</span><strong>دفترچه‌محور</strong><small>جدول مواد و ضرایب پس از تطبیق نهایی نمایش داده می‌شود</small></div>
      </div>
    </section>
    <div className="guide-grid">{guides.map((guide) => <Link href={`/guides/${guide.slug}`} className="guide-card" key={guide.slug}>
      <div className="guide-card-index">{guide.degree === "ارشد" ? "MSc" : "PhD"}</div><div><span>{guide.field}</span><h2>{guide.title}</h2><p>{guide.description}</p><div className="guide-card-meta"><span>بررسی {guide.reviewedAt}</span><strong>مشاهده راهنما ←</strong></div></div>
    </Link>)}</div>
    <aside className="official-disclaimer"><strong>وضعیت منبع</strong><p>این صفحات بر اساس برنامهٔ پذیرش منتشرشده تهیه شده‌اند. خود اطلاعیه امکان اصلاح جزئیات تا زمان ثبت‌نام را یادآوری کرده؛ بنابراین آخرین دفترچه و اصلاحیهٔ سازمان سنجش همیشه ملاک نهایی است.</p></aside>
  </main>;
}
