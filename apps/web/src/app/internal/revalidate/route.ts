import { revalidateTag } from "next/cache";
import { PUBLIC_CONTENT_TAG } from "../../../lib/api";

export const dynamic = "force-dynamic";

/** Loopback and private-network addresses: the Docker network the API calls from. */
function isInternal(address: string) {
  const ip = address.trim().replace(/^::ffff:/, "");
  return (
    ip === "::1" ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip)
  );
}

/**
 * Drops the cached copies of the public article and guide pages, so an edit
 * shows at once instead of after PUBLIC_PAGE_REVALIDATE seconds. The API calls
 * it over the server's internal network after any change to public content.
 * nginx refuses /internal/ from outside; as a second guard, a request whose
 * forwarding chain holds any public address (every request through nginx
 * does) is turned away.
 */
export async function POST(request: Request) {
  const chain = (request.headers.get("x-forwarded-for") ?? "").split(",").filter((part) => part.trim());
  if (chain.length === 0 || !chain.every(isInternal)) return new Response("not found", { status: 404 });
  revalidateTag(PUBLIC_CONTENT_TAG);
  return Response.json({ revalidated: true });
}
