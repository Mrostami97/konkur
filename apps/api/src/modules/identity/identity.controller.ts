import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { PasswordLoginDto } from "./dto/password-login.dto";
import { IdentityService } from "./identity.service";
import { SessionAuthGuard, RequestWithUser } from "./guards/session-auth.guard";

const SESSION_COOKIE = "session";
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 720);

@Controller("auth")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  // doc §9's "محدودیت تلاش" (attempt limiting) applied specifically to OTP:
  // 5 requests/min per IP so the console/SMS provider can't be spammed, and
  // 10 verify attempts/min per IP on top of the existing per-code attempt
  // counter (which limits guessing a single code, not request volume).
  @Post("otp/request")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.identity.requestOtp(dto.phone, { source: dto.source, campaignCode: dto.campaignCode });
    return { sent: true };
  }

  @Post("otp/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.identity.verifyOtp(dto.phone, dto.code, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_HOURS * 3_600_000,
    });
    return { user };
  }

  /**
   * Password login is deliberately a separate method from OTP so existing
   * passwordless users can keep using OTP and additional methods can be added
   * without changing the OTP contract.
   */
  @Post("password/login")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async loginWithPassword(
    @Body() dto: PasswordLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.identity.loginWithPassword(dto.phone, dto.password, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_HOURS * 3_600_000,
    });
    return { user };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await this.identity.logout(token);
    res.clearCookie(SESSION_COOKIE);
    return { loggedOut: true };
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  me(@Req() req: RequestWithUser) {
    return { user: req.user };
  }
}
