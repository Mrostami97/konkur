import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health is a plain liveness ping", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /healthz reports real connectivity to every dependency", async () => {
    const res = await request(app.getHttpServer()).get("/healthz").expect(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.version).toBe("string");
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(res.body.checks.database.status).toBe("ok");
    expect(typeof res.body.checks.database.latencyMs).toBe("number");
    expect(res.body.checks.objectStorage.status).toBe("ok");
    expect(typeof res.body.checks.objectStorage.latencyMs).toBe("number");
  });
});
