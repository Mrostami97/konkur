import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
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
    });
    if (!artifact) throw new NotFoundException("media not found");
    const url = await this.storage.presignedGetUrl(artifact.storageKey);
    res.redirect(302, url);
  }
}
