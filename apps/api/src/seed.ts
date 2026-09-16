import { Prisma, PrismaClient, ReviewStatus, Role, VersionedEntityType } from "@prisma/client";
import {
  ensureSeedAdmin,
  SEED_ADMIN_PHONE,
} from "./seed-admin";
import { seedStaticEditorial } from "./seed-static-editorial";
import { seedStaticResources } from "./seed-static-resources";

const prisma = new PrismaClient();

export { SEED_ADMIN_PASSWORD, SEED_ADMIN_PHONE } from "./seed-admin";
export const SEED_STUDENT_PHONE = "+989120000002";
export const SEED_COURSE_SLUG = "ce-algorithms-bootcamp";
export const SEED_PRODUCT_SLUG = "ce-algorithms-bootcamp";
export const SEED_ARTICLE_SLUG = "big-o-refresher";

async function upsertUserWithRole(phone: string, role: Role) {
  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role } },
    update: {},
    create: { userId: user.id, role },
  });
  return user;
}

async function seedCourseAndProduct(authorId: string) {
  const course = await prisma.course.upsert({
    where: { slug: SEED_COURSE_SLUG },
    update: {},
    create: {
      slug: SEED_COURSE_SLUG,
      title: "بوت‌کمپ الگوریتم برای ارشد کامپیوتر",
      description: "دوره مروری الگوریتم و پیچیدگی زمانی برای آزمون ارشد کامپیوتر.",
      isPublished: true,
    },
  });

  let courseModule = await prisma.courseModule.findFirst({ where: { courseId: course.id, order: 1 } });
  if (!courseModule) {
    courseModule = await prisma.courseModule.create({
      data: { courseId: course.id, title: "مقدمه بر تحلیل الگوریتم", order: 1 },
    });
  }

  const lessonExists = await prisma.lesson.findFirst({
    where: { courseModuleId: courseModule.id, order: 1 },
  });
  if (!lessonExists) {
    await prisma.lesson.create({
      data: {
        courseModuleId: courseModule.id,
        title: "نماد O بزرگ چیست؟",
        order: 1,
        contentBlocks: [
          { type: "heading", text: "نماد O بزرگ" },
          { type: "text", text: "O بزرگ کران بالای نرخ رشد یک تابع را توصیف می‌کند." },
          { type: "video", url: "https://example.com/videos/big-o.mp4" },
        ],
      },
    });
  }

  const product = await prisma.product.upsert({
    where: { slug: SEED_PRODUCT_SLUG },
    update: {},
    create: {
      slug: SEED_PRODUCT_SLUG,
      title: course.title,
      description: course.description,
      kind: "COURSE",
      courseId: course.id,
      isActive: true,
    },
  });

  const activePrice = await prisma.price.findFirst({ where: { productId: product.id, isActive: true } });
  if (!activePrice) {
    await prisma.price.create({ data: { productId: product.id, amountRial: 490_000 } });
  }

  await prisma.productCourseGrant.upsert({
    where: { productId_courseId: { productId: product.id, courseId: course.id } },
    update: {},
    create: { productId: product.id, courseId: course.id },
  });

  const seedArticlePayload = {
    schema_version: "article.v1",
    external_id: "seed-big-o-refresher",
    title: "مروری بر نماد O بزرگ",
    slug: SEED_ARTICLE_SLUG,
    summary: "یک مرور کوتاه بر نماد O بزرگ پیش از شروع دوره الگوریتم.",
    content_blocks: [
      { type: "heading", level: 2, text: "چرا O بزرگ مهم است؟" },
      { type: "text", text: "این مقاله مقدمه‌ای بر مبحث پیچیدگی زمانی است." },
    ],
    taxonomy: { major: ["computer-engineering"], tags: ["algorithms"] },
    provenance: {
      producer_type: "human",
      producer_name: "kunkur01 seed",
      source_artifact: "apps/api/src/seed.ts",
    },
    review_status: "approved",
  };
  const article = await prisma.article.upsert({
    where: { slug: SEED_ARTICLE_SLUG },
    update: {},
    create: {
      externalId: seedArticlePayload.external_id,
      slug: SEED_ARTICLE_SLUG,
      title: seedArticlePayload.title,
      summary: seedArticlePayload.summary,
      contentBlocks: seedArticlePayload.content_blocks,
      taxonomyMajor: ["computer-engineering"],
      taxonomyTags: ["algorithms"],
      authorId,
      reviewStatus: ReviewStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });
  await prisma.contentVersion.upsert({
    where: {
      entityType_entityId_version: {
        entityType: VersionedEntityType.ARTICLE,
        entityId: article.id,
        version: article.version,
      },
    },
    update: {},
    create: {
      entityType: VersionedEntityType.ARTICLE,
      entityId: article.id,
      version: article.version,
      payload: seedArticlePayload as Prisma.InputJsonValue,
      schemaVersion: "article.v1",
      reviewStatus: ReviewStatus.PUBLISHED,
      publishedAt: article.publishedAt,
    },
  });
}

export async function seed() {
  const { user: admin } = await ensureSeedAdmin(prisma);
  await prisma.contributorProfile.upsert({
    where: { slug: "mohammad-rostami" },
    update: { userId: admin.id },
    create: {
      userId: admin.id,
      slug: "mohammad-rostami",
      displayName: "محمد رستمی",
      roleTitle: "مدرس و مؤلف کنکور کامپیوتر",
      shortBio: "پروفایل تحریریه برای تکمیل و تأیید پیش از انتشار عمومی.",
      thesisUrl: "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/",
      isPublished: false,
    },
  });
  await upsertUserWithRole(SEED_STUDENT_PHONE, Role.STUDENT);
  await seedCourseAndProduct(admin.id);
  await seedStaticEditorial(prisma);
  await seedStaticResources(prisma);
}

if (require.main === module) {
  seed()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Seed complete: admin=%s student=%s", SEED_ADMIN_PHONE, SEED_STUDENT_PHONE);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
