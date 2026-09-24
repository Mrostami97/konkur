import { Logger } from "@nestjs/common";

export const SMS_GATEWAY = "SMS_GATEWAY";

/**
 * A template-based SMS gateway. Iranian operators only deliver bulk-route
 * messages that match a template the operator approved in advance, so every
 * message here is "template + ordered variables" rather than free text --
 * which is also what keeps a bug from texting arbitrary content to a user.
 */
export interface SmsGateway {
  /** Short name recorded on each message, e.g. "kavenegar". */
  readonly name: string;
  /** True when messages actually leave the building. */
  readonly delivers: boolean;
  send(phone: string, template: string, tokens: string[]): Promise<{ messageId?: string }>;
}

/** +989121234567 -> 09121234567, the form both Iranian gateways accept. */
export function toLocalMobile(phone: string): string {
  return phone.startsWith("+98") ? `0${phone.slice(3)}` : phone;
}

const TIMEOUT_MS = 10_000;

/** Development stand-in: writes the message to the log. */
export class ConsoleSmsGateway implements SmsGateway {
  readonly name = "console";
  readonly delivers = false;
  private readonly logger = new Logger("ConsoleSmsGateway");

  async send(phone: string, template: string, tokens: string[]) {
    this.logger.log(`SMS to ${phone} [${template}]: ${tokens.join(" | ")} (no SMS gateway configured)`);
    return {};
  }
}

/**
 * Kavenegar "verify/lookup": a pre-approved template with up to three
 * variables. The variables may not contain spaces, so a space becomes a
 * zero-width non-joiner -- which reads as a space in Persian text.
 * https://kavenegar.com/rest.html#sms-Lookup
 */
export class KavenegarSmsGateway implements SmsGateway {
  readonly name = "kavenegar";
  readonly delivers = true;

  constructor(private readonly apiKey: string) {}

  async send(phone: string, template: string, tokens: string[]) {
    const params = new URLSearchParams({ receptor: toLocalMobile(phone), template });
    const names = ["token", "token2", "token3"];
    tokens.slice(0, 3).forEach((value, index) => params.set(names[index], value.replace(/\s+/g, "‌")));
    const res = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as
      | { return?: { status?: number; message?: string }; entries?: { messageid?: number }[] }
      | null;
    if (!res.ok || body?.return?.status !== 200) {
      throw new Error(`kavenegar ${body?.return?.status ?? res.status}: ${body?.return?.message ?? res.statusText}`);
    }
    const id = body.entries?.[0]?.messageid;
    return { messageId: id !== undefined ? String(id) : undefined };
  }
}

/**
 * SMS.ir "send/verify": a template id with named parameters. The names are
 * fixed here so the templates can be set up once in the SMS.ir panel: a
 * login code template uses #CODE#, every other template #TOKEN#, #TOKEN2#
 * and #TOKEN3#.
 * https://app.sms.ir/developer/help/verify
 */
export class SmsIrSmsGateway implements SmsGateway {
  readonly name = "smsir";
  readonly delivers = true;

  constructor(private readonly apiKey: string) {}

  async send(phone: string, template: string, tokens: string[], names = ["TOKEN", "TOKEN2", "TOKEN3"]) {
    const templateId = Number(template);
    if (!Number.isInteger(templateId)) throw new Error(`smsir template id must be a number, got "${template}"`);
    const res = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({
        mobile: toLocalMobile(phone),
        templateId,
        parameters: tokens.slice(0, names.length).map((value, index) => ({ name: names[index], value })),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { status?: number; message?: string; data?: { messageId?: number } } | null;
    if (!res.ok || body?.status !== 1) {
      throw new Error(`smsir ${body?.status ?? res.status}: ${body?.message ?? res.statusText}`);
    }
    const id = body.data?.messageId;
    return { messageId: id !== undefined ? String(id) : undefined };
  }
}

/** Picks the gateway from SMS_PROVIDER / SMS_API_KEY. Anything else -- or a
 * provider without a key -- falls back to the console, loudly in production,
 * where it means nobody can receive a login code. */
export function createSmsGateway(env: NodeJS.ProcessEnv = process.env): SmsGateway {
  const logger = new Logger("SmsGateway");
  const provider = (env.SMS_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (env.SMS_API_KEY ?? "").trim();
  if (provider && !apiKey) logger.error(`SMS_PROVIDER=${provider} is set but SMS_API_KEY is empty; SMS falls back to the log`);
  if (provider === "kavenegar" && apiKey) return new KavenegarSmsGateway(apiKey);
  if (provider === "smsir" && apiKey) return new SmsIrSmsGateway(apiKey);
  if (provider && provider !== "console" && apiKey) logger.error(`unknown SMS_PROVIDER "${provider}"; SMS falls back to the log`);
  if (env.NODE_ENV === "production") {
    logger.error("no SMS gateway is configured: login codes and notifications are only written to the log");
  }
  return new ConsoleSmsGateway();
}
