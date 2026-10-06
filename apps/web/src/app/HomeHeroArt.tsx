import Image from "next/image";
import { Glyph, SUBJECT_GLYPH } from "../components/SubjectIcon";

/**
 * The homepage's picture: the logo's pentagon drawn large, with a subject at
 * each node and signals running round the cycle -- the subjects of the exam
 * are one connected graph, and the site sits in the middle of it. Two real
 * results from the evidence page float beside it.
 *
 * Node positions and colours follow /brand/konkurcom-logo.png.
 */

const NODES = [
  { x: 301, y: 44, color: "#ef0809", subject: "data-structures-algorithms", label: "داده‌ساختار" },
  { x: 527, y: 199, color: "#086ef6", subject: "automata", label: "نظریه زبان‌ها" },
  { x: 461, y: 466, color: "#09b90d", subject: "operating-systems", label: "سیستم عامل" },
  { x: 139, y: 466, color: "#ee0808", subject: "discrete-math", label: "گسسته" },
  { x: 73, y: 199, color: "#086ef6", subject: "databases", label: "پایگاه داده" },
] as const;

const W = 600;
const H = 520;
const CYCLE = `M${NODES.map((node) => `${node.x} ${node.y}`).join(" L")} Z`;

export function HomeHeroArt({ proof }: { proof: { value: string; label: string }[] }) {
  return (
    <div className="hx-art">
      <div className="hx-art-board" aria-hidden="true">
        <span className="hx-blob hx-blob-a" />
        <span className="hx-blob hx-blob-b" />
        <span className="hx-blob hx-blob-c" />
        <svg className="hx-art-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <path d={CYCLE} className="hx-art-edge" />
          {/* Spokes from every subject to the centre. */}
          {NODES.map((node) => (
            <line key={node.subject} x1={node.x} y1={node.y} x2={W / 2} y2={H / 2 + 6} className="hx-art-spoke" />
          ))}
          {[0, 1, 2].map((index) => (
            <circle key={index} r="7" className="hx-art-pulse">
              <animateMotion dur="9s" begin={`${-index * 3}s`} repeatCount="indefinite" path={CYCLE} />
            </circle>
          ))}
        </svg>
        {NODES.map((node, index) => (
          <span
            key={node.subject}
            className="hx-art-node"
            style={{
              left: `${(node.x / W) * 100}%`,
              top: `${(node.y / H) * 100}%`,
              ["--node" as string]: node.color,
              animationDelay: `${index * 0.6}s`,
            }}
          >
            <Glyph name={SUBJECT_GLYPH[node.subject] ?? "book"} />
            <small>{node.label}</small>
          </span>
        ))}
        <span className="hx-art-core">
          <Image src="/brand/logo-320.webp" alt="" width={320} height={320} priority unoptimized />
        </span>
      </div>

      {proof.map((figure, index) => (
        <p className={`hx-float hx-float-${index + 1}`} key={figure.value}>
          <span className="hx-float-icon" aria-hidden="true"><Glyph name="trophy" /></span>
          <span>
            <strong>{figure.value}</strong>
            <small>{figure.label}</small>
          </span>
        </p>
      ))}
      <p className="hx-float hx-float-3">
        <span className="hx-float-icon hx-float-icon-play" aria-hidden="true"><Glyph name="play" /></span>
        <span>
          <strong>ویدیوی رایگان</strong>
          <small>برای هر درس</small>
        </span>
      </p>
    </div>
  );
}
