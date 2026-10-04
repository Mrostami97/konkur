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
  ) {
    super(message);
  }
}

function errorFrom(status: number, statusText: string, body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : undefined;
  const message = record?.message ?? statusText;
  return new ApiError(
    status,
    Array.isArray(message) ? message.join(", ") : String(message),
    typeof record?.code === "string" ? record.code : undefined,
    record,
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

/** Server-side fetch for public, unauthenticated pages (SSR/SEO). */
export async function apiGetPublic<T>(path: string): Promise<T | null> {
  const res = await fetch(`${INTERNAL_API_URL}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

/** Browser-side fetch that carries the session cookie for authenticated calls. */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    // Lets a last report leave while the page is being closed.
    keepalive: options.keepalive,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
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
export function apiUpload<T>(path: string, file: File, onProgress?: (progress: UploadProgress) => void): Promise<T> {
  const formData = new FormData();
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
