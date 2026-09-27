import type { NextFunction, Request, Response } from "express";

/**
 * Every API response defaults to "never store". The site sits behind a CDN
 * whose default policy caches responses that do not forbid it, and most of
 * this API answers per person: a session, a library, an order, whether a
 * handout is readable. One cached copy of those could be served to someone
 * else. An endpoint that is safe to cache says so itself with @Header,
 * which runs after this and replaces it.
 */
export function noStoreByDefault(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("Cache-Control", "private, no-store");
  next();
}
