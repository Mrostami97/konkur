import type { NextFunction, Request, Response } from "express";

/** Protect browser writes, including login cookie issuance. Requests from tools
 * without browser origin/fetch metadata remain supported; those callers must
 * already possess credentials and cannot read them from a cross-origin browser. */
export function browserOriginMiddleware(frontendUrl: string) {
  const allowed = new URL(frontendUrl);
  if (!["http:", "https:"].includes(allowed.protocol) || allowed.username || allowed.password) {
    throw new Error("FRONTEND_URL must be an HTTP(S) origin");
  }
  const allowedOrigin = allowed.origin;

  return (request: Request, response: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return next();
    const reject = () => response
      .setHeader("Cache-Control", "private, no-store")
      .status(403)
      .json({ statusCode: 403, error: "Forbidden", message: "untrusted request origin" });

    const origin = request.headers.origin;
    if (origin !== undefined) {
      // Browser Origin is serialized without a path, query, credentials or slash.
      if (typeof origin !== "string" || origin !== allowedOrigin) return reject();
      return next();
    }
    const fetchSite = request.headers["sec-fetch-site"];
    if (fetchSite === "cross-site" || fetchSite === "same-site") return reject();
    const referer = request.headers.referer;
    if (referer !== undefined) {
      try {
        if (typeof referer !== "string" || new URL(referer).origin !== allowedOrigin) return reject();
      } catch {
        return reject();
      }
      return next();
    }
    // Legacy browsers may omit both Origin and Fetch Metadata. These form
    // encodings can issue a cross-origin login POST without a preflight.
    // JSON tools and authenticated multipart import clients remain supported.
    const contentType = String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (["application/x-www-form-urlencoded", "text/plain"].includes(contentType)) return reject();
    return next();
  };
}
