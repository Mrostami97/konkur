import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { signedInitData } from "./helpers/telegram";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

describe("Telegram mini app sign-in (e2e)", () => {
  const token = "123456:e2e-bot-token";
  let app: INestApplication;
  let otp: CapturingOtpProvider;
  const previous = process.env.TELEGRAM_BOT_TOKEN;

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = token;
    otp = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(OTP_PROVIDER).useValue(otp).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = previous;
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it("signs nobody in until the Telegram account is linked, then signs its owner in by itself", async () => {
    const telegramId = Math.floor(Math.random() * 1e9);
    const initData = signedInitData(token, { id: telegramId, first_name: "Sara" });

    const before = await http().post("/auth/telegram/session").send({ initData }).expect(200);
    expect(before.body).toEqual({ linked: false, configured: true });
    expect(before.headers["set-cookie"]).toBeUndefined();

    // Linking needs a site session.
    await http().post("/auth/telegram/link").send({ initData }).expect(401);

    const phone = `0912${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    await http().post("/auth/otp/request").send({ phone }).expect(200);
    const verified = await http().post("/auth/otp/verify").send({ phone, code: otp.sent.at(-1)!.code }).expect(200);
    const cookie = verified.headers["set-cookie"][0];
    await http().post("/auth/telegram/link").set("Cookie", cookie).send({ initData }).expect(200);

    const after = await http().post("/auth/telegram/session").send({ initData }).expect(200);
    expect(after.body.linked).toBe(true);
    expect(after.body.user.id).toBe(verified.body.user.id);
    const me = await http().get("/auth/me").set("Cookie", after.headers["set-cookie"][0]).expect(200);
    expect(me.body.user.id).toBe(verified.body.user.id);
  });

  it("refuses init data that Telegram did not sign", async () => {
    const forged = signedInitData("999:someone-else", { id: 1 });
    await http().post("/auth/telegram/session").send({ initData: forged }).expect(401);
  });
});
