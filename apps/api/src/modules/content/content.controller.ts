import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { ContentService } from "./content.service";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";

@Controller("articles")
export class ArticlesPublicController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list() {
    return this.content.listPublished();
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.content.getPublishedBySlug(slug);
  }
}

@Controller("admin/articles")
@UseGuards(SessionAuthGuard, RolesGuard)
export class ArticlesAdminController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  listAll() {
    return this.content.listAll();
  }

  @Get(":id")
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  getById(@Param("id") id: string) {
    return this.content.getById(id);
  }

  @Post()
  @Roles(Role.AUTHOR, Role.ADMIN)
  create(@Req() req: RequestWithUser, @Body() dto: CreateArticleDto) {
    return this.content.create(req.user!.id, dto);
  }

  @Patch(":id")
  @Roles(Role.AUTHOR, Role.ADMIN)
  update(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: UpdateArticleDto) {
    return this.content.update(id, req.user!.id, dto);
  }

  @Post(":id/revise")
  @Roles(Role.AUTHOR, Role.ADMIN)
  revise(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.content.revise(id, req.user!.id);
  }

  @Patch(":id/versions/:version")
  @Roles(Role.AUTHOR, Role.ADMIN)
  updateRevision(
    @Param("id") id: string,
    @Param("version", ParseIntPipe) version: number,
    @Req() req: RequestWithUser,
    @Body() payload: unknown,
  ) {
    return this.content.updateRevision(id, version, req.user!.id, payload);
  }

  @Get(":id/preview")
  @Header("Cache-Control", "no-store")
  @Header("X-Robots-Tag", "noindex, nofollow")
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  preview(@Param("id") id: string) {
    return this.content.preview(id);
  }

  @Post(":id/submit")
  @Roles(Role.AUTHOR, Role.ADMIN)
  submit(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.content.submitForReview(id, req.user!.id);
  }

  @Post(":id/versions/:version/submit")
  @Roles(Role.AUTHOR, Role.ADMIN)
  submitVersion(@Param("id") id: string, @Param("version", ParseIntPipe) version: number, @Req() req: RequestWithUser) {
    return this.content.submitForReview(id, req.user!.id, version);
  }

  @Post(":id/approve")
  @Roles(Role.REVIEWER, Role.ADMIN)
  approve(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.content.approve(id, req.user!.id);
  }

  @Post(":id/versions/:version/approve")
  @Roles(Role.REVIEWER, Role.ADMIN)
  approveVersion(@Param("id") id: string, @Param("version", ParseIntPipe) version: number, @Req() req: RequestWithUser) {
    return this.content.approve(id, req.user!.id, version);
  }

  @Post(":id/reject")
  @Roles(Role.REVIEWER, Role.ADMIN)
  reject(@Param("id") id: string, @Req() req: RequestWithUser, @Body("reason") reason?: string) {
    return this.content.reject(id, req.user!.id, reason);
  }

  @Post(":id/versions/:version/reject")
  @Roles(Role.REVIEWER, Role.ADMIN)
  rejectVersion(
    @Param("id") id: string,
    @Param("version", ParseIntPipe) version: number,
    @Req() req: RequestWithUser,
    @Body("reason") reason?: string,
  ) {
    return this.content.reject(id, req.user!.id, reason, version);
  }
}
