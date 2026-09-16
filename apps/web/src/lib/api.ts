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
