import { NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { CreateTopicDto } from "./dto/create-topic.dto";

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  createSubject(dto: CreateSubjectDto) {
    const { prerequisiteCodes = [], ...subject } = dto;
    return this.prisma.subject.create({
      data: {
        ...subject,
        slug: dto.slug ?? dto.code,
        prerequisites: {
          create: prerequisiteCodes.map((code) => ({
            prerequisite: { connect: { code } },
          })),
        },
      },
      include: { prerequisites: { include: { prerequisite: true } } },
    });
  }

  async createTopic(dto: CreateTopicDto) {
    const subject = await this.prisma.subject.findUnique({ where: { code: dto.subjectCode } });
    if (!subject) throw new NotFoundException(`subject ${dto.subjectCode} not found`);
    return this.prisma.topic.create({
      data: {
        code: dto.code,
        title: dto.title,
        slug: dto.slug ?? dto.code,
        description: dto.description,
        order: dto.order,
        metadata: dto.metadata,
        subjectId: subject.id,
        prerequisites: {
          create: (dto.prerequisiteCodes ?? []).map((code) => ({
            prerequisite: { connect: { code } },
          })),
        },
      },
      include: { prerequisites: { include: { prerequisite: true } } },
    });
  }

  listSubjects() {
    return this.prisma.subject.findMany({
      include: { prerequisites: { include: { prerequisite: true } } },
      orderBy: [{ order: "asc" }, { title: "asc" }],
    });
  }

  listTopics(subjectCode?: string) {
    return this.prisma.topic.findMany({
      where: subjectCode ? { subject: { code: subjectCode } } : undefined,
      include: {
        subject: true,
        prerequisites: { include: { prerequisite: true } },
      },
      orderBy: [{ order: "asc" }, { title: "asc" }],
    });
  }
}
