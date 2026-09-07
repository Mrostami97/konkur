import "reflect-metadata";
import { createHash } from "crypto";
import { Readable } from "stream";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { ObjectStorageService } from "../src/modules/ingestion/object-storage.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  sent: { phone: string; code: string }[] = [];

  async send(phone: string, code: string) {
    this.sent.push({ phone, code });
  }
}

class FakeObjectStorage {
  async getObjectStream(storageKey: string) {
    return Readable.from(Buffer.from(`protected:${storageKey}`));
  }

  async presignedGetUrl(storageKey: string) {
    return `https://objects.example.test/${encodeURIComponent(storageKey)}`;
  }
}

describe("Phase 9 resource hosting boundaries (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: CapturingOtpProvider;
  let adminCookie: string;
  let suffix: string;

  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    otp = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otp)
      .overrideProvider(ObjectStorageService)
      .useValue(new FakeObjectStorage())
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await seed();
    adminCookie = await login(SEED_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent.at(-1)!.code;
    const response = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return response.headers["set-cookie"][0] as string;
  }

  async function createSource(
    label: string,
    options: { mayHost?: boolean; mayEmbed?: boolean; rightsBasis?: string } = {},
  ) {
    const response = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: `resource-hosting-source-${label}-${suffix}`,
        kind: "FIRST_PARTY_FILE",
        title: `Resource hosting source ${label}`,
        publisher: "kunkur01",
        canonicalUrl: `https://kunkur01.ir/source/${label}-${suffix}`,
        sourceTier: "FIRST_PARTY",
        checkedAt: new Date().toISOString(),
        rightsHolder: "kunkur01",
        rightsBasis: options.rightsBasis ?? "USER_DECLARATION",
        mayLink: true,
        mayEmbed: options.mayEmbed ?? false,
        mayHost: options.mayHost ?? true,
        mayReproduce: true,
        commercialUseAllowed: true,
      })
      .expect(201);
    return response.body as { id: string };
  }

  async function createArtifact(label: string) {
    const bytes = Buffer.from(`resource-hosting-${label}-${suffix}`);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const artifact = await prisma.sourceArtifact.create({
      data: {
        checksum: `sha256:${checksum}`,
        filename: `${label}.pdf`,
        mimeType: "application/pdf",
        size: bytes.length,
        storageKey: `${checksum}/${label}.pdf`,
      },
    });
    return { ...artifact, checksumWithoutPrefix: checksum };
  }

  function resourcePayload(
    label: string,
    sourceId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      externalId: `resource-hosting-${label}-${suffix}`,
      slug: `resource-hosting-${label}-${suffix}`,
      title: `Resource hosting ${label}`,
      summary: "Regression fixture for protected resource delivery.",
      kind: "NOTE",
      accessMode: "PUBLIC",
      hostingMode: "METADATA_ONLY",
      contentBlocks: [{ type: "text", text: "Safe metadata content" }],
      sources: [{ sourceId, relation: "SUPPORTS", order: 0 }],
      ...overrides,
    };
  }

  it("only attaches artifacts in protected hosting modes with explicit documented mayHost rights", async () => {
    const validSource = await createSource("valid", { mayEmbed: true });
    const noMayHostSource = await createSource("no-may-host", { mayHost: false });
    const undocumentedSource = await createSource("undocumented", { rightsBasis: "LINK_ONLY" });
    const artifact = await createArtifact("attachment-policy");

    await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("metadata-with-artifact", validSource.id, { sourceArtifactId: artifact.id }))
      .expect(400);
    await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("external-with-artifact", validSource.id, {
        hostingMode: "EXTERNAL_LINK",
        externalUrl: "https://example.test/resource",
        sourceArtifactId: artifact.id,
      }))
      .expect(400);
    await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("embed-with-artifact", validSource.id, {
        hostingMode: "OFFICIAL_EMBED",
        externalUrl: "https://example.test/embed",
        sourceArtifactId: artifact.id,
      }))
      .expect(400);
    await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("missing-may-host", noMayHostSource.id, {
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: artifact.id,
      }))
      .expect(400);
    await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("missing-rights-basis", undocumentedSource.id, {
        hostingMode: "MIRRORED_WITH_PERMISSION",
        sourceArtifactId: artifact.id,
      }))
      .expect(400);

    const valid = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("valid-protected", validSource.id, {
        hostingMode: "MIRRORED_WITH_PERMISSION",
        sourceArtifactId: artifact.id,
      }))
      .expect(201);
    expect(valid.body).toMatchObject({ hostingMode: "MIRRORED_WITH_PERMISSION", sourceArtifactId: artifact.id });
  });

  it("supports explicit null clearing and rejects transitions that retain incompatible fields", async () => {
    const source = await createSource("transitions");
    const firstArtifact = await createArtifact("transition-first");
    const secondArtifact = await createArtifact("transition-second");
    const contributor = await request(app.getHttpServer())
      .post("/admin/contributors")
      .set("Cookie", adminCookie)
      .send({
        kind: "PERSON",
        slug: `resource-hosting-author-${suffix}`,
        displayName: "Resource hosting author",
        isPublished: false,
      })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("safe-transition", source.id, {
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: firstArtifact.id,
        authorProfileId: contributor.body.id,
      }))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/admin/resources/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ hostingMode: "EXTERNAL_LINK", externalUrl: "https://example.test/replacement" })
      .expect(400);

    const external = await request(app.getHttpServer())
      .patch(`/admin/resources/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({
        hostingMode: "EXTERNAL_LINK",
        externalUrl: "https://example.test/replacement",
        sourceArtifactId: null,
        authorProfileId: null,
      })
      .expect(200);
    expect(external.body).toMatchObject({
      hostingMode: "EXTERNAL_LINK",
      externalUrl: "https://example.test/replacement",
      sourceArtifactId: null,
      authorProfileId: null,
    });

    await request(app.getHttpServer())
      .patch(`/admin/resources/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ hostingMode: "USER_UPLOAD", sourceArtifactId: secondArtifact.id })
      .expect(400);

    const hostedAgain = await request(app.getHttpServer())
      .patch(`/admin/resources/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ hostingMode: "USER_UPLOAD", externalUrl: null, sourceArtifactId: secondArtifact.id })
      .expect(200);
    expect(hostedAgain.body).toMatchObject({
      hostingMode: "USER_UPLOAD",
      externalUrl: null,
      sourceArtifactId: secondArtifact.id,
    });

    const metadataOnly = await request(app.getHttpServer())
      .patch(`/admin/resources/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ hostingMode: "METADATA_ONLY", externalUrl: null, sourceArtifactId: null, authorProfileId: null })
      .expect(200);
    expect(metadataOnly.body).toMatchObject({
      hostingMode: "METADATA_ONLY",
      externalUrl: null,
      sourceArtifactId: null,
      authorProfileId: null,
    });
    const stored = await prisma.resource.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored).toMatchObject({
      hostingMode: "METADATA_ONLY",
      externalUrl: null,
      sourceArtifactId: null,
      authorProfileId: null,
    });
    await request(app.getHttpServer()).get(`/media/${firstArtifact.checksumWithoutPrefix}`).expect(404);
    await request(app.getHttpServer()).get(`/media/${secondArtifact.checksumWithoutPrefix}`).expect(404);
  });

  it("streams protected content only while its source still grants documented hosting rights", async () => {
    const source = await createSource("delivery");
    const artifact = await createArtifact("delivery");
    const created = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("delivery", source.id, {
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: artifact.id,
      }))
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${created.body.id}/submit`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${created.body.id}/approve`).set("Cookie", adminCookie).expect(201);

    const delivered = await request(app.getHttpServer()).get(`/resources/${created.body.slug}/content`).expect(200);
    expect(delivered.headers["content-disposition"]).toContain("inline");
    expect(Buffer.from(delivered.body).toString("utf8")).toContain("protected:");
    await request(app.getHttpServer()).get(`/media/${artifact.checksumWithoutPrefix}`).expect(404);

    await request(app.getHttpServer())
      .patch(`/admin/content-sources/${source.id}`)
      .set("Cookie", adminCookie)
      .send({ mayHost: false })
      .expect(200);
    await request(app.getHttpServer()).get(`/resources/${created.body.slug}/content`).expect(404);

    await prisma.resource.update({
      where: { id: created.body.id },
      data: { hostingMode: "EXTERNAL_LINK" },
    });
    await request(app.getHttpServer()).get(`/resources/${created.body.slug}/content`).expect(404);
  });

  it("promotes an explicit artifact clear through a published revision without reopening its checksum", async () => {
    const source = await createSource("published-transition");
    const artifact = await createArtifact("published-transition");
    const created = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("published-transition", source.id, {
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: artifact.id,
      }))
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${created.body.id}/submit`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${created.body.id}/approve`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${created.body.id}/revise`).set("Cookie", adminCookie).expect(201);

    const pending = await request(app.getHttpServer())
      .patch(`/admin/resources/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ hostingMode: "METADATA_ONLY", externalUrl: null, sourceArtifactId: null })
      .expect(200);
    expect(pending.body).toMatchObject({ version: 2, reviewStatus: "DRAFT", sourceArtifactId: null });

    // Until approval, the published canonical version remains the live one.
    await request(app.getHttpServer()).get(`/resources/${created.body.slug}/content`).expect(200);
    await request(app.getHttpServer()).post(`/admin/resources/${created.body.id}/submit`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${created.body.id}/approve`).set("Cookie", adminCookie).expect(201);

    const canonical = await prisma.resource.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(canonical).toMatchObject({ version: 2, hostingMode: "METADATA_ONLY", sourceArtifactId: null });
    const versions = await prisma.contentVersion.findMany({
      where: { entityType: "RESOURCE", entityId: created.body.id },
      orderBy: { version: "asc" },
    });
    expect((versions[0].payload as { source_artifact_id: string | null }).source_artifact_id).toBe(artifact.id);
    expect((versions[1].payload as { source_artifact_id: string | null }).source_artifact_id).toBeNull();
    await request(app.getHttpServer()).get(`/media/${artifact.checksumWithoutPrefix}`).expect(404);
  });

  it("denies raw checksums for version-only references while preserving unrelated media redirects", async () => {
    const source = await createSource("version-only");
    const referencedArtifact = await createArtifact("version-only");
    const unrelatedArtifact = await createArtifact("unrelated");
    const created = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send(resourcePayload("version-only", source.id, {
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: referencedArtifact.id,
      }))
      .expect(201);

    await prisma.resource.update({
      where: { id: created.body.id },
      data: { hostingMode: "METADATA_ONLY", sourceArtifactId: null },
    });
    await request(app.getHttpServer()).get(`/media/${referencedArtifact.checksumWithoutPrefix}`).expect(404);
    const redirect = await request(app.getHttpServer()).get(`/media/${unrelatedArtifact.checksumWithoutPrefix}`).redirects(0);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toContain("objects.example.test");
  });
});
