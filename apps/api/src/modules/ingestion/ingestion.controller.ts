import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Role, VersionedEntityType } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { IngestionService } from "./ingestion.service";
import { ReviewItemsDto } from "./dto/review-items.dto";
import { RollbackDto } from "./dto/rollback.dto";

@Controller("admin/import")
@UseGuards(SessionAuthGuard, RolesGuard)
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post()
  @Roles(Role.REVIEWER, Role.ADMIN)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  async receive(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: RequestWithUser) {
    if (!file) throw new BadRequestException("multipart field 'file' (a .zip) is required");
    return this.ingestion.receiveImport(file.buffer, req.user!.id);
  }

  @Get()
  @Roles(Role.REVIEWER, Role.ADMIN)
  listJobs() {
    return this.ingestion.listJobs();
  }

  @Get(":jobId")
  @Roles(Role.REVIEWER, Role.ADMIN)
  getJob(@Param("jobId") jobId: string) {
    return this.ingestion.getJob(jobId);
  }

  @Get(":jobId/items")
  @Roles(Role.REVIEWER, Role.ADMIN)
  listItems(@Param("jobId") jobId: string) {
    return this.ingestion.listItems(jobId);
  }

  @Post("items/review")
  @Roles(Role.REVIEWER, Role.ADMIN)
  review(@Req() req: RequestWithUser, @Body() dto: ReviewItemsDto) {
    return this.ingestion.reviewItems(dto.itemIds, req.user!.id, dto.decision, dto.note);
  }

  @Post(":jobId/publish")
  @Roles(Role.REVIEWER, Role.ADMIN)
  publish(@Param("jobId") jobId: string, @Req() req: RequestWithUser) {
    return this.ingestion.publishApprovedInJob(jobId, req.user!.id);
  }
}

@Controller("admin/content")
@UseGuards(SessionAuthGuard, RolesGuard)
export class ContentRollbackController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post("rollback")
  @Roles(Role.ADMIN)
  rollback(@Req() req: RequestWithUser, @Body() dto: RollbackDto) {
    return this.ingestion.rollbackEntity(
      dto.entityType as VersionedEntityType,
      dto.entityId,
      dto.toVersion,
      req.user!.id,
    );
  }
}
