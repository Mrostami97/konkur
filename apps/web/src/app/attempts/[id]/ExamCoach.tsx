"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { toPersianDigits } from "../../../lib/format";
import { subjectName } from "../../../content/subject-names";

export interface CoachItem {
  index: number;
  sectionId: string | null;
  subjectCode: string;
  answered: boolean;
  flagged: boolean;
  /** Time on this question so far, in seconds. */
  spent: number;
}

/** One sample of the pace: seconds into the exam and questions answered by then. */
export type PacePoint = [elapsed: number, answered: number];

/** «۴:۰۵» or «۱:۰۴:۰۵». */
export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${h > 0 ? String(m).padStart(2, "0") : m}:${String(sec).padStart(2, "0")}`;
  return toPersianDigits(h > 0 ? `${h}:${mmss}` : mmss);
}

/** «۳ دقیقه» or «۴۰ ثانیه», for sentences. */
function spoken(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${toPersianDigits(s)} ثانیه`;
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  // Seconds matter while the share is a few minutes; past ten, round them away.
  if (minutes >= 10 || rest === 0) return `${toPersianDigits(Math.round(s / 60))} دقیقه`;
  return `${toPersianDigits(minutes)} دقیقه و ${toPersianDigits(rest)} ثانیه`;
}

/**
 * Where the candidate stands against the clock: answered so far against the
 * even pace that finishes on time, and what the time left buys for each
 * question still open. The number is a guide, not a grade -- skipping a
 * hard question is a pace decision too.
 */
export function paceOf(elapsed: number, duration: number, answered: number, total: number, remaining: number) {
  const expected = duration > 0 ? (elapsed / duration) * total : 0;
  const lead = Math.round(answered - expected);
  const open = total - answered;
  return {
    lead,
    tone: lead >= 1 ? ("ahead" as const) : lead <= -1 ? ("behind" as const) : ("even" as const),
    budget: total > 0 ? duration / total : 0,
    perOpen: open > 0 ? remaining / open : null,
  };
}

/* ------------------------------------------------------------- pace chart */

const W = 260;
const H = 150;
// The count axis sits on the right, where the exam starts in a right-to-left chart.
const PAD = { top: 16, right: 24, bottom: 22, left: 8 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

/**
 * Answered questions over time, against the straight line that ends with
 * every question answered as the clock runs out. Time runs right to left,
 * the way the page reads.
 */
export function PaceChart({
  trail,
  elapsed,
  duration,
  answered,
  total,
  nowLabel = "اکنون",
}: {
  trail: PacePoint[];
  elapsed: number;
  duration: number;
  answered: number;
  total: number;
  /** What the vertical marker stands for: «now» in the sitting, «submitted» in the report. */
  nowLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const span = Math.max(duration, 1);
  const top = Math.max(total, 1);
  // Right-to-left: the start of the exam is on the right.
  const x = (t: number) => PAD.left + IW - (Math.min(Math.max(t, 0), span) / span) * IW;
  const y = (n: number) => PAD.top + IH - (Math.min(n, top) / top) * IH;

  const points = useMemo(() => {
    const rows = [...trail.filter(([t]) => t <= elapsed), [elapsed, answered] as PacePoint].sort((a, b) => a[0] - b[0]);
    if (rows[0]?.[0] !== 0) rows.unshift([0, 0]);
    return rows;
  }, [trail, elapsed, answered]);

  // A step line: the count holds until the next answer.
  const path = points
    .map(([t, n], i) => (i === 0 ? `M${x(t)},${y(n)}` : `H${x(t)}V${y(n)}`))
    .join("");
  const area = `${path}V${y(0)}H${x(0)}Z`;
  const answeredAt = (t: number) => {
    let n = 0;
    for (const [pt, pn] of points) if (pt <= t) n = pn;
    return n;
  };

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((event.clientX - box.left) / box.width) * W;
    const t = ((PAD.left + IW - px) / IW) * span;
    setHover(t < 0 || t > elapsed ? null : t);
  }

  const ticks = [0, 0.5, 1].map((f) => f * span);
  const expectedNow = (elapsed / span) * total;
  const hoverN = hover === null ? 0 : answeredAt(hover);
  const hoverExpected = hover === null ? 0 : (hover / span) * total;

  return (
    <figure className="ec-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`از ${toPersianDigits(total)} سؤال، ${toPersianDigits(answered)} سؤال در ${clock(elapsed)} پاسخ داده شده است.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Recessive grid: quarters of the questions. */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} className="ec-grid" x1={PAD.left} x2={PAD.left + IW} y1={y(f * top)} y2={y(f * top)} />
        ))}
        {[0, 0.5, 1].map((f) => (
          <text key={f} className="ec-axis" x={PAD.left + IW + 5} y={y(f * top) + 3.5} textAnchor="start">
            {toPersianDigits(Math.round(f * total))}
          </text>
        ))}
        {ticks.map((t, i) => (
          <text key={t} className="ec-axis" x={x(t)} y={H - 5} textAnchor={i === 0 ? "end" : i === ticks.length - 1 ? "start" : "middle"}>
            {i === 0 ? "شروع" : `دقیقهٔ ${toPersianDigits(Math.round(t / 60))}`}
          </text>
        ))}

        <line className="ec-ideal" x1={x(0)} y1={y(0)} x2={x(span)} y2={y(total)} />
        <path className="ec-area" d={area} />
        <path className="ec-line" d={path} />
        <line className="ec-now" x1={x(elapsed)} x2={x(elapsed)} y1={PAD.top} y2={PAD.top + IH} />
        <text className="ec-now-label" x={x(elapsed)} y={PAD.top - 5} textAnchor="middle">{nowLabel}</text>
        {/* The gap between where the even pace would be and where the candidate is. */}
        <line
          className="ec-gap"
          data-behind={answered < expectedNow || undefined}
          x1={x(elapsed)}
          x2={x(elapsed)}
          y1={y(expectedNow)}
          y2={y(answered)}
        />
        <circle className="ec-expected" cx={x(elapsed)} cy={y(expectedNow)} r={3.5} />
        <circle className="ec-dot" cx={x(elapsed)} cy={y(answered)} r={5} />

        {hover !== null && (
          <g className="ec-hover">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + IH} />
            <circle cx={x(hover)} cy={y(hoverN)} r={3.5} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="ec-tip" style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 22), 78)}%` }}>
          <b>دقیقهٔ {toPersianDigits(Math.round(hover / 60))}</b>
          <span>پاسخ‌داده: {toPersianDigits(hoverN)}</span>
          <span>برنامهٔ یکنواخت: {toPersianDigits(Math.round(hoverExpected))}</span>
        </div>
      )}
      <figcaption className="ec-key">
        <span><i className="ec-key-line" />پاسخ‌های تو</span>
        <span><i className="ec-key-ideal" />برنامهٔ یکنواخت</span>
        <span><i className="ec-key-expected" />جای تو طبق برنامه</span>
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------- time per question */

/**
 * One bar per question, in booklet order (right to left): how long it has
 * taken against the even share of the clock. A bar past twice the share is
 * drawn in the warning colour and listed by number, so it never rests on
 * colour alone.
 */
function TimeBars({ items, budget, current, onGo }: { items: CoachItem[]; budget: number; current: number; onGo: (index: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(budget * 2.2, ...items.map((item) => item.spent), 1);
  const heavy = items.filter((item) => budget > 0 && item.spent > budget * 2);
  const slot = 100 / Math.max(items.length, 1);
  const shown = hover !== null ? items[hover] : null;

  return (
    <div className="ec-bars-wrap">
      <div className="ec-bars" role="list" aria-label="زمان صرف‌شده برای هر سؤال" onPointerLeave={() => setHover(null)}>
        <span className="ec-budget" style={{ bottom: `${(budget / max) * 100}%` }} aria-hidden="true" />
        {items.map((item) => (
          <button
            type="button"
            role="listitem"
            key={item.index}
            className="ec-bar"
            data-heavy={(budget > 0 && item.spent > budget * 2) || undefined}
            data-current={item.index === current || undefined}
            style={{ width: `${slot}%` }}
            onPointerEnter={() => setHover(item.index)}
            onFocus={() => setHover(item.index)}
            onClick={() => onGo(item.index)}
            aria-label={`سؤال ${toPersianDigits(item.index + 1)}: ${clock(item.spent)}`}
          >
            <span style={{ height: `${Math.max((item.spent / max) * 100, item.spent > 0 ? 3 : 0)}%` }} />
          </button>
        ))}
      </div>
      <p className="ec-bars-note">
        {shown ? (
          <>سؤال {toPersianDigits(shown.index + 1)}: <b>{clock(shown.spent)}</b>{shown.answered ? " · پاسخ‌داده" : " · بی‌پاسخ"}</>
        ) : heavy.length > 0 ? (
          <>بیش از دو برابر سهم: سؤال {heavy.slice(0, 4).map((item) => toPersianDigits(item.index + 1)).join("، ")}{heavy.length > 4 ? " و …" : ""}</>
        ) : (
          <>سهم هر سؤال از زمان: <b>{clock(budget)}</b></>
        )}
      </p>
      <div className="ec-key">
        <span><i className="ec-key-bar" />زمان سؤال</span>
        <span><i className="ec-key-budget" />سهم هر سؤال</span>
        <span><i className="ec-key-heavy" />بیش از ۲ برابر</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ by section */

function Sections({ items, sections }: { items: CoachItem[]; sections: { id: string; title: string }[] }) {
  // A simulator has sections; a plain exam is grouped by subject.
  const groups = useMemo(() => {
    const keyOf = (item: CoachItem) => (sections.length ? item.sectionId ?? "" : item.subjectCode);
    const titleOf = (key: string) => (sections.length ? sections.find((s) => s.id === key)?.title ?? "سایر" : subjectName(key));
    const map = new Map<string, { title: string; total: number; answered: number; spent: number }>();
    for (const item of items) {
      const key = keyOf(item);
      const row = map.get(key) ?? { title: titleOf(key), total: 0, answered: 0, spent: 0 };
      row.total += 1;
      row.answered += item.answered ? 1 : 0;
      row.spent += item.spent;
      map.set(key, row);
    }
    return [...map.values()];
  }, [items, sections]);

  if (groups.length < 2) return null;
  return (
    <div className="ec-sections">
      {groups.map((group) => (
        <div className="ec-sec" key={group.title}>
          <div className="ec-sec-head">
            <span>{group.title}</span>
            <b>{toPersianDigits(group.answered)}<small> / {toPersianDigits(group.total)}</small></b>
          </div>
          <span className="ec-sec-track" aria-hidden="true">
            <span style={{ width: `${(group.answered / group.total) * 100}%` }} />
          </span>
          <small className="ec-sec-time">{clock(group.spent)} صرف شده</small>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- panel */

export function PaceSummary({ elapsed, duration, answered, total, remaining }: { elapsed: number; duration: number; answered: number; total: number; remaining: number }) {
  const pace = paceOf(elapsed, duration, answered, total, remaining);
  const text =
    pace.tone === "ahead"
      ? `${toPersianDigits(pace.lead)} سؤال جلوتر از برنامه`
      : pace.tone === "behind"
        ? `${toPersianDigits(-pace.lead)} سؤال عقب‌تر از برنامه`
        : "هم‌پای برنامه";
  return (
    <div className="ec-summary" data-tone={pace.tone}>
      <span className="ec-summary-icon" aria-hidden="true">{pace.tone === "ahead" ? "▲" : pace.tone === "behind" ? "▼" : "●"}</span>
      <div>
        <strong>{text}</strong>
        <small>
          {pace.perOpen !== null
            ? `برای هر سؤال بی‌پاسخ حدود ${spoken(pace.perOpen)} وقت داری.`
            : "به همهٔ سؤال‌ها پاسخ داده‌ای؛ وقت باقی‌مانده برای مرور است."}
        </small>
      </div>
    </div>
  );
}

export function ExamCoach({
  items,
  sections,
  trail,
  elapsed,
  duration,
  remaining,
  current,
  onGo,
}: {
  items: CoachItem[];
  sections: { id: string; title: string }[];
  trail: PacePoint[];
  elapsed: number;
  duration: number;
  remaining: number;
  current: number;
  onGo: (index: number) => void;
}) {
  const answered = items.filter((item) => item.answered).length;
  const { budget } = paceOf(elapsed, duration, answered, items.length, remaining);
  return (
    <div className="ec">
      <section className="ec-block">
        <h3>مسیر زمان</h3>
        <PaceChart trail={trail} elapsed={elapsed} duration={duration} answered={answered} total={items.length} />
      </section>
      <section className="ec-block">
        <h3>زمان هر سؤال</h3>
        <TimeBars items={items} budget={budget} current={current} onGo={onGo} />
      </section>
      {sections.length > 1 || new Set(items.map((item) => item.subjectCode)).size > 1 ? (
        <section className="ec-block">
          <h3>پیشرفت هر بخش</h3>
          <Sections items={items} sections={sections} />
        </section>
      ) : null}
    </div>
  );
}
