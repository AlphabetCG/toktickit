import { describe, it, expect } from "vitest";
import { validateSummary, validateDescription, validatePriority } from "../../src/validation.js";
import { normalizeTicketQuery } from "../../src/ticketQuery.js";
import {
  detectMimeType,
  isPermittedMime,
  isWithinSizeLimit,
  generateStoredFilename,
  MAX_ATTACHMENT_BYTES,
} from "../../src/attachmentValidation.js";

const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const webp = () => Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);
const pdf = () => Buffer.from("%PDF-1.7\n");
const exe = () => Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // "MZ" DOS header

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

  // UNIT-06 — AC-20, BR-36: invalid query parameters fall back to defaults.
  describe("ticket query normalisation", () => {
    it("falls back to documented defaults for invalid parameters", () => {
      const q = normalizeTicketQuery({
        page: "0",
        pageSize: "999",
        sort: "bogus",
        order: "sideways",
      });
      expect(q).toMatchObject({
        page: 1,
        pageSize: 10,
        sort: "ticketDate",
        order: "desc",
      });
    });

    it("keeps valid parameters and trims a blank search to absent", () => {
      const q = normalizeTicketQuery({
        search: "  laptop  ",
        categoryId: "2",
        priority: "HIGH",
        status: "NEW",
        sort: "ticketNumber",
        order: "asc",
        page: "3",
        pageSize: "50",
      });
      expect(q).toEqual({
        search: "laptop",
        categoryId: 2,
        relatedSystemId: undefined,
        priority: "HIGH",
        status: "NEW",
        sort: "ticketNumber",
        order: "asc",
        page: 3,
        pageSize: 50,
      });
    });

    it("ignores a non-integer or empty categoryId and an unknown priority", () => {
      const q = normalizeTicketQuery({ categoryId: "", relatedSystemId: "abc", priority: "URGENT" });
      expect(q.categoryId).toBeUndefined();
      expect(q.relatedSystemId).toBeUndefined();
      expect(q.priority).toBeUndefined();
    });
  });

  // UNIT-04 — AC-27, AC-28, BR-04, BR-05, BR-51
  describe("attachment type and size", () => {
    it("detects the four permitted types by content, not extension", () => {
      expect(detectMimeType(jpeg())).toBe("image/jpeg");
      expect(detectMimeType(png())).toBe("image/png");
      expect(detectMimeType(webp())).toBe("image/webp");
      expect(detectMimeType(pdf())).toBe("application/pdf");
    });

    it("rejects an executable regardless of its name", () => {
      expect(detectMimeType(exe())).toBeNull();
      expect(isPermittedMime(detectMimeType(exe()))).toBe(false);
    });

    it("accepts exactly 5 MB and rejects one byte more", () => {
      expect(isWithinSizeLimit(MAX_ATTACHMENT_BYTES)).toBe(true);
      expect(isWithinSizeLimit(MAX_ATTACHMENT_BYTES + 1)).toBe(false);
    });
  });

  // UNIT-05 — BR-50
  describe("stored filename generation", () => {
    it("is a UUID plus the extension from the detected type", () => {
      expect(generateStoredFilename("application/pdf")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/
      );
      expect(generateStoredFilename("image/png")).toMatch(/\.png$/);
    });

    it("never contains a path separator, so the original name cannot escape", () => {
      const name = generateStoredFilename("image/jpeg");
      expect(name).not.toContain("/");
      expect(name).not.toContain("\\");
      expect(name).not.toContain("..");
    });
  });
});
