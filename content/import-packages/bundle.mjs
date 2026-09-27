// Puts several built packages into one import zip, so /admin/import takes them
// in a single upload: the importer reads payload.json as an array of items that
// share one schema_version. Run after build.mjs:
//   node bundle.mjs <out.zip> <slug> <slug> ...
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const AdmZip = createRequire(`${repo}apps/api/package.json`)("adm-zip");

const [out, ...slugs] = process.argv.slice(2);
if (!out || !out.endsWith(".zip") || slugs.length === 0) {
  console.error("usage: node bundle.mjs <out.zip> <slug> <slug> ...");
  process.exit(1);
}

const items = [];
for (const slug of slugs) {
  const payload = JSON.parse(await readFile(`packages/${slug}/payload.json`, "utf8"));
  items.push(...(Array.isArray(payload) ? payload : [payload]));
}

// One import job must not hold two versions of the same article or two
// articles on one URL, and every item must use the same contract version.
const seen = new Map();
for (const item of items) {
  for (const key of [`id:${item.external_id}`, `url:${item.content_type}/${item.slug}`]) {
    if (seen.has(key)) throw new Error(`${key} appears twice (${seen.get(key)} and ${item.slug})`);
    seen.set(key, item.slug);
  }
}
const versions = new Set(items.map((item) => item.schema_version));
if (versions.size !== 1) throw new Error(`mixed schema versions: ${[...versions].join(", ")}`);

const zip = new AdmZip();
zip.addFile("payload.json", Buffer.from(JSON.stringify(items, null, 2), "utf8"));
zip.writeZip(out);
console.log(`${out}: ${items.length} items (${[...versions][0]})`);
