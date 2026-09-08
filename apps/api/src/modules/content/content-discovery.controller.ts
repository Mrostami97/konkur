import { Controller, Get, Param, Query } from "@nestjs/common";
import { ContentDiscoveryService } from "./content-discovery.service";
import { ContentSearchQueryDto, PublicReportCardsQueryDto } from "./dto/content-discovery.dto";

@Controller("content")
export class ContentDiscoveryController {
  constructor(private readonly discovery: ContentDiscoveryService) {}

  @Get("search")
  search(@Query() query: ContentSearchQueryDto) {
    return this.discovery.search(query);
  }
}

@Controller("contributors")
export class ContributorsPublicController {
  constructor(private readonly discovery: ContentDiscoveryService) {}

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.discovery.getPublishedContributor(slug);
  }
}

@Controller("report-cards")
export class ReportCardsPublicController {
  constructor(private readonly discovery: ContentDiscoveryService) {}

  @Get()
  list(@Query() query: PublicReportCardsQueryDto) {
    return this.discovery.listPublicReportCards(query);
  }
}
