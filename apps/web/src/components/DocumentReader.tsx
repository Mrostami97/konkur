"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import { toPersianDigits } from "../lib/format";
import { cacheKey, openCache } from "../lib/handout-cache";

type PdfDocument = {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
};
type PdfPage = {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void>; cancel(): void };
};

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];
const LOAD_TIMEOUT_MS = 90_000;
/** At 100% a page fills the column up to this width; zoom goes beyond it. */
const MAX_PAGE_WIDTH = 980;
const MAX_FULL_PAGE_WIDTH = 1200;

/** Where this reader stopped in each handout; kept on this device only. */
const lastPageKey = (slug: string) => `kc-reader-page:${slug}`;
function readLastPage(slug: string): number | null {
  try {
    const value = Number(window.localStorage.getItem(lastPageKey(slug)));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
function writeLastPage(slug: string, page: number) {
  try {
    window.localStorage.setItem(lastPageKey(slug), String(page));
  } catch {
    // Storage may be blocked; resuming is a convenience, not a requirement.
  }
}

/** A sold document arrives masked (see the API's sealStream): a 32-byte key, then the file XOR-ed with it. */
const SEALED_MIME = "application/vnd.kunkurcomputer.sealed";
const SEAL_KEY_BYTES = 32;

function unseal(body: Uint8Array, contentType: string | null): Uint8Array {
  if (!contentType?.startsWith(SEALED_MIME)) return body;
  const key = body.subarray(0, SEAL_KEY_BYTES);
  const out = body.slice(SEAL_KEY_BYTES);
  for (let i = 0; i < out.length; i += 1) out[i] ^= key[i % SEAL_KEY_BYTES];
  return out;
}

/**
 * Reads a purchased PDF inside the page. The file arrives already stamped
 * with the reader's name and number on every page (the API does that), so
 * the same copy can also be saved from here.
 */
export function DocumentReader({ slug, title }: { slug: string; title?: string }) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [waited, setWaited] = useState(0);
  const [received, setReceived] = useState<{ bytes: number; total: number | null }>({ bytes: 0, total: null });
  const [ratio, setRatio] = useState(1.414);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [width, setWidth] = useState(0);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const nativeFull = useRef(false);
  const currentRef = useRef(1);
  const restored = useRef(false);
  const fileRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocument | null = null;
    const controller = new AbortController();
    // If the server never answers, say so instead of spinning for ever.
    const timer = window.setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    setError(null);
    setWaited(0);
    setReceived({ bytes: 0, total: null });
    (async () => {
      try {
        const cache = await openCache();
        const kept = await cache?.match(cacheKey(slug)).catch(() => undefined);
        const keptVersion = kept?.headers.get("X-Content-Version");
        const response = await fetch(`${API_URL}/resources/${encodeURIComponent(slug)}/content`, {
          credentials: "include",
          signal: controller.signal,
          headers: keptVersion ? { "X-Have-Version": keptVersion } : undefined,
        });
        if (response.status === 401 || response.status === 403) {
          await cache?.delete(cacheKey(slug)).catch(() => undefined);
          throw new Error(response.status === 401 ? "برای خواندن این جزوه وارد حسابت شو." : "این جزوه در کتابخانهٔ تو نیست.");
        }
        let source = response;
        if (response.status === 204 && kept) source = kept;
        else if (!response.ok) throw new Error("جزوه الان باز نشد. چند لحظهٔ دیگر دوباره امتحان کن.");
        const total = Number(source.headers.get("Content-Length")) || null;
        const parts: Uint8Array[] = [];
        let bytes = 0;
        const body = source.body?.getReader();
        if (body) {
          for (;;) {
            const { done, value } = await body.read();
            if (done) break;
            parts.push(value);
            bytes += value.length;
            if (!cancelled) setReceived({ bytes, total });
          }
        } else {
          parts.push(new Uint8Array(await source.arrayBuffer()));
        }
        const whole = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
        let at = 0;
        for (const part of parts) {
          whole.set(part, at);
          at += part.length;
        }
        window.clearTimeout(timer);
        const contentType = source.headers.get("Content-Type");
        const version = response.headers.get("X-Content-Version");
        if (source === response && version && cache) {
          await cache
            .put(cacheKey(slug), new Response(whole.slice(), { headers: { "Content-Type": contentType ?? "", "X-Content-Version": version } }))
            .catch(() => undefined);
        }
        const data = unseal(whole, contentType);
        // pdf.js takes over the bytes it is given, so it gets its own copy.
        fileRef.current = data;
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        loaded = (await pdfjs.getDocument({
          data: data.slice(),
          isEvalSupported: false,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
        }).promise) as unknown as PdfDocument;
        const first = await loaded.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(viewport.height / viewport.width);
        setDoc(loaded);
      } catch (err) {
        window.clearTimeout(timer);
        if (cancelled) return;
        if (controller.signal.aborted) setError("باز شدن جزوه بیشتر از حد معمول طول کشید. دوباره امتحان کن؛ اگر باز هم باز نشد، به پشتیبانی خبر بده.");
        // A network failure surfaces as an English TypeError; say it in Persian.
        else setError(err instanceof Error && !(err instanceof TypeError) ? err.message : "جزوه باز نشد. اتصالت را بررسی کن و دوباره امتحان کن.");
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
      void loaded?.destroy();
    };
  }, [slug, attempt]);

  useEffect(() => {
    if (doc || error) return undefined;
    const tick = window.setInterval(() => setWaited((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(tick);
  }, [doc, error, attempt]);

  // Pages follow the reading box's width; zoom scales from there.
  useEffect(() => {
    if (!frame) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frame]);

  const goTo = useCallback(
    (page: number) => {
      const target = frame?.querySelectorAll<HTMLElement>(".dr-page")[page - 1];
      if (!frame || !target) return;
      // Set before the observers report, so a resize right after still anchors here.
      currentRef.current = page;
      frame.scrollTop = target.offsetTop - 12;
    },
    [frame],
  );

  const onVisible = useCallback(
    (page: number) => {
      currentRef.current = page;
      setCurrent(page);
      if (restored.current) writeLastPage(slug, page);
    },
    [slug],
  );

  // Back where the reader left off last time, once the pages are laid out.
  useEffect(() => {
    if (!doc || width === 0 || restored.current) return undefined;
    const last = readLastPage(slug);
    const frameId = window.requestAnimationFrame(() => {
      restored.current = true;
      if (last && last > 1 && last <= doc.numPages) {
        goTo(last);
        setResumedFrom(last);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [doc, width, slug, goTo]);

  useEffect(() => {
    if (resumedFrom === null) return undefined;
    const timer = window.setTimeout(() => setResumedFrom(null), 7000);
    return () => window.clearTimeout(timer);
  }, [resumedFrom]);

  // A zoom or a switch to full screen keeps the page being read in view.
  const pageWidth = Math.max(240, Math.round(Math.min(width, full ? MAX_FULL_PAGE_WIDTH : MAX_PAGE_WIDTH) * zoom));
  useEffect(() => {
    if (!restored.current) return undefined;
    const frameId = window.requestAnimationFrame(() => goTo(currentRef.current));
    return () => window.cancelAnimationFrame(frameId);
  }, [pageWidth, goTo]);

  const toggleFull = useCallback(async () => {
    if (!full) {
      setFull(true);
      // Real full screen where the browser allows it (not on iPhone); the
      // reader fills the window either way.
      try {
        if (readerRef.current?.requestFullscreen) {
          await readerRef.current.requestFullscreen();
          nativeFull.current = true;
        }
      } catch {
        nativeFull.current = false;
      }
    } else {
      setFull(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      nativeFull.current = false;
    }
  }, [full]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && nativeFull.current) {
        nativeFull.current = false;
        setFull(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!full) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const download = useCallback(() => {
    const bytes = fileRef.current;
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title ?? "").replace(/[\\/:*?"<>|]+/g, " ").trim() || slug}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [slug, title]);

  if (error) {
    return (
      <div className="dr-state" role="alert">
        <p style={{ margin: 0 }}>{error}</p>
        <button type="button" className="dr-retry" onClick={() => setAttempt((n) => n + 1)}>تلاش دوباره</button>
      </div>
    );
  }
  if (!doc) {
    const megabytes = (received.bytes / 1048576).toFixed(1).replace(".", "٫");
    const percent = received.total ? Math.min(100, Math.round((received.bytes / received.total) * 100)) : null;
    return (
      <div className="dr-state" aria-busy="true" role="status">
        <p style={{ margin: 0 }}>
          {received.bytes > 0
            ? `در حال دریافت جزوه… ${percent !== null ? `${toPersianDigits(percent)}٪` : `${toPersianDigits(megabytes)} مگابایت`}`
            : "در حال باز کردن جزوه…"}
        </p>
        {received.bytes === 0 && waited >= 8 && (
          <p style={{ margin: "0.6rem 0 0", fontSize: "0.85rem" }}>کمی بیشتر از معمول طول کشیده؛ هنوز منتظر پاسخ سرور هستیم. ({toPersianDigits(waited)} ثانیه)</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={readerRef}
      className={full ? "dr dr-full" : "dr"}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="dr-bar">
        <span className="dr-pages">صفحهٔ {toPersianDigits(current)} از {toPersianDigits(doc.numPages)}</span>
        {resumedFrom !== null && (
          <span className="dr-resume" role="status">
            از صفحهٔ {toPersianDigits(resumedFrom)} ادامه می‌دهی
            <button
              type="button"
              onClick={() => {
                goTo(1);
                setResumedFrom(null);
              }}
            >
              از اول
            </button>
          </span>
        )}
        <div className="dr-zoom" role="group" aria-label="بزرگ‌نمایی">
          <button type="button" className="dr-download" onClick={download} title="دانلود PDF، با نام و شمارهٔ تو روی هر صفحه">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            دانلود
          </button>
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="کوچک‌تر">−</button>
          <span>{toPersianDigits(Math.round(zoom * 100))}٪</span>
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="بزرگ‌تر">+</button>
          <button type="button" className="dr-full-btn" onClick={() => void toggleFull()} aria-pressed={full} aria-label={full ? "خروج از تمام‌صفحه" : "تمام‌صفحه"} title={full ? "خروج از تمام‌صفحه" : "تمام‌صفحه"}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        </div>
      </div>
      <div className="dr-frame" ref={setFrame}>
        <div className="dr-scroll">
          {width > 0 &&
            frame &&
            Array.from({ length: doc.numPages }, (_, index) => (
              <PageView key={index} doc={doc} number={index + 1} width={pageWidth} ratio={ratio} root={frame} onVisible={onVisible} />
            ))}
        </div>
      </div>
    </div>
  );
}

/** One page: drawn only when it comes near the screen, redrawn on resize. */
function PageView({
  doc,
  number,
  width,
  ratio,
  root,
  onVisible,
}: {
  doc: PdfDocument;
  number: number;
  width: number;
  ratio: number;
  root: HTMLElement;
  onVisible: (page: number) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(number <= 2);
  // Every page is sized before it is drawn, so jumping to a page lands on it.
  const [ownRatio, setOwnRatio] = useState<number | null>(null);
  const height = Math.round(width * (ownRatio ?? ratio));

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    // Drawn a little ahead of the screen; counted as "current" only when it
    // actually crosses a line a third of the way down it (one observer with a margin did both,
    // so pages far below the screen claimed to be the current one).
    const ahead = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { root, rootMargin: "900px 0px" });
    const middle = new IntersectionObserver(([entry]) => entry.isIntersecting && onVisible(number), { root, rootMargin: "-30% 0px -70% 0px" });
    ahead.observe(holder);
    middle.observe(holder);
    return () => {
      ahead.disconnect();
      middle.disconnect();
    };
  }, [number, onVisible, root]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const page = await doc.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const pixels = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (width / base.width) * pixels });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    setOwnRatio(base.height / base.width);
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    return page.render({ canvasContext: context, viewport });
  }, [doc, number, width]);

  useEffect(() => {
    if (!near) return;
    let task: { promise: Promise<void>; cancel(): void } | undefined;
    let cancelled = false;
    void draw().then((started) => {
      task = started;
      if (cancelled) task?.cancel();
      task?.promise.catch(() => undefined);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, draw]);

  return (
    <div className="dr-page" ref={holderRef} style={{ width, height }}>
      {/* dir="ltr": a canvas inherits the page's direction, and pdf.js draws each run assuming left-to-right. */}
      {near && <canvas ref={canvasRef} dir="ltr" style={{ width, height }} aria-label={`صفحهٔ ${toPersianDigits(number)}`} role="img" />}
    </div>
  );
}
