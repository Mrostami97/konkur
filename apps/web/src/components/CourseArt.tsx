import type { ReactNode } from "react";
import { toPersianDigits } from "../lib/format";
import "./course-art.css";

/**
 * The picture on a course's cover: a small, true drawing of what the subject
 * is about, in white and gold on the subject's colour -- a search in a binary
 * tree, an automaton, a circuit with its lamp lit, a pipeline, a schedule.
 * Where the scene has a natural "start" (the tree's root, the automaton's
 * start state) the publisher's photo sits there (owner, 2026-10-06: "a
 * creative mix of my photo and the subject's mark"); other scenes leave the
 * photo to the card's publisher line. Without a photo every scene is still
 * complete -- before, a course whose teacher had no photo showed a
 * lone yellow dot.
 *
 * A test course adds an answer sheet with one bubble filled.
 */

const ACCENT = "#ffd166";
const INK = "#0c1b2e";
const LINE = "rgba(255,255,255,0.85)";
const DIM = "rgba(255,255,255,0.5)";
const FAINT = "rgba(255,255,255,0.16)";

type Scene = (props: { uid: string; avatar: string | null }) => ReactNode;

/** A round photo with a ring, centred on (x, y). `uid` keeps clip ids unique per card. */
function Portrait({ uid, href, x, y, r, ring = ACCENT }: { uid: string; href: string; x: number; y: number; r: number; ring?: string }) {
  const clip = `ca-clip-${uid}`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      </defs>
      <circle cx={x} cy={y} r={r + 7} fill={ring} opacity="0.28" />
      <circle cx={x} cy={y} r={r + 3} fill={ring} />
      <image href={href} x={x - r} y={y - r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
    </g>
  );
}

/** A labelled node; `lit` ones are gold with a halo. */
function Node({ x, y, r = 14, label, lit = false, size = 13 }: { x: number; y: number; r?: number; label: string; lit?: boolean; size?: number }) {
  return (
    <g>
      {lit && <circle cx={x} cy={y} r={r + 6} fill={ACCENT} opacity="0.25" />}
      <circle cx={x} cy={y} r={r} fill={lit ? ACCENT : "#fff"} />
      <text x={x} y={y + size * 0.36} textAnchor="middle" fontSize={size} fontWeight="800" fill={INK}>
        {label}
      </text>
    </g>
  );
}

/** Faint sparkles that keep the corners of a cover from looking empty. */
function Sparkles() {
  const dots: [number, number, number][] = [[18, 22, 2], [300, 150, 2.4], [292, 28, 1.6], [26, 150, 1.6], [150, 160, 1.4]];
  return (
    <g fill="#fff" opacity="0.35">
      {dots.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}
      <path d="M306 74v8M302 78h8M12 94v6M9 97h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function arrowMarkers(uid: string) {
  return (
    <defs>
      <marker id={`ca-arrow-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 10 5 0 10z" fill={LINE} />
      </marker>
      <marker id={`ca-arrow-lit-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 10 5 0 10z" fill={ACCENT} />
      </marker>
    </defs>
  );
}

/** Data structures: a search for ۱۰ in a binary search tree, lit root to answer. */
const SearchTree: Scene = ({ uid, avatar }) => {
  const root = { x: 160, y: 40 };
  const nodes = [
    { x: 98, y: 92, v: 4 },
    { x: 222, y: 92, v: 12, lit: true },
    { x: 66, y: 138, v: 2 },
    { x: 130, y: 138, v: 6 },
    { x: 190, y: 138, v: 10, lit: true, found: true },
    { x: 254, y: 138, v: 14 },
  ];
  const edges: [{ x: number; y: number }, { x: number; y: number }, boolean][] = [
    [root, nodes[0], false],
    [root, nodes[1], true],
    [nodes[0], nodes[2], false],
    [nodes[0], nodes[3], false],
    [nodes[1], nodes[4], true],
    [nodes[1], nodes[5], false],
  ];
  return (
    <>
      {edges.map(([a, b, lit], index) => (
        <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lit ? ACCENT : DIM} strokeWidth={lit ? 4 : 2.5} strokeLinecap="round" />
      ))}
      {nodes.map((node) => (
        <g key={node.v}>
          {node.found && <circle cx={node.x} cy={node.y} r="21" fill="none" stroke={ACCENT} strokeWidth="2" strokeDasharray="3 4" />}
          <Node x={node.x} y={node.y} label={toPersianDigits(node.v)} lit={node.lit} />
        </g>
      ))}
      {avatar ? <Portrait uid={uid} href={avatar} x={root.x} y={root.y} r={25} /> : <Node x={root.x} y={root.y} r={19} label={toPersianDigits(8)} lit size={16} />}
    </>
  );
};

/** Theory of languages: an automaton reading "ab", its start state the publisher. */
const Automaton: Scene = ({ uid, avatar }) => {
  const y = 80;
  const arrow = `url(#ca-arrow-${uid})`;
  const arrowLit = `url(#ca-arrow-lit-${uid})`;
  return (
    <>
      {arrowMarkers(uid)}
      <line x1="14" y1={y} x2="38" y2={y} stroke={LINE} strokeWidth="2.5" markerEnd={arrow} />
      <line x1="104" y1={y} x2="146" y2={y} stroke={ACCENT} strokeWidth="3" markerEnd={arrowLit} />
      <text x="125" y={y - 9} textAnchor="middle" fontSize="13" fontWeight="700" fill={ACCENT}>a</text>
      <line x1="192" y1={y} x2="234" y2={y} stroke={ACCENT} strokeWidth="3" markerEnd={arrowLit} />
      <text x="213" y={y - 9} textAnchor="middle" fontSize="13" fontWeight="700" fill={ACCENT}>b</text>
      <path d={`M160 ${y - 20} C150 ${y - 58} 190 ${y - 58} 180 ${y - 20}`} fill="none" stroke={LINE} strokeWidth="2.5" markerEnd={arrow} />
      <text x="170" y={y - 50} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">a</text>
      <path d={`M252 ${y + 22} C222 ${y + 70} 106 ${y + 70} 78 ${y + 30}`} fill="none" stroke={LINE} strokeWidth="2.5" strokeDasharray="5 5" markerEnd={arrow} />
      <text x="166" y={y + 66} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">b</text>
      <circle cx="170" cy={y} r="21" fill="#fff" />
      <text x="170" y={y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">q₁</text>
      <circle cx="258" cy={y} r="27" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="258" cy={y} r="21" fill={ACCENT} />
      <text x="258" y={y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">q₂</text>
      {avatar ? (
        <Portrait uid={uid} href={avatar} x={72} y={y} r={27} ring="#fff" />
      ) : (
        <>
          <circle cx="72" cy={y} r="31" fill="#fff" opacity="0.25" />
          <circle cx="72" cy={y} r="25" fill="#fff" />
          <text x="72" y={y + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">q₀</text>
        </>
      )}
    </>
  );
};

/** Digital logic: (A AND B) OR C with A = B = ۱, the lamp lit. */
const Circuit: Scene = () => {
  const wire = (d: string, lit: boolean) => <path d={d} fill="none" stroke={lit ? ACCENT : DIM} strokeWidth={lit ? 3.2 : 2.4} strokeLinecap="round" strokeLinejoin="round" />;
  const input = (y: number, name: string, value: number) => (
    <g>
      <rect x="18" y={y - 12} width="40" height="24" rx="12" fill={value ? ACCENT : "#fff"} opacity={value ? 1 : 0.9} />
      <text x="38" y={y + 5} textAnchor="middle" fontSize="12" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">{`${name}=${value}`}</text>
    </g>
  );
  return (
    <>
      {wire("M58 52H112", true)}
      {wire("M58 88H112", true)}
      {wire("M58 136H186V112H208", false)}
      {wire("M162 70H186V88H208", true)}
      {wire("M262 100H282", true)}
      {/* AND */}
      <path d="M112 42h24a28 28 0 0 1 0 56h-24z" fill="#fff" />
      <text x="134" y="75" textAnchor="middle" fontSize="11" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">AND</text>
      {/* OR */}
      <path d="M204 74q14 26 0 52q40 0 60-26q-20-26-60-26z" fill="#fff" />
      <text x="232" y="104" textAnchor="middle" fontSize="11" fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">OR</text>
      {/* lamp */}
      <circle cx="296" cy="100" r="22" fill={ACCENT} opacity="0.22" />
      <circle cx="296" cy="100" r="13" fill={ACCENT} />
      <path d="M296 70v-8M296 138v-8M266 100h-2M318 82l6-5M318 118l6 5" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
      {input(52, "A", 1)}
      {input(88, "B", 1)}
      {input(136, "C", 0)}
    </>
  );
};

/** Computer architecture: a five-stage pipeline, three instructions overlapped. */
const Pipeline: Scene = () => {
  const stages = ["IF", "ID", "EX", "MEM", "WB"];
  const cell = { w: 34, h: 26, gap: 4 };
  const x0 = 52;
  const rows = [36, 74, 112];
  return (
    <>
      {/* clock ticks */}
      {Array.from({ length: 7 }, (_, index) => (
        <line key={index} x1={x0 + index * (cell.w + cell.gap) - 2} y1="22" x2={x0 + index * (cell.w + cell.gap) - 2} y2="148" stroke={FAINT} strokeWidth="1.5" strokeDasharray="2 4" />
      ))}
      {rows.map((y, row) => (
        <g key={y}>
          <text x="30" y={y + 18} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">{`I${row + 1}`}</text>
          {stages.map((stage, index) => {
            const x = x0 + (index + row) * (cell.w + cell.gap);
            // The same moment (column 3) is lit in every row: three stages at work at once.
            const lit = index + row === 2;
            return (
              <g key={stage}>
                <rect x={x} y={y} width={cell.w} height={cell.h} rx="7" fill={lit ? ACCENT : "#fff"} opacity={lit ? 1 : 0.92 - row * 0.12} />
                <text x={x + cell.w / 2} y={y + 17} textAnchor="middle" fontSize={stage === "MEM" ? 9 : 10.5} fontWeight="800" fill={INK} fontFamily="system-ui, sans-serif">{stage}</text>
              </g>
            );
          })}
        </g>
      ))}
    </>
  );
};

/** Operating systems: a round-robin schedule in a window. */
const Schedule: Scene = () => {
  const bars: [number, number, number, string][] = [
    // row, start, length, colour
    [0, 0, 2, ACCENT], [1, 2, 2, "#fff"], [2, 4, 1, DIM], [0, 5, 2, ACCENT], [1, 7, 1, "#fff"], [0, 8, 1, ACCENT],
  ];
  const unit = 21;
  const x0 = 92;
  return (
    <>
      <rect x="30" y="16" width="260" height="138" rx="14" fill="rgba(12,27,46,0.28)" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <path d="M30 40h260" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      {[48, 62, 76].map((x, index) => <circle key={x} cx={x} cy="28" r="4.5" fill={index === 0 ? ACCENT : DIM} />)}
      {["P1", "P2", "P3"].map((name, row) => (
        <text key={name} x="62" y={68 + row * 30} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">{name}</text>
      ))}
      {bars.map(([row, start, length, colour]) => (
        <rect key={`${row}-${start}`} x={x0 + start * unit} y={55 + row * 30} width={length * unit - 3} height="18" rx="6" fill={colour} />
      ))}
      <path d={`M${x0} 146H${x0 + 9 * unit}`} stroke={DIM} strokeWidth="2" strokeLinecap="round" />
      {Array.from({ length: 10 }, (_, index) => <path key={index} d={`M${x0 + index * unit} 142v8`} stroke={DIM} strokeWidth="1.6" />)}
    </>
  );
};

/** Discrete maths: a graph coloured properly with three colours. */
const ColouredGraph: Scene = () => {
  const v = [
    { x: 160, y: 30, c: ACCENT }, { x: 90, y: 70, c: "#fff" }, { x: 230, y: 70, c: "#fff" },
    { x: 115, y: 140, c: ACCENT }, { x: 205, y: 140, c: "dark" }, { x: 160, y: 92, c: "dark" },
  ];
  const e: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [5, 0], [5, 1], [5, 2], [5, 3]];
  return (
    <>
      {e.map(([a, b]) => <line key={`${a}${b}`} x1={v[a].x} y1={v[a].y} x2={v[b].x} y2={v[b].y} stroke={DIM} strokeWidth="2.6" strokeLinecap="round" />)}
      {v.map((p, index) => (
        <g key={index}>
          {p.c === ACCENT && <circle cx={p.x} cy={p.y} r="20" fill={ACCENT} opacity="0.25" />}
          <circle cx={p.x} cy={p.y} r="14" fill={p.c === "dark" ? "rgba(12,27,46,0.55)" : p.c} stroke="#fff" strokeWidth={p.c === "dark" ? 3 : 0} />
        </g>
      ))}
      <text x="276" y="150" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">χ = 3</text>
    </>
  );
};

/** Statistics: a histogram under its normal curve, the mean marked. */
const BellCurve: Scene = () => {
  const heights = [10, 24, 46, 74, 92, 74, 46, 24, 10];
  return (
    <>
      {heights.map((h, index) => (
        <rect key={index} x={52 + index * 24} y={146 - h} width="20" height={h} rx="4" fill={index === 4 ? ACCENT : "#fff"} opacity={index === 4 ? 0.95 : 0.45} />
      ))}
      <path d="M40 144C90 144 110 46 160 46S230 144 280 144" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M162 30V146" stroke={ACCENT} strokeWidth="2.4" strokeDasharray="4 5" />
      <text x="162" y="22" textAnchor="middle" fontSize="15" fontWeight="800" fill={ACCENT} fontFamily="system-ui, sans-serif">μ</text>
      <path d="M36 146H284" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
    </>
  );
};

/** Linear algebra: two vectors, their sum, and the matrix that moves them. */
const Vectors: Scene = ({ uid }) => {
  const o = { x: 70, y: 140 };
  return (
    <>
      {arrowMarkers(uid)}
      {Array.from({ length: 6 }, (_, index) => <path key={`v${index}`} d={`M${o.x + index * 26} 20V${o.y}`} stroke={FAINT} strokeWidth="1.2" />)}
      {Array.from({ length: 5 }, (_, index) => <path key={`h${index}`} d={`M${o.x} ${o.y - index * 26}H${o.x + 130}`} stroke={FAINT} strokeWidth="1.2" />)}
      <path d={`M${o.x + 104} ${o.y}L${o.x + 130} ${o.y - 78}M${o.x + 26} ${o.y - 78}L${o.x + 130} ${o.y - 78}`} stroke={DIM} strokeWidth="2" strokeDasharray="4 5" />
      <line x1={o.x} y1={o.y} x2={o.x + 102} y2={o.y} stroke="#fff" strokeWidth="3.2" markerEnd={`url(#ca-arrow-${uid})`} />
      <line x1={o.x} y1={o.y} x2={o.x + 25} y2={o.y - 75} stroke="#fff" strokeWidth="3.2" markerEnd={`url(#ca-arrow-${uid})`} />
      <line x1={o.x} y1={o.y} x2={o.x + 127} y2={o.y - 76} stroke={ACCENT} strokeWidth="3.8" markerEnd={`url(#ca-arrow-lit-${uid})`} />
      <g fontFamily="system-ui, sans-serif" fontWeight="800" fill="#fff" fontSize="14">
        <path d="M232 52h-6v64h6M290 52h6v64h-6" fill="none" stroke="#fff" strokeWidth="2.6" />
        <text x="246" y="78" textAnchor="middle">2</text>
        <text x="274" y="78" textAnchor="middle">1</text>
        <text x="246" y="104" textAnchor="middle">1</text>
        <text x="274" y="104" textAnchor="middle" fill={ACCENT}>3</text>
      </g>
    </>
  );
};

/** Artificial intelligence: a small network with one path of activation lit. */
const Network: Scene = () => {
  const layers = [[50, 85, 120], [30, 66, 104, 140], [62, 108]];
  const xs = [70, 160, 250];
  return (
    <>
      {layers.slice(0, -1).map((layer, l) =>
        layer.flatMap((y, i) =>
          layers[l + 1].map((y2, j) => {
            const on = (l === 0 && i === 1 && j === 1) || (l === 1 && i === 1 && j === 0);
            return <line key={`${l}-${i}-${j}`} x1={xs[l]} y1={y} x2={xs[l + 1]} y2={y2} stroke={on ? ACCENT : "rgba(255,255,255,0.32)"} strokeWidth={on ? 3.4 : 1.6} />;
          }),
        ),
      )}
      {layers.map((layer, l) =>
        layer.map((y, i) => {
          const on = (l === 0 && i === 1) || (l === 1 && i === 1) || (l === 2 && i === 0);
          return (
            <g key={`${l}-${i}`}>
              {on && <circle cx={xs[l]} cy={y} r="18" fill={ACCENT} opacity="0.25" />}
              <circle cx={xs[l]} cy={y} r="11" fill={on ? ACCENT : "#fff"} />
            </g>
          );
        }),
      )}
    </>
  );
};

/** Computer networks: a packet crossing a small network on its lit route. */
const Topology: Scene = () => {
  const n = [{ x: 46, y: 85 }, { x: 116, y: 38 }, { x: 116, y: 132 }, { x: 204, y: 85 }, { x: 276, y: 40 }, { x: 276, y: 132 }];
  const e: [number, number, boolean][] = [[0, 1, true], [0, 2, false], [1, 2, false], [1, 3, true], [2, 3, false], [3, 4, false], [3, 5, true]];
  return (
    <>
      {e.map(([a, b, on]) => <line key={`${a}${b}`} x1={n[a].x} y1={n[a].y} x2={n[b].x} y2={n[b].y} stroke={on ? ACCENT : DIM} strokeWidth={on ? 3.4 : 2.2} strokeLinecap="round" />)}
      {n.map((p, index) => (
        <g key={index}>
          <rect x={p.x - 17} y={p.y - 13} width="34" height="26" rx="8" fill={index === 0 || index === 5 ? ACCENT : "#fff"} />
          <path d={`M${p.x - 8} ${p.y + 3}h16M${p.x - 8} ${p.y - 3}h10`} stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      {/* the packet, mid-way along 1 → 3 */}
      <rect x="152" y="52" width="18" height="13" rx="3" fill="#fff" stroke={ACCENT} strokeWidth="2.5" transform="rotate(28 161 58)" />
    </>
  );
};

/** Databases: two tables joined on a key. */
const Tables: Scene = () => {
  const table = (x: number, y: number, rows: number, keyRow: number) => (
    <g>
      <rect x={x} y={y} width="96" height={24 + rows * 20} rx="9" fill="#fff" opacity="0.95" />
      <rect x={x} y={y} width="96" height="24" rx="9" fill={ACCENT} />
      <rect x={x} y={y + 14} width="96" height="10" fill={ACCENT} />
      {Array.from({ length: rows }, (_, index) => (
        <g key={index}>
          <path d={`M${x + 12} ${y + 36 + index * 20}h${index === keyRow ? 30 : 46}`} stroke={index === keyRow ? "#c98a00" : "rgba(12,27,46,0.35)"} strokeWidth="5" strokeLinecap="round" />
          <path d={`M${x + 64} ${y + 36 + index * 20}h20`} stroke="rgba(12,27,46,0.2)" strokeWidth="5" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
  return (
    <>
      <path d="M126 78C160 78 160 118 194 118" fill="none" stroke={ACCENT} strokeWidth="3.2" />
      <path d="M186 110l8 8-8 8M194 110v16" fill="none" stroke={ACCENT} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {table(30, 30, 4, 1)}
      {table(194, 66, 3, 1)}
    </>
  );
};

/** English: an open book with letters rising from it. */
const Book: Scene = () => (
  <>
    <path d="M160 58c-30-14-70-14-100 0v86c30-14 70-14 100 0z" fill="#fff" opacity="0.95" />
    <path d="M160 58c30-14 70-14 100 0v86c-30-14-70-14-100 0z" fill="#fff" opacity="0.8" />
    <path d="M160 58v86" stroke="rgba(12,27,46,0.25)" strokeWidth="2" />
    {[78, 92, 106, 120].map((y) => (
      <g key={y}>
        <path d={`M76 ${y}h${y === 92 ? 52 : 68}`} stroke="rgba(12,27,46,0.3)" strokeWidth="4" strokeLinecap="round" />
        <path d={`M178 ${y}h${y === 106 ? 44 : 64}`} stroke="rgba(12,27,46,0.22)" strokeWidth="4" strokeLinecap="round" />
      </g>
    ))}
    <g fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700">
      <text x="120" y="40" fontSize="30" fill={ACCENT} transform="rotate(-10 120 40)">A</text>
      <text x="168" y="30" fontSize="22" fill="#fff">b</text>
      <text x="204" y="44" fontSize="26" fill="#fff" opacity="0.8" transform="rotate(12 204 44)">c</text>
    </g>
  </>
);

/** Programming: a code window. */
const Code: Scene = () => (
  <>
    <rect x="44" y="20" width="232" height="132" rx="14" fill="rgba(12,27,46,0.4)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
    {[60, 74, 88].map((x, index) => <circle key={x} cx={x} cy="34" r="4.5" fill={index === 0 ? ACCENT : DIM} />)}
    {[
      [64, 60, 40, ACCENT, 70, "#fff"],
      [84, 78, 30, "#fff", 50, DIM],
      [84, 96, 56, DIM, 40, ACCENT],
      [64, 114, 24, ACCENT, 0, ""],
      [64, 132, 70, DIM, 0, ""],
    ].map(([x, y, w, c, w2, c2]) => (
      <g key={`${x}-${y}`}>
        <path d={`M${x} ${y}h${w}`} stroke={c as string} strokeWidth="7" strokeLinecap="round" />
        {(w2 as number) > 0 && <path d={`M${(x as number) + (w as number) + 14} ${y}h${w2}`} stroke={c2 as string} strokeWidth="7" strokeLinecap="round" />}
      </g>
    ))}
    <text x="248" y="134" textAnchor="middle" fontSize="26" fontWeight="800" fill={ACCENT} fontFamily="ui-monospace, monospace">{"{}"}</text>
  </>
);

/** Anything else: a small constellation. */
const Constellation: Scene = () => {
  const p = [[60, 120], [110, 60], [170, 96], [230, 40], [270, 116]];
  return (
    <>
      <path d={`M${p.map(([x, y]) => `${x} ${y}`).join("L")}`} fill="none" stroke={DIM} strokeWidth="2.4" strokeLinejoin="round" />
      {p.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={index === 2 ? 11 : 7} fill={index === 2 ? ACCENT : "#fff"} />)}
    </>
  );
};

const SCENES: Record<string, Scene> = {
  "data-structures-algorithms": SearchTree,
  "data-structures": SearchTree,
  algorithms: SearchTree,
  automata: Automaton,
  "digital-logic": Circuit,
  "computer-architecture": Pipeline,
  "operating-systems": Schedule,
  "discrete-math": ColouredGraph,
  statistics: BellCurve,
  "linear-algebra": Vectors,
  "artificial-intelligence": Network,
  "computer-networks": Topology,
  databases: Tables,
  "software-engineering": Tables,
  "it-management": Topology,
  english: Book,
  "programming-fundamentals": Code,
};

/** A corner of an answer sheet: four bubbles, the second filled. */
function AnswerSheet() {
  return (
    <g transform="translate(250 10) rotate(8)">
      <rect x="0" y="0" width="62" height="40" rx="7" fill="#fff" />
      <path d="M8 10h22" stroke="rgba(12,27,46,0.3)" strokeWidth="3" strokeLinecap="round" />
      {[0, 1, 2, 3].map((index) => (
        <circle key={index} cx={11 + index * 13.3} cy="26" r="4.8" fill={index === 1 ? INK : "none"} stroke={INK} strokeWidth="1.6" />
      ))}
    </g>
  );
}

export function CourseArt({
  subject,
  tests,
  avatar,
  uid,
  className,
}: {
  subject: string | null;
  tests: boolean;
  /** The publisher's photo; without one the drawing stands alone. */
  avatar: string | null;
  uid: string;
  className?: string;
}) {
  const Scene = (subject && SCENES[subject]) || Constellation;
  const id = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg className={`ca ${className ?? ""}`} viewBox="0 0 320 170" aria-hidden="true" focusable="false">
      <Sparkles />
      <Scene uid={id} avatar={avatar} />
      {tests && <AnswerSheet />}
    </svg>
  );
}
