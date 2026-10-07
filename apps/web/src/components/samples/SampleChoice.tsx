"use client";

import { useState, type ReactNode } from "react";

/**
 * The interactive part of a sample question: pick an option, see whether it
 * is right, and the solution opens. Everything shown here (options and
 * solution) is already in the server-rendered page, so it reads without
 * JavaScript and search engines see the worked answer.
 */
export function SampleChoice({
  options,
  accepted,
  solution,
}: {
  options: { number: number; content: ReactNode }[];
  /** Every option the final key accepts. */
  accepted: number[];
  solution: ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const answered = picked !== null;
  const right = answered && accepted.includes(picked);

  return (
    <>
      <ol className="sq-options" role="list">
        {options.map((option) => {
          const state = !answered ? undefined : accepted.includes(option.number) ? "right" : option.number === picked ? "wrong" : "idle";
          return (
            <li key={option.number}>
              <button
                type="button"
                data-state={state}
                aria-pressed={picked === option.number}
                disabled={answered}
                onClick={() => {
                  setPicked(option.number);
                  setOpen(true);
                }}
              >
                <span className="sq-num" aria-hidden="true">{"۱۲۳۴"[option.number - 1]}</span>
                <span className="sq-opt">{option.content}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {answered && (
        <p className="sq-verdict" data-right={right || undefined} role="status">
          {right ? "درست است." : `جواب گزینهٔ ${accepted.map((n) => "۱۲۳۴"[n - 1]).join(" یا ")} است.`}
          <button type="button" onClick={() => { setPicked(null); setOpen(false); }}>دوباره</button>
        </p>
      )}
      <details className="sq-solution" open={open} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary>پاسخ و راه‌حل تشریحی</summary>
        {solution}
      </details>
    </>
  );
}
