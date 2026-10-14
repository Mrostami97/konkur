export const dynamic = "force-dynamic";

const SECTIONS = new Set(["articles", "guides"]);

/**
 * The permanent redirect middleware.ts asks for (it rewrites here): a route
 * handler may answer with a relative Location, which middleware itself may
 * not, and an absolute one would carry the container's own host name instead
 * of the site's. The target travels in the path, not a query string, because
 * the standalone server drops a rewrite's query before it reaches the handler.
 * Only a same-site article or guide path is produced.
 */
export async function GET(_request: Request, context: { params: Promise<{ section: string; slug: string }> }) {
  const { section, slug } = await context.params;
  if (!SECTIONS.has(section) || !slug || /[/?#]/.test(slug)) return new Response("not found", { status: 404 });
  return new Response(null, { status: 308, headers: { Location: `/${section}/${encodeURIComponent(slug)}` } });
}

export const HEAD = GET;
