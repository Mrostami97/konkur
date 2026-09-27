import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { IS_PUBLIC_KEY, ROLES_KEY } from "./roles.decorator";
import { RequestWithUser } from "./session-auth.guard";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Fail closed: a handler behind RolesGuard with no @Roles (and no
    // explicit @Public()) is treated as a configuration mistake, not an
    // open door. Mark it @Public() if that is really what's intended.
    if (!required || required.length === 0) {
      throw new ForbiddenException("no roles configured for this route");
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const userRoles = req.user?.roles ?? [];
    // A student is never staff (see account-roles.ts): an account that still
    // carries STUDENT next to a staff role -- from before roles were kept
    // apart -- is refused until an administrator settles which it is.
    if (userRoles.includes(Role.STUDENT) && !required.includes(Role.STUDENT)) {
      throw new ForbiddenException("student accounts cannot use staff routes");
    }
    const allowed = required.some((role) => userRoles.includes(role));
    if (!allowed) throw new ForbiddenException("insufficient role");
    return true;
  }
}
