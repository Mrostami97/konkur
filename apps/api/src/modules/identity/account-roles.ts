import { Role } from "@prisma/client";

/**
 * Which roles one account may hold together (owner decisions, 2026-09-27,
 * changed 2026-10-12):
 *
 * - An ADMIN account may hold every role at once: the owner runs the site,
 *   teaches, reviews, handles payments and uses the student panel himself.
 * - Anyone else who is a student is not staff: such an account holds STUDENT alone, and
 *   RolesGuard refuses staff routes to any account that still carries
 *   STUDENT, so a student can never reach the admin API.
 * - A student is not an instructor: an account linked to an instructor
 *   (contributor) profile does not hold STUDENT.
 * - Staff roles (MENTOR, AUTHOR, REVIEWER, FINANCE) may be combined.
 */
export const STAFF_ROLES: readonly Role[] = [Role.ADMIN, Role.MENTOR, Role.AUTHOR, Role.REVIEWER, Role.FINANCE];

/** Why this set of roles cannot go on one account, or null if it can. */
export function roleSetProblem(roles: readonly Role[]): string | null {
  const unique = [...new Set(roles)];
  if (unique.includes(Role.ADMIN)) return null;
  if (unique.includes(Role.STUDENT) && unique.length > 1) {
    return "حساب دانشجو نقش کارمندی نمی‌گیرد؛ برای کارکنان حساب جداگانه بسازید.";
  }
  return null;
}
