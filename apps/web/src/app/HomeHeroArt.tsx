import Image from "next/image";
import { Glyph, type GlyphName } from "../components/SubjectIcon";

/**
 * The homepage's picture: the logo's pentagon drawn large, with a specialised
 * subject of the exam at each node and signals running round the cycle -- the
 * subjects are one connected graph, and the site sits in the middle of it.
 *
 * Nothing floats over it (the owner's call): results belong with their
 * sources further down the page, and the hero stays quiet.
 *
 * Node positions and colours follow /brand/konkurcom-logo.png.
 */

/**
 * The specialised subjects of the 1406 computer-engineering master's (1277),
 * grouped as its rank model groups them: logic and architecture share a node,
 * so five nodes hold all six.
 */
const NODES: { x: number; y: number; color: string; key: string; glyph: GlyphName; label: string }[] = [
  { x: 301, y: 44, color: "#ef0809", key: "ds", glyph: "tree", label: "داده‌ساختارها و الگوریتم‌ها" },
  { x: 527, y: 199, color: "#086ef6", key: "theory", glyph: "dfa", label: "نظریه زبان‌ها" },
  { x: 461, y: 466, color: "#09b90d", key: "os", glyph: "terminal", label: "سیستم عامل" },
  { x: 139, y: 466, color: "#ee0808", key: "arch", glyph: "logicChip", label: "منطقی و معماری" },
  { x: 73, y: 199, color: "#086ef6", key: "ai", glyph: "neural", label: "هوش مصنوعی" },
];

const W = 600;
const H = 520;
const CYCLE = `M${NODES.map((node) => `${node.x} ${node.y}`).join(" L")} Z`;

export function HomeHeroArt() {
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
            <line key={node.key} x1={node.x} y1={node.y} x2={W / 2} y2={H / 2 + 6} className="hx-art-spoke" />
          ))}
          {[0, 1, 2].map((index) => (
            <circle key={index} r="7" className="hx-art-pulse">
              <animateMotion dur="9s" begin={`${-index * 3}s`} repeatCount="indefinite" path={CYCLE} />
            </circle>
          ))}
        </svg>
        {NODES.map((node, index) => (
          <span
            key={node.key}
            className="hx-art-node"
            style={{
              left: `${(node.x / W) * 100}%`,
              top: `${(node.y / H) * 100}%`,
              ["--node" as string]: node.color,
              animationDelay: `${index * 0.6}s`,
            }}
          >
            <Glyph name={node.glyph} />
            <small>{node.label}</small>
          </span>
        ))}
        <span className="hx-art-core">
          <Image src="/brand/logo-320.webp" alt="" width={320} height={320} priority unoptimized />
        </span>
      </div>

    </div>
  );
}
