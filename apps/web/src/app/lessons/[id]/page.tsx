"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { ContentBlocks } from "../../../components/ContentBlocks";
import { EmptyState, PageHeader } from "../../../components/ui";

interface Lesson {
  id: string;
  title: string;
  contentBlocks: { type: string; [key: string]: unknown }[];
  completedAt?: string | null;
  progress?: { completedAt?: string | null } | null;
  courseModule?: {
    title?: string;
    course?: { slug?: string; title?: string };
  };
}

export default function LessonPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<Lesson>(`/lessons/${params.id}`);
        setLesson(data);
        setCompleted(Boolean(data.completedAt ?? data.progress?.completedAt));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) setForbidden(true);
        else if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setMessage("اتصال به محتوای درس برقرار نشد.");
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
      setMessage("تکمیل درس در پیشرفت مطالعه ثبت شد؛ این ثبت به‌تنهایی به‌معنای تسلط علمی نیست.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ثبت تکمیل درس انجام نشد.");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <main className="page-container"><div className="surface-card loading-state">در حال بارگذاری درس…</div></main>;

  if (forbidden) {
    return (
      <main className="page-container">
        <PageHeader eyebrow="دسترسی دوره" title="این درس در دسترس حساب نیست" description="برای مشاهدهٔ محتوای کامل، باید دسترسی فعال دوره را داشته باشی." />
        <EmptyState title="دسترسی فعال پیدا نشد" description="می‌توانی جزئیات دوره و نمونه‌های آزاد آن را در فهرست دوره‌ها ببینی." action={<Link className="button button-primary" href="/courses">مشاهدهٔ دوره‌ها ←</Link>} />
      </main>
    );
  }

  if (notFound) return <main className="page-container"><EmptyState title="درس پیدا نشد" description="ممکن است درس هنوز منتشر نشده یا نشانی آن تغییر کرده باشد." action={<Link className="button button-secondary" href="/courses">بازگشت به دوره‌ها</Link>} /></main>;
  if (!lesson) return <main className="page-container">{message && <div className="form-error" role="alert">{message}</div>}</main>;

  const course = lesson.courseModule?.course;

  return (
    <main className="page-container">
      <PageHeader
        eyebrow={lesson.courseModule?.title ?? "درس دوره"}
        title={lesson.title}
        description={course?.title ? `از دورهٔ ${course.title}` : "محتوای آموزشی و مسیر ادامهٔ مطالعه"}
        action={course?.slug ? <Link className="button button-secondary" href={`/courses/${course.slug}`}>بازگشت به سرفصل دوره</Link> : <Link className="button button-secondary" href="/courses">دوره‌ها</Link>}
      />
      <article className="editorial-body">
        <ContentBlocks blocks={lesson.contentBlocks} />
      </article>
      <section className="surface-card">
        <span className="eyebrow">ثبت فعالیت مطالعه</span>
        <h2>وضعیت این درس</h2>
        <p className="muted-copy">تکمیل‌کردن درس، فعالیت مطالعه را ثبت می‌کند. تسلط علمی فقط با شواهد پاسخ‌گویی سنجیده می‌شود.</p>
        <button className="button button-primary" type="button" onClick={markComplete} disabled={completed || completing}>
          {completing ? "در حال ثبت…" : completed ? "تکمیل درس ثبت شده ✓" : "این درس را تکمیل کردم"}
        </button>
        {message && <p className="success-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
