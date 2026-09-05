import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsArray, IsUUID } from "class-validator";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { AdmissionsService } from "./admissions.service";
import { CreateUniversityDto } from "./dto/create-university.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { CreateCapacityDto } from "./dto/create-capacity.dto";
import { AddChoiceDto } from "./dto/choice-list.dto";

class ReorderChoicesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  orderedProgramIds!: string[];
}

@Controller()
export class AdmissionsPublicController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get("universities")
  listUniversities() {
    return this.admissions.listUniversities();
  }

  @Get("programs")
  listPrograms(
    @Query("degree") degree?: "master" | "phd",
    @Query("field") field?: string,
    @Query("city") city?: string,
  ) {
    return this.admissions.listPrograms({ degree, field, city });
  }

  @Get("programs/:id")
  getProgram(@Param("id") id: string) {
    return this.admissions.getProgram(id);
  }
}

@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdmissionsAdminController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Post("universities")
  createUniversity(@Body() dto: CreateUniversityDto) {
    return this.admissions.createUniversity(dto);
  }

  @Post("programs")
  createProgram(@Body() dto: CreateProgramDto) {
    return this.admissions.createProgram(dto);
  }

  @Post("programs/:id/capacities")
  addCapacity(@Param("id") id: string, @Body() dto: CreateCapacityDto) {
    return this.admissions.addCapacity(id, dto);
  }
}

@Controller("me/choices")
@UseGuards(SessionAuthGuard)
export class ChoiceListController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.admissions.listChoices(req.user!.id);
  }

  @Get("compare")
  compare(@Req() req: RequestWithUser) {
    return this.admissions.compareChoices(req.user!.id);
  }

  @Post()
  add(@Req() req: RequestWithUser, @Body() dto: AddChoiceDto) {
    return this.admissions.addChoice(req.user!.id, dto.programId);
  }

  @Post("reorder")
  reorder(@Req() req: RequestWithUser, @Body() dto: ReorderChoicesDto) {
    return this.admissions.reorderChoices(req.user!.id, dto.orderedProgramIds);
  }

  @Delete(":programId")
  remove(@Param("programId") programId: string, @Req() req: RequestWithUser) {
    return this.admissions.removeChoice(req.user!.id, programId);
  }
}
