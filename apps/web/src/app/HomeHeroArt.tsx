import Image from "next/image";
import Link from "next/link";
import { Glyph, type GlyphName } from "../components/SubjectIcon";

/**
 * The homepage's picture: the logo's pentagon drawn large, with one of the
 * site's main features at each node and signals running round the cycle --
 * the features are one connected path, and the site sits in the middle of it.
 * Each node is a link to its feature (the owner's call, 2026-10-07).
 *
 * Nothing floats over it (the owner's call): results belong with their
 * sources further down the page, and the hero stays quiet.
 *
 * Node positions and colours follow /brand/konkurcom-logo.png.
 */

/** A candidate's path round the site, clockwise from the top. */
const NODES: { x: number; y: number; color: string; key: string; glyph: GlyphName; label: string; href: string }[] = [
  { x: 301, y: 44, color: "#ef0809", key: "courses", glyph: "play", label: "دوره‌ها", href: "/courses" },
  { x: 527, y: 199, color: "#086ef6", key: "bank", glyph: "list", label: "بانک سؤال", href: "/questions" },
  { x: 461, y: 466, color: "#09b90d", key: "rank", glyph: "target", label: "تخمین رتبه", href: "/rank-calculator/master-computer-engineering" },
  { x: 139, y: 466, color: "#ee0808", key: "programs", glyph: "compass", label: "انتخاب رشته", href: "/programs" },
  { x: 73, y: 199, color: "#086ef6", key: "results", glyph: "trophy", label: "نتایج شاگردان", href: "/evidence" },
];

const W = 600;
const H = 520;
const CYCLE = `M${NODES.map((node) => `${node.x} ${node.y}`).join(" L")} Z`;

export function HomeHeroArt() {
  return (
    <div className="hx-art">
      <nav className="hx-art-board" aria-label="امکانات کنکور کامپیوتر">
        <span className="hx-blob hx-blob-a" />
        <span className="hx-blob hx-blob-b" />
        <span className="hx-blob hx-blob-c" />
        <svg className="hx-art-graph" aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <path d={CYCLE} className="hx-art-edge" />
          {/* Spokes from every feature to the centre. */}
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
          <Link
            key={node.key}
            href={node.href}
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
          </Link>
        ))}
        <span className="hx-art-core" aria-hidden="true">
          <Image src="/brand/logo-320.webp" alt="" width={320} height={320} priority unoptimized />
        </span>
      </nav>
    </div>
  );
}
