import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { QuestionBankService } from "./question-bank.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { RetireQuestionDto } from "./dto/retire-question.dto";
import { SetSampleDto } from "./dto/set-sample.dto";

@Controller("questions")
@UseGuards(OptionalSessionAuthGuard)
export class QuestionsPublicController {
  constructor(private readonly questionBank: QuestionBankService) {}

  @Get()
  list(
    @Req() req: RequestWithUser,
    @Query("subjectCode") subjectCode?: string,
    @Query("topicCode") topicCode?: string,
    @Query("examDegree") examDegree?: "master" | "phd",
    @Query("examMajor") examMajor?: string,
    @Query("examYear") examYear?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.questionBank.list(
      {
        subjectCode,
        topicCode,
        examDegree,
        examMajor,
        examYear: examYear ? Number(examYear) : undefined,
        q,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      req.user,
    );
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.questionBank.getById(id, req.user);
  }
}

@Controller("admin/questions")
@UseGuards(SessionAuthGuard, RolesGuard)
export class QuestionsAdminController {
  constructor(private readonly questionBank: QuestionBankService) {}

  @Get(":id/versions")
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  listVersions(@Param("id") id: string) {
    return this.questionBank.listVersions(id);
  }

  /**
   * Creates a question, and is also how one is edited: the pipeline keys on
   * `external_id`, so re-submitting an existing id revises that question and
   * bumps its version rather than inserting a second row. There is no
   * straight-to-row update path on purpose — a question is versioned content,
   * so every change stays reviewable and roll-back-able like any other
   * publish.
   */
  @Post()
  @Roles(Role.AUTHOR, Role.ADMIN)
  createDirect(@Req() req: RequestWithUser, @Body() dto: CreateQuestionDto) {
    return this.questionBank.createDirect(req.user!.id, dto);
  }

  /** Admin listing: unlike the public path this can include retired questions,
   * because an operator needs to see what left the bank and why. */
  @Get()
  @Roles(Role.AUTHOR, Role.REVIEWER, Role.ADMIN)
  list(
    @Query("subjectCode") subjectCode?: string,
    @Query("examYear") examYear?: string,
    @Query("q") q?: string,
    @Query("includeRetired") includeRetired?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.questionBank.listForAdmin({
      subjectCode,
      examYear: examYear ? Number(examYear) : undefined,
      q,
      includeRetired: includeRetired === "true",
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post(":id/retire")
  @Roles(Role.ADMIN)
  retire(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: RetireQuestionDto) {
    return this.questionBank.retire(req.user!.id, id, dto.reason);
  }

  @Post(":id/restore")
  @Roles(Role.ADMIN)
  restore(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.questionBank.restore(req.user!.id, id);
  }

  @Post(":id/sample")
  @Roles(Role.AUTHOR, Role.ADMIN)
  setSample(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: SetSampleDto) {
    return this.questionBank.setSample(req.user!.id, id, dto.isSample);
  }
}
