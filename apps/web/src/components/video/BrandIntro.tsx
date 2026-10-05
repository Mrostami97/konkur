"use client";

import { useEffect, useRef } from "react";

/**
 * The opening sting of every video on the site: the logo's pentagon is
 * "traversed" breadth-first from its top node, the way an algorithms class
 * draws BFS on the board. Each node lights up as the signal reaches it, the
 * last edge closes the cycle from both ends, and the wordmark is revealed in
 * reading direction (right to left). The drawing sits on the same 600×600
 * grid as /brand/konkurcom-logo.png, so the real logo can fade in under it
 * without a jump.
 *
 * The five nodes are also five notes of a pentatonic scale, played softly
 * through Web Audio when the video is not muted. The sting starts from the
 * viewer's own click on play, so browsers allow the sound.
 */

export const INTRO_MS = 3800;
export const INTRO_REDUCED_MS = 900;

// Node centres and colours measured from the logo file.
const NODES = [
  { x: 301, y: 64, color: "#ef0809", at: 0.2 }, // top: the source of the traversal
  { x: 73, y: 219, color: "#086ef6", at: 0.78 }, // left
  { x: 527, y: 219, color: "#086ef6", at: 0.78 }, // right
  { x: 139, y: 486, color: "#ee0808", at: 1.36 }, // bottom left
  { x: 461, y: 486, color: "#09b90d", at: 1.36 }, // bottom right
];

// Edges in BFS order: [from, to, start (s), duration (s)]. The last one is
// drawn from both of its ends at once and meets in the middle.
const EDGES: [number, number, number, number][] = [
  [0, 1, 0.36, 0.42],
  [0, 2, 0.36, 0.42],
  [1, 3, 0.94, 0.42],
  [2, 4, 0.94, 0.42],
];
const CLOSE_AT = 1.52;
const CLOSE_FOR = 0.34;

// C major pentatonic, one note per node, low to high down the traversal.
const NOTES = [523.25, 659.25, 783.99, 880.0, 1046.5];

function playChime(muted: boolean, volume: number) {
  if (muted || volume <= 0 || typeof window === "undefined") return () => {};
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return () => {};
  let context: AudioContext;
  try {
    context = new Context();
  } catch {
    return () => {};
  }
  const master = context.createGain();
  master.gain.value = 0.07 * volume;
  master.connect(context.destination);
  const now = context.currentTime + 0.02;
  const tone = (frequency: number, at: number, length: number, gain = 1) => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, now + at);
    envelope.gain.linearRampToValueAtTime(gain, now + at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
    oscillator.connect(envelope).connect(master);
    oscillator.start(now + at);
    oscillator.stop(now + at + length + 0.05);
  };
  tone(NOTES[0], NODES[0].at, 0.7);
  tone(NOTES[1], NODES[1].at, 0.6, 0.8);
  tone(NOTES[2], NODES[2].at, 0.6, 0.8);
  tone(NOTES[3], NODES[3].at, 0.6, 0.7);
  tone(NOTES[4], NODES[4].at, 0.6, 0.7);
  // The cycle closes on the whole chord.
  for (const [index, note] of NOTES.entries()) tone(note / 2, CLOSE_AT + CLOSE_FOR + index * 0.015, 1.4, 0.5);
  const timer = window.setTimeout(() => void context.close().catch(() => {}), 4500);
  return () => {
    window.clearTimeout(timer);
    void context.close().catch(() => {});
  };
}

export function BrandIntro({
  muted,
  volume,
  reduced,
  onSkip,
}: {
  muted: boolean;
  volume: number;
  reduced: boolean;
  onSkip: () => void;
}) {
  // The chime is started once, from the mount that follows the click.
  const chimeStarted = useRef(false);
  useEffect(() => {
    if (reduced || chimeStarted.current) return;
    chimeStarted.current = true;
    return playChime(muted, volume);
    // Muting mid-sting does not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mid = { x: (NODES[3].x + NODES[4].x) / 2, y: NODES[3].y };

  return (
    <div className="vp-intro" data-reduced={reduced || undefined} aria-hidden="true">
      <div className="vp-intro-stage">
        <div className="vp-intro-glow" />
        <div className="vp-intro-disc" />
        <svg className="vp-intro-graph" viewBox="0 0 600 600">
          {EDGES.map(([from, to, start, duration], index) => {
            const a = NODES[from];
            const b = NODES[to];
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            return (
              <g key={`edge-${index}`}>
                <line
                  className="vp-intro-edge"
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  style={{ ["--len" as string]: length, animationDelay: `${start}s`, animationDuration: `${duration}s` }}
                />
                {/* The travelling signal at the head of the edge. */}
                <circle
                  className="vp-intro-pulse"
                  r="11"
                  style={{
                    ["--dx" as string]: `${b.x - a.x}px`,
                    ["--dy" as string]: `${b.y - a.y}px`,
                    transformOrigin: `${a.x}px ${a.y}px`,
                    animationDelay: `${start}s`,
                    animationDuration: `${duration}s`,
                  }}
                  cx={a.x}
                  cy={a.y}
                />
              </g>
            );
          })}
          {/* The closing edge, drawn from both ends towards the middle. */}
          {[3, 4].map((end) => {
            const a = NODES[end];
            const length = Math.abs(mid.x - a.x);
            return (
              <line
                key={`close-${end}`}
                className="vp-intro-edge"
                x1={a.x}
                y1={a.y}
                x2={mid.x}
                y2={mid.y}
                style={{ ["--len" as string]: length, animationDelay: `${CLOSE_AT}s`, animationDuration: `${CLOSE_FOR}s` }}
              />
            );
          })}
          <circle className="vp-intro-spark" cx={mid.x} cy={mid.y} r="18" style={{ animationDelay: `${CLOSE_AT + CLOSE_FOR - 0.04}s` }} />
          {NODES.map((node, index) => (
            <g key={`node-${index}`} style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
              <circle
                className="vp-intro-ripple"
                cx={node.x}
                cy={node.y}
                r="29"
                stroke={node.color}
                style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDelay: `${node.at}s` }}
              />
              <circle
                className="vp-intro-node"
                cx={node.x}
                cy={node.y}
                r="29"
                fill={node.color}
                style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDelay: `${node.at}s` }}
              />
            </g>
          ))}
        </svg>
        {/* The real logo carries the wordmark; it is revealed right to left. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vp-intro-logo" src="/brand/konkurcom-logo.png" alt="" draggable={false} />
      </div>
      <p className="vp-intro-tagline">
        <span>کنکور کامپیوتر</span>
        <span className="vp-intro-domain" dir="ltr">kunkurcomputer.ir</span>
      </p>
      <button
        type="button"
        className="vp-intro-skip"
        onClick={(event) => {
          event.stopPropagation();
          onSkip();
        }}
      >
        رد کردن
      </button>
    </div>
  );
}
