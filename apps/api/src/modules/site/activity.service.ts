import { Injectable } from "@nestjs/common";
import { EntitlementGrantSource, ProductKind, ResourceKind, Role, ReviewStatus } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

const DAY_MS = 24 * 3_600_000;
const SIGNUP_WINDOW_MS = 30 * DAY_MS;
const PURCHASE_WINDOW_MS = 60 * DAY_MS;
const PER_KIND = 20;

/** Staff accounts: their signups and the access they give themselves are not activity. */
const STAFF = [Role.ADMIN, Role.AUTHOR, Role.REVIEWER, Role.FINANCE];

export type ActivityEvent =
  | { id: string; kind: "signup"; at: string; degree: "MASTER" | "PHD" | null; field: string | null }
  | { id: string; kind: "purchase"; at: string; product: string; noun: string | null; name: string; href: string };

/** An id the browser can remember as "already shown" without learning the row's real id. */
function opaque(kind: string, id: string) {
  return createHash("sha256").update(`${kind}:${id}`).digest("hex").slice(0, 16);
}

interface SoldProduct {
  title: string;
  kind: ProductKind;
  course: { slug: string; title: string; isPublished: boolean } | null;
  courseGrants: { course: { slug: string; title: string; isPublished: boolean } }[];
  resourceGrants: { resource: { slug: string; title: string; kind: ResourceKind; reviewStatus: ReviewStatus } }[];
}

/** The courses and the published resources a product really opens, in the order they were attached. */
function contents(product: SoldProduct) {
  const courses = [product.course, ...product.courseGrants.map((grant) => grant.course)].filter(
    (course, index, all): course is NonNullable<typeof course> => course !== null && all.findIndex((item) => item?.slug === course.slug) === index,
  );
  const resources = product.resourceGrants.map((grant) => grant.resource).filter((resource) => resource.reviewStatus === ReviewStatus.PUBLISHED);
  return { courses, resources };
}

/** The word for what a resource is, as a buyer would say it. */
function resourceNoun(kind: ResourceKind) {
  if (kind === ResourceKind.VIDEO) return "ویدیوی";
  if (kind === ResourceKind.NOTE || kind === ResourceKind.PDF || kind === ResourceKind.OPEN_TEXTBOOK) return "جزوهٔ";
  return "منبع";
}

/**
 * What was bought, named by what it opens rather than by the product's own
 * title (which is whatever the admin typed): «جزوهٔ سیستم عامل», «دورهٔ …».
 * A product that opens several things is a package, named by its title.
 */
export function describeSale(product: SoldProduct): { noun: string | null; name: string } {
  const named = describeContents(product);
  // A title already saying what it is («جزوهٔ سیستم عامل …») needs no second
  // «جزوهٔ» in front, and a notice shows only the title, not the subtitle
  // after « | » that the page itself carries.
  const name = named.name.split(/\s+[|｜]\s+/)[0].trim() || named.name;
  // «دورهٔ» → «دور»: the stem matches «دوره»، «دورهٔ» and «دوره‌های» alike.
  const stem = named.noun?.replace(/ٔ$/u, "").replace(/[ۀهی]$/u, "");
  if (stem && name.startsWith(stem)) return { noun: null, name };
  return { noun: named.noun, name };
}

function describeContents(product: SoldProduct): { noun: string | null; name: string } {
  if (product.kind === ProductKind.CONSULTATION || product.kind === ProductKind.QUESTION_BANK) {
    return { noun: null, name: product.title };
  }
  const { courses, resources } = contents(product);
  if (courses.length + resources.length === 1) {
    if (courses.length === 1) return { noun: "دورهٔ", name: courses[0].title };
    return { noun: resourceNoun(resources[0].kind), name: resources[0].title };
  }
  if (courses.length + resources.length > 1 || product.kind === ProductKind.BUNDLE) return { noun: "بستهٔ", name: product.title };
  return { noun: null, name: product.title };
}

/** Where a notice about this product sends the reader: the page of the thing bought when it has one. */
export function productHref(product: SoldProduct) {
  if (product.kind === ProductKind.CONSULTATION) return "/consultations";
  if (product.kind === ProductKind.QUESTION_BANK) return "/questions";
  const { courses, resources } = contents(product);
  if (courses.length + resources.length === 1) {
    const course = courses.find((item) => item.isPublished);
    if (course) return `/courses/${course.slug}`;
    if (resources[0]) return `/resources/${resources[0].slug}`;
  }
  const course = courses.find((item) => item.isPublished);
  if (course) return `/courses/${course.slug}`;
  if (resources[0]) return `/resources/${resources[0].slug}`;
  return "/courses";
}

/**
 * Recent real activity for the "someone just joined / bought" notices.
 * Nothing identifies a person: no name, no phone, no city -- only what they
 * are preparing for, or which product was bought, and when. The viewer's own
 * activity is left out, so nobody is shown their own signup as someone else.
 *
 * A purchase is access that was sold: paid at checkout (ORDER) or sold by
 * hand and granted by the admin (MANUAL). Gifts and trials are not sales.
 * When nothing happened in the window the list is empty and no notice
 * appears -- nothing is ever made up to fill it.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async recent(viewerId?: string): Promise<ActivityEvent[]> {
    const now = Date.now();
    const [signups, sales] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          ...(viewerId ? { NOT: { id: viewerId } } : {}),
          createdAt: { gte: new Date(now - SIGNUP_WINDOW_MS) },
          roles: { some: { role: Role.STUDENT }, none: { role: { in: STAFF } } },
        },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
        select: { id: true, createdAt: true, profile: { select: { targetDegree: true, targetField: true } } },
      }),
      this.prisma.entitlement.findMany({
        where: {
          grantedVia: { in: [EntitlementGrantSource.ORDER, EntitlementGrantSource.MANUAL] },
          revokedAt: null,
          createdAt: { gte: new Date(now - PURCHASE_WINDOW_MS) },
          // A product taken off sale is not advertised.
          product: { isActive: true },
          user: {
            ...(viewerId ? { NOT: { id: viewerId } } : {}),
            roles: { none: { role: { in: STAFF } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
        select: {
          id: true,
          createdAt: true,
          product: {
            select: {
              title: true,
              kind: true,
              course: { select: { slug: true, title: true, isPublished: true } },
              courseGrants: { select: { course: { select: { slug: true, title: true, isPublished: true } } } },
              resourceGrants: { select: { resource: { select: { slug: true, title: true, kind: true, reviewStatus: true } } } },
            },
          },
        },
      }),
    ]);

    const events: ActivityEvent[] = [
      ...signups.map((user) => ({
        id: opaque("signup", user.id),
        kind: "signup" as const,
        at: user.createdAt.toISOString(),
        degree: user.profile?.targetDegree ?? null,
        field: user.profile?.targetField ?? null,
      })),
      ...sales.map((sale) => ({
        id: opaque("purchase", sale.id),
        kind: "purchase" as const,
        at: sale.createdAt.toISOString(),
        product: sale.product.title,
        ...describeSale(sale.product),
        href: productHref(sale.product),
      })),
    ];
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }
}
