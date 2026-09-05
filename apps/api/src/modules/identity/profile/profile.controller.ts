import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { SessionAuthGuard, RequestWithUser } from "../guards/session-auth.guard";
import { ProfileService } from "./profile.service";
import { UpdateProfileDto } from "./update-profile.dto";

@Controller("me/profile")
@UseGuards(SessionAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@Req() req: RequestWithUser) {
    return this.profile.getOrCreate(req.user!.id);
  }

  @Patch()
  update(@Req() req: RequestWithUser, @Body() dto: UpdateProfileDto) {
    return this.profile.update(req.user!.id, dto);
  }
}
