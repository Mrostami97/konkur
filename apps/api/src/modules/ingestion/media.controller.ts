import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, Res, UseGuards } from "@nestjs/common";
import { AccessMode, ReviewStatus, VersionedEntityType } from "@prisma/client";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { RequestWithUser } from "../identity/guards/session-auth.guard";
import { ObjectStorageService } from "./object-storage.service";

@Controller("media")
@UseGuards(OptionalSessionAuthGuard)
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get(":checksum")
  async redirectToMedia(@Param("checksum") checksum: string, @Req() req: RequestWithUser, @Res() res: Response) {
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
    if (!artifact) throw new NotFoundException("media not found");
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

    // Student photos follow their own rule, checked before the signed-in
    // pass-through below. A photo belongs to a real person who agreed to be
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
    // and must not fall through to the signed-in pass-through below.
    const isAchievementPhoto = /\/achievement\.(jpg|png|webp)$/.test(artifact.storageKey);
    if (achievementUses.length > 0 || isAchievementPhoto) {
      const isPublic = achievementUses.some((use) => use.isPublished);
      const isAdmin = req.user?.roles.includes("ADMIN") ?? false;
      if (!isPublic && !isAdmin) throw new NotFoundException("media not found");
      await this.send(artifact, req, res);
      return;
    }

    if (!req.user) {
      // Anonymous callers may only resolve a checksum that is already
      // reachable through a genuinely public, unauthenticated API response:
      // a Question's stem/option imagery (questions have no draft state --
      // see question-bank.service.ts PUBLIC_QUESTION_SELECT) or a PUBLISHED
      // Article's imagery, or a lesson that anyone may open (a preview
      // lesson, or any lesson of a public course). Everything else (in-review/draft article assets,
      // orphaned or admin-only ingestion artifacts, etc.) requires a session,
      // since there is no per-artifact entitlement model yet to check more
      // precisely than "is this caller identified at all".
      const [publicQuestion, publicArticle, openLesson] = await Promise.all([
        this.prisma.question.findFirst({
          where: { assets: { array_contains: [{ checksum: fullChecksum }] } },
          select: { id: true },
        }),
        this.prisma.article.findFirst({
          where: {
            reviewStatus: ReviewStatus.PUBLISHED,
            assets: { array_contains: [{ checksum: fullChecksum }] },
          },
          select: { id: true },
        }),
        this.prisma.lesson.findFirst({
          where: {
            assets: { array_contains: [{ checksum: fullChecksum }] },
            courseModule: { course: { isPublished: true } },
            OR: [{ isPreview: true }, { courseModule: { course: { accessMode: AccessMode.PUBLIC } } }],
          },
          select: { id: true },
        }),
      ]);
      if (!publicQuestion && !publicArticle && !openLesson) {
        throw new ForbiddenException("media requires an authenticated session");
      }
    }

    await this.send(artifact, req, res);
  }

  /**
   * Streams the file itself, answering a single byte Range with 206 so a
   * video can start at once and seek. The file used to be a redirect to a
   * signed object-storage URL, but in production storage is only reachable
   * inside the server, so that URL never worked from a browser.
   *
   * "private": the CDN caches whole files and then answers range requests
   * with all of it, which breaks video. The checksum names the content, so
   * the browser may keep its copy for a day.
   */
  private async send(artifact: { storageKey: string; mimeType: string; size: number }, req: RequestWithUser, res: Response) {
    const total = artifact.size;
    res.setHeader("Content-Type", artifact.mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const range = parseRange(req.headers.range, total);
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
