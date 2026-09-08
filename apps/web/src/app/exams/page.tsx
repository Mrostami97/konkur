import type { Metadata } from "next";
import { apiGetPublic } from "../../lib/api";
import { StartExamButton } from "../../components/StartExamButton";
import { EmptyState, PageHeader } from "../../components/ui";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "آزمون‌های آمادگی کنکور کامپیوتر",
  description: "فهرست آزمون‌های منتشرشده برای سنجش آمادگی ارشد و دکتری کامپیوتر در کنکورصفریک.",
  path: "/exams",
});

interface Exam {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
}

export default async function ExamsPage() {
  let exams: Exam[] | null = null;
  try {
    exams = await apiGetPublic<Exam[]>("/exams");
  } catch {
    exams = null;
  }

  return (
    <main className="page-container">
      <PageHeader eyebrow="سنجش آمادگی" title="آزمون‌ها" description="با آزمون‌های واقعی، آمادگی‌ات را بسنج و قدم بعدی را دقیق‌تر انتخاب کن." />
      {!exams ? (
        <EmptyState title="فهرست آزمون‌ها در دسترس نیست" description="اتصال به سرویس آزمون برقرار نشد؛ بعداً دوباره امتحان کن." />
      ) : exams.length === 0 ? (
        <EmptyState title="هنوز آزمونی منتشر نشده است" description="آزمون‌های جدید بعد از انتشار در این بخش قرار می‌گیرند." />
      ) : (
        <div className="exam-grid">
          {exams.map((exam) => (
            <article className="catalog-card" key={exam.id}><div><div className="catalog-card-meta"><span>آزمون شبیه‌ساز</span><span>{toPersianDigits(exam.durationMinutes)} دقیقه</span></div><h3>{exam.title}</h3><p>{exam.description}</p></div><div className="catalog-card-footer"><span className="muted-copy">آماده‌ای؟</span><StartExamButton examId={exam.id} /></div></article>
          ))}
        </div>
      )}
    </main>
  );
}
