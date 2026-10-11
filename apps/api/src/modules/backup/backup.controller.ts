import { Controller, Get, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Role } from "@prisma/client";
import { SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import type { RequestWithUser } from "../identity/guards/session-auth.guard";
import { BackupService } from "./backup.service";

@Controller("admin/backup")
@UseGuards(SessionAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  /** The whole site -- database and stored files -- as one tar download. ADMIN only. */
  @Get()
  @Roles(Role.ADMIN)
  async download(@Req() request: RequestWithUser, @Res() response: Response) {
    const prepared = await this.backup.prepare(request.user!.id);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    response.setHeader("Content-Type", "application/x-tar");
    response.setHeader("Content-Disposition", `attachment; filename="kunkurcomputer-backup-${stamp}.tar"`);
    response.setHeader("Cache-Control", "private, no-store");
    // Stream through nginx instead of letting it spool the archive to disk.
    response.setHeader("X-Accel-Buffering", "no");
    response.setHeader("X-Content-Type-Options", "nosniff");
    await this.backup.write(response, prepared).catch((error: Error) => response.destroy(error));
  }
}
