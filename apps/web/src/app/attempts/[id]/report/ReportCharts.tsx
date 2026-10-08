"use client";

import { useMemo, useState } from "react";
import { toPersianDigits } from "../../../../lib/format";
import { subjectName } from "../../../../content/subject-names";
import { clock } from "../ExamCoach";

type Outcome = "correct" | "wrong" | "blank";

export interface DotItem {
  index: number;
  outcome: Outcome;
  subjectCode: string;
  timeSpentMs: number;
  crowdCorrectPercent: number | null;
}

const LANES: { key: Outcome; label: string }[] = [
  { key: "correct", label: "درست" },
  { key: "wrong", label: "نادرست" },
  { key: "blank", label: "نزده" },
];
const LABEL: Record<Outcome, string> = { correct: "درست", wrong: "نادرست", blank: "نزده" };

/* ------------------------------------------------------------ score donut */

/**
 * The answer sheet in one ring -- right, wrong, blank -- with the konkur
 * percentage in the middle. Segments are separated by a gap, and each count
 * is spelled out beside the ring, so the ring is never read by colour alone.
 */
export function ScoreDonut({ correct, wrong, blank, percent }: { correct: number; wrong: number; blank: number; percent: number }) {
  const total = Math.max(correct + wrong + blank, 1);
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = correct && wrong && blank ? 1.2 : 0;
  let offset = 0;
  const segments = (
    [
      ["correct", correct],
      ["wrong", wrong],
      ["blank", blank],
    ] as [Outcome, number][]
  )
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const length = Math.max((n / total) * c - gap, 0);
      const segment = { key, length, offset };
      offset += (n / total) * c;
      return segment;
    });
  return (
    <figure className="rx-donut" aria-label={`${toPersianDigits(correct)} درست، ${toPersianDigits(wrong)} نادرست، ${toPersianDigits(blank)} نزده`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="rx-donut-track" cx="50" cy="50" r={r} />
        {segments.map((segment) => (
          <circle
            key={segment.key}
            className="rx-donut-seg"
            data-outcome={segment.key}
            cx="50"
            cy="50"
            r={r}
            strokeDasharray={`${segment.length} ${c}`}
            strokeDashoffset={-segment.offset}
          />
        ))}
      </svg>
      <figcaption>
        <strong className="tnum">{toPersianDigits(percent.toFixed(1))}٪</strong>
        <span>درصد کنکوری</span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------ swarm charts */

const W = 640;
const LANE_H = 66;
const PAD = { top: 8, right: 64, bottom: 28, left: 12 };
const R = 5.5;

/**
 * Questions as dots in three lanes -- right, wrong, blank -- placed along
 * one measure. Dots that would overlap are stacked up and down within their
 * lane (a beeswarm), so every question stays visible and clickable.
 */
function Swarm({
  items,
  value,
  domain,
  ticks,
  reference,
  band,
  describe,
  onJump,
  label,
  highOnRight = false,
}: {
  items: DotItem[];
  value: (item: DotItem) => number | null;
  domain: [number, number];
  ticks: { at: number; text: string }[];
  reference?: { at: number; text: string };
  band?: { from: number; to: number; lane: Outcome[]; text: string };
  describe: (item: DotItem) => string;
  onJump: (index: number) => void;
  label: string;
  /** Put larger values on the right (e.g. «easier»); by default they run leftward, like time. */
  highOnRight?: boolean;
}) {
  const [hover, setHover] = useState<DotItem | null>(null);
  const H = PAD.top + LANES.length * LANE_H + PAD.bottom;
  const IW = W - PAD.left - PAD.right;
  // By default the measure grows from right to left, the way the page reads.
  const x = (v: number) => {
    const t = (Math.min(Math.max(v, domain[0]), domain[1]) - domain[0]) / (domain[1] - domain[0] || 1);
    return highOnRight ? PAD.left + t * IW : PAD.left + IW - t * IW;
  };
  const laneY = (outcome: Outcome) => PAD.top + LANES.findIndex((lane) => lane.key === outcome) * LANE_H + LANE_H / 2;

  const placed = useMemo(() => {
    const out: { item: DotItem; cx: number; cy: number }[] = [];
    for (const lane of LANES) {
      const rows = items
        .filter((item) => item.outcome === lane.key && value(item) !== null)
        .map((item) => ({ item, cx: x(value(item)!) }))
        .sort((a, b) => a.cx - b.cx);
      const taken: { cx: number; dy: number }[] = [];
      for (const row of rows) {
        // The nearest free offset from the lane's middle: 0, +1, -1, +2, ...
        let dy = 0;
        for (let step = 0; step < 12; step++) {
          dy = step === 0 ? 0 : (step % 2 ? 1 : -1) * Math.ceil(step / 2) * (R * 2 + 1);
          if (Math.abs(dy) > LANE_H / 2 - R) { dy = 0; break; }
          if (!taken.some((other) => other.dy === dy && Math.abs(other.cx - row.cx) < R * 2 + 1)) break;
        }
        taken.push({ cx: row.cx, dy });
        out.push({ item: row.item, cx: row.cx, cy: laneY(lane.key) + dy });
      }
    }
    return out;
    // `x` and `value` follow from `domain` and the caller's measure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, domain[0], domain[1], highOnRight]);

  return (
    <figure className="rx-swarm">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
        {band && (
          <rect
            className="rx-band"
            x={Math.min(x(band.from), x(band.to))}
            width={Math.abs(x(band.to) - x(band.from))}
            y={Math.min(...band.lane.map((lane) => laneY(lane))) - LANE_H / 2}
            height={band.lane.length * LANE_H}
            rx={8}
          />
        )}
        {LANES.map((lane, i) => (
          <g key={lane.key}>
            {i > 0 && <line className="rx-lane-rule" x1={PAD.left} x2={PAD.left + IW} y1={PAD.top + i * LANE_H} y2={PAD.top + i * LANE_H} />}
            <text className="rx-lane-label" data-outcome={lane.key} x={W - 6} y={laneY(lane.key) + 4} textAnchor="end">
              {lane.label}
            </text>
          </g>
        ))}
        {ticks.map((tick) => (
          <g key={tick.at}>
            <line className="rx-tick" x1={x(tick.at)} x2={x(tick.at)} y1={PAD.top} y2={H - PAD.bottom} />
            <text className="rx-axis" x={x(tick.at)} y={H - 9} textAnchor="middle">{tick.text}</text>
          </g>
        ))}
        {reference && (
          <g>
            <line className="rx-ref" x1={x(reference.at)} x2={x(reference.at)} y1={PAD.top - 2} y2={H - PAD.bottom} />
            <text className="rx-ref-label" x={x(reference.at)} y={H - PAD.bottom + 10} textAnchor="middle">{reference.text}</text>
          </g>
        )}
        {band && (
          <text className="rx-band-label" x={(x(band.from) + x(band.to)) / 2} y={PAD.top + 11} textAnchor="middle">{band.text}</text>
        )}
        {placed.map(({ item, cx, cy }) => (
          <circle
            key={item.index}
            className="rx-dot"
            data-outcome={item.outcome}
            data-hover={hover?.index === item.index || undefined}
            cx={cx}
            cy={cy}
            r={R}
            tabIndex={0}
            role="button"
            aria-label={`سؤال ${toPersianDigits(item.index + 1)}، ${describe(item)}`}
            onPointerEnter={() => setHover(item)}
            onFocus={() => setHover(item)}
            onClick={() => onJump(item.index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onJump(item.index);
              }
            }}
          />
        ))}
      </svg>
      <figcaption className="rx-readout" aria-live="polite">
        {hover ? (
          <>
            <b>سؤال {toPersianDigits(hover.index + 1)}</b> · {subjectName(hover.subjectCode)} · {describe(hover)} ·{" "}
            <span data-outcome={hover.outcome}>{LABEL[hover.outcome]}</span>
            <small> (برای دیدن سؤال کلیک کن)</small>
          </>
        ) : (
          <span>روی هر نقطه برو تا سؤالش را ببینی؛ با کلیک به خود سؤال می‌روی.</span>
        )}
      </figcaption>
    </figure>
  );
}

/** Time on each question, by outcome: where the minutes went and what they bought. */
export function TimeSwarm({ items, durationMs, onJump }: { items: DotItem[]; durationMs: number; onJump: (index: number) => void }) {
  const tracked = items.filter((item) => item.timeSpentMs > 0);
  if (tracked.length < 3) return null;
  const share = durationMs > 0 ? durationMs / items.length / 1000 : 0;
  const longest = Math.max(...tracked.map((item) => item.timeSpentMs / 1000));
  const top = Math.max(longest, share * 1.5, 60);
  const step = top > 600 ? 180 : top > 300 ? 120 : 60;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step).map((at) => ({
    at,
    text: at === 0 ? "۰" : `${toPersianDigits(at / 60)} دقیقه`,
  }));
  const slowWrong = tracked.filter((item) => item.outcome === "wrong" && share > 0 && item.timeSpentMs / 1000 > share * 1.5).length;
  return (
    <section className="rc-block" aria-labelledby="rx-time-title">
      <div className="rc-head">
        <h2 id="rx-time-title">زمان و نتیجهٔ هر سؤال</h2>
        <p>
          هر نقطه یک سؤال است؛ هرچه چپ‌تر، وقت بیشتری برده.
          {share > 0 && ` خط‌چین سهم هر سؤال از کل وقت است (${clock(share)}).`}
          {slowWrong > 0 && ` ${toPersianDigits(slowWrong)} سؤال هم وقت زیادی گرفت و هم نادرست شد؛ این‌ها جای صرفه‌جویی‌اند.`}
        </p>
      </div>
      <Swarm
        items={items}
        value={(item) => (item.timeSpentMs > 0 ? item.timeSpentMs / 1000 : null)}
        domain={[0, top]}
        ticks={ticks}
        reference={share > 0 ? { at: share, text: "سهم هر سؤال" } : undefined}
        describe={(item) => clock(item.timeSpentMs / 1000)}
        onJump={onJump}
        label="زمان هر سؤال به تفکیک درست، نادرست و نزده"
      />
    </section>
  );
}

/**
 * How many participants got each question right, by this student's outcome.
 * The shaded corner -- easy for most, missed here -- is the cheapest place
 * to win marks back.
 */
export function DifficultySwarm({ items, onJump }: { items: DotItem[]; onJump: (index: number) => void }) {
  if (!items.some((item) => item.crowdCorrectPercent !== null)) return null;
  const golden = items.filter((item) => item.outcome !== "correct" && (item.crowdCorrectPercent ?? 0) >= 60).length;
  return (
    <section className="rc-block" aria-labelledby="rx-diff-title">
      <div className="rc-head">
        <h2 id="rx-diff-title">سختی سؤال‌ها و نتیجهٔ تو</h2>
        <p>
          هرچه راست‌تر، شرکت‌کنندهٔ بیشتری درستش زده (آسان‌تر).
          {golden > 0
            ? ` ${toPersianDigits(golden)} سؤال در گوشهٔ رنگی‌اند: بیشتر بچه‌ها درست زدند و تو نه.`
            : " هیچ سؤال آسانی را از دست نداده‌ای."}
        </p>
      </div>
      <Swarm
        items={items}
        value={(item) => item.crowdCorrectPercent}
        domain={[0, 100]}
        ticks={[0, 25, 50, 75, 100].map((at) => ({ at, text: `${toPersianDigits(at)}٪` }))}
        band={{ from: 60, to: 100, lane: ["wrong", "blank"], text: "طلایی‌های از دست‌رفته" }}
        describe={(item) => `${toPersianDigits(item.crowdCorrectPercent ?? 0)}٪ درست زدند`}
        onJump={onJump}
        label="درصد درست‌زدن هر سؤال در میان شرکت‌کننده‌ها، به تفکیک نتیجهٔ تو"
        highOnRight
      />
    </section>
  );
}
