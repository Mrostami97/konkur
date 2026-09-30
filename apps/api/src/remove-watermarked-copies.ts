import { Client } from "minio";

// One-off cleanup: personal stamped handout copies (watermarked/...) are no
// longer served, so they only take disk space. Originals are never touched.
// Usage: node dist/remove-watermarked-copies.js [--dry-run]
const PREFIX = "watermarked/";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const bucket = process.env.S3_BUCKET ?? "konkurcom-media";
  const client = new Client({
    endPoint: process.env.S3_ENDPOINT ?? "localhost",
    port: process.env.S3_PORT ? Number(process.env.S3_PORT) : 9000,
    useSSL: process.env.S3_USE_SSL === "true",
    accessKey: process.env.S3_ACCESS_KEY ?? "konkur",
    secretKey: process.env.S3_SECRET_KEY ?? "konkur123",
  });

  const keys: string[] = [];
  let bytes = 0;
  for await (const item of client.listObjectsV2(bucket, PREFIX, true) as AsyncIterable<{ name?: string; size: number }>) {
    if (item.name?.startsWith(PREFIX)) {
      keys.push(item.name);
      bytes += item.size;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`${keys.length} stamped copies, ${(bytes / 1048576).toFixed(1)} MB${dryRun ? " (dry run, nothing removed)" : ""}`);
  if (dryRun || keys.length === 0) return;
  await client.removeObjects(bucket, keys);
  // eslint-disable-next-line no-console
  console.log("removed");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("cleanup failed", error);
  process.exitCode = 1;
});
