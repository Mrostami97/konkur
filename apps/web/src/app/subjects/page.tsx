import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { subjects } from "../../content/editorial";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({ title: "درس‌های کنکور کامپیوتر و IT ۱۴۰۶", description: "صفحهٔ جامع هر درس با وضعیت حضور در آزمون ۱۴۰۶، پیش‌نیازها، مسیر یادگیری و مباحث کلیدی.", path: "/subjects" });

export default function SubjectsPage() {
  return <main className="page-container">
    <PageHeader eyebrow="نقشهٔ دانش" title="درس‌ها را جدا نخوان؛ مسیرشان را ببین" description="هر صفحه جای اتصال آموزش، منابع و تحلیل است. برچسب ۱۴۰۶ مشخص می‌کند هر درس در کدام مجموعه فعال است." action={<Link className="button button-primary" href="/guides">دیدن مسیرهای آزمون ←</Link>} />
    <section className="subjects-intro">
      <div><span className="subjects-intro-kicker">کتابخانهٔ هدفمند</span><h2>از «چه بخوانم؟» تا «چطور جلو بروم؟»</h2><p>برای هر درس، سرفصل آموزشی، پیش‌نیاز، جایگاه در آزمون و مسیر تمرین را کنار هم گذاشته‌ایم تا برنامه‌ریزی از روی حدس جلو نرود.</p></div>
      <div className="subjects-intro-metrics"><div><strong>{subjects.length}</strong><span>هاب درسی</span></div><div><strong>۶</strong><span>مسیر آزمون</span></div><div><strong>۳</strong><span>لایهٔ یادگیری</span></div></div>
    </section>
    <div className="content-filter-row subject-filter-row" aria-label="دسته‌بندی درس‌ها"><span className="active">همهٔ درس‌ها</span><span>ارشد مهندسی</span><span>ارشد IT</span><span>علوم کامپیوتر</span><span>دکتری</span></div>
    <div className="subject-grid">{subjects.map((subject) => <Link className="subject-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
      <div className="subject-monogram">{subject.accent}</div><div><span className="subject-status">{subject.status1406}</span><h2>{subject.title}</h2><p>{subject.description}</p><div className="subject-tags">{subject.tracks.slice(0, 3).map((track) => <span key={track}>{track}</span>)}</div><span className="subject-card-link">مشاهدهٔ سرفصل و مسیر ←</span></div>
    </Link>)}</div>
  </main>;
}
