import { Injectable } from "@nestjs/common";
import { EntitlementGrantSource, ProductKind, Role, ReviewStatus } from "@prisma/client";
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
  | { id: string; kind: "purchase"; at: string; product: string; href: string };

/** An id the browser can remember as "already shown" without learning the row's real id. */
function opaque(kind: string, id: string) {
  return createHash("sha256").update(`${kind}:${id}`).digest("hex").slice(0, 16);
}

interface SoldProduct {
  kind: ProductKind;
  course: { slug: string; isPublished: boolean } | null;
  resourceGrants: { resource: { slug: string; reviewStatus: ReviewStatus } }[];
}

/** Where a notice about this product sends the reader: the product's own page when it has one. */
function productHref(product: SoldProduct) {
  if (product.kind === ProductKind.CONSULTATION) return "/consultations";
  if (product.kind === ProductKind.QUESTION_BANK) return "/questions";
  if (product.course?.isPublished) return `/courses/${product.course.slug}`;
  const resource = product.resourceGrants.find((grant) => grant.resource.reviewStatus === ReviewStatus.PUBLISHED)?.resource;
  if (resource) return `/resources/${resource.slug}`;
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
              course: { select: { slug: true, isPublished: true } },
              resourceGrants: { select: { resource: { select: { slug: true, reviewStatus: true } } } },
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
        href: productHref(sale.product),
      })),
    ];
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }
}
