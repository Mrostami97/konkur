import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma, SmsStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizePhone } from "../identity/phone";
import { SMS_GATEWAY, SmsGateway } from "./sms-gateway";

/**
 * Every kind of message the site sends, with who receives it and what the
 * template's variables are. The gateway template for a kind is configured by
 * SMS_TEMPLATE_<KIND>; a kind without one is recorded as SKIPPED, so the
 * admin log shows exactly which messages would go out once it is set.
 */
export const SMS_KINDS = {
  PAYMENT_RECEIPT_SUBMITTED: { label: "رسید کارت‌به‌کارت ثبت شد (به مدیر)", tokens: ["کد پیگیری سفارش"] },
  PAYMENT_CONFIRMED: { label: "پرداخت تأیید شد", tokens: ["کد پیگیری سفارش"] },
  PAYMENT_REJECTED: { label: "پرداخت رد شد", tokens: ["کد پیگیری سفارش"] },
  CONSULTATION_REQUESTED: { label: "درخواست مشاورهٔ تازه (به مدرس)", tokens: ["نام دانشجو"] },
  CONSULTATION_CONFIRMED: { label: "زمان جلسهٔ مشاوره قطعی شد", tokens: ["تاریخ", "ساعت"] },
  CONSULTATION_CANCELLED: { label: "جلسهٔ مشاوره لغو شد", tokens: ["تاریخ"] },
} as const;

export type SmsKind = keyof typeof SMS_KINDS;

const MAX_ATTEMPTS = 5;

export function templateFor(kind: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env[`SMS_TEMPLATE_${kind}`]?.trim();
  return value ? value : null;
}

/** Phones that get operator alerts (e.g. a new receipt to check). */
export function adminAlertPhones(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.SMS_ADMIN_PHONES ?? "")
    .split(",")
    .map((phone) => normalizePhone(phone.trim()))
    .filter(Boolean);
}

export interface SmsRequest {
  kind: SmsKind;
  phone: string;
  userId?: string | null;
  tokens: string[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_GATEWAY) private readonly gateway: SmsGateway,
  ) {}

  /**
   * Records messages to send. Pass the transaction of the event that causes
   * them, so a rolled-back payment confirmation never texts anyone.
   */
  async enqueue(requests: SmsRequest[], tx?: Prisma.TransactionClient) {
    const rows = requests.filter((request) => request.phone);
    if (!rows.length) return;
    await (tx ?? this.prisma).smsMessage.createMany({
      data: rows.map((request) => ({
        kind: request.kind,
        phone: request.phone,
        userId: request.userId ?? null,
        tokens: request.tokens,
      })),
    });
  }

  /** Delivers what is pending. Each message is claimed by bumping its
   * attempt count conditionally, so two API instances never send the same
   * message twice. */
  @Interval(10_000)
  async dispatch() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const pending = await this.prisma.smsMessage.findMany({
        where: { status: SmsStatus.PENDING },
        orderBy: { createdAt: "asc" },
        take: 25,
      });
      for (const message of pending) {
        const template = templateFor(message.kind);
        if (!template) {
          await this.prisma.smsMessage.updateMany({
            where: { id: message.id, status: SmsStatus.PENDING },
            data: { status: SmsStatus.SKIPPED, lastError: `no SMS_TEMPLATE_${message.kind} configured` },
          });
          continue;
        }
        const claimed = await this.prisma.smsMessage.updateMany({
          where: { id: message.id, status: SmsStatus.PENDING, attempts: message.attempts },
          data: { attempts: { increment: 1 } },
        });
        if (claimed.count === 0) continue;
        try {
          const result = await this.gateway.send(message.phone, template, message.tokens as string[]);
          await this.prisma.smsMessage.update({
            where: { id: message.id },
            data: {
              status: SmsStatus.SENT,
              sentAt: new Date(),
              provider: this.gateway.name,
              providerMessageId: result.messageId ?? null,
              lastError: null,
            },
          });
        } catch (err) {
          const lastError = (err as Error).message.slice(0, 500);
          const failed = message.attempts + 1 >= MAX_ATTEMPTS;
          await this.prisma.smsMessage.update({
            where: { id: message.id },
            data: { lastError, provider: this.gateway.name, ...(failed ? { status: SmsStatus.FAILED } : {}) },
          });
          this.logger.warn(`SMS ${message.id} (${message.kind}) attempt ${message.attempts + 1} failed: ${lastError}`);
        }
      }
    } catch (err) {
      this.logger.error(`SMS dispatch failed: ${(err as Error).message}`);
    } finally {
      this.dispatching = false;
    }
  }

  // --- admin -------------------------------------------------------------------

  /** What is configured, without revealing the key. */
  status() {
    return {
      provider: this.gateway.name,
      delivers: this.gateway.delivers,
      otpTemplateConfigured: Boolean(process.env.SMS_OTP_TEMPLATE?.trim()),
      adminPhones: adminAlertPhones().length,
      kinds: Object.entries(SMS_KINDS).map(([kind, meta]) => ({
        kind,
        label: meta.label,
        tokens: meta.tokens,
        templateConfigured: Boolean(templateFor(kind)),
      })),
    };
  }

  async list(filters: { status?: SmsStatus; kind?: string; page?: number; pageSize?: number }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 && filters.pageSize <= 100 ? filters.pageSize : 25;
    const where: Prisma.SmsMessageWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.kind) where.kind = filters.kind;
    const [items, total, counts] = await this.prisma.$transaction([
      this.prisma.smsMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.smsMessage.count({ where }),
      this.prisma.smsMessage.groupBy({ by: ["status"], orderBy: { status: "asc" }, _count: { _all: true } }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      counts: Object.fromEntries(counts.map((row) => [row.status, (row._count as { _all: number })._all])),
    };
  }

  /** Puts a failed or skipped message back in the queue, e.g. after the
   * missing template was configured. */
  async retry(id: string) {
    const result = await this.prisma.smsMessage.updateMany({
      where: { id, status: { in: [SmsStatus.FAILED, SmsStatus.SKIPPED] } },
      data: { status: SmsStatus.PENDING, attempts: 0, lastError: null },
    });
    return { requeued: result.count === 1 };
  }
}
