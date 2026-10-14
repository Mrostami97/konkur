import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends a published article reached under the wrong section to its own one
 * (/articles/<guide> → /guides/<guide>, /guides/<article> → /articles/<article>)
 * before the page cache. Inside a cached page, Next sends a redirect's
 * Location header twice on its first render, and Chrome joins the two into
 * one broken address; the redirect from here (via app/internal/section-
 * redirect) has a single, relative one. The type of
 * each published slug comes from the API's small /article-kinds list, kept
 * for a minute. If the list cannot be read, requests pass through and the page
 * itself shows the content with its canonical address.
 */
const INTERNAL_API_URL = (process.env.INTERNAL_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const TTL_MS = 60_000;

let kinds: { bySlug: Map<string, string>; at: number } | null = null;
let loading: Promise<void> | null = null;

async function refresh() {
  try {
    const response = await fetch(`${INTERNAL_API_URL}/article-kinds`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (!response.ok) throw new Error(`article-kinds ${response.status}`);
    const list = (await response.json()) as { slug: string; contentType: string }[];
    kinds = { bySlug: new Map(list.map((item) => [item.slug, item.contentType])), at: Date.now() };
  } catch {
    // Keep what we had (or nothing) and try again after the TTL.
    kinds = { bySlug: kinds?.bySlug ?? new Map(), at: Date.now() };
  } finally {
    loading = null;
  }
}

export async function middleware(request: NextRequest) {
  if (!kinds || Date.now() - kinds.at > TTL_MS) {
    loading ??= refresh();
    await loading;
  }
  const [, section, rawSlug] = request.nextUrl.pathname.split("/");
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug ?? "");
  } catch {
    return NextResponse.next();
  }
  const type = kinds?.bySlug.get(slug);
  const home = type === "GUIDE" ? "guides" : type ? "articles" : null;
  if (!home || home === section) return NextResponse.next();
  // A relative Location, as before (app/internal/section-redirect).
  return NextResponse.rewrite(new URL(`/internal/section-redirect/${home}/${encodeURIComponent(slug)}`, request.url));
}

export const config = {
  matcher: ["/articles/:slug", "/guides/:slug"],
  runtime: "nodejs",
};
