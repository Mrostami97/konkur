import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { SMS_GATEWAY, SmsGateway, SmsIrSmsGateway } from "../notifications/sms-gateway";

export const OTP_PROVIDER = "OTP_PROVIDER";

export interface OtpProvider {
  send(phone: string, code: string): Promise<void>;
}

/**
 * Sends the login code through the configured SMS gateway (see
 * createSmsGateway), using the SMS_OTP_TEMPLATE the operator approved. With
 * no gateway configured -- local development -- the code is written to the
 * log instead, as before. The code is never stored anywhere but as a hash.
 */
@Injectable()
export class GatewayOtpProvider implements OtpProvider {
  private readonly logger = new Logger("OtpProvider");

  constructor(@Inject(SMS_GATEWAY) private readonly gateway: SmsGateway) {}

  async send(phone: string, code: string): Promise<void> {
    if (!this.gateway.delivers) {
      this.logger.log(`OTP for ${phone}: ${code} (console provider, no SMS gateway configured)`);
      return;
    }
    const template = process.env.SMS_OTP_TEMPLATE?.trim();
    if (!template) {
      this.logger.error("SMS_OTP_TEMPLATE is not set; a login code cannot be sent");
      throw new ServiceUnavailableException("login codes cannot be sent right now");
    }
    try {
      if (this.gateway instanceof SmsIrSmsGateway) await this.gateway.send(phone, template, [code], ["CODE"]);
      else await this.gateway.send(phone, template, [code]);
    } catch (err) {
      // The gateway's message may carry account details; the caller only
      // needs to know the code did not go out.
      this.logger.error(`login code to ${phone} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException("the login code could not be sent; try again in a minute");
    }
  }
}
