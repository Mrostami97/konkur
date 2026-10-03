import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { BlockList, isIP } from "node:net";

export function trustedProxyNetworks(value = process.env.TRUSTED_PROXY_CIDRS ?? ""): BlockList {
  const networks = new BlockList();
  for (const entry of value.split(/[\s,]+/).filter(Boolean)) {
    const [address, prefix, ...extra] = entry.split("/");
    const family = isIP(address);
    const bits = prefix === undefined ? (family === 4 ? 32 : 128) : Number(prefix);
    if (!family || extra.length || !Number.isInteger(bits) || bits < 1 || bits > (family === 4 ? 32 : 128)) {
      throw new Error("TRUSTED_PROXY_CIDRS must contain valid verified IPv4/IPv6 networks, excluding /0");
    }
    networks.addSubnet(address, bits, family === 4 ? "ipv4" : "ipv6");
  }
  return networks;
}

export function forwardedVisitor(header: string | string[] | undefined, peer: string, networks: BlockList): string {
  const chain = String(Array.isArray(header) ? header.join(",") : header ?? "")
    .split(",").map((entry) => entry.trim()).filter((entry) => isIP(entry) !== 0);
  if (!chain.length) return peer;
  let index = chain.length - 1;
  while (index > 0 && networks.check(chain[index], isIP(chain[index]) === 4 ? "ipv4" : "ipv6")) index--;
  return chain[index];
}

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
 * - nginx appends its actual client. Only explicitly verified reverse-proxy
 *   networks may extend that chain. A direct client's forged prefixes never
 *   replace its own tracker. Do not publish the API port outside this network.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  private readonly trustedNetworks = trustedProxyNetworks();
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    if (!request.headers["x-forwarded-for"]) return true;
    return super.shouldSkip(context);
  }

  protected async getTracker(request: Record<string, unknown>): Promise<string> {
    const headers = (request.headers ?? {}) as Record<string, string | string[] | undefined>;
    return forwardedVisitor(headers["x-forwarded-for"], String(request.ip), this.trustedNetworks);
  }
}
