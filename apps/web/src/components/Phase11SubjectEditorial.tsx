import Link from "next/link";
import type { SubjectPage } from "../content/editorial";
import {
  phase11MasterTracks,
  type Phase11ExamBundle,
  type Phase11SubjectContent,
  type Phase11SubjectSlug,
} from "../content/phase11";
import { toPersianDigits } from "../lib/format";
import { SectionHeader } from "./ui";

function officialPlacements(slug: Phase11SubjectSlug) {
  return Object.values(phase11MasterTracks).flatMap((track) =>
    track.bundles
      .filter((bundle) => bundle.subjectSlugs.includes(slug))
      .map((bundle) => ({ track, bundle })),
  );
}

function coefficientLabel(bundle: Phase11ExamBundle) {
  if (bundle.coefficientsByCode) {
    return `کد ۱: ضریب ${toPersianDigits(bundle.coefficientsByCode["1"])} · کد ۲: ضریب ${toPersianDigits(bundle.coefficientsByCode["2"])}`;
  }
  return `ضریب ${toPersianDigits(bundle.coefficient ?? "—")}`;
}

export function Phase11SubjectEditorial({
  subject,
  content,
}: {
  subject: SubjectPage;
  content: Phase11SubjectContent;
}) {
  const placements = officialPlacements(content.slug);
  const syllabus = subject.syllabus ?? [];

  return (
    <>
      <aside className="answer-first" aria-labelledby="phase11-quick-answer-title" data-phase11="verified-subject-hub">
        <strong id="phase11-quick-answer-title">پاسخ سریع برای آزمون ۱۴۰۶</strong>
        <p>{content.quickAnswer}</p>
      </aside>

      <section className="track-snapshot" aria-labelledby="phase11-exam-status-title">
        <div className="track-snapshot-heading">
          <span className="eyebrow">جایگاه در جدول رسمی</span>
          <h2 id="phase11-exam-status-title">این درس در کدام مسیر می‌آید؟</h2>
          <p>
            آخرین تطبیق با اطلاعیهٔ سازمان سنجش: {toPersianDigits(content.reviewedAt)}.
            نام و ضریب نهایی را هنگام ثبت‌نام با آخرین دفترچه و اصلاحیه کنترل کن.
          </p>
        </div>
        <div className="track-snapshot-grid">
          {placements.length > 0 ? placements.map(({ track, bundle }) => (
            <Link
              className="track-snapshot-card track-snapshot-card-featured"
              href={`/guides/${track.guideSlug}`}
              key={`${track.guideSlug}-${bundle.key}`}
            >
              <span>مجموعهٔ {toPersianDigits(track.collectionCode)} · {track.officialName}</span>
              <strong>{coefficientLabel(bundle)}</strong>
              <small>{bundle.title} — دیدن راهنمای کامل ←</small>
            </Link>
          )) : (
            <div className="track-snapshot-card track-snapshot-card-muted">
              <span>سه مجموعهٔ ارشد این فاز</span>
              <strong>درس مستقل نیست</strong>
              <small>کاربرد این هاب تکمیلی است؛ توضیح دقیق و استثناها را در پاسخ سریع بخوان.</small>
            </div>
          )}
        </div>
      </section>

      <section className="syllabus-panel" aria-labelledby="phase11-syllabus-title">
        <div className="section-heading syllabus-heading">
          <div>
            <span className="eyebrow">سرفصل آموزشی مرجع</span>
            <h2 id="phase11-syllabus-title">نقشهٔ مباحث {subject.shortTitle}</h2>
            <p>فصل‌ها برای ساخت ترتیب مطالعه آمده‌اند؛ حدود آزمون را اطلاعیه و دفترچهٔ رسمی تعیین می‌کند.</p>
          </div>
          {subject.syllabusSource?.url && (
            <a className="text-link" href={subject.syllabusSource.url} target="_blank" rel="noreferrer">
              مشاهدهٔ منبع سرفصل ←
            </a>
          )}
        </div>
        <div className="syllabus-grid">
          {syllabus.map((section, index) => (
            <details className="syllabus-card" open={index === 0} key={section.title}>
              <summary>
                <span>{toPersianDigits(String(index + 1).padStart(2, "0"))}</span>
                <strong>{section.title}</strong>
                <i aria-hidden="true">+</i>
              </summary>
              <ul>{section.topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="phase11-study-path-title">
        <SectionHeader
          title="از کجا شروع کنم؟"
          description="یک ترتیب پیشنهادی برای تبدیل سرفصل به مسیر مطالعه؛ نه برنامهٔ یکسان برای همه."
        />
        <div className="subject-journey">
          <article className="surface-card">
            <span className="eyebrow">مسیر یادگیری</span>
            <h2 id="phase11-study-path-title">قدم‌های پیشنهادی</h2>
            <ol>
              {content.learningPath.map((step) => (
                <li key={step.title}><strong>{step.title}:</strong> {step.detail}</li>
              ))}
            </ol>
          </article>
          <article className="surface-card">
            <span className="eyebrow">تمرکز مطالعه</span>
            <h2>سه محور این هاب</h2>
            <ul>{subject.focus.map((item) => <li key={item}>{item}</li>)}</ul>
            <Link className="button button-secondary" href={content.ctas.internal.href}>{content.ctas.internal.label}</Link>
          </article>
          <article className="surface-card">
            <span className="eyebrow">دام‌های رایج</span>
            <h2>قبل از تست‌زنی حواست باشد</h2>
            <ul>{content.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
            <Link className="button button-primary" href={content.ctas.resource.href}>{content.ctas.resource.label}</Link>
          </article>
        </div>
      </section>

      <section className="sources-box" aria-labelledby="phase11-sources-title">
        <div>
          <span>منابع و اعتبارسنجی</span>
          <h2 id="phase11-sources-title">منابع این صفحه</h2>
        </div>
        <ol>
          {content.sources.map((source) => (
            <li key={`${source.kind}-${source.url}`}>
              <a href={source.url} target="_blank" rel="noreferrer">
                <strong>{source.title}</strong>
                <span>{source.publisher} · بررسی {toPersianDigits(source.checkedAt)}</span>
              </a>
            </li>
          ))}
        </ol>
        <p>ملاک نهایی، آخرین دفترچه و اصلاحیهٔ منتشرشده توسط سازمان سنجش است.</p>
      </section>
    </>
  );
}
