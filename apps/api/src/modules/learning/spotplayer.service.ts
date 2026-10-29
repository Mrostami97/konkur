import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { VideoLicenseRequestStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../access/access.service";
import { AuditService } from "../audit/audit.service";
import { SPOTPLAYER_BASE_URL } from "./spotplayer.client";

/** Where a student installs the player; the key itself is typed into it. */
const SPOTPLAYER_DOWNLOAD_URL = "https://spotplayer.ir/download";

/**
 * SpotPlayer licences, issued by the owner by hand (owner, 2026-10-11): a
 * student who has bought a course with video asks for it, the request shows
 * in the admin panel, and the owner makes or extends the student's licence on
 * SpotPlayer and records its key here. One key can cover all of a student's
 * courses, so the key belongs to the student and each course is a request.
 */
@Injectable()
export class SpotPlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** Whether a course has video, and where this student stands with it. */
  async videoStatus(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { spotPlayerCourseId: true, isPublished: true } });
    const hasVideo = Boolean(course?.isPublished && course.spotPlayerCourseId);
    if (!hasVideo) return { hasVideo: false, hasAccess: false, request: null, license: null };
    const hasAccess = await this.access.hasActiveCourseAccess(userId, courseId);
    if (!hasAccess) return { hasVideo, hasAccess, request: null, license: null };
    return { hasVideo, hasAccess, ...(await this.state(userId, courseId)) };
  }

  /** Records the student's request; asking again changes nothing. */
  async requestLicense(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { spotPlayerCourseId: true, isPublished: true } });
    if (!course?.isPublished) throw new NotFoundException("course not found");
    if (!course.spotPlayerCourseId) throw new NotFoundException("this course has no video licence");
    if (!(await this.access.hasActiveCourseAccess(userId, courseId))) throw new ForbiddenException("you do not have access to this course");

    const existing = await this.prisma.videoLicenseRequest.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (!existing) {
      await this.prisma.videoLicenseRequest
        .create({ data: { userId, courseId } })
        // Two tabs at once: the unique pair keeps one request.
        .catch(() => undefined);
      await this.audit.log({ actorUserId: userId, action: "video_license.requested", targetType: "Course", targetId: courseId });
    }
    return { hasVideo: true, hasAccess: true, ...(await this.state(userId, courseId)) };
  }

  private async state(userId: string, courseId: string) {
    const [request, license, legacy] = await Promise.all([
      this.prisma.videoLicenseRequest.findUnique({ where: { userId_courseId: { userId, courseId } } }),
      this.prisma.studentVideoLicense.findUnique({ where: { userId } }),
      // Licences issued through SpotPlayer's API before 2026-10-11 still count.
      this.prisma.spotPlayerLicense.findUnique({ where: { userId_courseId: { userId, courseId } } }),
    ]);
    const shown =
      request?.status === VideoLicenseRequestStatus.DONE && license
        ? { licenseKey: license.licenseKey, downloadUrl: SPOTPLAYER_DOWNLOAD_URL, issuedAt: request.handledAt ?? license.issuedAt }
        : legacy
          ? {
              licenseKey: legacy.licenseKey,
              downloadUrl: legacy.licenseUrl.startsWith("http")
                ? legacy.licenseUrl
                : `${SPOTPLAYER_BASE_URL}${legacy.licenseUrl.startsWith("/") ? "" : "/"}${legacy.licenseUrl}`,
              issuedAt: legacy.issuedAt,
            }
          : null;
    return {
      request: request ? { status: request.status, requestedAt: request.requestedAt } : null,
      license: shown,
    };
  }

  /**
   * The student's own key, for their profile. Shown whether or not they asked:
   * the owner may give a licence to anyone from the admin panel (owner, 2026-10-29).
   */
  async myLicense(userId: string) {
    const license = await this.prisma.studentVideoLicense.findUnique({ where: { userId }, select: { licenseKey: true, issuedAt: true, updatedAt: true } });
    return {
      license: license ? { licenseKey: license.licenseKey, downloadUrl: SPOTPLAYER_DOWNLOAD_URL, issuedAt: license.issuedAt, updatedAt: license.updatedAt } : null,
    };
  }

  /** Every key on record, newest first, for the admin panel. */
  async listIssued() {
    const rows = await this.prisma.studentVideoLicense.findMany({
      orderBy: { updatedAt: "desc" },
      take: 1000,
      select: {
        licenseKey: true,
        issuedAt: true,
        updatedAt: true,
        user: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
      },
    });
    return rows.map((row) => ({
      user: { id: row.user.id, phone: row.user.phone, name: row.user.profile?.displayName ?? null },
      licenseKey: row.licenseKey,
      issuedAt: row.issuedAt,
      updatedAt: row.updatedAt,
    }));
  }

  /** Requests for the admin panel, one row per student with their courses and current key. */
  async listRequests(status: VideoLicenseRequestStatus) {
    const requests = await this.prisma.videoLicenseRequest.findMany({
      where: { status },
      orderBy: { requestedAt: status === VideoLicenseRequestStatus.PENDING ? "asc" : "desc" },
      take: 500,
      select: {
        id: true,
        status: true,
        requestedAt: true,
        handledAt: true,
        course: { select: { id: true, title: true, spotPlayerCourseId: true } },
        user: { select: { id: true, phone: true, profile: { select: { displayName: true } }, videoLicense: { select: { licenseKey: true, issuedAt: true } } } },
      },
    });
    const byUser = new Map<string, { user: { id: string; phone: string; name: string | null }; licenseKey: string | null; requests: object[] }>();
    for (const row of requests) {
      const entry = byUser.get(row.user.id) ?? {
        user: { id: row.user.id, phone: row.user.phone, name: row.user.profile?.displayName ?? null },
        licenseKey: row.user.videoLicense?.licenseKey ?? null,
        requests: [],
      };
      entry.requests.push({ id: row.id, course: row.course, requestedAt: row.requestedAt, handledAt: row.handledAt });
      byUser.set(row.user.id, entry);
    }
    return [...byUser.values()];
  }

  /**
   * Records the key the owner made on SpotPlayer and closes the student's
   * pending requests: from now on each of those course pages shows the key.
   * Works for any account, asked or not; the key then shows in their profile.
   */
  async issue(actorId: string, userId: string, licenseKey: string) {
    const key = licenseKey.trim();
    if (!key) throw new BadRequestException("کد لایسنس را وارد کن.");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("user not found");
    const closed = await this.prisma.$transaction(async (tx) => {
      await tx.studentVideoLicense.upsert({
        where: { userId },
        create: { userId, licenseKey: key, issuedById: actorId },
        update: { licenseKey: key, issuedById: actorId },
      });
      const result = await tx.videoLicenseRequest.updateMany({
        where: { userId, status: VideoLicenseRequestStatus.PENDING },
        data: { status: VideoLicenseRequestStatus.DONE, handledAt: new Date(), handledById: actorId },
      });
      await this.audit.log({ actorUserId: actorId, action: "video_license.issued", targetType: "User", targetId: userId, metadata: { requests: result.count } }, tx);
      return result.count;
    });
    return { userId, licenseKey: key, closedRequests: closed };
  }
}
