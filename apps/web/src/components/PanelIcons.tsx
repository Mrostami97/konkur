import type { JSX } from "react";

/**
 * Line icons for the panel sidebars and KPI tiles.
 *
 * Inline SVG rather than an icon package: the panel needs about a dozen
 * glyphs, and a dependency for that would ship thousands. They inherit
 * `currentColor` and a 1.7 stroke so a row's icon always matches its label,
 * including in the active and hover states.
 */
export type IconName =
  | "article"
  | "resource"
  | "source"
  | "people"
  | "tag"
  | "question"
  | "exam"
  | "course"
  | "import"
  | "commerce"
  | "instructor"
  | "consult"
  | "crm"
  | "chart"
  | "university"
  | "money"
  | "students"
  | "clock"
  | "check"
  | "trophy";

const PATHS: Record<IconName, JSX.Element> = {
  article: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  resource: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />,
  source: <path d="M12 3v18M4 7h16M4 17h16" />,
  people: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20a6 6 0 0 1 12 0M17 8.5a2.5 2.5 0 1 0 0-5M18 20a5.5 5.5 0 0 0-2-4.3" />,
  tag: <path d="M3 12.5 11 4h8v8l-8.5 8.5a1.5 1.5 0 0 1-2.1 0L3 15.1a1.8 1.8 0 0 1 0-2.6M15.5 7.5h.01" />,
  question: <path d="M9.2 9a3 3 0 1 1 4 2.8c-.8.3-1.2 1-1.2 1.8v.4M12 17.5h.01M4 4h16v16H4z" />,
  exam: <path d="M7 3h10v18l-5-3-5 3zM9.5 8.5l1.8 1.8 3.2-3.3" />,
  course: <path d="M3 8.5 12 4l9 4.5-9 4.5zM6.5 11v5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5" />,
  import: <path d="M12 3v11M8 10.5l4 4 4-4M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />,
  commerce: <path d="M3 5h2.2l2 11h10.4l2-8H6M9.5 20.5h.01M17 20.5h.01" />,
  instructor: <path d="M12 3 3 7.5l9 4.5 9-4.5zM7 10.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5.5M21 7.5V13" />,
  consult: <path d="M20 12a8 8 0 1 1-3.2-6.4M4 20.5 5.5 16M9 11h.01M12.5 11h.01M16 11h.01" />,
  crm: <path d="M4 20a6 6 0 0 1 12 0M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M18 4.5l1.3 2.7 2.7.4-2 2 .5 2.9-2.5-1.4-2.5 1.4.5-2.9-2-2 2.7-.4z" />,
  chart: <path d="M4 20V4M4 20h16M8 17v-5M12.5 17V8M17 17v-7" />,
  university: <path d="M12 3 2.5 8 12 13l9.5-5zM6 11v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6" />,
  money: <path d="M3 6h18v12H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M6.5 9.5h.01M17.5 14.5h.01" />,
  students: <path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M2 20a6 6 0 0 1 12 0M16.5 9a2.5 2.5 0 1 0 0-5M22 20a5.5 5.5 0 0 0-3.5-5.1" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7.5V12l3 2" />,
  check: <path d="M20 6 9.5 16.5 4 11" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />,
};

export function PanelIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
