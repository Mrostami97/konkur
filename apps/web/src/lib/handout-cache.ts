/**
 * The reader's own copy of each handout, kept (still masked) in the browser's
 * Cache Storage so a second visit does not download the file again. The copy
 * is never used on its own: every open still asks the API, which checks
 * access and answers 204 when the copy is current.
 */
const CACHE_NAME = "kc-handouts-v1";
export const cacheKey = (slug: string) => `/__handouts/${encodeURIComponent(slug)}`;

export async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** Forgets every kept handout; called on sign-out so the next person on this browser starts clean. */
export async function forgetHandouts() {
  try {
    if (typeof caches !== "undefined") await caches.delete(CACHE_NAME);
  } catch {
    // Storage may be blocked; there is then nothing to forget.
  }
}
