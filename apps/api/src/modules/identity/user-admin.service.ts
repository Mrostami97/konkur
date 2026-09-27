import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateUserDto } from "./dto/user-admin.dto";
import { roleSetProblem } from "./account-roles";
import { hashPassword } from "./password-hasher";

const MAX_PAGE_SIZE = 100;

/** The ten digits after the leading 9 identify a mobile number, whichever
 * prefix it was typed with. */
function mobileTail(phone: string): string | null {
  const match = /9[0-9]{9}$/.exec(phone.replace(/[^0-9]/g, ""));
  return match ? match[0] : null;
}

/** Every way the same mobile number may already be stored. */
function phoneVariants(phone: string): string[] {
  const tail = mobileTail(phone);
  return tail ? [`0${tail}`, `+98${tail}`, `98${tail}`, `0098${tail}`, tail] : [phone];
}

const USER_SELECT = {
  id: true,
  phone: true,
  createdAt: true,
  passwordHash: true,
  roles: { select: { role: true } },
  profile: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

function toView(user: UserRow) {
  const name = [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || user.profile?.displayName || null;
  return {
    id: user.id,
    phone: user.phone,
    name,
    roles: user.roles.map((row) => row.role),
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
  };
}

/**
 * Staff management: find people, give or take roles, and set a password so
 * someone can sign in while SMS delivery is not connected. Every change is
 * audited, and the last administrator can never lock everyone out.
 */
@Injectable()
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(params: { q?: string; role?: Role; page?: number; pageSize?: number }) {
    const q = params.q?.trim();
    const tail = q ? mobileTail(q) : null;
    const where: Prisma.UserWhereInput = {
      ...(params.role ? { roles: { some: { role: params.role } } } : {}),
      ...(q
        ? {
            OR: [
              { phone: { contains: tail ?? (q.replace(/[^0-9+]/g, "") || q) } },
              { profile: { firstName: { contains: q, mode: "insensitive" } } },
              { profile: { lastName: { contains: q, mode: "insensitive" } } },
              { profile: { displayName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const paged = params.page !== undefined;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? 20));
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: paged ? "desc" : "asc" },
        ...(paged ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users: rows.map(toView), total, page, pageSize };
  }

  async create(actorId: string, dto: CreateUserDto) {
    const tail = mobileTail(dto.phone);
    if (!tail) throw new BadRequestException("شمارهٔ موبایل معتبر نیست.");
    const existing = await this.prisma.user.findFirst({ where: { phone: { in: phoneVariants(dto.phone) } } });
    if (existing) throw new ConflictException("کاربری با این شماره از قبل وجود دارد.");

    const roles = dto.roles.length > 0 ? [...new Set(dto.roles)] : [Role.STUDENT];
    const problem = roleSetProblem(roles);
    if (problem) throw new BadRequestException(problem);
    const firstName = dto.firstName?.trim() || null;
    const lastName = dto.lastName?.trim() || null;
    const user = await this.prisma.user.create({
      data: {
        phone: `0${tail}`,
        roles: { create: roles.map((role) => ({ role })) },
        ...(firstName || lastName ? { profile: { create: { firstName, lastName } } } : {}),
      },
      select: USER_SELECT,
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "user.created_by_admin",
      targetType: "User",
      targetId: user.id,
      metadata: { roles },
    });
    return toView(user);
  }

  async setRoles(actorId: string, userId: string, roles: Role[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundException("user not found");
    const before = user.roles.map((row) => row.role);
    roles = [...new Set(roles)];
    const problem = roleSetProblem(roles);
    if (problem) throw new BadRequestException(problem);
    if (roles.includes(Role.STUDENT)) {
      const instructor = await this.prisma.contributorProfile.findUnique({ where: { userId }, select: { displayName: true } });
      if (instructor) {
        throw new BadRequestException(`این حساب به پروفایل مدرس «${instructor.displayName}» وصل است و دانشجو نمی‌شود.`);
      }
    }
    const wasAdmin = before.includes(Role.ADMIN);
    const staysAdmin = roles.includes(Role.ADMIN);

    if (wasAdmin && !staysAdmin) {
      if (userId === actorId) throw new BadRequestException("نقش مدیر را از حساب خودتان نمی‌توانید بردارید.");
      const admins = await this.prisma.userRole.count({ where: { role: Role.ADMIN } });
      if (admins <= 1) throw new BadRequestException("این تنها مدیر سامانه است؛ اول نقش مدیر را به کس دیگری بدهید.");
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId, role: { notIn: roles } } }),
      ...roles
        .filter((role) => !before.includes(role))
        .map((role) => this.prisma.userRole.create({ data: { userId, role } })),
    ]);
    await this.audit.log({
      actorUserId: actorId,
      action: "user.roles_changed",
      targetType: "User",
      targetId: userId,
      metadata: { before, after: roles },
    });
    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
    return toView(updated);
  }

  /** Setting someone else's password also signs them out everywhere, so an
   * old session cannot outlive the credential change. An admin setting their
   * own password keeps the session they are using. */
  async setPassword(actorId: string, userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("user not found");
    const passwordHash = await hashPassword(password);
    const sessionsRevoked = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      if (userId === actorId) return 0;
      const revoked = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return revoked.count;
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "user.password_set_by_admin",
      targetType: "User",
      targetId: userId,
      metadata: { sessionsRevoked },
    });
    return { passwordSet: true, sessionsRevoked };
  }

  async revokeSessions(actorId: string, userId: string) {
    if (userId === actorId) throw new BadRequestException("برای بستن نشست خودتان از «خروج» استفاده کنید.");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("user not found");
    const revoked = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "user.sessions_revoked",
      targetType: "User",
      targetId: userId,
      metadata: { count: revoked.count },
    });
    return { sessionsRevoked: revoked.count };
  }
}
