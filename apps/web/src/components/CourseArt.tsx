import { toPersianDigits } from "../lib/format";
import { SubjectGlyph } from "./SubjectIcon";
import "./course-art.css";

/**
 * The picture on a course's cover: the publisher's photo set inside a
 * drawing of the subject, in white on the subject's colour (owner, 2026-10-06:
 * "a creative mix of my photo and the subject's mark").
 *
 * - Data structures: a binary search tree whose root is the publisher, with
 *   the search for ۱۰ lit up from them down to the answer.
 * - Theory of languages: an automaton whose start state is the publisher.
 * - Anything else: the photo with the subject's mark as a badge.
 *
 * A test course adds an answer sheet with one bubble filled.
 */

const ACCENT = "#ffd166";

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

function SearchTree({ uid, avatar }: { uid: string; avatar: string }) {
  // A BST of 8, 4, 12, 2, 6, 10, 14 with the publisher at the root (8); the
  // path to 10 goes root → 12 → 10.
  const root = { x: 160, y: 40 };
  const nodes = [
    { x: 98, y: 92, v: 4 },
    { x: 222, y: 92, v: 12, lit: true },
    { x: 66, y: 136, v: 2 },
    { x: 130, y: 136, v: 6 },
    { x: 190, y: 136, v: 10, lit: true, found: true },
    { x: 254, y: 136, v: 14 },
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
        <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lit ? ACCENT : "rgba(255,255,255,0.55)"} strokeWidth={lit ? 4 : 2.5} strokeLinecap="round" />
      ))}
      {nodes.map((node) => (
        <g key={node.v}>
          {node.found && <circle cx={node.x} cy={node.y} r="20" fill="none" stroke={ACCENT} strokeWidth="2" opacity="0.6" />}
          <circle cx={node.x} cy={node.y} r="14" fill={node.lit ? ACCENT : "#fff"} />
          <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0c1b2e">
            {toPersianDigits(node.v)}
          </text>
        </g>
      ))}
      <Portrait uid={uid} href={avatar} x={root.x} y={root.y} r={25} />
    </>
  );
}

function Automaton({ uid, avatar }: { uid: string; avatar: string }) {
  const y = 80;
  const line = "rgba(255,255,255,0.85)";
  const arrow = `ca-arrow-${uid}`;
  const arrowLit = `ca-arrow-lit-${uid}`;
  return (
    <>
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill={line} />
        </marker>
        <marker id={arrowLit} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill={ACCENT} />
        </marker>
      </defs>
      {/* start arrow into the publisher, the start state */}
      <line x1="14" y1={y} x2="38" y2={y} stroke={line} strokeWidth="2.5" markerEnd={`url(#${arrow})`} />
      {/* q0 → q1 on a, q1 → q2 on b */}
      <line x1="104" y1={y} x2="146" y2={y} stroke={ACCENT} strokeWidth="3" markerEnd={`url(#${arrowLit})`} />
      <text x="125" y={y - 9} textAnchor="middle" fontSize="13" fontWeight="700" fill={ACCENT}>a</text>
      <line x1="192" y1={y} x2="234" y2={y} stroke={ACCENT} strokeWidth="3" markerEnd={`url(#${arrowLit})`} />
      <text x="213" y={y - 9} textAnchor="middle" fontSize="13" fontWeight="700" fill={ACCENT}>b</text>
      {/* q1 loops on a */}
      <path d={`M160 ${y - 20} C150 ${y - 58} 190 ${y - 58} 180 ${y - 20}`} fill="none" stroke={line} strokeWidth="2.5" markerEnd={`url(#${arrow})`} />
      <text x="170" y={y - 50} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">a</text>
      {/* q2 back to the start on b */}
      <path d={`M252 ${y + 22} C222 ${y + 70} 106 ${y + 70} 78 ${y + 30}`} fill="none" stroke={line} strokeWidth="2.5" strokeDasharray="5 5" markerEnd={`url(#${arrow})`} />
      <text x="166" y={y + 66} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">b</text>
      <circle cx="170" cy={y} r="21" fill="#fff" />
      <text x="170" y={y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0c1b2e" fontFamily="system-ui, sans-serif">q₁</text>
      <circle cx="258" cy={y} r="27" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="258" cy={y} r="21" fill={ACCENT} />
      <text x="258" y={y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0c1b2e" fontFamily="system-ui, sans-serif">q₂</text>
      <Portrait uid={uid} href={avatar} x={72} y={y} r={27} ring="#fff" />
    </>
  );
}

/** A corner of an answer sheet: four bubbles, the second filled. */
function AnswerSheet() {
  return (
    <g transform="translate(258 14) rotate(8)">
      <rect x="0" y="0" width="54" height="34" rx="6" fill="#fff" opacity="0.95" />
      {[0, 1, 2, 3].map((index) => (
        <circle key={index} cx={10 + index * 11.5} cy="17" r="4.2" fill={index === 1 ? "#0c1b2e" : "none"} stroke="#0c1b2e" strokeWidth="1.5" />
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
  const isTree = subject === "data-structures-algorithms" || subject === "data-structures" || subject === "algorithms";
  if (avatar && (isTree || subject === "automata")) {
    return (
      <svg className={`ca ${className ?? ""}`} viewBox="0 0 320 170" aria-hidden="true" focusable="false">
        {isTree ? <SearchTree uid={uid} avatar={avatar} /> : <Automaton uid={uid} avatar={avatar} />}
        {tests && <AnswerSheet />}
      </svg>
    );
  }
  return (
    <span className={`ca-badge ${className ?? ""}`} aria-hidden="true">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ca-badge-photo" src={avatar} alt="" />
      ) : null}
      <span className="ca-badge-mark">
        <SubjectGlyph slug={subject ?? ""} />
      </span>
    </span>
  );
}
