import { describe, it, expect } from "vitest";
import { validateSummary, validateDescription, validatePriority } from "../../src/validation.js";

// UNIT-03 — AC-12, BR-39, BR-40. Boundaries are tested at the edge, not the
// middle: the last invalid length and the first valid one.
describe("Ticket field validation", () => {
  describe("summary (5–150, trimmed)", () => {
    it("rejects below the minimum and accepts the minimum", () => {
      expect(validateSummary("abcd")).toBeDefined(); // 4
      expect(validateSummary("abcde")).toBeUndefined(); // 5
    });

    it("accepts the maximum and rejects one past it", () => {
      expect(validateSummary("a".repeat(150))).toBeUndefined();
      expect(validateSummary("a".repeat(151))).toBeDefined();
    });

    it("trims before measuring", () => {
      expect(validateSummary("   ab   ")).toBeDefined(); // 2 after trim
      expect(validateSummary(undefined)).toBeDefined();
    });
  });

  describe("description (20–5000, trimmed)", () => {
    it("rejects below the minimum and accepts the minimum", () => {
      expect(validateDescription("a".repeat(19))).toBeDefined();
      expect(validateDescription("a".repeat(20))).toBeUndefined();
    });

    it("accepts the maximum and rejects one past it", () => {
      expect(validateDescription("a".repeat(5000))).toBeUndefined();
      expect(validateDescription("a".repeat(5001))).toBeDefined();
    });
  });

  describe("requested priority", () => {
    it("accepts the three fixed values", () => {
      expect(validatePriority("LOW")).toBeUndefined();
      expect(validatePriority("MEDIUM")).toBeUndefined();
      expect(validatePriority("HIGH")).toBeUndefined();
    });

    it("rejects anything else", () => {
      expect(validatePriority("URGENT")).toBeDefined();
      expect(validatePriority("")).toBeDefined();
      expect(validatePriority(undefined)).toBeDefined();
    });
  });
});
