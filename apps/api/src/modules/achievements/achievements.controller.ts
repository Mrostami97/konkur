import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { memoryStorage } from "multer";
import { RequestWithUser, SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { AchievementsService } from "./achievements.service";
import { AchievementDto } from "./dto/achievement.dto";

/** The results wall. Published, consented rows only. */
/** A query-string number, or undefined when absent or not a whole number -- so
 * `?limit=abc` falls back to the default instead of reaching Prisma as NaN. */
function wholeNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

@Controller("achievements")
export class AchievementsPublicController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  list(
    @Query("examYear") examYear?: string,
    @Query("subject") subjectSlug?: string,
    @Query("limit") limit?: string,
  ) {
    return this.achievements.listPublic({
      examYear: wholeNumber(examYear),
      subjectSlug: subjectSlug || undefined,
      limit: wholeNumber(limit),
    });
  }

  @Get("summary")
  summary() {
    return this.achievements.summary();
  }
}

@Controller("admin/achievements")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AchievementsAdminController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  list() {
    return this.achievements.listForAdmin();
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: AchievementDto) {
    return this.achievements.create(req.user!.id, dto);
  }

  @Patch(":id")
  update(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: AchievementDto) {
    return this.achievements.update(req.user!.id, id, dto);
  }

  @Post(":id/unpublish")
  unpublish(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.achievements.unpublish(req.user!.id, id);
  }

  @Delete(":id")
  remove(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.achievements.remove(req.user!.id, id);
  }

  @Post("photo")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadPhoto(@Req() req: RequestWithUser, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.achievements.uploadPhoto(req.user!.id, file);
  }
}
