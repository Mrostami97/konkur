import { Controller, Get, Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { SiteService } from "./site.service";

@Controller("site")
export class SiteController {
  constructor(private readonly site: SiteService) {}

  /** Public: only counts per feature and whether SMS login is live. */
  @Get("availability")
  availability() {
    return this.site.availability();
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [SiteController],
  providers: [SiteService],
})
export class SiteModule {}
