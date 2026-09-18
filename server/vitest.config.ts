import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Every API/migration test shares one PostgreSQL database, and the Lab 3 seed
    // rewrites comments/notes wholesale. Running test files serially keeps that
    // shared state deterministic (no cross-file races on the same rows).
    fileParallelism: false,
  },
});
