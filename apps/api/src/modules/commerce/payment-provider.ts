import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";

export const PAYMENT_PROVIDER = "PAYMENT_PROVIDER";

export interface ChargeResult {
  providerRef: string;
  succeeded: boolean;
}

export interface PaymentProvider {
  readonly name: string;
  charge(orderId: string, amountRial: number): Promise<ChargeResult>;
}

/**
 * No real Iranian payment gateway (Zarinpal/IDPay/etc.) has been chosen yet
 * (doc §12.1 lists it as a pending business/ops input). This provider always
 * succeeds immediately, standing in for a real gateway's redirect+callback
 * cycle so the register→purchase→access E2E path can be built and tested
 * now. Swappable behind the PaymentProvider interface, same pattern as the
 * OTP provider in Phase 0.
 */
@Injectable()
export class ManualSandboxPaymentProvider implements PaymentProvider {
  readonly name = "manual-sandbox";
  private readonly logger = new Logger(ManualSandboxPaymentProvider.name);

  async charge(orderId: string, amountRial: number): Promise<ChargeResult> {
    const providerRef = `sandbox-${randomUUID()}`;
    this.logger.log(
      `Sandbox-charged order ${orderId} for ${amountRial} IRR (ref ${providerRef}). No real gateway configured.`,
    );
    return { providerRef, succeeded: true };
  }
}
