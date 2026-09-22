import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultationBookingStatus, ConsultationKind, Prisma, ProductKind } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../access/access.service";
import { AuditService } from "../audit/audit.service";
import { CreateOfferingDto, UpdateOfferingDto } from "./dto/consultation-offering.dto";
import { ConfirmBookingDto, RequestBookingDto } from "./dto/consultation-booking.dto";

/**
 * A booking in any of these states has spent one session from the quota.
 * CANCELLED is the only status that returns it: a session called off before
 * it happened was never delivered, so charging the student for it would be
 * taking something they did not receive. A NO_SHOW does consume, because the
 * instructor held the time.
 */
const QUOTA_CONSUMING: ConsultationBookingStatus[] = [
  ConsultationBookingStatus.REQUESTED,
  ConsultationBookingStatus.CONFIRMED,
  ConsultationBookingStatus.COMPLETED,
  ConsultationBookingStatus.NO_SHOW,
];

/** What the two participants of a booking may see. The student's phone is in
 * here because the instructor has to be able to reach them; it is never part
 * of any listing a third party can read. */
const BOOKING_SELECT = {
  id: true,
  status: true,
  requestedSlots: true,
  studentNote: true,
  scheduledAt: true,
  durationMinutes: true,
  meetingUrl: true,
  instructorNote: true,
  completedAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  entitlementId: true,
  offering: {
    select: {
      id: true,
      headline: true,
      kind: true,
      instructorProfile: { select: { slug: true, displayName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.ConsultationBookingSelect;

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  // --- admin: what is on sale -------------------------------------------------

  /**
   * Creates the offering together with the Product and Price that sell it.
   *
   * These are one thing to an operator and it would be a trap to make them
   * create a product, then a price, then remember to link an offering to it:
   * a half-linked offering is unbuyable and looks fine in the admin list.
   */
  async createOffering(actorId: string, dto: CreateOfferingDto) {
    const instructor = await this.prisma.contributorProfile.findUnique({
      where: { id: dto.instructorProfileId },
      select: { id: true, displayName: true, slug: true },
    });
    if (!instructor) throw new NotFoundException("contributor profile not found");

    if (dto.kind === ConsultationKind.SINGLE_SESSION && dto.sessionQuota !== 1) {
      throw new BadRequestException("a single-session offering has a quota of exactly 1");
    }
    if (dto.kind === ConsultationKind.PACKAGE && dto.sessionQuota < 2) {
      throw new BadRequestException("a package offering needs a quota of at least 2");
    }

    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (validUntil && validUntil.getTime() <= Date.now()) {
      throw new BadRequestException("validUntil must be in the future");
    }

    const offering = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          slug: dto.slug,
          title: dto.headline,
          description: dto.description,
          kind: ProductKind.CONSULTATION,
          isActive: true,
          prices: { create: [{ amountRial: dto.amountRial, isActive: true }] },
        },
      });

      return tx.consultationOffering.create({
        data: {
          instructorProfileId: dto.instructorProfileId,
          productId: product.id,
          kind: dto.kind,
          sessionQuota: dto.sessionQuota,
          durationMinutes: dto.durationMinutes,
          validUntil,
          headline: dto.headline,
          description: dto.description,
        },
        include: {
          product: { include: { prices: { where: { isActive: true } } } },
          instructorProfile: { select: { slug: true, displayName: true } },
        },
      });
    });

    await this.audit.log({
      actorUserId: actorId,
      action: "consultation.offering_created",
      targetType: "ConsultationOffering",
      targetId: offering.id,
      metadata: {
        instructorProfileId: dto.instructorProfileId,
        kind: dto.kind,
        sessionQuota: dto.sessionQuota,
        amountRial: dto.amountRial,
      },
    });
    return offering;
  }

  /**
   * Edits an offering. The quota is deliberately not editable: bookings
   * already made were sold against the quota that existed then, and changing
   * it under them would silently move the line for students mid-package.
   * Retire the offering and publish a new one instead.
   */
  async updateOffering(actorId: string, id: string, dto: UpdateOfferingDto) {
    const existing = await this.prisma.consultationOffering.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });
    if (!existing) throw new NotFoundException("offering not found");

    const validUntil = dto.validUntil === undefined ? undefined : dto.validUntil ? new Date(dto.validUntil) : null;

    const offering = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.consultationOffering.update({
        where: { id },
        data: {
          headline: dto.headline,
          description: dto.description,
          durationMinutes: dto.durationMinutes,
          isActive: dto.isActive,
          validUntil,
        },
        include: { product: { include: { prices: { where: { isActive: true } } } } },
      });

      // Keep the product in step, so the catalogue never shows a title that
      // differs from the offering it sells.
      await tx.product.update({
        where: { id: existing.productId },
        data: {
          title: dto.headline,
          description: dto.description,
          // Deactivating the offering must also take the product off sale,
          // or it stays buyable through the commerce catalogue.
          isActive: dto.isActive,
        },
      });

      if (dto.amountRial !== undefined) {
        // Prices are append-only: past order items point at the price they
        // were actually charged, so a new price is added and the old one
        // deactivated rather than edited in place.
        await tx.price.updateMany({ where: { productId: existing.productId }, data: { isActive: false } });
        await tx.price.create({
          data: { productId: existing.productId, amountRial: dto.amountRial, isActive: true },
        });
      }

      return updated;
    });

    await this.audit.log({
      actorUserId: actorId,
      action: "consultation.offering_updated",
      targetType: "ConsultationOffering",
      targetId: id,
      metadata: { ...dto },
    });
    return offering;
  }

  async listOfferingsForAdmin() {
    const offerings = await this.prisma.consultationOffering.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        instructorProfile: { select: { id: true, slug: true, displayName: true, isPublished: true } },
        product: { select: { id: true, slug: true, isActive: true, prices: { where: { isActive: true } } } },
        _count: { select: { bookings: true } },
      },
    });
    return offerings.map((offering) => ({
      ...offering,
      amountRial: offering.product.prices[0]?.amountRial ?? null,
    }));
  }

  // --- public catalogue -------------------------------------------------------

  /** Active offerings from published instructors. Never lists an offering
   * whose product or price is inactive: it would not be buyable. */
  async listPublicOfferings(instructorSlug?: string) {
    const offerings = await this.prisma.consultationOffering.findMany({
      where: {
        isActive: true,
        product: { isActive: true, prices: { some: { isActive: true } } },
        instructorProfile: { isPublished: true, ...(instructorSlug ? { slug: instructorSlug } : {}) },
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        sessionQuota: true,
        durationMinutes: true,
        validUntil: true,
        headline: true,
        description: true,
        instructorProfile: {
          select: { slug: true, displayName: true, roleTitle: true, avatarUrl: true },
        },
        product: { select: { id: true, slug: true, prices: { where: { isActive: true }, take: 1 } } },
      },
    });

    return offerings.map(({ product, ...offering }) => ({
      ...offering,
      productId: product.id,
      productSlug: product.slug,
      amountRial: product.prices[0]?.amountRial ?? null,
    }));
  }

  // --- the student's side -----------------------------------------------------

  /**
   * What the student has bought and how much of it is left.
   *
   * Quota is reported per entitlement rather than per offering, because that
   * is how it is spent: two purchases of the same package are two separate
   * balances with their own expiry dates.
   */
  async listMyAccess(userId: string) {
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        userId,
        revokedAt: null,
        product: { kind: ProductKind.CONSULTATION, consultationOffering: { isNot: null } },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        product: {
          select: {
            consultationOffering: {
              select: {
                id: true,
                headline: true,
                kind: true,
                sessionQuota: true,
                durationMinutes: true,
                instructorProfile: { select: { slug: true, displayName: true, avatarUrl: true } },
              },
            },
          },
        },
        _count: { select: { consultationBookings: { where: { status: { in: QUOTA_CONSUMING } } } } },
      },
    });

    const now = new Date();
    return entitlements
      .filter((row) => row.product.consultationOffering !== null)
      .map((row) => {
        const offering = row.product.consultationOffering!;
        const used = row._count.consultationBookings;
        const expired = row.endAt !== null && row.endAt <= now;
        return {
          entitlementId: row.id,
          offering,
          startAt: row.startAt,
          endAt: row.endAt,
          sessionsUsed: used,
          sessionsRemaining: Math.max(0, offering.sessionQuota - used),
          isExpired: expired,
          isBookable: !expired && used < offering.sessionQuota,
        };
      });
  }

  /**
   * Books a session against something the student already paid for.
   *
   * Every check is here on the server. The quota read and the insert run in
   * one transaction so two requests sent at once cannot both see the last
   * remaining session and both take it.
   */
  async requestBooking(userId: string, dto: RequestBookingDto) {
    const offering = await this.prisma.consultationOffering.findUnique({
      where: { id: dto.offeringId },
      select: {
        id: true,
        productId: true,
        instructorProfileId: true,
        sessionQuota: true,
        durationMinutes: true,
        isActive: true,
        headline: true,
      },
    });
    if (!offering) throw new NotFoundException("offering not found");
    if (!offering.isActive) throw new BadRequestException("this consultation is no longer offered");

    const slots = dto.requestedSlots.map((slot) => {
      const date = new Date(slot);
      if (Number.isNaN(date.getTime())) throw new BadRequestException("requestedSlots must be valid dates");
      if (date.getTime() <= Date.now()) throw new BadRequestException("requested times must be in the future");
      return date.toISOString();
    });

    const entitlements = await this.access.activeEntitlementsForProduct(userId, offering.productId);
    if (entitlements.length === 0) {
      throw new ForbiddenException("you do not have an active entitlement for this consultation");
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      // Oldest entitlement with quota left, so the balance that expires
      // soonest is spent first.
      for (const entitlement of entitlements) {
        const used = await tx.consultationBooking.count({
          where: { entitlementId: entitlement.id, status: { in: QUOTA_CONSUMING } },
        });
        if (used >= offering.sessionQuota) continue;

        return tx.consultationBooking.create({
          data: {
            offeringId: offering.id,
            entitlementId: entitlement.id,
            studentUserId: userId,
            instructorProfileId: offering.instructorProfileId,
            durationMinutes: offering.durationMinutes,
            requestedSlots: slots,
            studentNote: dto.studentNote,
          },
          select: BOOKING_SELECT,
        });
      }
      throw new BadRequestException("no sessions left on this consultation");
    });

    await this.audit.log({
      actorUserId: userId,
      action: "consultation.booking_requested",
      targetType: "ConsultationBooking",
      targetId: booking.id,
      metadata: { offeringId: offering.id, slots },
    });
    return booking;
  }

  async listMyBookings(userId: string) {
    return this.prisma.consultationBooking.findMany({
      where: { studentUserId: userId },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      select: BOOKING_SELECT,
    });
  }

  /** Either participant can call a session off. The session returns to the
   * quota, and who cancelled is recorded. */
  async cancelBooking(actorUserId: string, bookingId: string, reason: string) {
    const booking = await this.loadParticipantBooking(actorUserId, bookingId);
    if (booking.status === ConsultationBookingStatus.COMPLETED) {
      throw new BadRequestException("a completed session cannot be cancelled");
    }
    if (booking.status === ConsultationBookingStatus.CANCELLED) {
      throw new BadRequestException("this session is already cancelled");
    }

    const updated = await this.prisma.consultationBooking.update({
      where: { id: bookingId },
      data: {
        status: ConsultationBookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
      select: BOOKING_SELECT,
    });

    await this.audit.log({
      actorUserId,
      action: "consultation.booking_cancelled",
      targetType: "ConsultationBooking",
      targetId: bookingId,
      metadata: { reason, cancelledBy: booking.viewerRole },
    });
    return updated;
  }

  // --- the instructor's side --------------------------------------------------

  /** The instructor's queue. Carries the student's phone, which the listing
   * exists to make actionable, and nothing about other instructors' work. */
  async listQueue(userId: string, status?: ConsultationBookingStatus) {
    const profile = await this.requireInstructorProfile(userId);
    return this.prisma.consultationBooking.findMany({
      where: { instructorProfileId: profile.id, ...(status ? { status } : {}) },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: {
        ...BOOKING_SELECT,
        student: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
      },
    });
  }

  /**
   * Fixes the time. The instructor may confirm one of the times the student
   * proposed or any other time -- there is no availability calendar, so the
   * student's list is a suggestion, not a constraint. A time that does not
   * suit is then cancelled by the student and the session returns to quota.
   */
  async confirmBooking(userId: string, bookingId: string, dto: ConfirmBookingDto) {
    const profile = await this.requireInstructorProfile(userId);
    const booking = await this.prisma.consultationBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, instructorProfileId: true, status: true },
    });
    if (!booking || booking.instructorProfileId !== profile.id) {
      throw new NotFoundException("booking not found");
    }
    if (booking.status !== ConsultationBookingStatus.REQUESTED && booking.status !== ConsultationBookingStatus.CONFIRMED) {
      throw new BadRequestException("only a requested or confirmed session can be scheduled");
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException("scheduledAt must be a valid date");

    const updated = await this.prisma.consultationBooking.update({
      where: { id: bookingId },
      data: {
        status: ConsultationBookingStatus.CONFIRMED,
        scheduledAt,
        meetingUrl: dto.meetingUrl,
        instructorNote: dto.instructorNote,
      },
      select: BOOKING_SELECT,
    });

    await this.audit.log({
      actorUserId: userId,
      action: "consultation.booking_confirmed",
      targetType: "ConsultationBooking",
      targetId: bookingId,
      metadata: { scheduledAt: scheduledAt.toISOString() },
    });
    return updated;
  }

  /** Closes a session out. NO_SHOW keeps the quota spent; the instructor held
   * the time either way. */
  async closeBooking(
    userId: string,
    bookingId: string,
    outcome: "COMPLETED" | "NO_SHOW",
    instructorNote?: string,
  ) {
    const profile = await this.requireInstructorProfile(userId);
    const booking = await this.prisma.consultationBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, instructorProfileId: true, status: true },
    });
    if (!booking || booking.instructorProfileId !== profile.id) {
      throw new NotFoundException("booking not found");
    }
    if (booking.status !== ConsultationBookingStatus.CONFIRMED) {
      throw new BadRequestException("only a confirmed session can be closed");
    }

    const updated = await this.prisma.consultationBooking.update({
      where: { id: bookingId },
      data: {
        status: ConsultationBookingStatus[outcome],
        completedAt: outcome === "COMPLETED" ? new Date() : null,
        instructorNote: instructorNote ?? undefined,
      },
      select: BOOKING_SELECT,
    });

    await this.audit.log({
      actorUserId: userId,
      action: `consultation.booking_${outcome.toLowerCase()}`,
      targetType: "ConsultationBooking",
      targetId: bookingId,
    });
    return updated;
  }

  // --- shared -----------------------------------------------------------------

  private async requireInstructorProfile(userId: string) {
    const profile = await this.prisma.contributorProfile.findUnique({
      where: { userId },
      select: { id: true, slug: true, displayName: true },
    });
    if (!profile) throw new ForbiddenException("this account is not linked to an instructor profile");
    return profile;
  }

  /** Loads a booking only for one of its two participants, and says which one
   * the caller is. Anyone else gets a 404 rather than a 403, so the endpoint
   * does not confirm that a booking id exists. */
  private async loadParticipantBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.consultationBooking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        studentUserId: true,
        instructorProfile: { select: { userId: true } },
      },
    });
    if (!booking) throw new NotFoundException("booking not found");

    if (booking.studentUserId === userId) return { ...booking, viewerRole: "STUDENT" as const };
    if (booking.instructorProfile.userId === userId) return { ...booking, viewerRole: "INSTRUCTOR" as const };
    throw new NotFoundException("booking not found");
  }
}
