import type { ReactNode } from "react";

/**
 * One mark per subject, each drawing the structure its subject is about -- a
 * binary tree for data structures, a gate for digital logic -- on a single
 * 24px grid at one stroke weight, so a row of them reads as a set.
 *
 * Shared by the homepage, the navigation and the subject pages; previously
 * these lived inside the homepage and nothing else could use them.
 */
const GLYPHS: Record<string, ReactNode> = {
  tree: <><circle cx="12" cy="5" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="18" r="2.2" /><path d="M10.4 6.7 7.5 16M13.6 6.7 16.5 16" /></>,
  branch: <><path d="M5 4v6a3 3 0 0 0 3 3h11" /><path d="M16 9.5 19.5 13 16 16.5" /><circle cx="5" cy="19" r="2" /><path d="M5 17v-3" /></>,
  chip: <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></>,
  cylinder: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8V6" /><path d="M5 12v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-6" /></>,
  matrix: <><path d="M7 4H4.5v16H7M17 4h2.5v16H17" /><circle cx="9.8" cy="9" r="1" /><circle cx="14.2" cy="9" r="1" /><circle cx="9.8" cy="15" r="1" /><circle cx="14.2" cy="15" r="1" /></>,
  code: <><path d="M8.5 8 4 12l4.5 4M15.5 8 20 12l-4.5 4M13.5 5l-3 14" /></>,
  graph: <><circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="18" r="2" /><path d="M8 7h8M7.1 8.8 11 16.2M16.9 8.8 13 16.2" /></>,
  hub: <><circle cx="12" cy="12" r="2.4" /><circle cx="12" cy="4" r="1.8" /><circle cx="4.5" cy="18" r="1.8" /><circle cx="19.5" cy="18" r="1.8" /><path d="M12 5.8v3.8M10.2 13.6 6 16.6M13.8 13.6 18 16.6" /></>,
  curve: <><path d="M3 18c4 0 5-11 9-11s5 11 9 11" /><path d="M3 21h18" /></>,
  gate: <><path d="M6 6h5a6 6 0 0 1 0 12H6z" /><path d="M2 9h4M2 15h4M17 12h5" /></>,
  automaton: <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v4M18.4 12h3.6" /></>,
  glyph: <><path d="M4 19 9 5l5 14M5.8 15h6.4" /><path d="M17 10v9M17 10c2.5 0 3.5 1.4 3.5 3s-1 3-3.5 3" /></>,
  neural: <><circle cx="5" cy="7" r="1.8" /><circle cx="5" cy="17" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="7" r="1.8" /><circle cx="19" cy="17" r="1.8" /><path d="M6.6 8.1 10.5 10.8M6.6 15.9 10.5 13.2M13.5 10.8 17.4 8.1M13.5 13.2 17.4 15.9" /></>,
  layers: <><path d="M12 3 3 7.5 12 12l9-4.5z" /><path d="m3 12.5 9 4.5 9-4.5" /><path d="m3 17 9 4.5 9-4.5" /></>,
  flow: <><rect x="3" y="4" width="7" height="5" rx="1.4" /><rect x="14" y="15" width="7" height="5" rx="1.4" /><path d="M6.5 9v5.5a2 2 0 0 0 2 2H14" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-5 2 2-5z" /></>,
  pace: <><circle cx="12" cy="13" r="8" /><path d="M12 13V8.5M9.5 2h5" /></>,
  flag: <><path d="M5 21V4M5 4h13l-2.5 4L18 12H5" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5.5 3.5-5.5 3.5z" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  building: <><path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-5h6v5M3 20h18" /></>,
  chat: <><path d="M20 12a8 8 0 0 1-11.8 7L4 20l1-4.2A8 8 0 1 1 20 12z" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>,
  shield: <><path d="M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
};

export type GlyphName = keyof typeof GLYPHS;

export const SUBJECT_GLYPH: Record<string, GlyphName> = {
  english: "glyph",
  "discrete-math": "graph",
  statistics: "curve",
  "linear-algebra": "matrix",
  "programming-fundamentals": "code",
  "digital-logic": "gate",
  "computer-architecture": "chip",
  "data-structures-algorithms": "tree",
  "data-structures": "tree",
  algorithms: "branch",
  automata: "automaton",
  "operating-systems": "chip",
  "artificial-intelligence": "neural",
  "computer-networks": "hub",
  databases: "cylinder",
  "software-engineering": "layers",
  "it-management": "flow",
};

/**
 * Colour family per subject, by the exam package it sits in -- so the tint
 * carries a grouping a candidate needs, instead of decorating the grid at
 * random. Maths is violet, the core computing subjects teal, hardware blue,
 * language amber, the IT track rose.
 */
export const SUBJECT_TONE: Record<string, "violet" | "teal" | "blue" | "amber" | "rose"> = {
  "discrete-math": "violet",
  statistics: "violet",
  "linear-algebra": "violet",
  english: "amber",
  "programming-fundamentals": "teal",
  "data-structures-algorithms": "teal",
  "data-structures": "teal",
  algorithms: "teal",
  automata: "teal",
  "artificial-intelligence": "teal",
  "digital-logic": "blue",
  "computer-architecture": "blue",
  "operating-systems": "blue",
  "computer-networks": "rose",
  databases: "rose",
  "software-engineering": "rose",
  "it-management": "rose",
};

export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  );
}

export function SubjectGlyph({ slug, className }: { slug: string; className?: string }) {
  return <Glyph name={SUBJECT_GLYPH[slug] ?? "book"} className={className} />;
}
