import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { pageArgs, PageQueryDto } from "../../common/pagination";
import { SessionAuthGuard, RequestWithUser } from "./guards/session-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./guards/roles.decorator";
import { latinDigits } from "./phone";

class ListUsersQuery extends PageQueryDto {
  /** Part of a phone number (any spelling) or of the person's name. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;
}

class RoleDto {
  @IsIn(Object.values(Role))
  role!: Role;
}

/**
 * Users and their roles. A role is what opens a part of the admin panel
 * (see AdminShell), so granting one is the only way an owner can hand an
 * author, a reviewer or a finance operator their tools without a database
 * console -- and both directions are audited.
 */
@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("users")
  @Roles(Role.ADMIN, Role.FINANCE)
  async listUsers(@Query() query: ListUsersQuery) {
    const { page, pageSize, skip, take } = pageArgs(query, 25);
    const where: Prisma.UserWhereInput = {};
    const q = query.q ? latinDigits(query.q).trim() : "";
    if (q) {
      // 0912... and +98912... are the same person: match on the digits
      // after the leading zero / country code.
      const digits = q.replace(/\D/g, "").replace(/^(0098|98|0)/, "");
      where.OR = [
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        { profile: { displayName: { contains: q, mode: "insensitive" } } },
        { profile: { firstName: { contains: q, mode: "insensitive" } } },
        { profile: { lastName: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (query.role) where.roles = { some: { role: query.role } };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          roles: true,
          profile: { select: { displayName: true, firstName: true, lastName: true } },
          _count: { select: { orders: true, entitlements: true, attempts: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      users: users.map((u) => ({
        id: u.id,
        phone: u.phone,
        name: [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || u.profile?.displayName || null,
        roles: u.roles.map((r) => r.role),
        createdAt: u.createdAt,
        counts: u._count,
      })),
      total,
      page,
      pageSize,
    };
  }

  @Get("users/:id")
  @Roles(Role.ADMIN, Role.FINANCE)
  async getUser(@Param("id") id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
        profile: true,
        entitlements: {
          orderBy: { startAt: "desc" },
          take: 50,
          include: { product: { select: { id: true, title: true, kind: true } } },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            items: { include: { product: { select: { title: true } } } },
            payments: { select: { status: true, referenceCode: true, amountRial: true } },
          },
        },
        contributorProfile: { select: { slug: true, displayName: true } },
        _count: { select: { attempts: true, sessions: true, studySessions: true } },
      },
    });
    if (!user) throw new NotFoundException("user not found");
    const { passwordHash, ...safe } = user;
    return { ...safe, hasPassword: Boolean(passwordHash), roles: user.roles.map((r) => r.role) };
  }

  @Post("users/:id/roles")
  @Roles(Role.ADMIN)
  async grantRole(@Param("id") id: string, @Body() dto: RoleDto, @Req() req: RequestWithUser) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException("user not found");
    await this.prisma.userRole.upsert({
      where: { userId_role: { userId: id, role: dto.role } },
      update: {},
      create: { userId: id, role: dto.role },
    });
    await this.audit.log({ actorUserId: req.user!.id, action: "user.role_granted", targetType: "User", targetId: id, metadata: { role: dto.role } });
    return this.rolesOf(id);
  }

  @Delete("users/:id/roles/:role")
  @Roles(Role.ADMIN)
  async revokeRole(@Param("id") id: string, @Param("role") role: Role, @Req() req: RequestWithUser) {
    if (!Object.values(Role).includes(role)) throw new BadRequestException("unknown role");
    if (role === Role.ADMIN) {
      // Two guards on the one role that can lock everyone out: nobody
      // demotes themselves, and the last administrator stays one.
      if (id === req.user!.id) throw new BadRequestException("you cannot remove your own admin role");
      const admins = await this.prisma.userRole.count({ where: { role: Role.ADMIN } });
      if (admins <= 1) throw new BadRequestException("the last administrator cannot be removed");
    }
    const removed = await this.prisma.userRole.deleteMany({ where: { userId: id, role } });
    if (removed.count === 0) throw new NotFoundException("the user does not have this role");
    await this.audit.log({ actorUserId: req.user!.id, action: "user.role_revoked", targetType: "User", targetId: id, metadata: { role } });
    return this.rolesOf(id);
  }

  private async rolesOf(userId: string) {
    const roles = await this.prisma.userRole.findMany({ where: { userId }, select: { role: true } });
    return { userId, roles: roles.map((row) => row.role) };
  }
}
