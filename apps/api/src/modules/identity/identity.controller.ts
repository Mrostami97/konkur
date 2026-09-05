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
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { IdentityService } from "./identity.service";
import { SessionAuthGuard, RequestWithUser } from "./guards/session-auth.guard";

const SESSION_COOKIE = "session";
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 720);

@Controller("auth")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("otp/request")
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.identity.requestOtp(dto.phone);
    return { sent: true };
  }

  @Post("otp/verify")
  @HttpCode(200)
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
