import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { Response } from "express";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { RequestWithUser, SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { RolesGuard } from "../identity/guards/roles.guard";
import {
  CreateContentSourceDto,
  CreateContributorDto,
  CreateResourceDto,
  PublicResourcesQueryDto,
  RejectEditorialDto,
  UpdateContentSourceDto,
  UpdateContributorDto,
  UpdateResourceDto,
} from "./dto/editorial.dto";
import { EditorialService } from "./editorial.service";

@Controller("resources")
@UseGuards(OptionalSessionAuthGuard)
export class ResourcesPublicController {
  constructor(private readonly editorial: EditorialService) {}

  @Get()
  list(@Req() request: RequestWithUser, @Query() query: PublicResourcesQueryDto) {
    return this.editorial.listPublishedResources(request.user?.id, query);
  }

  @Get(":slug")
  get(@Param("slug") slug: string, @Req() request: RequestWithUser) {
    return this.editorial.getPublishedResource(slug, request.user?.id);
  }

  @Get(":slug/content")
  async content(
    @Param("slug") slug: string,
    @Req() request: RequestWithUser,
    @Res() response: Response,
  ) {
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const result = await this.editorial.getResourceContent(slug, request.user?.id);
    if (result.type === "json") return response.json(result.value);
    response.setHeader("Content-Type", result.mimeType);
    response.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
    result.stream.on("error", (error) => response.destroy(error));
    result.stream.pipe(response);
  }
}

@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
export class EditorialAdminController {
  constructor(private readonly editorial: EditorialService) {}

  @Get("content-sources")
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  sources() {
    return this.editorial.listSources();
  }

  @Post("content-sources")
  @Roles(Role.ADMIN)
  createSource(@Req() request: RequestWithUser, @Body() dto: CreateContentSourceDto) {
    return this.editorial.createSource(request.user!.id, dto);
  }

  @Patch("content-sources/:id")
  @Roles(Role.ADMIN)
  updateSource(@Param("id") id: string, @Req() request: RequestWithUser, @Body() dto: UpdateContentSourceDto) {
    return this.editorial.updateSource(id, request.user!.id, dto);
  }

  @Post("content-sources/:id/archive")
  @Roles(Role.ADMIN)
  archiveSource(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.editorial.archiveSource(id, request.user!.id);
  }

  @Get("contributors")
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  contributors() {
    return this.editorial.listContributors();
  }

  @Post("contributors")
  @Roles(Role.ADMIN)
  createContributor(@Req() request: RequestWithUser, @Body() dto: CreateContributorDto) {
    return this.editorial.createContributor(request.user!.id, dto);
  }

  @Patch("contributors/:id")
  @Roles(Role.ADMIN)
  updateContributor(@Param("id") id: string, @Req() request: RequestWithUser, @Body() dto: UpdateContributorDto) {
    return this.editorial.updateContributor(id, request.user!.id, dto);
  }

  @Get("resources")
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  resources() {
    return this.editorial.listResourcesAdmin();
  }

  @Get("resources/:id")
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  resource(@Param("id") id: string) {
    return this.editorial.getResourceAdmin(id);
  }

  @Post("resources")
  @Roles(Role.AUTHOR, Role.ADMIN)
  createResource(@Req() request: RequestWithUser, @Body() dto: CreateResourceDto) {
    return this.editorial.createResource(request.user!.id, dto);
  }

  @Patch("resources/:id")
  @Roles(Role.AUTHOR, Role.ADMIN)
  updateResource(@Param("id") id: string, @Req() request: RequestWithUser, @Body() dto: UpdateResourceDto) {
    return this.editorial.updateResource(id, request.user!.id, dto);
  }

  @Post("resources/:id/revise")
  @Roles(Role.AUTHOR, Role.ADMIN)
  reviseResource(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.editorial.reviseResource(id, request.user!.id);
  }

  @Post("resources/:id/submit")
  @Roles(Role.AUTHOR, Role.ADMIN)
  submitResource(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.editorial.submitResource(id, request.user!.id);
  }

  @Post("resources/:id/approve")
  @Roles(Role.REVIEWER, Role.ADMIN)
  approveResource(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.editorial.approveResource(id, request.user!.id);
  }

  @Post("resources/:id/reject")
  @Roles(Role.REVIEWER, Role.ADMIN)
  rejectResource(@Param("id") id: string, @Req() request: RequestWithUser, @Body() dto: RejectEditorialDto) {
    return this.editorial.rejectResource(id, request.user!.id, dto.reason);
  }
}
