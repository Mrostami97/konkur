"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { ContentBlocks } from "../../../components/ContentBlocks";

interface Block {
  type: string;
  [key: string]: unknown;
}

interface Option {
  number: number;
  blocks: Block[];
}

interface Item {
  questionId: string;
  order: number;
  points: number;
  question: {
    id: string;
    stemBlocks: Block[];
    options: Option[];
    assets: { media_key: string; checksum: string }[];
  };
  selectedOption: number | null;
}

interface AttemptState {
  id: string;
  examTitle: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  remainingSeconds: number;
  items: Item[];
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AttemptPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [remaining, setRemaining] = useState(0);
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<AttemptState>(`/attempts/${params.id}`);
      setAttempt(data);
      setRemaining(data.remainingSeconds);
      if (data.status !== "IN_PROGRESS") {
        router.push(`/attempts/${params.id}/report`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login");
    }
  }, [params.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    await apiFetch(`/attempts/${params.id}/submit`, { method: "POST" }).catch(() => {});
    router.push(`/attempts/${params.id}/report`);
  }, [params.id, router]);

  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt, submit]);

  async function selectOption(questionId: string, option: number) {
    setAttempt((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.questionId === questionId ? { ...i, selectedOption: option } : i)),
          }
        : prev,
    );
    await apiFetch(`/attempts/${params.id}/answers/${questionId}`, {
      method: "PUT",
      body: { selectedOption: option },
    }).catch(() => {});
  }

  if (!attempt) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "white", padding: "0.5rem 0" }}>
        <h1>{attempt.examTitle}</h1>
        <strong style={{ color: remaining < 60 ? "crimson" : "inherit" }}>{formatTime(remaining)}</strong>
      </div>

      {attempt.items.map((item, index) => (
        <div key={item.questionId} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "1rem", marginBottom: "1rem" }}>
          <p style={{ fontWeight: "bold" }}>سؤال {index + 1}</p>
          <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />
          {item.question.options.map((option) => (
            <label key={option.number} style={{ display: "block", margin: "0.3rem 0", cursor: "pointer" }}>
              <input
                type="radio"
                name={item.questionId}
                checked={item.selectedOption === option.number}
                onChange={() => selectOption(item.questionId, option.number)}
              />{" "}
              <ContentBlocks blocks={option.blocks} assets={item.question.assets} />
            </label>
          ))}
        </div>
      ))}

      <button onClick={submit}>پایان و ثبت آزمون</button>
    </main>
  );
}
