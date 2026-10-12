import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma, Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateUserDto } from "./dto/user-admin.dto";
import { roleSetProblem } from "./account-roles";
import { hashPassword } from "./password-hasher";
import { mobileTail, phoneVariants } from "./phone";
import { createHash } from "crypto";

const MAX_PAGE_SIZE = 100;

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
    if (roles.includes(Role.STUDENT) && !roles.includes(Role.ADMIN)) {
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

  /** The phone number is the sign-in name, so changing it changes how the
   * person signs in; their open sessions stay as they are. */
  async changePhone(actorId: string, userId: string, phone: string) {
    const tail = mobileTail(phone);
    if (!tail) throw new BadRequestException("شمارهٔ موبایل معتبر نیست.");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, phone: true } });
    if (!user) throw new NotFoundException("user not found");
    const taken = await this.prisma.user.findFirst({
      where: { phone: { in: phoneVariants(phone) }, id: { not: userId } },
      select: { id: true },
    });
    if (taken) throw new ConflictException("کاربر دیگری با این شماره هست.");
    if (mobileTail(user.phone) === tail && user.phone === `0${tail}`) {
      return toView(await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT }));
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { phone: `0${tail}` }, select: USER_SELECT });
    await this.audit.log({
      actorUserId: actorId,
      action: "user.phone_changed",
      targetType: "User",
      targetId: userId,
      metadata: { before: user.phone, after: updated.phone },
    });
    return toView(updated);
  }

  /**
   * Deletes an account and everything that hangs off it (sessions, attempts,
   * study history, unpaid orders, access grants). An account with a paid order
   * or a consultation booking is kept: those are financial and service
   * records that must not vanish with a person. An instructor profile stays
   * public, only unlinked from the deleted account.
   */
  async remove(actorId: string, userId: string) {
    if (userId === actorId) throw new BadRequestException("حساب خودتان را نمی‌توانید حذف کنید.");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundException("user not found");
    const [paidOrders, bookings] = await Promise.all([
      this.prisma.order.count({ where: { userId, status: OrderStatus.PAID } }),
      this.prisma.consultationBooking.count({ where: { studentUserId: userId } }),
    ]);
    if (paidOrders > 0) {
      throw new BadRequestException("این کاربر خرید پرداخت‌شده دارد و سوابق مالی‌اش نباید پاک شود. به‌جای حذف، دسترسی‌هایش را بگیرید و نشست‌هایش را ببندید.");
    }
    if (bookings > 0) {
      throw new BadRequestException("این کاربر جلسهٔ مشاوره دارد و حذف نمی‌شود. اول جلسه‌هایش را در بخش مشاوره‌ها پاک کنید.");
    }
    const view = toView(user);
    try {
      await this.prisma.user.delete({ where: { id: userId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new BadRequestException("این کاربر به داده‌ای وصل است که نگه داشته می‌شود و حذف نمی‌شود.");
      }
      throw error;
    }
    await this.audit.log({
      actorUserId: actorId,
      action: "user.deleted_by_admin",
      targetType: "User",
      targetId: userId,
      metadata: { phone: user.phone, name: view.name, roles: view.roles },
    });
    return { deleted: true };
  }

  /** Setting someone else's password also signs them out everywhere, so an
   * old session cannot outlive the credential change. An admin setting their
   * own password keeps the session they are using. */
  async setPassword(actorId: string, userId: string, password: string, currentSessionToken?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("user not found");
    const passwordHash = await hashPassword(password);
    // Only a validated request cookie can identify the session being retained.
    // Calls without that context revoke all sessions, including the caller's.
    const currentTokenHash = userId === actorId && currentSessionToken
      ? createHash("sha256").update(currentSessionToken).digest("hex")
      : undefined;
    const sessionsRevoked = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      const revoked = await tx.session.updateMany({
        where: { userId, revokedAt: null, ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}) },
        data: { revokedAt: new Date() },
      });
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
