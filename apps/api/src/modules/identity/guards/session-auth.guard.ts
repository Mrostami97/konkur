import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { IdentityService, SessionUser } from "../identity.service";

export interface RequestWithUser extends Request {
  user?: SessionUser;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly identity: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token = req.cookies?.["session"];
    if (!token) throw new UnauthorizedException("no session");

    const user = await this.identity.validateSession(token);
    if (!user) throw new UnauthorizedException("invalid or expired session");

    req.user = user;
    return true;
  }
}
