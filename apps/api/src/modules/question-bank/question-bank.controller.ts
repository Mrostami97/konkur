import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { QuestionQuality, Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { QuestionBankService } from "./question-bank.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { RetireQuestionDto } from "./dto/retire-question.dto";
import { SetSampleDto } from "./dto/set-sample.dto";
import { ConfirmExamKeyDto, ReviewQuestionDto } from "./dto/review-question.dto";
import { PracticeAnswerDto, PracticeReasonDto, QuestionMarkDto } from "./dto/practice.dto";
import { COLLECTIONS, PracticeService, type Collection } from "./practice.service";
import { PersonalExamDto, PracticeSelectionDto } from "./dto/personal-exam.dto";
import { PersonalExamService } from "./personal-exam.service";

@Controller("questions")
@UseGuards(OptionalSessionAuthGuard)
export class QuestionsPublicController {
  constructor(
    private readonly questionBank: QuestionBankService,
    private readonly practice: PracticeService,
    private readonly personalExams: PersonalExamService,
  ) {}

  @Get()
  list(
    @Req() req: RequestWithUser,
    @Query("subjectCode") subjectCode?: string,
    @Query("topicCode") topicCode?: string,
    @Query("topicCodes") topicCodes?: string,
    @Query("collection") collection?: string,
    @Query("examDegree") examDegree?: "master" | "phd",
    @Query("examMajor") examMajor?: string,
    @Query("examYear") examYear?: string,
    @Query("q") q?: string,
    @Query("solved") solved?: string,
    @Query("sample") sample?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.questionBank.list(
      {
        subjectCode,
        topicCode,
        // A chapter is sent as its topics, comma separated; a sane cap keeps the query small.
        topicCodes: topicCodes ? topicCodes.split(",").map((code) => code.trim()).filter(Boolean).slice(0, 60) : undefined,
        collection: collection && (COLLECTIONS as readonly string[]).includes(collection) ? (collection as Collection) : undefined,
        examDegree,
        examMajor,
        examYear: examYear ? Number(examYear) : undefined,
        q,
        solved: solved === "true",
        sample: sample === "true",
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      req.user,
    );
  }

  /** The signed-in student's history and marks on these questions (comma separated ids); declared before `:id`. */
  @Get("history")
  @UseGuards(SessionAuthGuard)
  history(@Req() req: RequestWithUser, @Query("ids") ids?: string) {
    return this.practice.history(req.user!.id, (ids ?? "").split(",").map((id) => id.trim()).filter(Boolean));
  }

  /** A practice answer: graded on the server from the key, kept for the student's history. */
  @Post(":id/practice")
  @UseGuards(SessionAuthGuard)
  answer(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: PracticeAnswerDto) {
    return this.practice.record(req.user!.id, id, dto);
  }

  /** The student's own reason for one of their wrong answers. */
  @Patch("practice-answers/:answerId")
  @UseGuards(SessionAuthGuard)
  reason(@Req() req: RequestWithUser, @Param("answerId") answerId: string, @Body() dto: PracticeReasonDto) {
    return this.practice.setReason(req.user!.id, answerId, dto.errorReason);
  }

  /** The student's progress on a subject, per syllabus topic; declared before `:id`. */
  @Get("progress")
  @UseGuards(SessionAuthGuard)
  progress(@Req() req: RequestWithUser, @Query("subjectCode") subjectCode?: string) {
    if (!subjectCode || !/^[a-z0-9-]{1,80}$/.test(subjectCode)) throw new BadRequestException("subjectCode is required");
    return this.practice.progress(req.user!.id, subjectCode);
  }

  /** «۱۰ تست امروز»: the day's practice set, today's answers against the goal, and the streak; declared before `:id`. */
  @Get("today")
  @UseGuards(SessionAuthGuard)
  today(@Req() req: RequestWithUser) {
    return this.questionBank.today(req.user!.id);
  }

  /** The student's progress on every subject they have practised: questions seen and right last time. */
  @Get("progress-summary")
  @UseGuards(SessionAuthGuard)
  progressSummary(@Req() req: RequestWithUser) {
    return this.practice.progressSummary(req.user!.id);
  }

  /** A random set of questions the student may read, for practice with the key after each. */
  @Post("practice-set")
  @UseGuards(SessionAuthGuard)
  practiceSet(@Req() req: RequestWithUser, @Body() dto: PracticeSelectionDto) {
    return this.personalExams.pick(req.user!.id, dto);
  }

  /** The same selection as a timed exam of the student's own, started with POST /exams/:id/start. */
  @Post("practice-exams")
  @UseGuards(SessionAuthGuard)
  practiceExam(@Req() req: RequestWithUser, @Body() dto: PersonalExamDto) {
    return this.personalExams.createExam(req.user!.id, dto);
  }

  /** A star and/or a note on a question. */
  @Put(":id/mark")
  @UseGuards(SessionAuthGuard)
  mark(@Req() req: RequestWithUser, @Param("id") id: string, @Body() dto: QuestionMarkDto) {
    return this.practice.mark(req.user!.id, id, dto);
  }

  /** Question counts per subject and, for one subject, per syllabus topic; declared before `:id`. */
  @Get("counts")
  counts(@Query("subjectCode") subjectCode?: string) {
    return this.questionBank.counts(subjectCode || undefined);
  }

  /** For one subject, per syllabus topic: questions, worked solutions and questions per exam year; declared before `:id`. */
  @Get("chapter-stats")
  chapterStats(@Query("subjectCode") subjectCode: string) {
    if (!subjectCode) throw new BadRequestException("subjectCode is required");
    return this.questionBank.chapterStats(subjectCode);
  }

  /** A subject's public samples with their answers; declared before `:id` so it is not read as an id. */
  @Get("samples")
  samples(@Query("subjectCode") subjectCode: string, @Query("limit") limit?: string) {
    if (!subjectCode) throw new BadRequestException("subjectCode is required");
    return this.questionBank.samples(subjectCode, limit ? Number(limit) || 6 : 6);
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

  /** The review queue's overview: per exam year, questions by tier and keys left to check. */
  @Get("review-summary")
  @Roles(Role.REVIEWER, Role.ADMIN)
  reviewSummary() {
    return this.questionBank.reviewSummary();
  }

  @Post("exam-key/confirm")
  @Roles(Role.REVIEWER, Role.ADMIN)
  confirmExamKey(@Req() req: RequestWithUser, @Body() dto: ConfirmExamKeyDto) {
    return this.questionBank.confirmExamKey(req.user!.id, dto.examCode, dto.examYear);
  }

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
    @Query("qualityTier") qualityTier?: string,
    @Query("examCode") examCode?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.questionBank.listForAdmin({
      subjectCode,
      examYear: examYear ? Number(examYear) : undefined,
      q,
      includeRetired: includeRetired === "true",
      qualityTier: qualityTier && qualityTier in QuestionQuality ? (qualityTier as QuestionQuality) : undefined,
      examCode,
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

  /** The review queue: confirm (or withdraw) that the text and the key match the original. */
  @Post(":id/review")
  @Roles(Role.REVIEWER, Role.ADMIN)
  review(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: ReviewQuestionDto) {
    return this.questionBank.review(req.user!.id, id, dto);
  }

  @Post(":id/sample")
  @Roles(Role.AUTHOR, Role.ADMIN)
  setSample(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: SetSampleDto) {
    return this.questionBank.setSample(req.user!.id, id, dto.isSample);
  }
}
