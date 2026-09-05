import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { QuestionBankService } from "./question-bank.service";
import { CreateQuestionDto } from "./dto/create-question.dto";

@Controller("questions")
export class QuestionsPublicController {
  constructor(private readonly questionBank: QuestionBankService) {}

  @Get()
  list(
    @Query("subjectCode") subjectCode?: string,
    @Query("topicCode") topicCode?: string,
    @Query("examDegree") examDegree?: "master" | "phd",
    @Query("examMajor") examMajor?: string,
    @Query("examYear") examYear?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.questionBank.list({
      subjectCode,
      topicCode,
      examDegree,
      examMajor,
      examYear: examYear ? Number(examYear) : undefined,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.questionBank.getById(id);
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

  @Post()
  @Roles(Role.AUTHOR, Role.ADMIN)
  createDirect(@Req() req: RequestWithUser, @Body() dto: CreateQuestionDto) {
    return this.questionBank.createDirect(req.user!.id, dto);
  }
}
