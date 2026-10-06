import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { plainToInstance } from "class-transformer";
import { IsArray, IsUUID, validate } from "class-validator";
import { memoryStorage } from "multer";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { AdmissionsService } from "./admissions.service";
import { CreateUniversityDto } from "./dto/create-university.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { CreateCapacityDto } from "./dto/create-capacity.dto";
import { AddChoiceDto } from "./dto/choice-list.dto";
import { ListProgramsDto } from "./dto/list-programs.dto";
import { CatalogQueryDto, ImportBookletDto } from "./dto/import-booklet.dto";

class ImportBookletFormDto {
  @IsUUID()
  sourceId!: string;
}

/** Reads an uploaded "admissions-booklet.v1" JSON file, with the same validation a JSON body gets. */
async function readBooklet(file: Express.Multer.File | undefined) {
  if (!file) throw new BadRequestException("فایل JSON دفترچه لازم است (فیلد file).");
  let raw: unknown;
  try {
    raw = JSON.parse(file.buffer.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new BadRequestException("فایل، JSON معتبر نیست.");
  }
  const dto = plainToInstance(ImportBookletDto, raw);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    const first = errors[0];
    const row = first.property === "rows" ? first.children?.[0] : undefined;
    const detail = row ? `ردیف ${Number(row.property) + 1}: ${JSON.stringify(row.children?.[0]?.constraints ?? row.constraints)}` : JSON.stringify(first.constraints);
    throw new BadRequestException(`فایل دفترچه معتبر نیست — ${first.property}، ${detail}`);
  }
  return dto;
}

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

  @Get("universities/:code")
  getUniversity(@Param("code") code: string) {
    return this.admissions.getUniversityByCode(code);
  }

  @Get("programs")
  listPrograms(@Query() query: ListProgramsDto) {
    return this.admissions.listPrograms(query);
  }

  /** Everything the field-selection tool filters, for one booklet year. */
  @Get("admissions/catalog")
  catalog(@Query() query: CatalogQueryDto) {
    return this.admissions.catalog(query);
  }

  @Get("programs/code/:code")
  getProgramByCode(@Param("code") code: string) {
    return this.admissions.getProgramByCode(code);
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

  @Post("admissions/import")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async importBooklet(@UploadedFile() file: Express.Multer.File | undefined, @Body() form: ImportBookletFormDto) {
    return this.admissions.importBooklet(await readBooklet(file), form.sourceId);
  }

  @Post("programs/:id/capacities")
  addCapacity(@Param("id") id: string, @Body() dto: CreateCapacityDto) {
    return this.admissions.addCapacity(id, dto);
  }

  @Delete("programs/:id")
  deleteProgram(@Param("id") id: string) {
    return this.admissions.deleteProgram(id);
  }

  @Delete("universities/:id")
  deleteUniversity(@Param("id") id: string) {
    return this.admissions.deleteUniversity(id);
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
