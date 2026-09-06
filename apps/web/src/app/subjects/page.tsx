import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { subjects } from "../../content/editorial";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({ title: "درس‌های کنکور کامپیوتر و IT ۱۴۰۶", description: "صفحهٔ جامع هر درس با وضعیت حضور در آزمون ۱۴۰۶، پیش‌نیازها، مسیر یادگیری و مباحث کلیدی.", path: "/subjects" });

export default function SubjectsPage() {
  return <main className="page-container">
    <PageHeader eyebrow="نقشهٔ دانش" title="درس‌ها را جدا نخوان؛ مسیرشان را ببین" description="هر صفحه جای اتصال آموزش، منابع و تحلیل است. برچسب ۱۴۰۶ مشخص می‌کند هر درس در کدام مجموعه فعال است." />
    <div className="subject-grid">{subjects.map((subject) => <Link className="subject-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
      <div className="subject-monogram">{subject.accent}</div><div><span className="subject-status">{subject.status1406}</span><h2>{subject.title}</h2><p>{subject.description}</p><div className="subject-tags">{subject.tracks.slice(0, 3).map((track) => <span key={track}>{track}</span>)}</div></div>
    </Link>)}</div>
  </main>;
}
