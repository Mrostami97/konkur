import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import { splitSqlStatements } from "../src/sql-statements";

describe("splitSqlStatements", () => {
  it("ignores semicolons inside full-line comments", () => {
    const sql = [
      "-- Consent dates live only here; dropping them loses the record.",
      "CREATE TEMP TABLE \"_guard\" (\"empty\" BOOLEAN NOT NULL CHECK (\"empty\")) ON COMMIT DROP;",
      "",
      "  -- indented; still a comment",
      "DROP TABLE \"student_achievements\";",
    ].join("\n");
    expect(splitSqlStatements(sql)).toEqual([
      "CREATE TEMP TABLE \"_guard\" (\"empty\" BOOLEAN NOT NULL CHECK (\"empty\")) ON COMMIT DROP",
      "DROP TABLE \"student_achievements\"",
    ]);
  });

  it("handles Windows line endings", () => {
    expect(splitSqlStatements("-- a; b\r\nDROP INDEX \"x\";\r\n")).toEqual(["DROP INDEX \"x\""]);
  });

  // Every checked-in down file must split into statements that each start
  // with SQL, not with the tail of a comment -- the failure that broke the
  // CI rollback drill.
  it("splits every checked-in down.sql into real statements", () => {
    const dir = path.resolve(__dirname, "../prisma/migrations");
    const downs = readdirSync(dir)
      .map((name) => path.join(dir, name, "down.sql"))
      .filter((file) => existsSync(file));
    expect(downs.length).toBeGreaterThan(0);
    for (const file of downs) {
      for (const statement of splitSqlStatements(readFileSync(file, "utf8"))) {
        expect(statement).toMatch(/^(CREATE|INSERT|ALTER|DROP|DELETE|UPDATE|WITH|SELECT)\b/);
      }
    }
  });
});
