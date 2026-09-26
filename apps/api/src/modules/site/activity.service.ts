import { Injectable } from "@nestjs/common";
import { OrderStatus, Role } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

const SIGNUP_WINDOW_MS = 3 * 24 * 3_600_000;
const PURCHASE_WINDOW_MS = 14 * 24 * 3_600_000;
const PER_KIND = 8;

export type ActivityEvent =
  | { id: string; kind: "signup"; at: string; degree: "MASTER" | "PHD" | null; field: string | null }
  | { id: string; kind: "purchase"; at: string; product: string };

/** An id the browser can remember as "already shown" without learning the row's real id. */
function opaque(kind: string, id: string) {
  return createHash("sha256").update(`${kind}:${id}`).digest("hex").slice(0, 16);
}

/**
 * Recent real activity for the "someone just joined / bought" notices.
 * Nothing identifies a person: no name, no phone, no city -- only what they
 * are preparing for, or which product was bought, and when. The viewer's own
 * activity is left out, so nobody is shown their own signup as someone else.
 * When nothing happened recently the list is empty and no notice appears.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async recent(viewerId?: string): Promise<ActivityEvent[]> {
    const now = Date.now();
    const notViewer = viewerId ? { NOT: { id: viewerId } } : {};
    const [signups, orders] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          ...notViewer,
          createdAt: { gte: new Date(now - SIGNUP_WINDOW_MS) },
          roles: { some: { role: Role.STUDENT }, none: { role: { in: [Role.ADMIN, Role.AUTHOR, Role.REVIEWER, Role.FINANCE] } } },
        },
        orderBy: { createdAt: "desc" },
        take: PER_KIND,
        select: { id: true, createdAt: true, profile: { select: { targetDegree: true, targetField: true } } },
      }),
      this.prisma.order.findMany({
        where: {
          status: OrderStatus.PAID,
          updatedAt: { gte: new Date(now - PURCHASE_WINDOW_MS) },
          ...(viewerId ? { NOT: { userId: viewerId } } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: PER_KIND,
        select: { id: true, updatedAt: true, items: { take: 1, select: { product: { select: { title: true, isActive: true } } } } },
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
      ...orders.flatMap((order) => {
        const product = order.items[0]?.product;
        // A product taken off sale is not advertised.
        if (!product?.isActive) return [];
        return [{ id: opaque("purchase", order.id), kind: "purchase" as const, at: order.updatedAt.toISOString(), product: product.title }];
      }),
    ];
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }
}
