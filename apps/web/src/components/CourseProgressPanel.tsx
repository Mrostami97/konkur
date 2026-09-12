"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { toPersianDigits } from "../lib/format";
import { ProgressBar } from "./ui";

interface CourseProgressItem {
  course?: { slug?: string; title?: string };
  courseSlug?: string;
  slug?: string;
  completedLessons?: number;
  completedCount?: number;
  viewedLessons?: number;
  totalLessons?: number;
  lessonCount?: number;
  progressPercent?: number;
  percent?: number;
  resumeLesson?: { id: string; title?: string } | null;
  nextLesson?: { id: string; title?: string } | null;
}

function itemsFromResponse(value: unknown): CourseProgressItem[] {
  if (Array.isArray(value)) return value as CourseProgressItem[];
  if (!value || typeof value !== "object") return [];
  const record = value as { courses?: unknown; items?: unknown };
  if (Array.isArray(record.courses)) return record.courses as CourseProgressItem[];
  if (Array.isArray(record.items)) return record.items as CourseProgressItem[];
  return [];
}

function itemSlug(item: CourseProgressItem) {
  return item.course?.slug ?? item.courseSlug ?? item.slug;
}

export function CourseProgressPanel({ courseSlug, firstLessonId }: { courseSlug: string; firstLessonId?: string }) {
  const [item, setItem] = useState<CourseProgressItem | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiFetch<unknown>("/me/learning-progress");
        if (!active) return;
        setItem(itemsFromResponse(response).find((candidate) => itemSlug(candidate) === courseSlug) ?? null);
        setState("ready");
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) setState("guest");
        else setState("unavailable");
      }
    })();
    return () => { active = false; };
  }, [courseSlug]);

  if (state === "loading") return <div className="surface-card loading-state">در حال بررسی مسیر مطالعه…</div>;
  if (state === "unavailable") return null;

  if (state === "guest") {
    return (
      <div className="surface-card">
        <span className="eyebrow">ادامهٔ یادگیری</span>
        <h2>پیشرفتت را در حساب نگه دار</h2>
        <p className="muted-copy">مشاهدهٔ دوره ممکن است آزاد باشد؛ برای ثبت آخرین درس و ادامه از همان نقطه وارد حساب شو.</p>
        <Link className="button button-secondary" href="/login">ورود به حساب ←</Link>
      </div>
    );
  }

  const completed = Math.max(0, item?.completedLessons ?? item?.completedCount ?? 0);
  const total = Math.max(0, item?.totalLessons ?? item?.lessonCount ?? 0);
  const explicitPercent = item?.progressPercent ?? item?.percent;
  const percent = Number.isFinite(explicitPercent)
    ? Math.min(100, Math.max(0, Number(explicitPercent)))
    : total > 0 ? Math.round((completed / total) * 100) : 0;
  const resume = item?.resumeLesson ?? item?.nextLesson;
  const targetLessonId = resume?.id ?? (completed === 0 ? firstLessonId : undefined);

  return (
    <div className="surface-card">
      <span className="eyebrow">ادامهٔ یادگیری</span>
      <h2>{item ? "مسیر ثبت‌شدهٔ تو" : "برای شروع آماده‌ای"}</h2>
      {item ? (
        <>
          <p className="muted-copy">
            {total > 0
              ? `${toPersianDigits(completed)} درس از ${toPersianDigits(total)} درس تکمیل شده است.`
              : "فعالیت مطالعه ثبت شده، اما تعداد کل درس‌ها در دسترس نیست."}
          </p>
          {total > 0 && <ProgressBar value={percent} label="پیشرفت مطالعه بر پایهٔ درس‌های تکمیل‌شده" />}
        </>
      ) : (
        <p className="muted-copy">با باز کردن نخستین درس، نقطهٔ ادامهٔ مطالعه در حسابت ثبت می‌شود.</p>
      )}
      {targetLessonId && (
        <Link className="button button-primary" href={`/lessons/${targetLessonId}`}>
          {resume ? `ادامه از «${resume.title ?? "آخرین درس"}»` : "شروع دوره"} ←
        </Link>
      )}
    </div>
  );
}
