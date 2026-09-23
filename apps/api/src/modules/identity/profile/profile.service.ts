import { ForbiddenException, Injectable } from "@nestjs/common";
import { Degree, EducationStatus, Profile } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { UpdateProfileDto } from "./update-profile.dto";

/** What a student must have told us before they can start an exam. */
export const REQUIRED_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "educationStatus",
  "universityName",
  "fieldOfStudy",
  "targetDegree",
  "targetField",
] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number];

export function profileCompletion(profile: Pick<Profile, RequiredProfileField>) {
  const missing = REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = profile[field];
    return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
  });
  return {
    complete: missing.length === 0,
    missing,
    percent: Math.round(((REQUIRED_PROFILE_FIELDS.length - missing.length) / REQUIRED_PROFILE_FIELDS.length) * 100),
  };
}

/**
 * Persian text typed on an Arabic keyboard layout arrives with Arabic yeh and
 * kaf, which look the same but compare unequal -- "علي" would never match
 * "علی" in a search or a report. Normalised on the way in, and trimmed, with
 * runs of spaces collapsed.
 */
function normalizeText(value: string | undefined) {
  if (value === undefined) return undefined;
  return value.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    const profile =
      (await this.prisma.profile.findUnique({ where: { userId } })) ??
      (await this.prisma.profile.create({ data: { userId } }));
    return { ...profile, completion: profileCompletion(profile) };
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const firstName = normalizeText(dto.firstName);
    const lastName = normalizeText(dto.lastName);
    const data = {
      displayName: normalizeText(dto.displayName),
      firstName,
      lastName,
      educationStatus: dto.educationStatus as EducationStatus | undefined,
      universityName: normalizeText(dto.universityName),
      fieldOfStudy: normalizeText(dto.fieldOfStudy),
      entryYear: dto.entryYear,
      graduationYear: dto.graduationYear,
      gpa: dto.gpa,
      targetDegree: dto.targetDegree as Degree | undefined,
      targetField: normalizeText(dto.targetField),
      targetExamYear: dto.targetExamYear,
    };

    const saved = await this.prisma.$transaction(async (tx) => {
      let profile = await tx.profile.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
      // The name the rest of the product shows (payment review, consultation
      // requests) follows the real name once the student has given one.
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
      const followUp: { displayName?: string; completedAt?: Date } = {};
      if (fullName && dto.displayName === undefined && profile.displayName !== fullName) {
        followUp.displayName = fullName;
      }
      if (profileCompletion(profile).complete && !profile.completedAt) followUp.completedAt = new Date();
      if (Object.keys(followUp).length > 0) {
        profile = await tx.profile.update({ where: { userId }, data: followUp });
      }
      return profile;
    });
    return { ...saved, completion: profileCompletion(saved) };
  }

  /**
   * Called before an exam attempt starts. A report card belongs to a named
   * person with a known background; an anonymous attempt cannot be ranked,
   * compared or discussed with them later. The error names the missing
   * fields so the client can send the student straight to them.
   */
  async assertExamReady(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const completion = profileCompletion(
      profile ?? {
        firstName: null,
        lastName: null,
        educationStatus: null,
        universityName: null,
        fieldOfStudy: null,
        targetDegree: null,
        targetField: null,
      },
    );
    if (!completion.complete) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "PROFILE_INCOMPLETE",
        message: "complete your profile (name and education) before starting an exam",
        missing: completion.missing,
      });
    }
  }
}
