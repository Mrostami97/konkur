import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { ROLES_KEY } from "./roles.decorator";
import { RequestWithUser } from "./session-auth.guard";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const userRoles = req.user?.roles ?? [];
    const allowed = required.some((role) => userRoles.includes(role));
    if (!allowed) throw new ForbiddenException("insufficient role");
    return true;
  }
}
