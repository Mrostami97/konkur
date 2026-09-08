import { Injectable, NotFoundException } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";
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

  async getSubjectBySlug(slug: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { slug },
      select: {
        code: true,
        slug: true,
        title: true,
        description: true,
        order: true,
        metadata: true,
        prerequisites: {
          select: {
            prerequisite: {
              select: { code: true, slug: true, title: true, description: true },
            },
          },
        },
        topics: {
          orderBy: [{ order: "asc" }, { title: "asc" }],
          select: { code: true, slug: true, title: true, description: true, order: true },
        },
        courses: {
          where: { isPublished: true },
          orderBy: { title: "asc" },
          select: {
            slug: true,
            title: true,
            description: true,
            accessMode: true,
            degreeTargets: true,
            fieldTargets: true,
          },
        },
      },
    });
    if (!subject) throw new NotFoundException("subject not found");

    const [articles, resources] = await Promise.all([
      this.prisma.article.findMany({
        where: { reviewStatus: ReviewStatus.PUBLISHED, subjectCodes: { has: subject.code } },
        orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
        select: {
          slug: true,
          title: true,
          summary: true,
          contentType: true,
          quickAnswer: true,
          publishedAt: true,
        },
      }),
      this.prisma.resource.findMany({
        where: { reviewStatus: ReviewStatus.PUBLISHED, subjectCodes: { has: subject.code } },
        orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
        select: {
          slug: true,
          title: true,
          summary: true,
          kind: true,
          accessMode: true,
          publishedAt: true,
        },
      }),
    ]);

    return {
      code: subject.code,
      slug: subject.slug,
      title: subject.title,
      description: subject.description,
      order: subject.order,
      metadata: subject.metadata,
      prerequisites: subject.prerequisites.map(({ prerequisite }) => prerequisite),
      topics: subject.topics,
      relatedContent: {
        articles: articles.map((article) => ({
          ...article,
          href: article.contentType === "GUIDE" ? `/guides/${article.slug}` : `/articles/${article.slug}`,
        })),
        resources: resources.map((resource) => ({ ...resource, href: `/resources/${resource.slug}` })),
        courses: subject.courses.map((course) => ({ ...course, href: `/courses/${course.slug}` })),
      },
    };
  }

  async getTopicBySlug(slug: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      select: {
        code: true,
        slug: true,
        title: true,
        description: true,
        order: true,
        metadata: true,
        subject: {
          select: { code: true, slug: true, title: true, description: true },
        },
        prerequisites: {
          select: {
            prerequisite: {
              select: {
                code: true,
                slug: true,
                title: true,
                description: true,
                subject: { select: { code: true, slug: true, title: true } },
              },
            },
          },
        },
      },
    });
    if (!topic) throw new NotFoundException("topic not found");

    const [articles, resources, courses] = await Promise.all([
      this.prisma.article.findMany({
        where: { reviewStatus: ReviewStatus.PUBLISHED, topicCodes: { has: topic.code } },
        orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
        select: {
          slug: true,
          title: true,
          summary: true,
          contentType: true,
          quickAnswer: true,
          publishedAt: true,
        },
      }),
      this.prisma.resource.findMany({
        where: { reviewStatus: ReviewStatus.PUBLISHED, topicCodes: { has: topic.code } },
        orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
        select: {
          slug: true,
          title: true,
          summary: true,
          kind: true,
          accessMode: true,
          publishedAt: true,
        },
      }),
      this.prisma.course.findMany({
        where: {
          isPublished: true,
          modules: {
            some: {
              lessons: { some: { topics: { some: { topic: { code: topic.code } } } } },
            },
          },
        },
        orderBy: { title: "asc" },
        select: {
          slug: true,
          title: true,
          description: true,
          accessMode: true,
          degreeTargets: true,
          fieldTargets: true,
        },
      }),
    ]);

    return {
      code: topic.code,
      slug: topic.slug,
      title: topic.title,
      description: topic.description,
      order: topic.order,
      metadata: topic.metadata,
      subject: topic.subject,
      prerequisites: topic.prerequisites.map(({ prerequisite }) => prerequisite),
      relatedContent: {
        articles: articles.map((article) => ({
          ...article,
          href: article.contentType === "GUIDE" ? `/guides/${article.slug}` : `/articles/${article.slug}`,
        })),
        resources: resources.map((resource) => ({ ...resource, href: `/resources/${resource.slug}` })),
        courses: courses.map((course) => ({ ...course, href: `/courses/${course.slug}` })),
      },
    };
  }
}
