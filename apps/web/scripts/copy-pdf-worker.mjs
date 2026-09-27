// pdf.js renders PDFs off the main thread in a worker, which the browser loads
// as a plain file, along with the standard fonts and character maps a PDF may
// rely on without embedding them. All of it is copied from the installed
// package on every build, so it always matches the library version and never
// has to be committed.
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pdfjs");
mkdirSync(target, { recursive: true });
copyFileSync(join(packageRoot, "legacy", "build", "pdf.worker.min.mjs"), join(target, "pdf.worker.min.mjs"));
cpSync(join(packageRoot, "standard_fonts"), join(target, "standard_fonts"), { recursive: true });
cpSync(join(packageRoot, "cmaps"), join(target, "cmaps"), { recursive: true });
console.log(`pdf.js worker, fonts and cmaps copied to ${target}`);
