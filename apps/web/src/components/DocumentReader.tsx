"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import { toPersianDigits } from "../lib/format";

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
 * with the reader's name and number on every page (the API does that); this
 * view offers no download or print, and keeps the file in memory rather than
 * behind a link that could be saved or shared. It cannot stop a screenshot --
 * nothing in a browser can -- which is why the stamp is in the pages.
 */
export function DocumentReader({ slug, identity }: { slug: string; identity: string }) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [width, setWidth] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocument | null = null;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/resources/${encodeURIComponent(slug)}/content`, { credentials: "include" });
        if (response.status === 401) throw new Error("برای خواندن این جزوه وارد حسابت شو.");
        if (response.status === 403) throw new Error("این جزوه در کتابخانهٔ تو نیست.");
        if (!response.ok) throw new Error("جزوه الان باز نشد. چند لحظهٔ دیگر دوباره امتحان کن.");
        const data = unseal(new Uint8Array(await response.arrayBuffer()), response.headers.get("Content-Type"));
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        loaded = (await pdfjs.getDocument({
          data,
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
        // A network failure surfaces as an English TypeError; say it in Persian.
        if (!cancelled) setError(err instanceof Error && !(err instanceof TypeError) ? err.message : "جزوه باز نشد. اتصالت را بررسی کن و صفحه را دوباره باز کن.");
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [slug]);

  // Pages follow the reading column's width; zoom scales from there.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(frame);
    return () => observer.disconnect();
  }, [doc]);

  // Printing and saving the page are the two obvious ways out; both are
  // refused while the reader is open. Neither is a lock, only a deterrent.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === "s" || key === "p")) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pageWidth = Math.max(240, Math.round(width * zoom));

  if (error) return <p className="dr-state" role="alert">{error}</p>;
  if (!doc) return <p className="dr-state" aria-busy="true">در حال آماده کردن نسخهٔ شخصی تو…</p>;

  return (
    <div className="dr" onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
      <div className="dr-bar">
        <span className="dr-pages">صفحهٔ {toPersianDigits(current)} از {toPersianDigits(doc.numPages)}</span>
        <div className="dr-zoom" role="group" aria-label="بزرگ‌نمایی">
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="کوچک‌تر">−</button>
          <span>{toPersianDigits(Math.round(zoom * 100))}٪</span>
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="بزرگ‌تر">+</button>
        </div>
      </div>
      <div className="dr-frame" ref={frameRef}>
        <div className="dr-scroll">
          {width > 0 &&
            Array.from({ length: doc.numPages }, (_, index) => (
              <PageView key={index} doc={doc} number={index + 1} width={pageWidth} ratio={ratio} onVisible={setCurrent} />
            ))}
        </div>
      </div>
      <p className="dr-note">این نسخه به نام <b>{identity}</b> ساخته شده و همین مشخصات روی هر صفحه‌اش هست؛ لطفاً آن را در اختیار دیگران نگذار.</p>
    </div>
  );
}

/** One page: drawn only when it comes near the screen, redrawn on resize. */
function PageView({
  doc,
  number,
  width,
  ratio,
  onVisible,
}: {
  doc: PdfDocument;
  number: number;
  width: number;
  ratio: number;
  onVisible: (page: number) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(number <= 2);
  const [height, setHeight] = useState(Math.round(width * ratio));

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setNear(true);
          if (entry.intersectionRatio > 0.5) onVisible(number);
        }
      },
      { rootMargin: "900px 0px", threshold: [0, 0.5] },
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, [number, onVisible]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const page = await doc.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const pixels = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (width / base.width) * pixels });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    setHeight(Math.round((width / base.width) * base.height));
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
