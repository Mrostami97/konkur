import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { RolesGuard } from "../src/modules/identity/guards/roles.guard";

function buildContext(user: { roles: Role[] } | undefined, required: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn(() => required),
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

describe("RolesGuard", () => {
  it("allows access when no roles are required", () => {
    const { reflector, context } = buildContext(undefined, undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows access when the user has a required role", () => {
    const { reflector, context } = buildContext({ roles: [Role.ADMIN] }, [Role.ADMIN]);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("denies access when the user lacks the required role", () => {
    const { reflector, context } = buildContext({ roles: [Role.STUDENT] }, [Role.ADMIN]);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("denies access when there is no user on the request", () => {
    const { reflector, context } = buildContext(undefined, [Role.ADMIN]);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
