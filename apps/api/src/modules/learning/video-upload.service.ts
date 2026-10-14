import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { LearningService, MAX_LESSON_VIDEO_BYTES } from "./learning.service";

/** Each piece is a short request: at a slow upload (~250 KB/s) about half a
 * minute, well inside what the CDN lets one request take. */
export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;
/** An upload nobody finished is cleared after a day. */
const STALE_MS = 24 * 60 * 60 * 1000;
/** A video still "processing" this long after it was completed was cut off
 * by a restart; it is reported failed so the operator can upload again. */
const PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;

type UploadStatus = "uploading" | "processing" | "done" | "failed";

interface UploadMeta {
  id: string;
  userId: string;
  size: number;
  chunks: number;
  received: number[];
  status: UploadStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

/**
 * Lesson videos uploaded in pieces. A video of a few hundred megabytes on a
 * slow connection takes many minutes in one request, and the CDN in front of
 * the site cuts such a request off -- the operator only saw "upload failed".
 * In pieces, every request is short, a failed piece is simply sent again, and
 * the slow work (MP4 fast-start, hashing, storing) runs after the last piece
 * while the page asks how it is going.
 */
@Injectable()
export class VideoUploadService {
  private readonly logger = new Logger(VideoUploadService.name);
  private readonly dir = join(tmpdir(), "kc-video-uploads");

  constructor(private readonly learning: LearningService) {}

  private dataPath(id: string) {
    return join(this.dir, `${id}.part`);
  }

  private metaPath(id: string) {
    return join(this.dir, `${id}.json`);
  }

  private async readMeta(userId: string, id: string): Promise<UploadMeta> {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new NotFoundException("upload not found");
    const raw = await fs.readFile(this.metaPath(id), "utf8").catch(() => null);
    if (!raw) throw new NotFoundException("upload not found");
    const meta = JSON.parse(raw) as UploadMeta;
    if (meta.userId !== userId) throw new ForbiddenException("not your upload");
    return meta;
  }

  /** Written aside and renamed into place: a status read while the record is
   * being rewritten would otherwise find it empty and answer "not found". */
  private async writeMeta(meta: UploadMeta) {
    const temp = `${this.metaPath(meta.id)}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(meta));
    await fs.rename(temp, this.metaPath(meta.id));
  }

  /** Clears uploads left unfinished for a day, with their partial files. */
  private async purgeStale() {
    const names = await fs.readdir(this.dir).catch(() => [] as string[]);
    const now = Date.now();
    for (const name of names) {
      const path = join(this.dir, name);
      const stat = await fs.stat(path).catch(() => null);
      if (stat && now - stat.mtimeMs > STALE_MS) await fs.rm(path, { force: true });
    }
  }

  async start(userId: string, size: number) {
    if (!Number.isInteger(size) || size <= 0) throw new BadRequestException("video size is required");
    if (size > MAX_LESSON_VIDEO_BYTES) throw new BadRequestException("video must be 300 MB or smaller");
    await fs.mkdir(this.dir, { recursive: true });
    await this.purgeStale();
    const id = randomUUID();
    const handle = await fs.open(this.dataPath(id), "w");
    await handle.truncate(size);
    await handle.close();
    const meta: UploadMeta = {
      id,
      userId,
      size,
      chunks: Math.ceil(size / VIDEO_CHUNK_BYTES),
      received: [],
      status: "uploading",
      createdAt: Date.now(),
    };
    await this.writeMeta(meta);
    return { uploadId: id, chunkBytes: VIDEO_CHUNK_BYTES, chunks: meta.chunks };
  }

  /** Writes one piece in its place. Sending the same piece again is harmless. */
  async putChunk(userId: string, id: string, index: number, data: Buffer | undefined) {
    const meta = await this.readMeta(userId, id);
    if (meta.status !== "uploading") throw new BadRequestException("this upload is already complete");
    if (!Number.isInteger(index) || index < 0 || index >= meta.chunks) throw new BadRequestException("no such piece");
    const expected = Math.min(VIDEO_CHUNK_BYTES, meta.size - index * VIDEO_CHUNK_BYTES);
    if (!data || data.length !== expected) throw new BadRequestException(`piece ${index} must be ${expected} bytes`);
    const handle = await fs.open(this.dataPath(id), "r+");
    try {
      await handle.write(data, 0, data.length, index * VIDEO_CHUNK_BYTES);
    } finally {
      await handle.close();
    }
    // Re-read: the file on disk is the record, not what this request started with.
    const current = await this.readMeta(userId, id);
    if (!current.received.includes(index)) current.received.push(index);
    await this.writeMeta(current);
    return { received: current.received.length, chunks: current.chunks };
  }

  /** All pieces are in: the video is checked and stored in the background. */
  async complete(userId: string, id: string) {
    const meta = await this.readMeta(userId, id);
    if (meta.status !== "uploading") return this.status(userId, id);
    const missing = Array.from({ length: meta.chunks }, (_, index) => index).filter((index) => !meta.received.includes(index));
    if (missing.length > 0) throw new BadRequestException(`pieces still missing: ${missing.slice(0, 10).join(", ")}`);
    meta.status = "processing";
    meta.completedAt = Date.now();
    await this.writeMeta(meta);

    void this.learning
      .storeLessonVideo(userId, this.dataPath(id))
      .then(async (result) => {
        await this.writeMeta({ ...meta, status: "done", result });
      })
      .catch(async (error: unknown) => {
        const message = error instanceof HttpException ? String((error.getResponse() as { message?: unknown }).message ?? error.message) : "processing the video failed";
        if (!(error instanceof HttpException)) this.logger.error(`lesson video ${id} failed: ${String(error)}`);
        await this.writeMeta({ ...meta, status: "failed", error: message });
      })
      .finally(async () => {
        await fs.rm(this.dataPath(id), { force: true });
      });
    return { status: "processing" as const };
  }

  async status(userId: string, id: string) {
    const meta = await this.readMeta(userId, id);
    if (meta.status === "processing" && meta.completedAt && Date.now() - meta.completedAt > PROCESSING_TIMEOUT_MS) {
      return { status: "failed" as const, error: "processing the video was interrupted; upload it again" };
    }
    return {
      status: meta.status,
      received: meta.received.length,
      chunks: meta.chunks,
      ...(meta.result ? { result: meta.result } : {}),
      ...(meta.error ? { error: meta.error } : {}),
    };
  }
}
