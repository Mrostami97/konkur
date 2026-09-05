import { Injectable } from "@nestjs/common";
import { Degree } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { UpdateProfileDto } from "./update-profile.dto";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.profile.create({ data: { userId } });
  }

  async update(userId: string, dto: UpdateProfileDto) {
    return this.prisma.profile.upsert({
      where: { userId },
      update: {
        displayName: dto.displayName,
        targetDegree: dto.targetDegree as Degree | undefined,
        targetField: dto.targetField,
      },
      create: {
        userId,
        displayName: dto.displayName,
        targetDegree: dto.targetDegree as Degree | undefined,
        targetField: dto.targetField,
      },
    });
  }
}
