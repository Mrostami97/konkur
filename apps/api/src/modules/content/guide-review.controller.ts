import { BadRequestException, Controller, Delete, Get, Header, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function checkedSlug(slug: string) {
  if (!SLUG.test(slug) || slug.length > 120) throw new BadRequestException("invalid guide slug");
  return slug;
}

/** Who signed off each static guide, for the guide pages to name. */
@Controller("guide-reviews")
export class GuideReviewsPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list() {
    return this.prisma.guideReview.findMany({ select: { slug: true, reviewerName: true, reviewedAt: true }, orderBy: { slug: "asc" } });
  }
}

/**
 * The owner's sign-off on a guide whose text lives in the site code. The
 * reviewer named on the page is the signer's own profile name, so a guide
 * never names someone who did not read it.
 */
@Controller("admin/guide-reviews")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class GuideReviewsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post(":slug")
  async approve(@Param("slug") slug: string, @Req() req: RequestWithUser) {
    checkedSlug(slug);
    const profile = await this.prisma.profile.findUnique({ where: { userId: req.user!.id }, select: { displayName: true } });
    const reviewerName = profile?.displayName?.trim();
    if (!reviewerName) throw new BadRequestException("اول نام خودت را در پروفایل حساب کاربری ثبت کن؛ همین نام به‌عنوان بازبین روی راهنما می‌آید.");
    const review = await this.prisma.guideReview.upsert({
      where: { slug },
      create: { slug, reviewerId: req.user!.id, reviewerName },
      update: { reviewerId: req.user!.id, reviewerName, reviewedAt: new Date() },
    });
    await this.audit.log({ actorUserId: req.user!.id, action: "guide.reviewed", targetType: "Guide", targetId: slug });
    return review;
  }

  @Delete(":slug")
  async withdraw(@Param("slug") slug: string, @Req() req: RequestWithUser) {
    checkedSlug(slug);
    await this.prisma.guideReview.deleteMany({ where: { slug } });
    await this.audit.log({ actorUserId: req.user!.id, action: "guide.review_withdrawn", targetType: "Guide", targetId: slug });
    return { slug, reviewed: false };
  }
}
