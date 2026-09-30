import "reflect-metadata";
import { Readable } from "stream";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { PDFDocument } from "pdf-lib";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { ObjectStorageService } from "../src/modules/ingestion/object-storage.service";
import { SEALED_MIME, unseal } from "../src/modules/content/pdf-watermark";
import { PrismaService } from "../src/prisma/prisma.service";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";
import { purchaseProduct } from "./helpers/purchase";

class CapturingOtpProvider implements OtpProvider {
  sent: { phone: string; code: string }[] = [];

  async send(phone: string, code: string) {
    this.sent.push({ phone, code });
  }
}

/** Object storage kept in memory, so the test can see what was written. */
class MemoryObjectStorage {
  objects = new Map<string, Buffer>();
  puts: string[] = [];

  async putObject(key: string, buffer: Buffer) {
    this.puts.push(key);
    this.objects.set(key, Buffer.from(buffer));
  }

  async objectExists(key: string) {
    return this.objects.has(key);
  }

  async getObjectStream(key: string) {
    const object = this.objects.get(key);
    if (!object) throw new Error(`missing object ${key}`);
    return Readable.from(object);
  }
}

async function samplePdf(pages: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([595, 842]).drawText(`Operating systems handout, page ${i + 1}`, { x: 60, y: 760, size: 14 });
  return Buffer.from(await doc.save());
}

function binary(res: request.Response, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("Sold handouts: upload, watermarked personal copies (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: CapturingOtpProvider;
  let storage: MemoryObjectStorage;
  let adminCookie: string;
  let suffix: string;

  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    otp = new CapturingOtpProvider();
    storage = new MemoryObjectStorage();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otp)
      .overrideProvider(ObjectStorageService)
      .useValue(storage)
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

  function randomPhone() {
    return `0915${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  }

  it("accepts only readable, unencrypted PDFs, and only from staff", async () => {
    const studentCookie = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/admin/resource-files")
      .set("Cookie", studentCookie)
      .attach("file", await samplePdf(1), "note.pdf")
      .expect(403);

    const notPdf = await request(app.getHttpServer())
      .post("/admin/resource-files")
      .set("Cookie", adminCookie)
      .attach("file", Buffer.from("just some text"), "note.pdf")
      .expect(400);
    expect(notPdf.body.message).toContain("PDF");

    await request(app.getHttpServer())
      .post("/admin/resource-files")
      .set("Cookie", adminCookie)
      .attach("file", Buffer.from("%PDF-1.7 broken"), "broken.pdf")
      .expect(400);
  });

  it("gives each buyer their own stamped copy and nobody else the file", async () => {
    const original = await samplePdf(3);
    const uploaded = await request(app.getHttpServer())
      .post("/admin/resource-files")
      .set("Cookie", adminCookie)
      .attach("file", original, `os-handout-${suffix}.pdf`)
      .expect(201);
    expect(uploaded.body).toMatchObject({ pages: 3, size: original.length });

    const source = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: `handout-source-${suffix}`,
        kind: "FIRST_PARTY_FILE",
        title: "Own handout",
        publisher: "kunkurcomputer",
        canonicalUrl: `https://kunkurcomputer.ir/source/handout-${suffix}`,
        sourceTier: "FIRST_PARTY",
        checkedAt: new Date().toISOString(),
        rightsHolder: "kunkurcomputer",
        rightsBasis: "USER_DECLARATION",
        mayLink: true,
        mayEmbed: false,
        mayHost: true,
        mayReproduce: true,
        commercialUseAllowed: true,
      })
      .expect(201);

    const resource = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send({
        externalId: `handout-${suffix}`,
        slug: `handout-${suffix}`,
        title: "Operating systems handout",
        summary: "A sold handout, read in the student panel.",
        kind: "NOTE",
        accessMode: "ENTITLEMENT",
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: uploaded.body.id,
        sources: [{ sourceId: source.body.id, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${resource.body.id}/submit`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${resource.body.id}/approve`).set("Cookie", adminCookie).expect(201);

    const product = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({ slug: `handout-product-${suffix}`, title: "OS handout", description: "Handout", kind: "RESOURCE", resourceIds: [resource.body.id] })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/products/${product.body.id}/prices`).set("Cookie", adminCookie).send({ amountRial: 1_500_000 }).expect(201);

    const contentPath = `/resources/${resource.body.slug}/content`;
    const anonymous = await request(app.getHttpServer()).get(contentPath);
    expect(anonymous.status).not.toBe(200);

    const buyerPhone = randomPhone();
    const buyerCookie = await login(buyerPhone);
    const beforePurchase = await request(app.getHttpServer()).get(contentPath).set("Cookie", buyerCookie);
    expect(beforePurchase.status).not.toBe(200);

    await purchaseProduct(app, { buyerCookie, adminCookie, productId: product.body.id });

    const first = await request(app.getHttpServer()).get(contentPath).set("Cookie", buyerCookie).buffer(true).parse(binary).expect(200);
    // Sealed for the panel reader: not a PDF, no filename, not cacheable.
    expect(first.headers["content-type"]).toContain(SEALED_MIME);
    expect(first.headers["content-disposition"]).toBeUndefined();
    expect(first.headers["cache-control"]).toContain("no-store");
    expect((first.body as Buffer).subarray(0, 5).toString("latin1")).not.toBe("%PDF-");
    const copy = unseal(first.body as Buffer);
    expect(copy.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(copy.equals(original)).toBe(false);
    const stamped = await PDFDocument.load(copy);
    expect(stamped.getPageCount()).toBe(3);
    const subject = stamped.getSubject() ?? "";
    expect(subject).toContain(buyerPhone);
    const copyCode = subject.match(/Licensed copy ([0-9A-F]{8})/)?.[1];
    expect(copyCode).toBeDefined();

    // The stamped copy is made once and then served from storage.
    const writes = storage.puts.length;

    const again = await request(app.getHttpServer()).get(contentPath).set("Cookie", buyerCookie).buffer(true).parse(binary).expect(200);
    expect(unseal(again.body as Buffer).equals(copy)).toBe(true);
    expect(storage.puts.length).toBe(writes);

    // A reader that already holds this version gets an empty answer, after the
    // same access check; someone without access is refused even with it.
    const version = first.headers["x-content-version"];
    expect(version).toBeTruthy();
    const unchanged = await request(app.getHttpServer()).get(contentPath).set("Cookie", buyerCookie).set("X-Have-Version", version);
    expect(unchanged.status).toBe(204);
    expect(unchanged.headers["cache-control"]).toContain("no-store");
    const stale = await request(app.getHttpServer()).get(contentPath).set("Cookie", buyerCookie).set("X-Have-Version", "sha256:old").buffer(true).parse(binary).expect(200);
    expect(unseal(stale.body as Buffer).equals(copy)).toBe(true);
    const outsider = await request(app.getHttpServer()).get(contentPath).set("Cookie", await login(randomPhone())).set("X-Have-Version", version);
    expect(outsider.status).toBe(403);
    const stranger = await request(app.getHttpServer()).get(contentPath).set("X-Have-Version", version);
    expect([401, 403]).toContain(stranger.status);

    const otherPhone = randomPhone();
    const otherCookie = await login(otherPhone);
    await purchaseProduct(app, { buyerCookie: otherCookie, adminCookie, productId: product.body.id });
    // Another buyer gets a copy carrying their own number, not the first one's.
    const other = await request(app.getHttpServer()).get(contentPath).set("Cookie", otherCookie).buffer(true).parse(binary).expect(200);
    const otherSubject = (await PDFDocument.load(unseal(other.body as Buffer))).getSubject() ?? "";
    expect(otherSubject).toContain(otherPhone);
    expect(otherSubject).not.toContain(buyerPhone);
    // ...and their copy's version is not the first buyer's.
    expect(other.headers["x-content-version"]).not.toBe(version);

    const opened = await prisma.auditLog.findMany({ where: { action: "resource.document_opened", targetId: resource.body.id } });
    expect(opened.length).toBe(5);
    expect(opened.map((entry) => (entry.metadata as { copyCode?: string }).copyCode)).toContain(copyCode);
  });
  /** Uploads a PDF and publishes it as a resource with the given access. */
  async function publishHandout(label: string, accessMode: "ENTITLEMENT" | "ACCOUNT" | "PUBLIC") {
    const uploaded = await request(app.getHttpServer())
      .post("/admin/resource-files")
      .set("Cookie", adminCookie)
      .attach("file", await samplePdf(2), `${label}-${suffix}.pdf`)
      .expect(201);
    const source = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: `${label}-source-${suffix}`,
        kind: "FIRST_PARTY_FILE",
        title: "Own handout",
        publisher: "kunkurcomputer",
        canonicalUrl: `https://kunkurcomputer.ir/source/${label}-${suffix}`,
        sourceTier: "FIRST_PARTY",
        checkedAt: new Date().toISOString(),
        rightsHolder: "kunkurcomputer",
        rightsBasis: "USER_DECLARATION",
        mayLink: true,
        mayEmbed: false,
        mayHost: true,
        mayReproduce: true,
        commercialUseAllowed: true,
      })
      .expect(201);
    const resource = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send({
        externalId: `${label}-${suffix}`,
        slug: `${label}-${suffix}`,
        title: `Handout ${label}`,
        summary: "A course handout.",
        kind: "NOTE",
        accessMode,
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: uploaded.body.id,
        sources: [{ sourceId: source.body.id, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${resource.body.id}/submit`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post(`/admin/resources/${resource.body.id}/approve`).set("Cookie", adminCookie).expect(201);
    return resource.body as { id: string; slug: string };
  }

  it("opens a course's handouts to whoever gets the course, directly or in a bundle", async () => {
    const handout = await publishHandout("course-handout", "ENTITLEMENT");
    const freeHandout = await publishHandout("course-free-handout", "PUBLIC");

    const course = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: `handout-course-${suffix}`, title: "Test-solving course", description: "Lessons with handouts." })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/courses/${course.body.id}/publish`).set("Cookie", adminCookie).expect(201);

    // A free-to-all file is refused: course buyers read handouts in the panel.
    await request(app.getHttpServer())
      .put(`/admin/courses/${course.body.id}/materials`)
      .set("Cookie", adminCookie)
      .send({ resourceIds: [freeHandout.id] })
      .expect(400);
    const set = await request(app.getHttpServer())
      .put(`/admin/courses/${course.body.id}/materials`)
      .set("Cookie", adminCookie)
      .send({ resourceIds: [handout.id] })
      .expect(200);
    expect(set.body.map((row: { id: string }) => row.id)).toEqual([handout.id]);

    // The public syllabus lists the handout by title, and the handout names the course.
    const syllabus = await request(app.getHttpServer()).get(`/courses/${course.body.slug}`).expect(200);
    expect(syllabus.body.materials).toEqual([expect.objectContaining({ slug: handout.slug })]);
    expect(syllabus.body.materials[0]).not.toHaveProperty("sourceArtifactId");
    const detail = await request(app.getHttpServer()).get(`/resources/${handout.slug}`).expect(200);
    expect(detail.body.courses).toEqual([{ slug: course.body.slug, title: "Test-solving course" }]);

    const courseProduct = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({ slug: `handout-course-product-${suffix}`, title: "Course", description: "Course", kind: "COURSE", courseId: course.body.id })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/products/${courseProduct.body.id}/prices`).set("Cookie", adminCookie).send({ amountRial: 9_000_000 }).expect(201);
    const otherCourse = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: `handout-other-course-${suffix}`, title: "Other course", description: "No handouts." })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/courses/${otherCourse.body.id}/publish`).set("Cookie", adminCookie).expect(201);
    const bundle = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({ slug: `handout-bundle-${suffix}`, title: "Bundle", description: "Bundle", kind: "BUNDLE", courseIds: [course.body.id, otherCourse.body.id] })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/products/${bundle.body.id}/prices`).set("Cookie", adminCookie).send({ amountRial: 12_000_000 }).expect(201);

    const contentPath = `/resources/${handout.slug}/content`;
    const outsider = await login(randomPhone());
    await request(app.getHttpServer()).get(contentPath).set("Cookie", outsider).expect(403);

    for (const productId of [courseProduct.body.id, bundle.body.id]) {
      const buyer = await login(randomPhone());
      await request(app.getHttpServer()).get(contentPath).set("Cookie", buyer).expect(403);
      await purchaseProduct(app, { buyerCookie: buyer, adminCookie, productId });
      const copy = await request(app.getHttpServer()).get(contentPath).set("Cookie", buyer).buffer(true).parse(binary).expect(200);
      expect(copy.headers["content-type"]).toContain(SEALED_MIME);
      expect((await PDFDocument.load(unseal(copy.body as Buffer))).getPageCount()).toBe(2);
      const library = await request(app.getHttpServer()).get("/me/library").set("Cookie", buyer).expect(200);
      expect(library.body.resources).toEqual([
        expect.objectContaining({ slug: handout.slug, course: { slug: course.body.slug, title: "Test-solving course" } }),
      ]);
    }

    // Taking the handout off the course takes it away from course buyers.
    await request(app.getHttpServer()).put(`/admin/courses/${course.body.id}/materials`).set("Cookie", adminCookie).send({ resourceIds: [] }).expect(200);
    const lateBuyer = await login(randomPhone());
    await purchaseProduct(app, { buyerCookie: lateBuyer, adminCookie, productId: courseProduct.body.id });
    await request(app.getHttpServer()).get(contentPath).set("Cookie", lateBuyer).expect(403);
  });

  it("links a paid handout to a free sample any signed-in student can read", async () => {
    const paid = await publishHandout("sampled-handout", "ENTITLEMENT");
    const sample = await publishHandout("sampled-handout-free", "ACCOUNT");
    const otherPaid = await publishHandout("sampled-handout-other", "ENTITLEMENT");

    // A paid resource is not a sample, nor is the handout itself.
    await request(app.getHttpServer()).put(`/admin/resources/${paid.id}/sample`).set("Cookie", adminCookie).send({ sampleResourceId: otherPaid.id }).expect(400);
    await request(app.getHttpServer()).put(`/admin/resources/${paid.id}/sample`).set("Cookie", adminCookie).send({ sampleResourceId: paid.id }).expect(400);
    await request(app.getHttpServer()).put(`/admin/resources/${paid.id}/sample`).set("Cookie", adminCookie).send({ sampleResourceId: sample.id }).expect(200);

    const paidPage = await request(app.getHttpServer()).get(`/resources/${paid.slug}`).expect(200);
    expect(paidPage.body.sample).toEqual({ slug: sample.slug, title: "Handout sampled-handout-free" });
    expect(paidPage.body.canAccess).toBe(false);
    const samplePage = await request(app.getHttpServer()).get(`/resources/${sample.slug}`).expect(200);
    expect(samplePage.body.sampleFor).toEqual([{ slug: paid.slug, title: "Handout sampled-handout" }]);

    // Free to any signed-in student, stamped and sealed like a sold copy; the paid one stays closed.
    await request(app.getHttpServer()).get(`/resources/${sample.slug}/content`).expect(401);
    const student = await login(randomPhone());
    const copy = await request(app.getHttpServer()).get(`/resources/${sample.slug}/content`).set("Cookie", student).buffer(true).parse(binary).expect(200);
    expect(copy.headers["content-type"]).toContain(SEALED_MIME);
    expect((await PDFDocument.load(unseal(copy.body as Buffer))).getPageCount()).toBe(2);
    await request(app.getHttpServer()).get(`/resources/${paid.slug}/content`).set("Cookie", student).expect(403);

    await request(app.getHttpServer()).put(`/admin/resources/${paid.id}/sample`).set("Cookie", adminCookie).send({ sampleResourceId: null }).expect(200);
    expect((await request(app.getHttpServer()).get(`/resources/${paid.slug}`).expect(200)).body.sample).toBeNull();
  });
});
