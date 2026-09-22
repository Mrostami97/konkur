import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../access/access.service";
import { AuditService } from "../audit/audit.service";
import {
  SPOTPLAYER_BASE_URL,
  SPOTPLAYER_CLIENT,
  type SpotPlayerClient,
} from "./spotplayer.client";

@Injectable()
export class SpotPlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(SPOTPLAYER_CLIENT) private readonly client: SpotPlayerClient,
  ) {}

  /**
   * Returns this student's licence for a course, issuing it on first ask.
   *
   * Issuance is lazy rather than done at purchase on purpose. Calling an
   * external service inside the transaction that grants access would mean an
   * outage at SpotPlayer could fail a payment the money had already arrived
   * for; and a licence issued for a course the student never opens is a seat
   * spent for nothing. Asking for it is also a natural retry.
   */
  async getOrIssueLicense(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, spotPlayerCourseId: true, isPublished: true },
    });
    if (!course || !course.isPublished) throw new NotFoundException("course not found");
    if (!course.spotPlayerCourseId) {
      throw new NotFoundException("this course has no video licence");
    }

    // Checked every time, not only at issuance: a licence already handed out
    // is not a reason to keep handing it to someone whose access was revoked.
    const allowed = await this.access.hasActiveCourseAccess(userId, courseId);
    if (!allowed) throw new ForbiddenException("you do not have access to this course");

    const existing = await this.prisma.spotPlayerLicense.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return this.project(existing);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true, profile: { select: { displayName: true } } },
    });

    const issued = await this.client.createLicense({
      courseIds: [course.spotPlayerCourseId],
      name: user.profile?.displayName?.trim() || user.phone,
      // The phone is the watermark because it is the one identifier every
      // account has and the one a leaked recording can be traced back by.
      watermark: user.phone,
    });

    // `create` rather than `upsert`: if two tabs raced, the unique pair makes
    // the loser fail here, and re-reading gives it the winner's licence
    // instead of spending a second seat.
    let stored;
    try {
      stored = await this.prisma.spotPlayerLicense.create({
        data: {
          userId,
          courseId,
          spotPlayerLicenseId: issued.licenseId,
          licenseKey: issued.key,
          licenseUrl: issued.url,
        },
      });
    } catch {
      const winner = await this.prisma.spotPlayerLicense.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!winner) throw new NotFoundException("licence could not be stored");
      return this.project(winner);
    }

    await this.audit.log({
      actorUserId: userId,
      action: "spotplayer.license_issued",
      targetType: "Course",
      targetId: courseId,
      metadata: { spotPlayerLicenseId: issued.licenseId },
    });
    return this.project(stored);
  }

  /** Whether a course has video at all, and whether the integration is even
   * switched on -- so the UI can say "not configured" instead of failing. */
  async videoStatus(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { spotPlayerCourseId: true },
    });
    return {
      hasVideo: Boolean(course?.spotPlayerCourseId),
      integrationConfigured: this.client.configured,
    };
  }

  private project(license: {
    licenseKey: string;
    licenseUrl: string;
    spotPlayerLicenseId: string;
    issuedAt: Date;
  }) {
    return {
      licenseKey: license.licenseKey,
      // SpotPlayer hands back a relative path; the student needs a link they
      // can actually open.
      downloadUrl: license.licenseUrl.startsWith("http")
        ? license.licenseUrl
        : `${SPOTPLAYER_BASE_URL}${license.licenseUrl.startsWith("/") ? "" : "/"}${license.licenseUrl}`,
      spotPlayerLicenseId: license.spotPlayerLicenseId,
      issuedAt: license.issuedAt,
    };
  }
}
