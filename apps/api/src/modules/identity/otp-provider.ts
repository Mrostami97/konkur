import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { mobileTail } from "./phone";

export const OTP_PROVIDER = "OTP_PROVIDER";

export interface OtpProvider {
  send(phone: string, code: string): Promise<void>;
}

/**
 * Dev-mode stand-in: logs the OTP instead of sending an SMS.
 * No SMS gateway vendor has been chosen yet (doc §12.1 lists it as a
 * pending business/ops input). Swappable later without touching
 * IdentityService, which only depends on the OtpProvider interface.
 */
@Injectable()
export class ConsoleOtpProvider implements OtpProvider {
  private readonly logger = new Logger(ConsoleOtpProvider.name);

  async send(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException("OTP login is not configured");
    }
    this.logger.log(`OTP for ${phone}: ${code} (console provider, no SMS gateway configured)`);
  }
}

const SMSIR_VERIFY_ENDPOINT = "https://api.sms.ir/v1/send/verify";

/**
 * Sends the sign-in code through sms.ir's template ("verify") API: the text
 * lives in an approved template on their panel, and only the code is sent as
 * its parameter. Contract per https://app.sms.ir/developer/help/verify --
 * POST with the key in `x-api-key`, body `{ mobile, templateId, parameters }`;
 * a delivered request answers `{ status: 1 }`.
 */
@Injectable()
export class SmsIrOtpProvider implements OtpProvider {
  private readonly logger = new Logger(SmsIrOtpProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly templateId: number,
    private readonly codeParameter: string,
  ) {}

  async send(phone: string, code: string): Promise<void> {
    const tail = mobileTail(phone);
    if (!tail) throw new ServiceUnavailableException("شمارهٔ موبایل برای ارسال پیامک معتبر نیست.");

    let response: Response;
    try {
      response = await fetch(SMSIR_VERIFY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify({
          mobile: `0${tail}`,
          templateId: this.templateId,
          parameters: [{ name: this.codeParameter, value: code }],
        }),
        // The person is waiting on the login form; a hung connection should
        // read as "try again", not as a spinner that never stops.
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error(`sms.ir request failed: ${String(error)}`);
      throw new ServiceUnavailableException("ارسال پیامک الان ممکن نشد؛ چند لحظهٔ دیگر دوباره امتحان کن.");
    }

    const body = (await response.json().catch(() => null)) as { status?: unknown; message?: unknown } | null;
    if (!response.ok || body?.status !== 1) {
      // Their message names the cause (bad key, IP not allowed, no credit,
      // template not approved); it belongs in the log, never in the reply,
      // and neither the phone nor the code is logged.
      this.logger.error(`sms.ir refused the code (HTTP ${response.status}, status ${String(body?.status)}): ${String(body?.message).slice(0, 300)}`);
      throw new ServiceUnavailableException("ارسال پیامک الان ممکن نشد؛ چند لحظهٔ دیگر دوباره امتحان کن.");
    }
  }
}

/** sms.ir when its key and template are configured, otherwise the console
 * stand-in (which refuses to send in production). */
export function otpProviderFromEnv(env: NodeJS.ProcessEnv = process.env): OtpProvider {
  const apiKey = env.SMSIR_API_KEY?.trim() ?? "";
  const templateId = Number(env.SMSIR_TEMPLATE_ID?.trim() ?? "");
  if (apiKey && Number.isInteger(templateId) && templateId > 0) {
    return new SmsIrOtpProvider(apiKey, templateId, env.SMSIR_CODE_PARAMETER?.trim() || "CODE");
  }
  return new ConsoleOtpProvider();
}
