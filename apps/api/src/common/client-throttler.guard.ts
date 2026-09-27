import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Rate limits per visitor, not per proxy.
 *
 * The API is reached two ways: browsers through nginx (and, in production, a
 * CDN before it), and the web server's own page rendering, which calls the
 * API directly inside the Docker network. Without this, every browser
 * request looked like it came from nginx and every rendered page from the
 * web container, so the whole site shared one 60-a-minute allowance.
 *
 * - Rendering calls carry no X-Forwarded-For (only nginx adds it, and the
 *   API port is not published), so they are not limited here; the visitor
 *   behind them was already counted when their request reached the web.
 * - For browser calls the visitor is read from X-Forwarded-For. nginx
 *   appends the address it saw; TRUSTED_PROXY_HOPS says how many proxies
 *   stand in front of nginx (1 with the CDN), so the visitor is that many
 *   entries from the right. Entries further left are client-supplied and
 *   never trusted.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    if (!request.headers["x-forwarded-for"]) return true;
    return super.shouldSkip(context);
  }

  protected async getTracker(request: Record<string, unknown>): Promise<string> {
    const headers = (request.headers ?? {}) as Record<string, string | string[] | undefined>;
    const header = headers["x-forwarded-for"];
    const chain = String(Array.isArray(header) ? header.join(",") : header ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const hops = Math.max(0, Number(process.env.TRUSTED_PROXY_HOPS ?? 0) || 0);
    const visitor = chain[chain.length - 1 - hops] ?? chain[0];
    return visitor ?? String(request.ip);
  }
}
