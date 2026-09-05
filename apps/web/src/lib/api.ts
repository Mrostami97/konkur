export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Server-only override so SSR requests hit the API directly on the docker
 * network instead of round-tripping through the public HTTPS domain (which
 * doesn't resolve there, and wouldn't validate against a self-signed cert
 * anyway). Falls back to the public URL when unset (e.g. local `pnpm dev`). */
const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
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
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await parseBody(res);
  if (!res.ok) {
    const message = (body && body.message) || res.statusText;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(", ") : message);
  }
  return body as T;
}

/** Multipart upload (e.g. the ingestion zip) with the session cookie attached. */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const body = await parseBody(res);
  if (!res.ok) {
    const message = (body && body.message) || res.statusText;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(", ") : message);
  }
  return body as T;
}
