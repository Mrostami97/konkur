import { Controller, Get, Header, Module, Req, UseGuards } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { RequestWithUser } from "../identity/guards/session-auth.guard";
import { ActivityService } from "./activity.service";
import { SiteService } from "./site.service";

@Controller("site")
export class SiteController {
  constructor(
    private readonly site: SiteService,
    private readonly activity: ActivityService,
  ) {}

  /** Public: only counts per feature and whether SMS login is live. */
  @Get("availability")
  availability() {
    return this.site.availability();
  }

  /** Public: recent signups and purchases, with nothing that identifies anyone. */
  @Get("activity")
  @UseGuards(OptionalSessionAuthGuard)
  @Header("Cache-Control", "private, max-age=60")
  recentActivity(@Req() req: RequestWithUser) {
    return this.activity.recent(req.user?.id);
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [SiteController],
  providers: [SiteService, ActivityService],
})
export class SiteModule {}
