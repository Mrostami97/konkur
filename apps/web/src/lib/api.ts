const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

/**
 * Browser requests deliberately use the site's own `/api` gateway by default.
 * This keeps login, media, and paid-resource requests on the canonical origin
 * and avoids baking a deployment-specific API hostname into the client bundle.
 * Developers can still opt into a separate origin with NEXT_PUBLIC_API_URL.
 */
export const API_URL = PUBLIC_API_URL || "/api";

/** Server-only override so SSR requests hit the API directly on the Docker
 * network instead of round-tripping through public DNS and TLS. Local
 * development falls back to the API's conventional localhost port. */
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ?? PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** A machine-readable reason the API attached, e.g. PROFILE_INCOMPLETE. */
    public code?: string,
    /** The rest of the error body, for callers that need its details. */
    public details?: Record<string, unknown>,
    /** The server's own wording, often English, for a page that matches on
     * it. `message` is always Persian and is what a person reads. */
    public reason: string = message,
  ) {
    super(message);
  }
}

const PERSIAN = /[\u0600-\u06FF]/;

/** Reasons the API gives in English, as a person should read them. */
const KNOWN_REASONS: [RegExp, string][] = [
  [/untrusted request origin/i, "این درخواست از نشانی دیگری آمده است. سایت را از kunkurcomputer.ir باز کن و دوباره امتحان کن."],
  [/no session|invalid or expired session/i, "نشست کاربری‌ات تمام شده است؛ دوباره وارد شو."],
  [/student accounts cannot use staff routes|insufficient role|no roles configured/i, "به این بخش دسترسی نداری."],
  [/invalid phone or password/i, "شمارهٔ موبایل یا رمز عبور درست نیست."],
  [/invalid phone or code/i, "کد درست نیست؛ دوباره نگاهش کن یا کد تازه بگیر."],
  [/code expired/i, "این کد منقضی شده است؛ کد تازه بگیر."],
  [/too many attempts/i, "این کد چند بار اشتباه وارد شد؛ کد تازه بگیر."],
  [/OTP login is not configured/i, "ورود با کد پیامکی فعلاً فعال نیست؛ با رمز عبور وارد شو."],
  [/phone must be a valid phone number/i, "شمارهٔ موبایل را درست وارد کن؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹."],
  [/too many requests|throttl/i, "چند بار پشت سر هم امتحان کردی؛ چند دقیقه صبر کن و دوباره امتحان کن."],
  [/payload too large|file too large/i, "حجم فایل از سقف مجاز بیشتر است."],
  [/slug already exists/i, "این نشانی (slug) را مورد دیگری دارد؛ نشانی دیگری بنویس."],
  [/not found/i, "موردی که خواستی پیدا نشد؛ شاید حذف شده باشد."],
  [/must be|should not be|must not be|must contain|must match|is not valid|invalid/i, "بعضی از اطلاعات واردشده درست نیست؛ فرم را بررسی کن و دوباره بفرست."],
];

/** When the reason is unknown, what the status alone says. */
function statusMessage(status: number) {
  if (status === 0) return "اتصال به سایت برقرار نشد؛ اینترنتت را بررسی کن و دوباره امتحان کن.";
  if (status === 400 || status === 422) return "اطلاعات واردشده درست نیست؛ فرم را بررسی کن و دوباره بفرست.";
  if (status === 401) return "اول وارد حسابت شو؛ اگر وارد بودی، نشستت تمام شده است.";
  if (status === 403) return "به این بخش دسترسی نداری.";
  if (status === 404) return "موردی که خواستی پیدا نشد.";
  if (status === 409) return "این کار با وضعیت فعلی جور درنمی‌آید؛ صفحه را تازه کن و دوباره امتحان کن.";
  if (status === 413) return "حجم فایل از سقف مجاز بیشتر است.";
  if (status === 429) return "چند بار پشت سر هم امتحان کردی؛ چند دقیقه صبر کن و دوباره امتحان کن.";
  if (status >= 500) return "سرور الان پاسخ نداد؛ کمی بعد دوباره امتحان کن.";
  return "انجام این کار ممکن نشد؛ دوباره امتحان کن.";
}

/**
 * Every error a person sees is Persian. The API writes its own messages in
 * Persian where a person will read them; the rest (validation, guards, the
 * framework's defaults) are English and are put into Persian here, so no
 * page shows a raw server message.
 */
export function persianError(status: number, reason: string): string {
  const text = reason.trim();
  if (text && PERSIAN.test(text)) return text;
  const known = KNOWN_REASONS.find(([pattern]) => pattern.test(text));
  return known ? known[1] : statusMessage(status);
}

function errorFrom(status: number, statusText: string, body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : undefined;
  const raw = record?.message ?? statusText;
  const text = Array.isArray(raw) ? raw.join(", ") : String(raw);
  // A CDN error page arrives as HTML, not as a reason.
  const reason = /^\s*</.test(text) ? statusText : text;
  return new ApiError(
    status,
    persianError(status, reason),
    typeof record?.code === "string" ? record.code : undefined,
    record,
    reason,
  );
}

async function parseBody(res: Response) {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * How long a public article or guide page is served from cache before it is
 * rendered again (seconds). The page is cached on its first request, never at
 * build time (the image is built without the API), so search engines and the
 * CDN get a ready page instead of a fresh render each time.
 */
export const PUBLIC_PAGE_REVALIDATE = 300;

/**
 * Server-side fetch for public, unauthenticated pages (SSR/SEO). Uncached by
 * default; `revalidate` lets a page whose every fetch is public be cached.
 */
export async function apiGetPublic<T>(path: string, options: { revalidate?: number } = {}): Promise<T | null> {
  const res = await fetch(
    `${INTERNAL_API_URL}${path}`,
    options.revalidate ? { next: { revalidate: options.revalidate } } : { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const reason = await res.text();
    throw new ApiError(res.status, persianError(res.status, reason), undefined, undefined, reason);
  }
  return res.json();
}

/** Browser-side fetch that carries the session cookie for authenticated calls. */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      // Lets a last report leave while the page is being closed.
      keepalive: options.keepalive,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    // No answer at all: offline, DNS, the connection cut.
    throw new ApiError(0, statusMessage(0), undefined, undefined, err instanceof Error ? err.message : "network error");
  }
  const body = await parseBody(res);
  if (!res.ok) throw errorFrom(res.status, res.statusText, body);
  return body as T;
}

export interface UploadProgress {
  loaded: number;
  total: number;
}

/**
 * Multipart upload (e.g. the ingestion zip, a handout PDF) with the session
 * cookie attached. XMLHttpRequest rather than fetch, because only it reports
 * upload progress: a large PDF on a slow line otherwise looks frozen.
 */
export function apiUpload<T>(
  path: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  fields: Record<string, string> = {},
): Promise<T> {
  const formData = new FormData();
  // Text fields first: multer reads them before the file.
  for (const [name, value] of Object.entries(fields)) formData.append(name, value);
  formData.append("file", file);
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}${path}`);
    request.withCredentials = true;
    if (onProgress) {
      request.upload.onprogress = (event) => onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : file.size });
    }
    request.onload = () => {
      let body: unknown = request.responseText || undefined;
      try {
        body = request.responseText ? JSON.parse(request.responseText) : undefined;
      } catch {
        /* an HTML error page from the CDN; keep it as text */
      }
      if (request.status >= 200 && request.status < 300) resolve(body as T);
      else if (request.status === 413) reject(new ApiError(413, "حجم فایل از سقف مجاز بیشتر است."));
      else if (request.status === 502 || request.status === 503 || request.status === 504) {
        reject(new ApiError(request.status, "سرور در دسترس نبود یا بارگذاری بیش از حد طول کشید. اتصال را بررسی و دوباره تلاش کنید."));
      } else reject(errorFrom(request.status, request.statusText, body));
    };
    request.onerror = () => reject(new ApiError(0, "اتصال در میانهٔ بارگذاری قطع شد. دوباره تلاش کنید."));
    request.onabort = () => reject(new ApiError(0, "بارگذاری لغو شد."));
    request.send(formData);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One piece of a file, with its own progress. */
function putPiece(path: string, piece: Blob, onProgress: (loaded: number) => void): Promise<void> {
  const formData = new FormData();
  formData.append("chunk", piece, "chunk");
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `${API_URL}${path}`);
    request.withCredentials = true;
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      let body: unknown;
      try {
        body = request.responseText ? JSON.parse(request.responseText) : undefined;
      } catch {
        /* an HTML error page from the CDN */
      }
      reject(errorFrom(request.status, request.statusText, body));
    };
    request.onerror = () => reject(new ApiError(0, "اتصال قطع شد."));
    request.send(formData);
  });
}

/**
 * Uploads a large file in pieces (the lesson-video upload): each piece is a
 * short request, so a slow connection never runs into the CDN's limit on how
 * long one request may take, and a piece that fails is sent again. After the
 * last piece the server processes the file while this waits for the result.
 */
export async function uploadInPieces<T>(base: string, file: File, onProgress?: (progress: UploadProgress) => void): Promise<T> {
  const { uploadId, chunkBytes, chunks } = await apiFetch<{ uploadId: string; chunkBytes: number; chunks: number }>(base, {
    method: "POST",
    body: { size: file.size },
  });
  for (let index = 0; index < chunks; index++) {
    const start = index * chunkBytes;
    const piece = file.slice(start, Math.min(file.size, start + chunkBytes));
    for (let attempt = 1; ; attempt++) {
      try {
        await putPiece(`${base}/${uploadId}/chunks/${index}`, piece, (loaded) => onProgress?.({ loaded: start + loaded, total: file.size }));
        break;
      } catch (error) {
        // A refusal (4xx) will not change on retry; a dropped connection may.
        const refused = error instanceof ApiError && error.status >= 400 && error.status < 500;
        if (refused || attempt >= 6) throw error;
        await wait(2000 * attempt);
      }
    }
  }
  await apiFetch(`${base}/${uploadId}/complete`, { method: "POST" });
  onProgress?.({ loaded: file.size, total: file.size });
  for (let misses = 0; ; ) {
    await wait(2000);
    try {
      const state = await apiFetch<{ status: string; result?: T; error?: string }>(`${base}/${uploadId}`);
      misses = 0;
      if (state.status === "done") return state.result as T;
      if (state.status === "failed") throw new ApiError(400, state.error ?? "processing failed");
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) throw error;
      if (++misses >= 15) throw error;
    }
  }
}
