import { SetMetadata } from "@nestjs/common";
import { Role } from "@prisma/client";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Explicit opt-out of role checking for a handler/controller that sits
 * behind `RolesGuard` (e.g. because a sibling handler in the same class
 * needs `@Roles`) but intentionally allows any authenticated caller.
 * `RolesGuard` fails closed when `@Roles` is missing, so a handler that
 * really needs no role must say so on purpose with this decorator instead
 * of relying on the guard's old fail-open default.
 */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
