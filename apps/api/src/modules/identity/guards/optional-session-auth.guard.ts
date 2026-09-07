import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { IdentityService } from "../identity.service";
import { RequestWithUser } from "./session-auth.guard";

/** Adds a validated user to public requests when a session is present, while
 * keeping truly public content reachable without authentication. */
@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(private readonly identity: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.cookies?.session;
    if (!token) return true;
    const user = await this.identity.validateSession(token);
    if (user) request.user = user;
    return true;
  }
}
