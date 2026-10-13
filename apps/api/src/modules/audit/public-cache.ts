/**
 * After a change to public content, asks the web app to drop its cached
 * article and guide pages (POST /internal/revalidate), so an edit is visible
 * at once. Calls within a short window are merged into one, sent a moment
 * later so the change's transaction has committed. Off when WEB_INTERNAL_URL
 * is unset (development, tests); a failure only means the page refreshes on
 * its own a minute later.
 */
const PUBLIC_CONTENT_ACTIONS = /^(article|guide|import|content|content_source|contributor)\./;
const DELAY_MS = 1500;

let pending: ReturnType<typeof setTimeout> | null = null;

export function touchesPublicContent(action: string) {
  return PUBLIC_CONTENT_ACTIONS.test(action);
}

export function schedulePublicCacheRefresh(webUrl = process.env.WEB_INTERNAL_URL) {
  if (!webUrl || pending) return;
  pending = setTimeout(() => {
    pending = null;
    fetch(`${webUrl.replace(/\/$/, "")}/internal/revalidate`, { method: "POST", signal: AbortSignal.timeout(5000) }).catch(() => undefined);
  }, DELAY_MS);
  pending.unref?.();
}
