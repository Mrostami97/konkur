/**
 * Splits a hand-written migration file into the statements to run one by one.
 *
 * Full-line `--` comments are dropped first: down files explain their guards
 * in prose, and a semicolon inside that prose ("...only here; dropping them
 * loses...") used to split the comment into a fragment that PostgreSQL then
 * tried to execute. Statements themselves never contain a semicolon in these
 * files (no string literals with ";" and no `$$` function bodies), which is
 * what makes a plain split safe; a file that needs either should not go
 * through this tool.
 */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}
