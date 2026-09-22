import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { RequestWithUser, SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { Req } from "@nestjs/common";
import { InstructorsService } from "./instructors.service";
import { AttachInstructorDto } from "./dto/attach-instructor.dto";

/** Public instructor index. There is no public detail route on purpose -- a
 * person's canonical public page is /authors/[slug], which now lists their
 * courses. */
@Controller("instructors")
export class InstructorsPublicController {
  constructor(private readonly instructors: InstructorsService) {}

  @Get()
  list() {
    return this.instructors.listPublic();
  }
}

/**
 * An instructor's own view of their work.
 *
 * Guarded by session only, not by role: the scope comes from the account being
 * linked to a contributor profile, which the service requires. Holding the
 * MENTOR role without a linked profile gets nothing, and a linked profile only
 * ever sees its own figures.
 */
@Controller("me/instructor")
@UseGuards(SessionAuthGuard)
export class InstructorSelfController {
  constructor(private readonly instructors: InstructorsService) {}

  @Get()
  profile(@Req() req: RequestWithUser) {
    return this.instructors.getOwnProfile(req.user!.id);
  }

  @Get("sales")
  sales(@Req() req: RequestWithUser) {
    return this.instructors.getOwnSales(req.user!.id);
  }
}

@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
export class InstructorsAdminController {
  constructor(private readonly instructors: InstructorsService) {}

  @Get("instructors")
  @Roles(Role.ADMIN, Role.FINANCE)
  list() {
    return this.instructors.listInstructors();
  }

  /** Finance can read an instructor's figures without signing in as them. */
  @Get("instructors/:profileId/sales")
  @Roles(Role.ADMIN, Role.FINANCE)
  sales(@Param("profileId") profileId: string) {
    return this.instructors.getSalesForProfile(profileId);
  }

  @Post("courses/:courseId/instructors")
  @Roles(Role.ADMIN)
  attach(@Param("courseId") courseId: string, @Req() req: RequestWithUser, @Body() dto: AttachInstructorDto) {
    return this.instructors.attachToCourse(
      req.user!.id,
      courseId,
      dto.contributorProfileId,
      dto.revenueShareBp,
      dto.sortOrder ?? 0,
    );
  }

  @Delete("courses/:courseId/instructors/:profileId")
  @Roles(Role.ADMIN)
  detach(
    @Param("courseId") courseId: string,
    @Param("profileId") profileId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.instructors.detachFromCourse(req.user!.id, courseId, profileId);
  }
}
