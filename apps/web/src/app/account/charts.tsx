import { toPersianDigits } from "../../lib/format";

/** A percentage as a ring, with the number in the middle. */
export function ProgressRing({
  percent,
  size = 96,
  stroke = 9,
  label,
  tone = "teal",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
  tone?: "teal" | "blue" | "amber" | "violet" | "light";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={`st-ring st-ring-${tone}`} style={{ width: size, height: size }} role="img" aria-label={`${label ?? "پیشرفت"}: ${clamped}٪`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle className="st-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="st-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="st-ring-text">
        <b>{toPersianDigits(clamped)}٪</b>
        {label && <small>{label}</small>}
      </span>
    </div>
  );
}

/**
 * Exam scores over time, oldest to newest. A line needs two points; with one
 * attempt the caller shows the number instead.
 */
export function ScoreTrend({ points }: { points: { value: number; label: string }[] }) {
  if (points.length < 2) return null;
  const width = 320;
  const height = 120;
  const pad = 12;
  const x = (index: number) => pad + (index * (width - pad * 2)) / (points.length - 1);
  const y = (value: number) => height - pad - (Math.max(0, Math.min(100, value)) / 100) * (height - pad * 2);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`;
  return (
    <svg className="st-trend" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="روند درصد آزمون‌ها">
      <defs>
        <linearGradient id="st-trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((mark) => (
        <line key={mark} x1={pad} x2={width - pad} y1={y(mark)} y2={y(mark)} className="st-trend-grid" />
      ))}
      <path d={area} fill="url(#st-trend-fill)" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => (
        <circle key={index} cx={x(index)} cy={y(point.value)} r="3.5" className="st-trend-dot">
          <title>{`${point.label}: ${Math.round(point.value)}٪`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Minutes studied on each of the last seven days, today last. */
export function WeekBars({ days }: { days: { label: string; minutes: number; today?: boolean }[] }) {
  const max = Math.max(30, ...days.map((day) => day.minutes));
  return (
    <div className="st-week" role="img" aria-label="دقیقه‌های مطالعهٔ هفت روز اخیر">
      {days.map((day, index) => (
        <div className={`st-week-day${day.today ? " st-week-today" : ""}`} key={index}>
          <span className="st-week-value">{day.minutes > 0 ? toPersianDigits(day.minutes) : ""}</span>
          <span className="st-week-bar">
            <span style={{ height: `${Math.max(day.minutes > 0 ? 6 : 0, (day.minutes / max) * 100)}%` }} />
          </span>
          <span className="st-week-label">{day.label}</span>
        </div>
      ))}
    </div>
  );
}
