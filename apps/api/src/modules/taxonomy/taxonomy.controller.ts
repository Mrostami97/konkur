import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { TaxonomyService } from "./taxonomy.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { CreateTopicDto } from "./dto/create-topic.dto";

@Controller()
export class TaxonomyPublicController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get("subjects")
  listSubjects() {
    return this.taxonomy.listSubjects();
  }

  @Get("topics")
  listTopics(@Query("subjectCode") subjectCode?: string) {
    return this.taxonomy.listTopics(subjectCode);
  }

  @Get("subjects/:slug")
  getSubject(@Param("slug") slug: string) {
    return this.taxonomy.getSubjectBySlug(slug);
  }

  @Get("topics/:slug")
  getTopic(@Param("slug") slug: string) {
    return this.taxonomy.getTopicBySlug(slug);
  }
}

@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.AUTHOR, Role.ADMIN)
export class TaxonomyAdminController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Post("subjects")
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.taxonomy.createSubject(dto);
  }

  @Post("topics")
  createTopic(@Body() dto: CreateTopicDto) {
    return this.taxonomy.createTopic(dto);
  }
}
