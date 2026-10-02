import type { NextFunction, Request, Response } from "express";
import { browserOriginMiddleware } from "../src/common/browser-origin.middleware";

describe("browser origin protection", () => {
  const middleware = browserOriginMiddleware("https://kunkurcomputer.ir");
  function invoke(method: string, headers: Record<string, string | string[]> = {}) {
    const next = jest.fn();
    const response = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
    response.setHeader.mockReturnValue(response);
    response.status.mockReturnValue(response);
    middleware({ method, headers } as Request, response as unknown as Response, next as NextFunction);
    return { next, response };
  }

  it.each(["GET", "HEAD", "OPTIONS"])("keeps public %s accessible regardless of foreign Origin", (method) => {
    expect(invoke(method, { origin: "https://foreign.invalid" }).next).toHaveBeenCalledTimes(1);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("accepts trusted browser %s", (method) => {
    expect(invoke(method, { origin: "https://kunkurcomputer.ir" }).next).toHaveBeenCalledTimes(1);
  });

  it.each(["https://foreign.invalid", "null", "", "https://kunkurcomputer.ir.foreign.invalid", "https://kunkurcomputer.ir/path"])("rejects unsafe Origin %s", (origin) => {
    const { next, response } = invoke("POST", { origin, "content-type": "application/x-www-form-urlencoded" });
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it.each(["cross-site", "same-site"])("rejects %s browser writes without Origin", (fetchSite) => {
    const { next, response } = invoke("POST", { "sec-fetch-site": fetchSite });
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("checks the Referer origin when Origin is absent", () => {
    expect(invoke("POST", { referer: "https://kunkurcomputer.ir/admin/users" }).next).toHaveBeenCalled();
    expect(invoke("POST", { referer: "https://foreign.invalid/form" }).response.status).toHaveBeenCalledWith(403);
    expect(invoke("POST", { referer: "malformed" }).response.status).toHaveBeenCalledWith(403);
  });

  it("preserves non-browser JSON and multipart clients without browser metadata", () => {
    expect(invoke("POST", { "content-type": "application/json" }).next).toHaveBeenCalled();
    expect(invoke("POST", { "content-type": "multipart/form-data; boundary=test" }).next).toHaveBeenCalled();
  });

  it.each(["application/x-www-form-urlencoded", "text/plain; charset=utf-8"])("rejects originless legacy form writes with %s", (contentType) => {
    expect(invoke("POST", { "content-type": contentType }).response.status).toHaveBeenCalledWith(403);
    expect(invoke("POST", { "content-type": contentType, referer: "https://kunkurcomputer.ir/login" }).next).toHaveBeenCalled();
  });

  it("rejects credential-bearing or non-HTTP frontend configuration", () => {
    expect(() => browserOriginMiddleware("https://user:password@kunkurcomputer.ir")).toThrow();
    expect(() => browserOriginMiddleware("file:///local")).toThrow();
  });
});
