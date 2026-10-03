import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

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
