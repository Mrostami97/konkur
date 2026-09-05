import { Controller, Get, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./guards/roles.decorator";

/**
 * Exists in Phase 0 solely to prove RBAC works end-to-end (session auth +
 * role check against a real protected route). The full Backoffice module
 * (content/finance/reporting) is a later phase.
 */
@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("users")
  @Roles(Role.ADMIN)
  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: { roles: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        phone: u.phone,
        roles: u.roles.map((r) => r.role),
        createdAt: u.createdAt,
      })),
    };
  }
}
