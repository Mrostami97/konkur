module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.e2e-spec.ts"],
  testTimeout: 30000,
  // e2e specs share one real Postgres database (see AGENTS.md); running them
  // in parallel workers races concurrent seed() calls against the same rows
  // (e.g. two processes upserting the same seeded phone number at once).
  maxWorkers: 1,
};
