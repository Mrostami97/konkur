import "reflect-metadata";
import { createHash, randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { IdentityService } from "../src/modules/identity/identity.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { OtpProvider } from "../src/modules/identity/otp-provider";

// Explicit opt-in: this suite never falls back to a developer/production DATABASE_URL.
const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const isolatedDatabaseSuite = databaseUrl ? describe : describe.skip;

isolatedDatabaseSuite("OTP concurrency on explicitly isolated Postgres", () => {
  let prisma: PrismaClient;
  let service: IdentityService;
  const createdUserIds: string[] = [];
  const deliveries = new Map<string, string[]>();
  const phone = () => `security-otp-${randomUUID()}`;

  beforeAll(async () => {
    const parsed = new URL(databaseUrl!);
    const dedicatedDatabase = parsed.pathname.toLowerCase().includes("security");
    const ephemeralCiService = process.env.CI === "true" && process.env.SECURITY_TEST_DATABASE === "1" && parsed.pathname === "/konkurcom";
    if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || !(dedicatedDatabase || ephemeralCiService)) {
      throw new Error("SECURITY_TEST_DATABASE_URL must name a dedicated loopback security database or the opted-in ephemeral CI service");
    }
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    const provider: OtpProvider = { send: async (value, code) => { deliveries.set(value, [...(deliveries.get(value) ?? []), code]); } };
    service = new IdentityService(prisma as unknown as PrismaService, new AuditService(prisma as unknown as PrismaService), provider);
  });

  afterAll(async () => {
    if (!prisma) return;
    // Deletes only synthetic accounts created by this suite, never seeds or unrelated rows.
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function issue(value: string) {
    await service.requestOtp(value);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: value } });
    if (!createdUserIds.includes(user.id)) createdUserIds.push(user.id);
    return { userId: user.id, code: deliveries.get(value)!.at(-1)! };
  }

  it("issues only one session for twenty simultaneous uses of one valid code", async () => {
    const value = phone();
    const { userId, code } = await issue(value);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => service.verifyOtp(value, code, {})));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.session.count({ where: { userId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { actorUserId: userId, action: "auth.login" } })).toBe(1);
  });

  it("persists exactly five failed attempts under a concurrent guessing burst", async () => {
    const value = phone();
    const { userId, code } = await issue(value);
    const wrong = code === "000000" ? "111111" : "000000";
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => service.verifyOtp(value, wrong, {})));
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect((await prisma.otpCode.findFirstOrThrow({ where: { userId, consumedAt: null } })).attempts).toBe(5);
    await expect(service.verifyOtp(value, code, {})).rejects.toThrow("too many attempts");
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
  });

  it("leaves one pending challenge after parallel issuance and never reactivates an older code", async () => {
    const value = phone();
    const { userId, code: oldCode } = await issue(value);
    await Promise.all(Array.from({ length: 8 }, () => service.requestOtp(value)));
    expect(await prisma.otpCode.count({ where: { userId, consumedAt: null } })).toBe(1);
    // Delivery happens after commit and may finish out of order. Select the
    // code for the actual pending row, rather than relying on delivery order.
    const pending = await prisma.otpCode.findFirstOrThrow({ where: { userId, consumedAt: null } });
    const currentCode = deliveries.get(value)!.find((code) => createHash("sha256").update(code).digest("hex") === pending.codeHash);
    expect(currentCode).toBeDefined();
    await service.verifyOtp(value, currentCode!, {});
    await expect(service.verifyOtp(value, oldCode, {})).rejects.toThrow("invalid phone or code");
    expect(await prisma.session.count({ where: { userId } })).toBe(1);
  });
});
