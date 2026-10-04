import { ServiceUnavailableException } from "@nestjs/common";
import { ConsoleOtpProvider, SmsIrOtpProvider, otpProviderFromEnv } from "../src/modules/identity/otp-provider";

describe("sms.ir sign-in codes", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  function answer(status: number, body: unknown) {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("sends the code as the template parameter to the number in 09 form", async () => {
    const fetchMock = answer(200, { status: 1, message: "موفق", data: { messageId: 1 } });
    await new SmsIrOtpProvider("key", 123456, "CODE").send("+989121234567", "48213");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sms.ir/v1/send/verify");
    expect(init.headers["x-api-key"]).toBe("key");
    expect(JSON.parse(init.body)).toEqual({ mobile: "09121234567", templateId: 123456, parameters: [{ name: "CODE", value: "48213" }] });
  });

  it("fails visibly, in Persian, when sms.ir refuses", async () => {
    answer(200, { status: 10, message: "invalid key" });
    await expect(new SmsIrOtpProvider("key", 1, "CODE").send("09121234567", "1")).rejects.toBeInstanceOf(ServiceUnavailableException);
    answer(400, { status: 0, message: "ip not allowed" });
    await expect(new SmsIrOtpProvider("key", 1, "CODE").send("09121234567", "1")).rejects.toThrow("ارسال پیامک");
  });

  it("uses sms.ir only when both the key and the template are set", () => {
    expect(otpProviderFromEnv({ SMSIR_API_KEY: "k", SMSIR_TEMPLATE_ID: "100" })).toBeInstanceOf(SmsIrOtpProvider);
    expect(otpProviderFromEnv({ SMSIR_API_KEY: "k" })).toBeInstanceOf(ConsoleOtpProvider);
    expect(otpProviderFromEnv({ SMSIR_TEMPLATE_ID: "100" })).toBeInstanceOf(ConsoleOtpProvider);
    expect(otpProviderFromEnv({ SMSIR_API_KEY: "k", SMSIR_TEMPLATE_ID: "abc" })).toBeInstanceOf(ConsoleOtpProvider);
  });
});
