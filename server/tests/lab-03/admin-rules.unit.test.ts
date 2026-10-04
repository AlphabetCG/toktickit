import { describe, it, expect } from "vitest";
import { wouldKeepAnActiveAdmin } from "../../src/adminRules.js";

// UNIT-11 — BR-56: removing a user from the active Administrators must leave at
// least one. The API path needs a concurrent race (API-36); the rule itself is
// asserted here directly and deterministically.
describe("UNIT-11: last-active-Administrator rule", () => {
  it("refuses removing the only active Administrator", () => {
    expect(wouldKeepAnActiveAdmin([7], 7)).toBe(false);
  });

  it("allows removing one of several", () => {
    expect(wouldKeepAnActiveAdmin([3, 7], 7)).toBe(true);
  });

  it("allows removing a user who is not an active Administrator", () => {
    expect(wouldKeepAnActiveAdmin([3], 9)).toBe(true);
  });

  it("refuses when there are no active Administrators at all", () => {
    expect(wouldKeepAnActiveAdmin([], 9)).toBe(false);
  });
});
