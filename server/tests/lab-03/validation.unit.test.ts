import { describe, it, expect } from "vitest";
import { validateCommentBody, COMMENT_BODY_MAX } from "../../src/validation.js";

// UNIT-04 — AC-26, BR-44 (docs/lab-03/tests.md §2.1). Pure function, no DB.
describe("UNIT-04: comment and note body rules", () => {
  const ok = (v: unknown) => validateCommentBody(v) === undefined;

  it("trims first, so a whitespace-only body is rejected", () => {
    expect(ok("   ")).toBe(false);
    expect(ok("\n\t  ")).toBe(false);
    expect(ok("")).toBe(false);
  });

  it("accepts 1 character and 2000 characters", () => {
    expect(ok("a")).toBe(true);
    expect(ok("a".repeat(COMMENT_BODY_MAX))).toBe(true);
  });

  it("rejects 2001 characters", () => {
    expect(ok("a".repeat(COMMENT_BODY_MAX + 1))).toBe(false);
  });

  it("rejects a non-string body", () => {
    expect(ok(undefined)).toBe(false);
    expect(ok(42)).toBe(false);
  });
});
