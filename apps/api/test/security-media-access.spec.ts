import { NotFoundException } from "@nestjs/common";
import { AccessMode, Role } from "@prisma/client";
import type { Response } from "express";
import { PassThrough, Readable } from "node:stream";
import { PrismaService } from "../src/prisma/prisma.service";
import { AccessService } from "../src/modules/access/access.service";
import { RequestWithUser } from "../src/modules/identity/guards/session-auth.guard";
import { MediaController } from "../src/modules/ingestion/media.controller";
import { ObjectStorageService } from "../src/modules/ingestion/object-storage.service";

const checksum = "a".repeat(64);
const student = { id: "student", phone: "synthetic", roles: [Role.STUDENT] };

function fixture() {
  const artifact = { id: "artifact", storageKey: "digest/lesson-video.mp4", mimeType: "video/mp4", size: 4, resources: [] as { id: string }[] };
  const prisma = {
    sourceArtifact: { findUnique: jest.fn().mockResolvedValue(artifact) },
    contentVersion: { findFirst: jest.fn().mockResolvedValue(null) },
    auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
    studentAchievement: { findMany: jest.fn().mockResolvedValue([]) },
    article: { findFirst: jest.fn().mockResolvedValue(null) },
    question: { findMany: jest.fn().mockResolvedValue([]) },
    lesson: { findMany: jest.fn().mockResolvedValue([]) },
    attempt: { findFirst: jest.fn().mockResolvedValue(null) },
    course: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const storage = { getObjectStream: jest.fn().mockImplementation(async () => Readable.from([Buffer.from("TEST")])), getRangeStream: jest.fn().mockImplementation(async () => Readable.from([Buffer.from("ES")])) };
  const access = { accessibleQuestionBankSubjects: jest.fn().mockResolvedValue(new Set()), hasActiveCourseAccess: jest.fn().mockResolvedValue(false) };
  const controller = new MediaController(prisma as unknown as PrismaService, storage as unknown as ObjectStorageService, access as unknown as AccessService);
  const response = new PassThrough() as PassThrough & Response;
  response.setHeader = jest.fn().mockReturnValue(response);
  response.status = jest.fn().mockReturnValue(response);
  response.resume();
  return { artifact, prisma, storage, access, controller, response };
}

describe("Media authorization and active-content defenses", () => {
  it("rejects legacy HTML/SVG artifacts even for a staff session before storage access", async () => {
    for (const mimeType of ["text/html", "image/svg+xml", "application/xhtml+xml", "application/pdf"]) {
      const f = fixture(); f.artifact.mimeType = mimeType;
      await expect(f.controller.redirectToMedia(checksum, { user: { ...student, roles: [Role.ADMIN] }, headers: {} } as RequestWithUser, f.response)).rejects.toBeInstanceOf(NotFoundException);
      expect(f.storage.getObjectStream).not.toHaveBeenCalled();
    }
  });

  it("refuses an ordinary signed-in account holding a paid lesson checksum", async () => {
    const f = fixture();
    f.prisma.lesson.findMany.mockResolvedValue([{ isPreview: false, courseModule: { course: { id: "paid-course", accessMode: AccessMode.ENTITLEMENT } } }]);
    await expect(f.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, f.response)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.access.hasActiveCourseAccess).toHaveBeenCalledWith(student.id, "paid-course");
    expect(f.storage.getObjectStream).not.toHaveBeenCalled();
  });

  it("allows a paid lesson only while the entitlement checker grants access", async () => {
    const f = fixture();
    f.prisma.lesson.findMany.mockResolvedValue([{ isPreview: false, courseModule: { course: { id: "paid-course", accessMode: AccessMode.ENTITLEMENT } } }]);
    f.access.hasActiveCourseAccess.mockResolvedValue(true);
    await f.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, f.response);
    expect(f.storage.getObjectStream).toHaveBeenCalledTimes(1);
    expect(f.response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("does not expose staged/orphan media to an ordinary account", async () => {
    const f = fixture();
    await expect(f.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, f.response)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.storage.getObjectStream).not.toHaveBeenCalled();
  });

  it("requires a session for an ACCOUNT lesson and does not treat a mentor as content staff", async () => {
    const accountLesson = { isPreview: false, courseModule: { course: { id: "account-course", accessMode: AccessMode.ACCOUNT } } };
    const anonymous = fixture(); anonymous.prisma.lesson.findMany.mockResolvedValue([accountLesson]);
    await expect(anonymous.controller.redirectToMedia(checksum, { headers: {} } as RequestWithUser, anonymous.response)).rejects.toBeInstanceOf(NotFoundException);
    const signed = fixture(); signed.prisma.lesson.findMany.mockResolvedValue([accountLesson]);
    await signed.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, signed.response);
    const mentor = fixture();
    await expect(mentor.controller.redirectToMedia(checksum, { user: { ...student, roles: [Role.MENTOR] }, headers: {} } as RequestWithUser, mentor.response)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("preserves content-staff previews without granting mixed student/staff roles access", async () => {
    const staff = fixture();
    await staff.controller.redirectToMedia(checksum, { user: { ...student, roles: [Role.REVIEWER] }, headers: {} } as RequestWithUser, staff.response);
    expect(staff.storage.getObjectStream).toHaveBeenCalledTimes(1);
    const mixed = fixture();
    await expect(mixed.controller.redirectToMedia(checksum, { user: { ...student, roles: [Role.STUDENT, Role.ADMIN] }, headers: {} } as RequestWithUser, mixed.response)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows a published article or a published public/preview lesson anonymously", async () => {
    const article = fixture(); article.prisma.article.findFirst.mockResolvedValue({ id: "public-article" });
    await article.controller.redirectToMedia(checksum, { headers: {} } as RequestWithUser, article.response);
    expect(article.prisma.article.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { reviewStatus: "PUBLISHED", assets: { array_contains: [{ checksum: `sha256:${checksum}` }] } } }));
    for (const lesson of [
      { isPreview: true, courseModule: { course: { id: "preview", accessMode: AccessMode.ENTITLEMENT } } },
      { isPreview: false, courseModule: { course: { id: "public", accessMode: AccessMode.PUBLIC } } },
    ]) {
      const f = fixture(); f.prisma.lesson.findMany.mockResolvedValue([lesson]);
      await f.controller.redirectToMedia(checksum, { headers: {} } as RequestWithUser, f.response);
      expect(f.prisma.lesson.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ courseModule: { course: { isPublished: true } } }) }));
    }
  });

  it("requires bank entitlement for a non-sample question and excludes retired public questions", async () => {
    const f = fixture(); f.prisma.question.findMany.mockResolvedValue([{ isSample: false, subjectCode: "algorithms" }]);
    await expect(f.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, f.response)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.prisma.question.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ retiredAt: null }) }));
    expect(f.access.accessibleQuestionBankSubjects).toHaveBeenCalledWith(student.id, ["algorithms"]);
    const allowed = fixture(); allowed.prisma.question.findMany.mockResolvedValue([{ isSample: false, subjectCode: "algorithms" }]);
    allowed.access.accessibleQuestionBankSubjects.mockResolvedValue(new Set(["algorithms"]));
    await allowed.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, allowed.response);
    const sample = fixture(); sample.prisma.question.findMany.mockResolvedValue([{ isSample: true, subjectCode: "algorithms" }]);
    await sample.controller.redirectToMedia(checksum, { headers: {} } as RequestWithUser, sample.response);
  });

  it("preserves owned exam imagery via form membership, including retired history", async () => {
    const f = fixture(); f.prisma.attempt.findFirst.mockResolvedValue({ id: "own-attempt" });
    await f.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, f.response);
    expect(f.prisma.attempt.findFirst).toHaveBeenCalledWith({ where: { userId: student.id, examForm: { items: { some: { question: { assets: { array_contains: [{ checksum: `sha256:${checksum}` }] } } } } } }, select: { id: true } });
  });

  it("keeps current/historical resource and withdrawn-photo protections ahead of staff previews", async () => {
    for (const kind of ["current-resource", "old-resource", "resource-audit", "photo"]) {
      const f = fixture();
      if (kind === "current-resource") f.artifact.resources = [{ id: "resource" }];
      if (kind === "old-resource") f.prisma.contentVersion.findFirst.mockResolvedValue({ id: "version" });
      if (kind === "resource-audit") f.prisma.auditLog.findFirst.mockResolvedValue({ id: "audit" });
      if (kind === "photo") { f.artifact.storageKey = "digest/achievement.png"; f.prisma.studentAchievement.findMany.mockResolvedValue([{ isPublished: false }]); }
      await expect(f.controller.redirectToMedia(checksum, { user: { ...student, roles: [Role.REVIEWER] }, headers: {} } as RequestWithUser, f.response)).rejects.toBeInstanceOf(NotFoundException);
      expect(f.storage.getObjectStream).not.toHaveBeenCalled();
    }
  });

  it("keeps published photos public and withdrawn photos visible only to an admin", async () => {
    const published = fixture(); published.artifact.storageKey = "digest/achievement.png";
    published.prisma.studentAchievement.findMany.mockResolvedValue([{ isPublished: true }]);
    await published.controller.redirectToMedia(checksum, { headers: {} } as RequestWithUser, published.response);
    const withdrawn = fixture(); withdrawn.artifact.storageKey = "digest/achievement.png";
    await withdrawn.controller.redirectToMedia(checksum, { user: { ...student, roles: [Role.ADMIN] }, headers: {} } as RequestWithUser, withdrawn.response);
  });

  it("serves a published course's cover to anyone, cached, and an unpublished one to staff only", async () => {
    const published = fixture(); published.artifact.storageKey = "digest/course-cover.png"; published.artifact.mimeType = "image/png";
    published.prisma.course.findFirst.mockResolvedValue({ id: "course" });
    await published.controller.redirectToMedia(checksum, { headers: {} } as RequestWithUser, published.response);
    expect(published.prisma.course.findFirst).toHaveBeenCalledWith({ where: { coverArtifactId: "artifact", isPublished: true }, select: { id: true } });
    expect(published.response.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=86400");
    const unpublished = fixture(); unpublished.artifact.storageKey = "digest/course-cover.png"; unpublished.artifact.mimeType = "image/png";
    await expect(unpublished.controller.redirectToMedia(checksum, { user: student, headers: {} } as RequestWithUser, unpublished.response)).rejects.toBeInstanceOf(NotFoundException);
    await unpublished.controller.redirectToMedia(checksum, { user: { ...student, roles: [Role.ADMIN] }, headers: {} } as RequestWithUser, unpublished.response);
    expect(unpublished.response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("retains byte ranges after permission checks and rejects invalid identifiers before a lookup", async () => {
    const f = fixture(); f.prisma.article.findFirst.mockResolvedValue({ id: "public-article" });
    await f.controller.redirectToMedia(checksum, { headers: { range: "bytes=1-2" } } as RequestWithUser, f.response);
    expect(f.storage.getRangeStream).toHaveBeenCalledWith(f.artifact.storageKey, 1, 2);
    expect(f.response.status).toHaveBeenCalledWith(206);
    expect(f.response.setHeader).toHaveBeenCalledWith("Content-Range", "bytes 1-2/4");
    expect(f.response.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(f.response.setHeader).toHaveBeenCalledWith("Content-Security-Policy", "default-src 'none'; sandbox");
    const invalid = fixture();
    await expect(invalid.controller.redirectToMedia("not-a-digest", { headers: {} } as RequestWithUser, invalid.response)).rejects.toBeInstanceOf(NotFoundException);
    expect(invalid.prisma.sourceArtifact.findUnique).not.toHaveBeenCalled();
  });
});
