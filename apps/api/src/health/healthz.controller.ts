import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { ObjectStorageService } from "../modules/ingestion/object-storage.service";

// Read at runtime (not a compile-time `import ... from "../../package.json"`)
// so tsc doesn't pull package.json into its rootDir inference -- that shifted
// the whole build's output a directory deeper (dist/src/main.js instead of
// dist/main.js), breaking the Dockerfile's `node dist/main.js` CMD.
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

interface CheckResult {
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
}

/** Deep health check: reports real connectivity to every external
 * dependency the service actually has (Postgres, MinIO/S3), not just
 * "the process is running". Used by CI/deploy as a post-deploy smoke
 * check -- see .github/workflows/deploy.yml. Redis is provisioned but
 * not yet used by any code path, so it is deliberately not checked here;
 * checking it would misrepresent it as a real dependency. */
@Controller()
export class HealthzController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  @Get("healthz")
  async healthz(@Res() res: Response) {
    const [database, objectStorage] = await Promise.all([
      this.timed(() => this.prisma.$queryRaw`SELECT 1`),
      this.timed(() => this.objectStorage.ping()),
    ]);
    const checks = { database, objectStorage };
    const healthy = Object.values(checks).every((c) => c.status === "ok");

    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: healthy ? "ok" : "degraded",
      version: readVersion(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  private async timed(fn: () => Promise<unknown>): Promise<CheckResult> {
    const start = Date.now();
    try {
      await fn();
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (err) {
      return { status: "error", latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
