import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { CaseStatus, LeadStage, OrderStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCaseDto } from "./dto/create-case.dto";
import { AddInteractionDto } from "./dto/add-interaction.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";

const AT_RISK_IDLE_DAYS = 14;
const ADVOCATE_TASK_THRESHOLD = 5;
const ADVOCATE_ATTEMPT_THRESHOLD = 3;

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The outbox's first real consumer (doc §5.1's Transactional Outbox
   * pattern, undelivered on since Phase 0). Polls rather than a full
   * BullMQ worker -- honest MVP-scale substitute, same "start simple"
   * posture as the rest of this codebase; see AGENTS.md.
   */
  @Interval(5000)
  async processOutbox() {
    const events = await this.prisma.outboxEvent.findMany({
      where: { eventType: "UserOnboarded", publishedAt: null },
      take: 50,
    });
    for (const event of events) {
      const payload = event.payload as { userId: string; source?: string; campaignCode?: string };
      try {
        await this.prisma.lead.upsert({
          where: { userId: payload.userId },
          update: {},
          create: { userId: payload.userId, source: payload.source, campaignCode: payload.campaignCode },
        });
        await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { publishedAt: new Date() } });
      } catch (err) {
        this.logger.error(`failed to process outbox event ${event.id}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Heuristic, computed-on-demand stage classification (doc §8.2's funnel).
   * Not a fully event-driven state machine -- see AGENTS.md Phase 7
   * simplifications for what that would take.
   */
  async recomputeStage(userId: string): Promise<LeadStage> {
    const [activeEntitlementCount, taskDoneCount, attemptCount, goal, lastActivity] = await Promise.all([
      this.prisma.entitlement.count({
        where: { userId, revokedAt: null, OR: [{ endAt: null }, { endAt: { gt: new Date() } }] },
      }),
      this.prisma.task.count({ where: { plan: { userId }, status: "DONE" } }),
      this.prisma.attempt.count({ where: { userId, status: { in: ["SUBMITTED", "EXPIRED"] } } }),
      this.prisma.goal.findUnique({ where: { userId } }),
      this.prisma.studySession.findFirst({ where: { userId }, orderBy: { loggedAt: "desc" } }),
    ]);

    const hasActivity = taskDoneCount > 0 || attemptCount > 0 || !!goal;
    // Only someone who actually logged study time before can have "gone
    // quiet" -- a lead with no StudySession row yet simply hasn't started,
    // which is not the same thing as having lapsed.
    const daysSinceLastActivity = lastActivity
      ? (Date.now() - lastActivity.loggedAt.getTime()) / (1000 * 60 * 60 * 24)
      : null;

    let stage: LeadStage;
    if (activeEntitlementCount > 0) {
      stage =
        taskDoneCount >= ADVOCATE_TASK_THRESHOLD || attemptCount >= ADVOCATE_ATTEMPT_THRESHOLD
          ? LeadStage.ADVOCATE
          : LeadStage.CUSTOMER;
    } else if (hasActivity && daysSinceLastActivity !== null && daysSinceLastActivity > AT_RISK_IDLE_DAYS) {
      stage = LeadStage.AT_RISK;
    } else if (attemptCount > 0 || goal) {
      stage = LeadStage.QUALIFIED;
    } else if (hasActivity) {
      stage = LeadStage.ACTIVATED;
    } else {
      stage = LeadStage.LEAD;
    }

    const lead = await this.prisma.lead.upsert({
      where: { userId },
      update: { stage },
      create: { userId, stage },
    });
    return lead.stage;
  }

  async listLeads(stage?: LeadStage) {
    return this.prisma.lead.findMany({
      where: stage ? { stage } : undefined,
      include: { user: { select: { phone: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getLead(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { user: { select: { phone: true } }, cases: true, interactions: { orderBy: { createdAt: "desc" } } },
    });
    if (!lead) throw new NotFoundException("lead not found");
    return lead;
  }

  async addCase(leadId: string, dto: CreateCaseDto) {
    return this.prisma.case.create({ data: { leadId, subject: dto.subject } });
  }

  async resolveCase(caseId: string) {
    return this.prisma.case.update({
      where: { id: caseId },
      data: { status: CaseStatus.RESOLVED, resolvedAt: new Date() },
    });
  }

  async addInteraction(leadId: string, dto: AddInteractionDto) {
    return this.prisma.interaction.create({ data: { leadId, type: dto.type, note: dto.note } });
  }

  // --- Telegram growth loop (doc §8.3) --------------------------------------

  async createCampaign(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({ data: dto });
  }

  async listCampaigns() {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
  }

  async recordClickAndGetTarget(code: string): Promise<string> {
    const campaign = await this.prisma.campaign.update({
      where: { code },
      data: { clicks: { increment: 1 } },
    });
    return campaign.targetUrl;
  }

  // --- Business report (doc §11 success metrics, computed from real data) ---

  async getReport() {
    const [totalUsers, leadsByStageRaw, paidOrders, activeEntitlements, totalAttempts, completedTasks, campaigns] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.lead.groupBy({ by: ["stage"], _count: { _all: true } }),
        this.prisma.order.aggregate({
          where: { status: OrderStatus.PAID },
          _count: { _all: true },
          _sum: { totalAmountRial: true },
        }),
        this.prisma.entitlement.count({
          where: { revokedAt: null, OR: [{ endAt: null }, { endAt: { gt: new Date() } }] },
        }),
        this.prisma.attempt.count({ where: { status: { in: ["SUBMITTED", "EXPIRED"] } } }),
        this.prisma.task.count({ where: { status: "DONE" } }),
        this.prisma.campaign.findMany({ orderBy: { clicks: "desc" }, take: 10 }),
      ]);

    const leadsByStage: Record<string, number> = {};
    for (const row of leadsByStageRaw) leadsByStage[row.stage] = row._count._all;

    return {
      totalUsers,
      leadsByStage,
      paidOrderCount: paidOrders._count._all,
      totalRevenueRial: paidOrders._sum.totalAmountRial ?? 0,
      activeEntitlements,
      totalAttempts,
      completedTasks,
      topCampaigns: campaigns,
    };
  }
}
