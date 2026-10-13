export const dynamic = "force-dynamic";

const TARGET = /^\/(articles|guides)\/[^/?#]+$/;

/**
 * The permanent redirect middleware.ts asks for (it rewrites here): a route
 * handler may answer with a relative Location, which middleware itself may
 * not, and an absolute one would carry the container's own host name instead
 * of the site's. Only a same-site article or guide path is accepted.
 */
export function GET(request: Request) {
  const to = new URL(request.url).searchParams.get("to") ?? "";
  if (!TARGET.test(to)) return new Response("not found", { status: 404 });
  return new Response(null, { status: 308, headers: { Location: to } });
}

export const HEAD = GET;
