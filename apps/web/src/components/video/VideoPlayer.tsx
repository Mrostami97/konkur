"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { toPersianDigits } from "../../lib/format";
import { BrandIntro, INTRO_MS, INTRO_REDUCED_MS } from "./BrandIntro";
import "./video-player.css";

/**
 * The site's own video player. Every play from the start opens with the
 * brand sting (BrandIntro), after which the logo shrinks into the corner and
 * stays there as a quiet watermark. Beyond that it is the player a student
 * watching a lesson actually needs: speed up to 2×, ten-second jumps
 * (double-tap on a phone), keyboard shortcuts, picture-in-picture, and
 * picking up where they left off.
 *
 * The timeline runs left to right like every media timeline, Persian UI or
 * not; only the labels are Persian.
 */

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SPEED_KEY = "kc-video-speed";
const RESUME_PREFIX = "kc-video-at:";
const HIDE_AFTER_MS = 2600;

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return toPersianDigits(h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
}

function speedLabel(speed: number): string {
  return `${toPersianDigits(String(speed).replace(".", "٫"))}×`;
}

// Browser storage can be missing or throw (private mode); every use is optional.
function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* optional */
  }
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    play: "M8 5.5v13l11-6.5z",
    pause: "M7 5h4v14H7zM13 5h4v14h-4z",
    replay: "M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z",
    back: "M11.5 12 20 6v12zM3 12l8.5-6v12z",
    forward: "M12.5 12 4 18V6zM21 12l-8.5 6V6z",
    volume: "M4 9v6h4l5 4V5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z",
    mute: "M4 9v6h4l5 4V5L8 9zm12.6 3 2.7-2.7-1.3-1.3-2.7 2.7-2.7-2.7-1.3 1.3 2.7 2.7-2.7 2.7 1.3 1.3 2.7-2.7 2.7 2.7 1.3-1.3z",
    full: "M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z",
    exitFull: "M8 4h2v6H4V8h4zm6 0h2v4h4v2h-6zM4 14h6v6H8v-4H4zm10 0h6v2h-4v4h-2z",
    pip: "M3 5h18v14H3zm2 2v10h14V7zm6 5h7v4h-7z",
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="currentColor" />
    </svg>
  );
}

type Stage = "poster" | "intro" | "playing" | "ended";

export function VideoPlayer({ src, title, className }: { src: string; title?: string; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const introTimer = useRef<number | null>(null);
  const lastTap = useRef<{ at: number; side: "back" | "forward" } | null>(null);
  const resumeKey = RESUME_PREFIX + src;

  const [stage, setStage] = useState<Stage>("poster");
  const stageRef = useRef<Stage>("poster");
  // Whether this play opened with the sting, so the logo flies into the corner.
  const [introPlayed, setIntroPlayed] = useState(false);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [ripple, setRipple] = useState<{ side: "back" | "forward"; key: number } | null>(null);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    // The metadata can arrive before hydration, when no handler was listening yet.
    const video = videoRef.current;
    if (video && video.readyState >= 1) {
      setDuration(video.duration);
      if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight);
    }
    if (video?.error) setError(true);
    const saved = Number(readStore(SPEED_KEY));
    if (SPEEDS.includes(saved)) setSpeed(saved);
    setPipSupported(typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    const onFullscreen = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      query.removeEventListener("change", onChange);
      document.removeEventListener("fullscreenchange", onFullscreen);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (introTimer.current) window.clearTimeout(introTimer.current);
    };
  }, []);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Controls fade out while the video plays and the pointer is still.
  const poke = useCallback(() => {
    setControlsShown(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsShown(false);
        setSpeedOpen(false);
      }
    }, HIDE_AFTER_MS);
  }, []);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    stageRef.current = "playing";
    setStage("playing");
    void video.play().catch(() => setPaused(true));
    poke();
  }, [poke, speed]);

  const finishIntro = useCallback(() => {
    if (introTimer.current) window.clearTimeout(introTimer.current);
    introTimer.current = null;
    startPlayback();
  }, [startPlayback]);

  // Runs inside the viewer's click. play() is called here and paused at once:
  // iOS only lets an element play with sound if its first play() came from a
  // gesture, and the brief start also begins buffering under the sting.
  function beginIntro(video: HTMLVideoElement) {
    stageRef.current = "intro";
    setStage("intro");
    setIntroPlayed(true);
    video.currentTime = 0;
    void video
      .play()
      .then(() => {
        if (stageRef.current !== "intro") return;
        video.pause();
        video.currentTime = 0;
      })
      .catch(() => {});
    introTimer.current = window.setTimeout(finishIntro, reduced ? INTRO_REDUCED_MS : INTRO_MS);
  }

  function firstPlay() {
    const video = videoRef.current;
    if (!video) return;
    if (error) {
      setError(false);
      video.load();
    }
    const saved = Number(readStore(resumeKey));
    const total = video.duration;
    if (saved > 10 && (!Number.isFinite(total) || saved < total - 10)) {
      // Coming back to a half-watched video skips the sting and picks up where they were.
      video.currentTime = saved;
      setResumedFrom(saved);
      window.setTimeout(() => setResumedFrom(null), 6000);
      startPlayback();
      return;
    }
    beginIntro(video);
  }

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (stage === "poster") return firstPlay();
    if (stage === "intro") return finishIntro();
    if (stage === "ended") {
      video.currentTime = 0;
      return startPlayback();
    }
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
    poke();
  }

  function seekBy(seconds: number) {
    const video = videoRef.current;
    if (!video || stage === "poster" || stage === "intro") return;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), video.duration || 0);
    if (stage === "ended" && seconds < 0) setStage("playing");
    poke();
  }

  function timeAt(clientX: number): number {
    const track = trackRef.current;
    if (!track || !duration) return 0;
    const box = track.getBoundingClientRect();
    return Math.min(Math.max((clientX - box.left) / box.width, 0), 1) * duration;
  }

  function scrubTo(clientX: number) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const next = timeAt(clientX);
    video.currentTime = next;
    setTime(next);
  }

  function onTrackDown(event: PointerEvent<HTMLDivElement>) {
    if (stage === "poster" || stage === "intro") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubbing(true);
    scrubTo(event.clientX);
    if (stage === "ended") setStage("playing");
  }

  function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else if (root.requestFullscreen) void root.requestFullscreen().catch(() => {});
    else {
      // iOS Safari only lets the <video> itself go full screen.
      const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      video?.webkitEnterFullscreen?.();
    }
  }

  async function togglePip() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* not allowed here */
    }
  }

  function chooseSpeed(next: number) {
    setSpeed(next);
    writeStore(SPEED_KEY, String(next));
    setSpeedOpen(false);
  }

  function setVolumeTo(next: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = next === 0;
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.6;
  }

  // On a phone a double tap on either half jumps ten seconds, YouTube style;
  // a single tap only brings the controls back.
  function onSurfacePointer(event: PointerEvent<HTMLDivElement>) {
    if (stage !== "playing") return;
    if (event.pointerType !== "touch") {
      toggle();
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const side = event.clientX - box.left < box.width / 2 ? "back" : "forward";
    const now = Date.now();
    if (lastTap.current && now - lastTap.current.at < 320 && lastTap.current.side === side) {
      seekBy(side === "back" ? -10 : 10);
      setRipple({ side, key: now });
      lastTap.current = null;
      return;
    }
    lastTap.current = { at: now, side };
    if (controlsShown && !videoRef.current?.paused) setControlsShown(false);
    else poke();
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.closest(".vp-speed-menu")) return;
    const video = videoRef.current;
    if (!video) return;
    const key = event.key.toLowerCase();
    const handled = (() => {
      switch (key) {
        case " ":
        case "k":
          if (target.tagName === "BUTTON" && key === " ") return false;
          toggle();
          return true;
        case "arrowleft":
          seekBy(-5);
          return true;
        case "arrowright":
          seekBy(5);
          return true;
        case "j":
          seekBy(-10);
          return true;
        case "l":
          seekBy(10);
          return true;
        case "arrowup":
          setVolumeTo(Math.min(video.volume + 0.1, 1));
          return true;
        case "arrowdown":
          setVolumeTo(Math.max(video.volume - 0.1, 0));
          return true;
        case "m":
          toggleMute();
          return true;
        case "f":
          toggleFullscreen();
          return true;
        case ">":
        case "<": {
          const index = SPEEDS.indexOf(speed) + (key === ">" ? 1 : -1);
          if (index >= 0 && index < SPEEDS.length) chooseSpeed(SPEEDS[index]);
          return true;
        }
        default:
          if (/^[0-9]$/.test(key) && duration && stage !== "poster" && stage !== "intro") {
            video.currentTime = (Number(key) / 10) * duration;
            return true;
          }
          return false;
      }
    })();
    if (handled) {
      event.preventDefault();
      poke();
    }
  }

  const progress = duration ? (time / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;
  const showControls = stage === "playing" || stage === "ended";
  const idle = stage === "playing" && !paused && !controlsShown && !speedOpen && !scrubbing;

  return (
    <div
      ref={rootRef}
      className={`vp${className ? ` ${className}` : ""}`}
      data-stage={stage}
      data-idle={idle || undefined}
      data-fullscreen={fullscreen || undefined}
      style={{ ["--vp-ratio" as string]: String(ratio) }}
      tabIndex={0}
      role="region"
      aria-label={title ? `پخش‌کنندهٔ ویدیو: ${title}` : "پخش‌کنندهٔ ویدیو"}
      onKeyDown={onKey}
      onPointerMove={(event) => {
        if (event.pointerType !== "touch" && stage === "playing") poke();
      }}
      onPointerLeave={() => {
        if (videoRef.current && !videoRef.current.paused) setControlsShown(false);
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="vp-video"
        // A few seconds in makes a better still than the usual black first frame.
        // Playback itself always starts from 0 or the saved position.
        src={src.includes("#") ? src : `${src}#t=4`}
        preload="metadata"
        playsInline
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration);
          if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight);
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (!scrubbing) setTime(video.currentTime);
          if (stage === "playing" && Math.floor(video.currentTime) % 5 === 0) {
            writeStore(resumeKey, video.currentTime > 10 ? String(Math.floor(video.currentTime)) : null);
          }
        }}
        onProgress={(event) => {
          const ranges = event.currentTarget.buffered;
          const now = event.currentTarget.currentTime;
          for (let i = 0; i < ranges.length; i++) {
            if (ranges.start(i) <= now + 0.5) setBuffered(ranges.end(i));
          }
        }}
        onPlay={() => {
          setPaused(false);
          setError(false);
        }}
        onPause={() => {
          setPaused(true);
          setControlsShown(true);
          const video = videoRef.current;
          if (video && video.currentTime > 10) writeStore(resumeKey, String(Math.floor(video.currentTime)));
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onVolumeChange={(event) => {
          setMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
        }}
        onEnded={() => {
          setStage("ended");
          setPaused(true);
          setControlsShown(true);
          writeStore(resumeKey, null);
        }}
        onError={() => setError(true)}
      />

      {/* The logo the sting ends in, kept in the corner while the video plays. */}
      <div className="vp-bug" data-arrive={introPlayed || undefined} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-128.webp" alt="" draggable={false} />
      </div>

      <div className="vp-surface" onPointerUp={onSurfacePointer} />

      {ripple && (
        <div key={ripple.key} className="vp-ripple" data-side={ripple.side} onAnimationEnd={() => setRipple(null)} aria-hidden="true">
          <span>{ripple.side === "back" ? "۱۰ ثانیه عقب" : "۱۰ ثانیه جلو"}</span>
        </div>
      )}

      {waiting && stage === "playing" && !error && (
        <div className="vp-loading" role="status" aria-label="در حال بارگذاری">
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <polygon points="30,6 54,23 45,52 15,52 6,23" />
            <circle cx="30" cy="6" r="5" fill="#ef0809" />
            <circle cx="54" cy="23" r="5" fill="#086ef6" />
            <circle cx="45" cy="52" r="5" fill="#09b90d" />
            <circle cx="15" cy="52" r="5" fill="#ee0808" />
            <circle cx="6" cy="23" r="5" fill="#086ef6" />
          </svg>
        </div>
      )}

      {stage === "poster" && (
        <button type="button" className="vp-poster" onClick={firstPlay} aria-label={title ? `پخش «${title}»` : "پخش ویدیو"}>
          <span className="vp-poster-play">
            <svg viewBox="0 0 100 100" className="vp-poster-ring" aria-hidden="true">
              <polygon points="50,6 92,37 76,88 24,88 8,37" />
            </svg>
            <Icon name="play" />
          </span>
          {duration > 0 && <span className="vp-poster-duration">{clock(duration)}</span>}
        </button>
      )}

      {stage === "intro" && <BrandIntro muted={muted} volume={volume} reduced={reduced} onSkip={finishIntro} />}

      {stage === "ended" && (
        <div className="vp-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-128.webp" alt="" width={64} height={64} />
          <button type="button" className="vp-end-replay" onClick={toggle}>
            <Icon name="replay" />
            دوباره ببین
          </button>
        </div>
      )}

      {resumedFrom !== null && stage === "playing" && (
        <div className="vp-toast" role="status">
          از {clock(resumedFrom)} ادامه می‌دهیم
          <button
            type="button"
            onClick={() => {
              setResumedFrom(null);
              writeStore(resumeKey, null);
              const video = videoRef.current;
              if (!video) return;
              video.pause();
              beginIntro(video);
            }}
          >
            از اول
          </button>
        </div>
      )}

      {error && stage !== "poster" && (
        <div className="vp-error" role="alert">
          <p>پخش این ویدیو ممکن نشد. اینترنتت را بررسی کن و دوباره امتحان کن.</p>
          <div>
            <button type="button" onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              const at = video.currentTime;
              setError(false);
              video.load();
              video.currentTime = at;
              void video.play().catch(() => setError(true));
            }}>
              تلاش دوباره
            </button>
            <a href={src} target="_blank" rel="noreferrer">باز کردن فایل</a>
          </div>
        </div>
      )}

      {showControls && (
        <div className="vp-controls" dir="ltr" onPointerUp={(event) => event.stopPropagation()}>
          <div
            ref={trackRef}
            className="vp-track"
            role="slider"
            tabIndex={0}
            aria-label="زمان ویدیو"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(time)}
            aria-valuetext={`${clock(time)} از ${clock(duration)}`}
            data-scrubbing={scrubbing || undefined}
            onPointerDown={onTrackDown}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setHover({ x: event.clientX - box.left, time: timeAt(event.clientX) });
              if (scrubbing) scrubTo(event.clientX);
            }}
            onPointerUp={() => setScrubbing(false)}
            onPointerCancel={() => setScrubbing(false)}
            onPointerLeave={() => setHover(null)}
          >
            <div className="vp-track-rail">
              <div className="vp-track-buffer" style={{ width: `${bufferedPercent}%` }} />
              <div className="vp-track-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="vp-track-thumb" style={{ left: `${progress}%` }} />
            {hover && duration > 0 && (
              <div className="vp-track-tip" style={{ left: `${hover.x}px` }}>
                {clock(hover.time)}
              </div>
            )}
          </div>

          <div className="vp-bar">
            <button type="button" className="vp-btn" onClick={toggle} aria-label={paused ? "پخش" : "توقف"} title={paused ? "پخش (k)" : "توقف (k)"}>
              <Icon name={stage === "ended" ? "replay" : paused ? "play" : "pause"} />
            </button>
            <button type="button" className="vp-btn" onClick={() => seekBy(-10)} aria-label="۱۰ ثانیه عقب" title="۱۰ ثانیه عقب (j)">
              <Icon name="back" />
            </button>
            <button type="button" className="vp-btn" onClick={() => seekBy(10)} aria-label="۱۰ ثانیه جلو" title="۱۰ ثانیه جلو (l)">
              <Icon name="forward" />
            </button>
            <div className="vp-volume">
              <button type="button" className="vp-btn" onClick={toggleMute} aria-label={muted ? "پخش صدا" : "بی‌صدا"} title="صدا (m)">
                <Icon name={muted || volume === 0 ? "mute" : "volume"} />
              </button>
              <input
                type="range"
                className="vp-volume-range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => setVolumeTo(Number(event.target.value))}
                aria-label="بلندی صدا"
                style={{ ["--vp-vol" as string]: `${(muted ? 0 : volume) * 100}%` }}
              />
            </div>
            <span className="vp-time">
              {clock(time)} <span className="vp-time-sep">/</span> {clock(duration)}
            </span>
            <span className="vp-spacer" />
            <div className="vp-speed">
              <button
                type="button"
                className="vp-btn vp-speed-btn"
                onClick={() => setSpeedOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={speedOpen}
                aria-label={`سرعت پخش ${speedLabel(speed)}`}
                title="سرعت پخش (< >)"
              >
                {speedLabel(speed)}
              </button>
              {speedOpen && (
                <div className="vp-speed-menu" role="menu" dir="rtl">
                  <span className="vp-speed-title">سرعت پخش</span>
                  {SPEEDS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={option === speed}
                      onClick={() => chooseSpeed(option)}
                    >
                      {option === 1 ? "عادی" : speedLabel(option)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {pipSupported && (
              <button type="button" className="vp-btn vp-hide-narrow" onClick={() => void togglePip()} aria-label="تصویر در تصویر" title="تصویر در تصویر">
                <Icon name="pip" />
              </button>
            )}
            <button type="button" className="vp-btn" onClick={toggleFullscreen} aria-label={fullscreen ? "خروج از تمام‌صفحه" : "تمام‌صفحه"} title="تمام‌صفحه (f)">
              <Icon name={fullscreen ? "exitFull" : "full"} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
