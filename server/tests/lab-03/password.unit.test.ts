import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  validateNewPassword,
  PASSWORD_BLOCKLIST,
} from "../../src/password.js";

// UNIT-01, UNIT-02, UNIT-03 (docs/lab-03/tests.md §2.1). Pure functions, no DB.

// UNIT-01 — BR-04, D-02
describe("UNIT-01: password hashing", () => {
  it("never returns the plaintext and differs across calls for the same input", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe("correct horse battery");
    expect(a).not.toBe(b); // per-hash salt
  });

  it("verifies only the original password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong horse battery", hash)).toBe(false);
  });
});

// UNIT-02 — BR-12
describe("UNIT-02: email normalisation", () => {
  it("trims and lower-cases before storage and comparison", () => {
    expect(normalizeEmail("  Somchai@KMUTT.AC.TH ")).toBe("somchai@kmutt.ac.th");
  });
});

// UNIT-03 — AC-08, BR-10
describe("UNIT-03: password policy boundaries", () => {
  const ok = (s: string | null) => s === null;

  it("rejects 11 characters and accepts 12", () => {
    expect(ok(validateNewPassword("a".repeat(11)))).toBe(false);
    expect(ok(validateNewPassword("a".repeat(12)))).toBe(true);
  });

  it("accepts 128 characters and rejects 129", () => {
    expect(ok(validateNewPassword("a".repeat(128)))).toBe(true);
    expect(ok(validateNewPassword("a".repeat(129)))).toBe(false);
  });

  it("rejects a blocklisted value", () => {
    expect(ok(validateNewPassword(PASSWORD_BLOCKLIST[0]))).toBe(false);
  });

  it("rejects a new password equal to the current one", () => {
    expect(ok(validateNewPassword("a-good-long-password", "a-good-long-password"))).toBe(false);
    expect(ok(validateNewPassword("a-good-long-password", "different-but-also-long"))).toBe(true);
  });
});
