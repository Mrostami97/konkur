import { Inject, Injectable } from "@nestjs/common";
import { AccessMode, ReviewStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsoleOtpProvider, OTP_PROVIDER, OtpProvider } from "../identity/otp-provider";

/** The same filter the public admissions and report pages apply to sources. */
const ACTIVE_OFFICIAL_SOURCE = {
  sourceTier: "PRIMARY_OFFICIAL",
  sourceStatus: "ACTIVE",
  archivedAt: null,
  mayLink: true,
} as const;

/**
 * Which parts of the site have anything published yet, so the web can mark
 * the rest "coming soon" instead of showing an empty page -- and drop the
 * mark by itself the moment content is published, with nobody editing code.
 *
 * Every count uses the same filter as the public endpoint behind that page,
 * so "has content" here means "the visitor would see something there".
 * Only counts leave this endpoint; nothing about the records themselves.
 */
@Injectable()
export class SiteService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
  ) {}

  async availability() {
    const now = new Date();
    const [
      courses,
      paidCourses,
      questions,
      exams,
      freeVideos,
      resources,
      consultations,
      instructors,
      results,
      reportCards,
      programs,
    ] = await Promise.all([
      this.prisma.course.count({ where: { isPublished: true } }),
      this.prisma.course.count({ where: { isPublished: true, accessMode: AccessMode.ENTITLEMENT } }),
      this.prisma.question.count({ where: { retiredAt: null } }),
      this.prisma.exam.count({ where: { isPublished: true } }),
      this.prisma.resource.count({
        where: { kind: "VIDEO", hostingMode: "EXTERNAL_LINK", reviewStatus: ReviewStatus.PUBLISHED },
      }),
      this.prisma.resource.count({ where: { reviewStatus: ReviewStatus.PUBLISHED } }),
      this.prisma.consultationOffering.count({
        where: {
          isActive: true,
          product: { isActive: true, prices: { some: { isActive: true } } },
          instructorProfile: { isPublished: true },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
      }),
      this.prisma.contributorProfile.count({
        where: { isPublished: true, taughtCourses: { some: { course: { isPublished: true } } } },
      }),
      this.prisma.studentAchievement.count({ where: { isPublished: true } }),
      this.prisma.reportCard.count({ where: { publicConsent: true } }),
      this.prisma.program.count({
        where: { source: { is: ACTIVE_OFFICIAL_SOURCE }, university: { source: { is: ACTIVE_OFFICIAL_SOURCE } } },
      }),
    ]);

    // Codes are only logged, not sent, until an SMS gateway is connected. That
    // still works for a developer reading the log, but in production nobody
    // can read it, so there a code request would only strand the visitor.
    const smsLogin = !(this.otp instanceof ConsoleOtpProvider);
    return {
      smsLogin,
      otpLogin: smsLogin || process.env.NODE_ENV !== "production",
      courses,
      paidCourses,
      questions,
      exams,
      freeVideos,
      resources,
      consultations,
      instructors,
      results,
      reportCards,
      programs,
    };
  }
}
