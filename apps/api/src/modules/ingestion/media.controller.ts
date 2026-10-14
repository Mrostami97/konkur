import { Controller, Get, NotFoundException, Param, Req, Res, UseGuards } from "@nestjs/common";
import { AccessMode, ReviewStatus, Role, VersionedEntityType } from "@prisma/client";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { RequestWithUser } from "../identity/guards/session-auth.guard";
import { ObjectStorageService } from "./object-storage.service";
import { AccessService } from "../access/access.service";
import { isSafeMediaMime } from "./media-types";

@Controller("media")
@UseGuards(OptionalSessionAuthGuard)
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly access: AccessService,
  ) {}

  @Get(":checksum")
  async redirectToMedia(@Param("checksum") checksum: string, @Req() req: RequestWithUser, @Res() res: Response) {
    if (!/^[a-f0-9]{64}$/.test(checksum)) throw new NotFoundException("media not found");
    const fullChecksum = `sha256:${checksum}`;
    const artifact = await this.prisma.sourceArtifact.findUnique({
      where: { checksum: fullChecksum },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        size: true,
        resources: {
          select: { id: true },
          take: 1,
        },
      },
    });
    // Protect existing legacy/staged artifacts too, not just future uploads.
    if (!artifact || !isSafeMediaMime(artifact.mimeType)) throw new NotFoundException("media not found");
    const [resourceVersion, resourceAudit] = await Promise.all([
      this.prisma.contentVersion.findFirst({
        where: {
          entityType: VersionedEntityType.RESOURCE,
          payload: { path: ["source_artifact_id"], equals: artifact.id },
        },
        select: { id: true },
      }),
      this.prisma.auditLog.findFirst({
        where: {
          targetType: "Resource",
          OR: [
            { metadata: { path: ["sourceArtifactId"], equals: artifact.id } },
            { metadata: { path: ["previousSourceArtifactId"], equals: artifact.id } },
          ],
        },
        select: { id: true },
      }),
    ]);
    if (artifact.resources.length > 0 || resourceVersion || resourceAudit) {
      // Resource-linked media is only ever served through the entitlement-
      // checked /resources/:slug/content path, never by checksum directly.
      throw new NotFoundException("media not found");
    }

    // Student photos follow their own rule. A photo belongs to a real person who agreed to be
    // shown on the results wall; if their result is unpublished -- never
    // consented, or consent withdrawn -- the photo must not be reachable by
    // anyone who happens to hold the checksum, signed in or not. Only an
    // admin managing the wall can still see it. A 404 rather than a 403, so
    // the response does not confirm the photo exists.
    const achievementUses = await this.prisma.studentAchievement.findMany({
      where: { photoArtifactId: artifact.id },
      select: { isPublished: true },
    });
    // Keyed by where the upload stored it as well as by current use: a photo
    // that was replaced, or whose row was deleted, is still a person's face
    // and must not fall through to ordinary content access below.
    const isAchievementPhoto = /\/achievement\.(jpg|png|webp)$/.test(artifact.storageKey);
    if (achievementUses.length > 0 || isAchievementPhoto) {
      const isPublic = achievementUses.some((use) => use.isPublished);
      const isAdmin = req.user?.roles.includes(Role.ADMIN) && !req.user.roles.includes(Role.STUDENT);
      if (!isPublic && !isAdmin) throw new NotFoundException("media not found");
      await this.send(artifact, req, res);
      return;
    }

    // A published course's cover is public, like the card it sits on, and is
    // cached: every catalogue visitor loads it, and its address is its hash.
    // An unpublished course's cover falls through to the staff-only rule.
    // The same for a published teacher's photo (its profile keeps the address).
    const [cover, avatar] = await Promise.all([
      this.prisma.course.findFirst({ where: { coverArtifactId: artifact.id, isPublished: true }, select: { id: true } }),
      this.prisma.contributorProfile.findFirst({ where: { isPublished: true, avatarUrl: { endsWith: `/media/${checksum}` } }, select: { id: true } }),
    ]);
    if (cover || avatar) {
      await this.send(artifact, req, res, "public, max-age=86400");
      return;
    }

    // Staff may inspect unpublished uploads, but a student's session is not
    // permission to read a paid lesson, a locked bank or an orphaned file.
    const roles = req.user?.roles ?? [];
    const isContentStaff = !roles.includes(Role.STUDENT) &&
      roles.some((role) => role === Role.ADMIN || role === Role.AUTHOR || role === Role.REVIEWER);
    if (!isContentStaff && !(await this.canReadContentMedia(fullChecksum, req.user?.id))) {
      throw new NotFoundException("media not found");
    }

    await this.send(artifact, req, res);
  }

  private async canReadContentMedia(checksum: string, userId?: string): Promise<boolean> {
    const assets = { array_contains: [{ checksum }] };
    const [article, questions, lessons, ownAttempt] = await Promise.all([
      this.prisma.article.findFirst({
        where: { reviewStatus: ReviewStatus.PUBLISHED, assets }, select: { id: true },
      }),
      this.prisma.question.findMany({
        where: { retiredAt: null, assets }, select: { isSample: true, subjectCode: true },
      }),
      this.prisma.lesson.findMany({
        where: { assets, courseModule: { course: { isPublished: true } } },
        select: { isPreview: true, courseModule: { select: { course: { select: { id: true, accessMode: true } } } } },
      }),
      // Attempts legitimately expose their own form imagery, including old
      // reports whose question was since retired. Answer rows are not a grant.
      userId ? this.prisma.attempt.findFirst({
        where: { userId, examForm: { items: { some: { question: { assets } } } } },
        select: { id: true },
      }) : null,
    ]);
    if (article || ownAttempt || questions.some((question) => question.isSample)) return true;
    if (lessons.some((lesson) => lesson.isPreview || lesson.courseModule.course.accessMode === AccessMode.PUBLIC)) return true;
    if (!userId) return false;
    if (lessons.some((lesson) => lesson.courseModule.course.accessMode === AccessMode.ACCOUNT)) return true;
    const subjects = await this.access.accessibleQuestionBankSubjects(userId, questions.map((question) => question.subjectCode));
    if (subjects.size > 0) return true;
    const courseIds = [...new Set(lessons.map((lesson) => lesson.courseModule.course.id))];
    for (const courseId of courseIds) {
      if (await this.access.hasActiveCourseAccess(userId, courseId)) return true;
    }
    return false;
  }

  /**
   * Streams the file itself, answering a single byte Range with 206 so a
   * video can start at once and seek. The file used to be a redirect to a
   * signed object-storage URL, but in production storage is only reachable
   * inside the server, so that URL never worked from a browser.
   *
   * Do not cache a permission-bearing response: access, publication and
   * photo consent can change even though the file's checksum stays the same.
   * Only a file that is public by nature (a published course's cover) passes
   * a cacheable `cacheControl`.
   */
  private async send(artifact: { storageKey: string; mimeType: string; size: number }, req: RequestWithUser, res: Response, cacheControl = "private, no-store") {
    const total = artifact.size;
    res.setHeader("Content-Type", artifact.mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");

    const range = capRange(parseRange(req.headers.range, total));
    if (range === "unsatisfiable") {
      res.status(416).setHeader("Content-Range", `bytes */${total}`);
      res.end();
      return;
    }
    const stream = range
      ? await this.storage.getRangeStream(artifact.storageKey, range.start, range.end - range.start + 1)
      : await this.storage.getObjectStream(artifact.storageKey);
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${total}`);
      res.setHeader("Content-Length", String(range.end - range.start + 1));
    } else {
      res.status(200);
      res.setHeader("Content-Length", String(total));
    }
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  }
}

/**
 * The most one ranged response carries. The CDN in front of the site refuses
 * responses of about 100 MB and more (it answers 402 with its own page), and
 * a browser starting a video asks for "bytes=0-", the whole file. A shorter
 * 206 is valid HTTP: the player simply asks for the next piece.
 */
export const MAX_RANGE_BYTES = 8 * 1024 * 1024;

export function capRange<T extends { start: number; end: number } | "unsatisfiable" | null>(range: T): T {
  if (!range || range === "unsatisfiable") return range;
  return { start: range.start, end: Math.min(range.end, range.start + MAX_RANGE_BYTES - 1) } as T;
}

/**
 * One "bytes=start-end" range (or "start-", or "-suffix"), clamped to the
 * file. Several ranges at once are answered with the whole file, as HTTP
 * allows; a range that starts past the end cannot be satisfied.
 */
export function parseRange(header: string | undefined, total: number): { start: number; end: number } | "unsatisfiable" | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match || (match[1] === "" && match[2] === "")) return null;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return "unsatisfiable";
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  if (start >= total || end < start) return "unsatisfiable";
  return { start, end };
}
