"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { ContentBlocks } from "../../../components/ContentBlocks";

interface Lesson {
  id: string;
  title: string;
  contentBlocks: { type: string; [key: string]: unknown }[];
}

export default function LessonPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<Lesson>(`/lessons/${params.id}`);
        setLesson(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  async function markComplete() {
    await apiFetch(`/lessons/${params.id}/complete`, { method: "POST" });
    setCompleted(true);
  }

  if (loading) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  if (forbidden) {
    return (
      <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
        <h1>دسترسی ندارید</h1>
        <p>برای مشاهده این درس باید دوره مربوطه را خریداری کنید.</p>
      </main>
    );
  }

  if (!lesson) return null;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>{lesson.title}</h1>
      <ContentBlocks blocks={lesson.contentBlocks} />
      <button onClick={markComplete} disabled={completed}>
        {completed ? "تکمیل شد ✓" : "علامت‌گذاری به‌عنوان تکمیل‌شده"}
      </button>
    </main>
  );
}
