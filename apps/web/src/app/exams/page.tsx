import type { Metadata } from "next";
import { apiGetPublic } from "../../lib/api";
import { StartExamButton } from "../../components/StartExamButton";
import { EmptyState } from "../../components/ui";
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
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">سنجش آمادگی</p>
          <h1>آزمون‌ها</h1>
          <p className="pg-lede">با آزمون‌های واقعی، آمادگی‌ات را بسنج و قدم بعدی را دقیق‌تر انتخاب کن.</p>
        </div>
      </div>

      <section className="pg-shell pg-sec">
        {!exams ? (
          <EmptyState
            title="فهرست آزمون‌ها در دسترس نیست"
            description="اتصال به سرویس آزمون برقرار نشد؛ بعداً دوباره امتحان کن."
          />
        ) : exams.length === 0 ? (
          <EmptyState
            title="هنوز آزمونی منتشر نشده است"
            description="آزمون‌های جدید بعد از انتشار در این بخش قرار می‌گیرند."
          />
        ) : (
          <div className="pg-grid pg-grid-wide">
            {exams.map((exam) => (
              <article className="pg-card" key={exam.id}>
                <span className="pg-card-meta">
                  آزمون شبیه‌ساز · {toPersianDigits(exam.durationMinutes)} دقیقه
                </span>
                <b>{exam.title}</b>
                <small>{exam.description}</small>
                <span className="pg-card-action">
                  <StartExamButton examId={exam.id} />
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
