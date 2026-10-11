import { ConflictException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import type { Writable } from "stream";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ObjectStorageService } from "../ingestion/object-storage.service";
import { TarWriter } from "./tar-writer";

const README = `پشتیبان کامل سایت کنکور کامپیوتر

database.sql.gz  همهٔ دیتابیس (کاربران، سفارش‌ها، سؤال‌ها، آزمون‌ها، مقاله‌ها و ...) با pg_dump
media/           همهٔ فایل‌های ذخیره‌شده (تصویرها، جزوه‌ها، ویدیوهای آپلودی، فایل‌های ورود داده)
manifest.json    زمان پشتیبان، آخرین مهاجرت دیتابیس و فهرست فایل‌ها

بازگردانی روی سرور:
  ops/restore.sh database.sql.gz
  و محتوای پوشهٔ media را با mc mirror به باکت konkurcom-media برگردانید.

رمزها و کلیدهای فایل .env سرور در این پشتیبان نیستند؛ آن‌ها را جدا نگه دارید.
این فایل اطلاعات شخصی کاربران را دارد؛ آن را جای امن نگه دارید و برای کسی نفرستید.
`;

/**
 * A full backup as one tar: the database dumped with pg_dump (restorable with
 * ops/restore.sh) and every object in storage. Streamed, so its size is
 * bounded by the disk the dump goes to, not by memory.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly audit: AuditService,
  ) {}

  /** Dumps the database first, so a failure is a proper error rather than a broken download. */
  async prepare(actorId: string) {
    if (this.running) throw new ConflictException("یک پشتیبان‌گیری دیگر در حال انجام است؛ چند دقیقهٔ دیگر دوباره امتحان کن.");
    this.running = true;
    const dir = await fs.mkdtemp(join(tmpdir(), "backup-"));
    try {
      const dumpPath = join(dir, "database.sql.gz");
      await this.dumpDatabase(dumpPath);
      const objects = await this.storage.listAll();
      const migration = await this.prisma.$queryRaw<{ migration_name: string }[]>`
        SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
      await this.audit.log({
        actorUserId: actorId,
        action: "backup.downloaded",
        targetType: "Site",
        targetId: "backup",
        metadata: { objects: objects.length, bytes: objects.reduce((sum, item) => sum + item.size, 0) },
      });
      return { dir, dumpPath, objects, migration: migration[0]?.migration_name ?? null };
    } catch (error) {
      await this.release(dir);
      throw error;
    }
  }

  async write(out: Writable, prepared: Awaited<ReturnType<BackupService["prepare"]>>) {
    const tar = new TarWriter(out);
    const createdAt = new Date();
    const skipped: string[] = [];
    try {
      await tar.addBuffer("README.txt", Buffer.from(README, "utf8"), createdAt);
      const dumpSize = (await fs.stat(prepared.dumpPath)).size;
      await tar.addStream("database.sql.gz", dumpSize, createReadStream(prepared.dumpPath), createdAt);
      for (const object of prepared.objects) {
        // An object deleted since the listing is noted, not fatal.
        const stream = await this.storage.getObjectStream(object.key).catch(() => null);
        if (!stream) {
          skipped.push(object.key);
          continue;
        }
        await tar.addStream(`media/${object.key}`, object.size, stream, object.lastModified);
      }
      const manifest = {
        site: "kunkurcomputer.ir",
        createdAt: createdAt.toISOString(),
        lastMigration: prepared.migration,
        database: { file: "database.sql.gz", bytes: dumpSize, format: "pg_dump plain SQL, gzip" },
        media: {
          bucket: process.env.S3_BUCKET ?? "konkurcom-media",
          objects: prepared.objects.length - skipped.length,
          bytes: prepared.objects.filter((item) => !skipped.includes(item.key)).reduce((sum, item) => sum + item.size, 0),
          skipped,
        },
      };
      await tar.addBuffer("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"), createdAt);
      await tar.finish();
    } finally {
      await this.release(prepared.dir);
    }
  }

  private async release(dir: string) {
    this.running = false;
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  private async dumpDatabase(path: string) {
    const url = new URL(process.env.DATABASE_URL ?? "");
    const args = ["--no-password", "-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", url.pathname.slice(1)];
    // The password goes in the environment, never the command line other processes can read.
    const child = spawn(process.env.PG_DUMP_BIN ?? "pg_dump", args, {
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));
    const exited = new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
    try {
      await pipeline(child.stdout, createGzip({ level: 6 }), createWriteStream(path, { mode: 0o600 }));
      const code = await exited;
      if (code !== 0) throw new Error(`pg_dump exited ${code}: ${stderr}`);
    } catch (error) {
      this.logger.error(`database dump failed: ${(error as Error).message}`);
      throw new InternalServerErrorException("گرفتن نسخهٔ دیتابیس ممکن نشد.");
    }
  }
}
