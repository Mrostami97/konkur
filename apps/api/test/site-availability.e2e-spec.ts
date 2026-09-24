import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { ConsoleOtpProvider, OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { SiteService } from "../src/modules/site/site.service";

/** Stands in for a connected SMS gateway. */
class GatewayOtpProvider implements OtpProvider {
  async send(): Promise<void> {}
}

const KEYS = [
  "smsLogin",
  "otpLogin",
  "courses",
  "paidCourses",
  "questions",
  "exams",
  "freeVideos",
  "resources",
  "consultations",
  "instructors",
  "results",
  "reportCards",
  "programs",
];

describe("Site availability (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(new GatewayOtpProvider())
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("is public and returns only flags and counts", async () => {
    const res = await request(app.getHttpServer()).get("/site/availability").expect(200);
    expect(Object.keys(res.body).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      const value = res.body[key];
      if (key === "smsLogin" || key === "otpLogin") expect(typeof value).toBe("boolean");
      else expect(Number.isInteger(value) && value >= 0).toBe(true);
    }
    expect(res.body.smsLogin).toBe(true);
    expect(res.body.otpLogin).toBe(true);
  });

  it("counts a course only once it is published, as the public catalogue does", async () => {
    const before = (await request(app.getHttpServer()).get("/site/availability").expect(200)).body;
    const course = await prisma.course.create({
      data: { slug: `availability-${randomUUID()}`, title: "دورهٔ آزمایشی", description: "آزمایشی" },
    });
    try {
      const draft = (await request(app.getHttpServer()).get("/site/availability").expect(200)).body;
      expect(draft.courses).toBe(before.courses);
      expect(draft.paidCourses).toBe(before.paidCourses);

      await prisma.course.update({ where: { id: course.id }, data: { isPublished: true } });
      const published = (await request(app.getHttpServer()).get("/site/availability").expect(200)).body;
      expect(published.courses).toBe(before.courses + 1);
      expect(published.paidCourses).toBe(before.paidCourses + 1);
    } finally {
      await prisma.course.delete({ where: { id: course.id } });
    }
  });

  it("closes code login in production while codes are only logged", async () => {
    const site = new SiteService(prisma, new ConsoleOtpProvider());
    const env = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      expect(await site.availability()).toMatchObject({ smsLogin: false, otpLogin: false });
      // A developer can still read the code from the API log.
      process.env.NODE_ENV = "development";
      expect(await site.availability()).toMatchObject({ smsLogin: false, otpLogin: true });
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});
