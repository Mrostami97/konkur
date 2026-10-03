import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { ClientThrottlerGuard, trustedProxyNetworks } from "../src/common/client-throttler.guard";

/** What the API promises to the CDN and proxies in front of it. */
describe("API behaviour behind the CDN (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("forbids storing responses unless an endpoint allows it", async () => {
    const articles = await request(app.getHttpServer()).get("/articles").expect(200);
    expect(articles.headers["cache-control"]).toBe("private, no-store");
    const denied = await request(app.getHttpServer()).get("/me/library").expect(401);
    expect(denied.headers["cache-control"]).toBe("private, no-store");
  });

  it("answers the session check with 200 and no user when signed out", async () => {
    const session = await request(app.getHttpServer()).get("/auth/session").expect(200);
    expect(session.body).toEqual({ user: null });
    expect(session.headers["cache-control"]).toBe("private, no-store");
  });

  it("rate-limits the visitor, not the proxy in front of the API", async () => {
    class Probe extends ClientThrottlerGuard {
      tracker(headers: Record<string, string>, trustedCidrs = "") {
        (this as any).trustedNetworks = trustedProxyNetworks(trustedCidrs);
        return this.getTracker({ headers, ip: "10.0.0.2" });
      }
    }
    const guard = Object.create(Probe.prototype) as Probe;
    expect(await guard.tracker({ "x-forwarded-for": "6.6.6.6, 5.1.2.3, 172.19.0.8" }, "172.19.0.0/24")).toBe("5.1.2.3");
    expect(await guard.tracker({ "x-forwarded-for": "5.1.2.3, 172.19.0.8" }, "172.19.0.0/24")).toBe("5.1.2.3");
    // An untrusted direct peer cannot create a new bucket with a prefix.
    expect(await guard.tracker({ "x-forwarded-for": "6.6.6.6, 5.1.2.3" })).toBe("5.1.2.3");
    expect(await guard.tracker({ "x-forwarded-for": "7.7.7.7, 5.1.2.3" })).toBe("5.1.2.3");
  });
});
