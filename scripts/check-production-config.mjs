import { isIP } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function strongSecret(value) {
  return typeof value === "string" && value.length >= 16 && value.length <= 1024
    && !/^(.)\1+$/u.test(value)
    && !/(change[-_ ]?me|replace[-_ ]?me|example|placeholder|password|konkur123|security_test_only)/iu.test(value)
    && !/^(?:0123456789|1234567890|qwerty|abcdef)+[0-9a-z]*$/iu.test(value);
}

export function validateProxyCidrs(value = "") {
  if (!value.trim()) return [];
  return value.trim().split(/[\s,]+/u).flatMap((entry) => {
    const parts = entry.split("/");
    const family = isIP(parts[0]);
    const prefix = parts.length === 2 && /^\d+$/u.test(parts[1]) ? Number(parts[1]) : NaN;
    if (parts.length !== 2 || !family || !Number.isInteger(prefix)
      || prefix <= 0 || prefix > (family === 4 ? 32 : 128)) {
      return ["TRUSTED_PROXY_CIDRS must contain explicit IPv4/IPv6 CIDRs with nonzero prefixes"];
    }
    return [];
  });
}

// This preflight is deliberately offline. Report field names, never secret values.
export function validateProductionConfig(env, { requireCredentials = false } = {}) {
  const errors = validateProxyCidrs(env.TRUSTED_PROXY_CIDRS);
  if (requireCredentials || env.NODE_ENV === "production") {
    let dbPassword;
    try {
      const database = new URL(env.DATABASE_URL);
      if (!["postgres:", "postgresql:"].includes(database.protocol)
        || !database.hostname || !database.username || !database.pathname || database.pathname === "/") {
        throw new Error("invalid database URL");
      }
      dbPassword = decodeURIComponent(database.password);
    } catch {
      errors.push("DATABASE_URL must be a valid PostgreSQL URL with a database name");
    }
    if (!strongSecret(dbPassword)) errors.push("DATABASE_URL password must be a strong unique secret of at least 16 characters");
    if (!strongSecret(env.S3_SECRET_KEY)) errors.push("S3_SECRET_KEY must be a strong unique secret of at least 16 characters");
    try {
      const frontend = new URL(env.FRONTEND_URL);
      if (frontend.protocol !== "https:" || frontend.username || frontend.password) throw new Error("invalid origin");
    } catch {
      errors.push("FRONTEND_URL must be an HTTPS URL without credentials");
    }
    const phone = env.BOOTSTRAP_ADMIN_PHONE?.trim();
    const password = env.BOOTSTRAP_ADMIN_PASSWORD;
    if (Boolean(phone) !== Boolean(password)) errors.push("Administrator bootstrap requires both fields or neither");
    if (password && !strongSecret(password)) errors.push("BOOTSTRAP_ADMIN_PASSWORD must be a strong unique secret of at least 16 characters");
  }
  return [...new Set(errors)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = validateProductionConfig(process.env, {
    requireCredentials: process.argv.includes("--require-credentials"),
  });
  if (errors.length) {
    console.error("Production configuration preflight failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Production configuration preflight passed (offline; service connectivity not tested).");
  }
}
