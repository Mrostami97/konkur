"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { ContentBlocks } from "../../../components/ContentBlocks";
import { DataState } from "../../../components/ds";
import "../../courses/course.css";

interface Lesson {
  id: string;
  title: string;
  contentBlocks: { type: string; [key: string]: unknown }[];
  assets?: { media_key: string; checksum: string }[];
  completedAt?: string | null;
  progress?: { completedAt?: string | null } | null;
  courseModule?: {
    title?: string;
    course?: { slug?: string; title?: string };
  };
}

interface Outline {
  modules: { lessons: { id: string; title: string }[] }[];
}

/**
 * A lesson as a reading page: the content in a comfortable measure, then
 * "done" and the way on -- previous and next come from the course's public
 * outline, so a student moves through a course without going back to it.
 */
export default function LessonPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<Lesson>(`/lessons/${params.id}`);
        setLesson(data);
        setCompleted(Boolean(data.completedAt ?? data.progress?.completedAt));
        const slug = data.courseModule?.course?.slug;
        if (slug) {
          apiFetch<Outline>(`/courses/${encodeURIComponent(slug)}`)
            .then((outline) => setSiblings(outline.modules.flatMap((module) => module.lessons)))
            .catch(() => setSiblings([]));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError("اتصال به محتوای درس برقرار نشد.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  async function markComplete() {
    setCompleting(true);
    setMessage(null);
    try {
      await apiFetch(`/lessons/${params.id}/complete`, { method: "POST" });
      setCompleted(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ثبت تکمیل درس انجام نشد.");
    } finally {
      setCompleting(false);
    }
  }

  const course = lesson?.courseModule?.course;
  const index = siblings.findIndex((row) => row.id === params.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  return (
    <main className="cr">
      <header className="cr-top">
        <div className="ls-wrap">
          <nav className="cr-crumbs" aria-label="مسیر صفحه">
            <Link href="/courses">دوره‌ها</Link>
            {course?.slug && (
              <>
                <span aria-hidden="true">/</span>
                <Link href={`/courses/${course.slug}`}>{course.title ?? "دوره"}</Link>
              </>
            )}
          </nav>
          {lesson?.courseModule?.title && <p className="cr-kicker">{lesson.courseModule.title}</p>}
          <h1>{lesson?.title ?? (forbidden ? "این درس برای حسابت باز نیست" : "درس")}</h1>
          {index >= 0 && siblings.length > 0 && (
            <p className="cr-facts"><span>درس {toPersianDigits(index + 1)} از {toPersianDigits(siblings.length)}</span></p>
          )}
        </div>
      </header>

      <div className="ls-wrap ls-body">
        {forbidden ? (
          <section className="ls-locked">
            <h2>دسترسی فعال این دوره پیدا نشد</h2>
            <p>برای خواندن این درس، دسترسی دورهٔ آن لازم است. درس‌های نمونهٔ آزاد هر دوره برای همه باز است.</p>
            <Link className="ds-btn ds-btn-primary" href={course?.slug ? `/courses/${course.slug}` : "/courses"}>دیدن دوره</Link>
          </section>
        ) : (
          <DataState
            loading={loading}
            error={error}
            isEmpty={notFound}
            emptyTitle="درس پیدا نشد"
            emptyDescription="ممکن است درس هنوز منتشر نشده یا نشانی آن تغییر کرده باشد."
            skeletonRows={6}
          >
            {lesson && (
              <>
                <article className="ls-article">
                  <ContentBlocks blocks={lesson.contentBlocks} assets={lesson.assets ?? []} />
                </article>

                <section className="ls-done" aria-live="polite">
                  <div>
                    <strong>{completed ? "این درس را تمام کرده‌ای" : "خواندن این درس تمام شد؟"}</strong>
                    <p>ثبت تکمیل، پیشرفت مطالعه را نگه می‌دارد؛ تسلط را فقط پاسخ به سؤال‌ها نشان می‌دهد.</p>
                  </div>
                  <button className="ds-btn ds-btn-primary" type="button" onClick={markComplete} disabled={completed || completing}>
                    {completing ? "در حال ثبت…" : completed ? "ثبت شد ✓" : "این درس را تمام کردم"}
                  </button>
                  {message && <p className="ls-error" role="alert">{message}</p>}
                </section>

                <nav className="ls-nav" aria-label="درس قبلی و بعدی">
                  {previous ? (
                    <Link href={`/lessons/${previous.id}`} className="ls-step">
                      <small>درس قبلی</small>
                      <span>{previous.title}</span>
                    </Link>
                  ) : <span />}
                  {next ? (
                    <Link href={`/lessons/${next.id}`} className="ls-step ls-step-next">
                      <small>درس بعدی</small>
                      <span>{next.title}</span>
                    </Link>
                  ) : course?.slug ? (
                    <Link href={`/courses/${course.slug}`} className="ls-step ls-step-next">
                      <small>پایان فصل‌ها</small>
                      <span>بازگشت به سرفصل دوره</span>
                    </Link>
                  ) : <span />}
                </nav>
              </>
            )}
          </DataState>
        )}
      </div>
    </main>
  );
}
