import type { Metadata } from "next";
import { apiGetPublic } from "../../lib/api";
import { ComingSoon } from "../../components/ComingSoon";
import { ExamCatalog, type CatalogExam } from "./ExamCatalog";
import "./exams.css";
import { EmptyState } from "../../components/ui";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";

async function loadExams() {
  try {
    return await apiGetPublic<CatalogExam[]>("/exams");
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const exams = await loadExams();
  return pageMetadata({
    title: "آزمون‌های آمادگی کنکور کامپیوتر",
    description: "فهرست آزمون‌های منتشرشده برای سنجش آمادگی ارشد و دکتری کامپیوتر در کنکور کامپیوتر.",
    path: "/exams",
    // Until an exam is published this is a "coming soon" page, not one to rank.
    noIndex: exams === null || exams.length === 0,
  });
}

export default async function ExamsPage() {
  const exams = await loadExams();
  const questions = (exams ?? []).reduce((sum, exam) => sum + (exam.itemCount ?? 0), 0);
  const years = new Set((exams ?? []).map((exam) => exam.simulatesYear).filter(Boolean)).size;

  return (
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">سنجش آمادگی</p>
          <h1>آزمون‌ها</h1>
          <p className="pg-lede">با آزمون‌های واقعی، آمادگی‌ات را بسنج و قدم بعدی را دقیق‌تر انتخاب کن.</p>
          {exams && exams.length > 0 && (
            <dl className="xc-hero-stats">
              <div><dt>آزمون</dt><dd className="tnum">{toPersianDigits(exams.length)}</dd></div>
              {questions > 0 && <div><dt>سؤال کنکور</dt><dd className="tnum">{toPersianDigits(questions)}</dd></div>}
              {years > 0 && <div><dt>سال کنکور</dt><dd className="tnum">{toPersianDigits(years)}</dd></div>}
            </dl>
          )}
          {exams && exams.length > 0 && (
            <ul className="xc-promise">
              <li>زمان‌دار، با همان ترتیب و بخش‌های دفترچه</li>
              <li>کارنامه با درصد به روش کنکور، تراز و رتبه بین شرکت‌کننده‌ها</li>
              <li>تحلیل زمان، سؤال‌های طلایی از دست‌رفته و راه‌حل هر سؤال</li>
            </ul>
          )}
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
          <ExamCatalog exams={exams} />
        )}
      </section>
    </main>
  );
}
