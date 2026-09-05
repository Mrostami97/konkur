import { PrismaClient, ReviewStatus, Role } from "@prisma/client";
import { hashPassword } from "./modules/identity/password-hasher";

const prisma = new PrismaClient();

export const SEED_ADMIN_PHONE = "+989120000001";
export const SEED_ADMIN_PASSWORD = "123";
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

  await prisma.article.upsert({
    where: { slug: SEED_ARTICLE_SLUG },
    update: {},
    create: {
      slug: SEED_ARTICLE_SLUG,
      title: "مروری بر نماد O بزرگ",
      summary: "یک مرور کوتاه بر نماد O بزرگ پیش از شروع دوره الگوریتم.",
      contentBlocks: [
        { type: "heading", level: 2, text: "چرا O بزرگ مهم است؟" },
        { type: "text", text: "این مقاله مقدمه‌ای بر مبحث پیچیدگی زمانی است." },
      ],
      taxonomyMajor: ["computer-engineering"],
      taxonomyTags: ["algorithms"],
      authorId,
      reviewStatus: ReviewStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });
}

export async function seed() {
  const admin = await upsertUserWithRole(SEED_ADMIN_PHONE, Role.ADMIN);
  // Keep the fixture repeatable without overwriting an administrator's
  // deliberately changed password on subsequent seed runs.
  if (!admin.passwordHash) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: await hashPassword(SEED_ADMIN_PASSWORD) },
    });
  }
  await upsertUserWithRole(SEED_STUDENT_PHONE, Role.STUDENT);
  await seedCourseAndProduct(admin.id);
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
