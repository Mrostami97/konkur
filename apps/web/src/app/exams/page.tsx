import type { Metadata } from "next";
import { apiGetPublic } from "../../lib/api";
import { StartExamButton } from "../../components/StartExamButton";
import { ComingSoon } from "../../components/ComingSoon";
import { EmptyState } from "../../components/ui";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";

interface Exam {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
}

async function loadExams() {
  try {
    return await apiGetPublic<Exam[]>("/exams");
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const exams = await loadExams();
  return pageMetadata({
    title: "آزمون‌های آمادگی کنکور کامپیوتر",
    description: "فهرست آزمون‌های منتشرشده برای سنجش آمادگی ارشد و دکتری کامپیوتر در کنکورصفریک.",
    path: "/exams",
    // Until an exam is published this is a "coming soon" page, not one to rank.
    noIndex: exams === null || exams.length === 0,
  });
}

export default async function ExamsPage() {
  const exams = await loadExams();

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
          <ComingSoon
            icon="target"
            title="آزمون‌های آزمایشی به‌زودی"
            text="آزمون‌های زمان‌دار با کارنامه، درصد به روش کنکور و رتبه بین شرکت‌کننده‌ها در حال آماده‌سازی است. بعد از انتشار، از همین صفحه و از پنل خودت شرکت می‌کنی."
            alternatives={[
              { href: "/guides/booklets-and-answer-keys", label: "دفترچه و کلید سال‌های قبل" },
              { href: "/guides/exam-time-management", label: "مدیریت زمان سر جلسه" },
              { href: "/subjects", label: "نقشهٔ درس‌ها" },
            ]}
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
