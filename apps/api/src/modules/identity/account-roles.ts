import { Role } from "@prisma/client";

/**
 * Which roles one account may hold together (owner decision, 2026-09-27):
 *
 * - The main administrator is separate from everyone: an ADMIN account holds
 *   ADMIN alone. ADMIN already reaches every staff route, so nothing is lost.
 *   The administrator may still teach (be linked to an instructor profile)
 *   and may open the student panel, which is scoped by session, not role.
 * - A student is not staff: a STUDENT account holds STUDENT alone, and
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
  if (unique.includes(Role.ADMIN) && unique.length > 1) {
    return "حساب مدیر اصلی فقط نقش «مدیر» دارد؛ برای کارهای دیگر حساب جداگانه بسازید.";
  }
  if (unique.includes(Role.STUDENT) && unique.length > 1) {
    return "حساب دانشجو نقش کارمندی نمی‌گیرد؛ برای کارکنان حساب جداگانه بسازید.";
  }
  return null;
}
