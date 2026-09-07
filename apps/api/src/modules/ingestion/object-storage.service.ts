import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Client } from "minio";
import type { Readable } from "stream";

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? "konkurcom-media";
    this.client = new Client({
      endPoint: process.env.S3_ENDPOINT ?? "localhost",
      port: process.env.S3_PORT ? Number(process.env.S3_PORT) : 9000,
      useSSL: process.env.S3_USE_SSL === "true",
      accessKey: process.env.S3_ACCESS_KEY ?? "konkur",
      secretKey: process.env.S3_SECRET_KEY ?? "konkur123",
    });
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.client
        .makeBucket(this.bucket)
        .then(() => this.logger.log(`Created bucket ${this.bucket}`))
        .catch((err: Error) =>
          this.logger.warn(
            `Could not create/verify bucket ${this.bucket} at startup (media upload/download will fail until this is reachable): ${err.message}`,
          ),
        );
    }
  }

  async putObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      "Content-Type": mimeType,
    });
  }

  /** Real connectivity check for /healthz -- throws if the bucket can't be
   * reached, rather than swallowing the error like onModuleInit does. */
  async ping(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) throw new Error(`bucket ${this.bucket} does not exist`);
  }

  async objectExists(key: string): Promise<boolean> {
    return this.client
      .statObject(this.bucket, key)
      .then(() => true)
      .catch(() => false);
  }

  /** Short-lived signed URL (doc §9: "Signed URL کوتاه‌عمر"); the app never
   * proxies media bytes itself, it just redirects here. */
  async presignedGetUrl(key: string, expirySeconds = 300): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  /** Protected resources are proxied by the API after an entitlement check;
   * callers never receive an object-storage URL or key. */
  async getObjectStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }
}
