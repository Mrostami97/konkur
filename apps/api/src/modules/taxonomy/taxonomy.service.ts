import { NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { CreateTopicDto } from "./dto/create-topic.dto";

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  createSubject(dto: CreateSubjectDto) {
    return this.prisma.subject.create({ data: dto });
  }

  async createTopic(dto: CreateTopicDto) {
    const subject = await this.prisma.subject.findUnique({ where: { code: dto.subjectCode } });
    if (!subject) throw new NotFoundException(`subject ${dto.subjectCode} not found`);
    return this.prisma.topic.create({
      data: { code: dto.code, title: dto.title, subjectId: subject.id },
    });
  }

  listSubjects() {
    return this.prisma.subject.findMany({ orderBy: { title: "asc" } });
  }

  listTopics(subjectCode?: string) {
    return this.prisma.topic.findMany({
      where: subjectCode ? { subject: { code: subjectCode } } : undefined,
      include: { subject: true },
      orderBy: { title: "asc" },
    });
  }
}
