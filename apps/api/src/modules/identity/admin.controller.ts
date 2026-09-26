import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "./guards/session-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./guards/roles.decorator";
import { CreateUserDto, SetPasswordDto, SetRolesDto } from "./dto/user-admin.dto";
import { UserAdminService } from "./user-admin.service";

/** Staff and account management. Administrators only. */
@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly users: UserAdminService) {}

  /** Without `page` this returns every user, which the entitlement form
   * relies on; with `page` it is a searchable, paged list. */
  @Get("users")
  listUsers(
    @Query("q") q?: string,
    @Query("role") role?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    if (role && !(role in Role)) throw new BadRequestException("unknown role");
    return this.users.list({
      q,
      role: role as Role | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post("users")
  createUser(@Req() req: RequestWithUser, @Body() dto: CreateUserDto) {
    return this.users.create(req.user!.id, dto);
  }

  @Put("users/:id/roles")
  setRoles(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: SetRolesDto) {
    return this.users.setRoles(req.user!.id, id, dto.roles);
  }

  @Post("users/:id/password")
  setPassword(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: SetPasswordDto) {
    return this.users.setPassword(req.user!.id, id, dto.password);
  }

  @Post("users/:id/sessions/revoke")
  revokeSessions(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.users.revokeSessions(req.user!.id, id);
  }
}
