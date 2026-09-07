import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { VersionedEntityType } from "@prisma/client";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { ObjectStorageService } from "./object-storage.service";

@Controller("media")
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get(":checksum")
  async redirectToMedia(@Param("checksum") checksum: string, @Res() res: Response) {
    const artifact = await this.prisma.sourceArtifact.findUnique({
      where: { checksum: `sha256:${checksum}` },
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
      throw new NotFoundException("media not found");
    }
    const url = await this.storage.presignedGetUrl(artifact.storageKey);
    res.redirect(302, url);
  }
}
