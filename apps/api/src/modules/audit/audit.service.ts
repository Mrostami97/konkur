import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    await db.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata ?? undefined,
      },
    });
  }
}
