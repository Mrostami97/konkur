import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, Res, UseGuards } from "@nestjs/common";
import { ReviewStatus, VersionedEntityType } from "@prisma/client";
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

    if (!req.user) {
      // Anonymous callers may only resolve a checksum that is already
      // reachable through a genuinely public, unauthenticated API response:
      // a Question's stem/option imagery (questions have no draft state --
      // see question-bank.service.ts PUBLIC_QUESTION_SELECT) or a PUBLISHED
      // Article's imagery. Everything else (in-review/draft article assets,
      // orphaned or admin-only ingestion artifacts, etc.) requires a session,
      // since there is no per-artifact entitlement model yet to check more
      // precisely than "is this caller identified at all".
      const [publicQuestion, publicArticle] = await Promise.all([
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
      ]);
      if (!publicQuestion && !publicArticle) {
        throw new ForbiddenException("media requires an authenticated session");
      }
    }

    const url = await this.storage.presignedGetUrl(artifact.storageKey);
    res.redirect(302, url);
  }
}
