module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  testPathIgnorePatterns: ["\\.e2e-spec\\.ts$"],
};
