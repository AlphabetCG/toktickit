import { describe, it, expect } from "vitest";
import { validateCommentBody, COMMENT_BODY_MAX } from "../../src/validation.js";
import { normalizeQueueQuery } from "../../src/queueQuery.js";
import { normalizeTicketQuery, TICKET_STATUSES } from "../../src/ticketQuery.js";

// UNIT-05 — AC-31, §9.3: queue query normalisation.
describe("UNIT-05: queue query normalisation", () => {
  it("falls back to documented defaults for invalid values", () => {
    const q = normalizeQueueQuery({
      page: "0",
      pageSize: "999",
      sort: "bogus",
      order: "sideways",
      status: "NOPE",
      ownerId: "abc",
      itPriority: "URGENT",
      categoryId: "x1",
    });
    expect(q).toMatchObject({ page: 1, pageSize: 20, sort: "updatedAt", order: "desc" });
    expect(q.status).toBeUndefined();
    expect(q.owner).toBeUndefined();
    expect(q.itPriority).toBeUndefined();
    expect(q.categoryId).toBeUndefined();
  });

  it("uses the §9.3 defaults when nothing is supplied", () => {
    expect(normalizeQueueQuery({})).toEqual({ sort: "updatedAt", order: "desc", page: 1, pageSize: 20 });
  });

  it("accepts every valid value, including the three owner forms", () => {
    expect(normalizeQueueQuery({ ownerId: "unassigned" }).owner).toEqual({ kind: "unassigned" });
    expect(normalizeQueueQuery({ ownerId: "me" }).owner).toEqual({ kind: "me" });
    expect(normalizeQueueQuery({ ownerId: "7" }).owner).toEqual({ kind: "user", id: 7 });
    expect(normalizeQueueQuery({ sort: "itPriority", order: "asc", pageSize: "50", page: "3" })).toMatchObject({
      sort: "itPriority",
      order: "asc",
      pageSize: 50,
      page: 3,
    });
    for (const status of TICKET_STATUSES) expect(normalizeQueueQuery({ status }).status).toBe(status);
  });

  it("treats a blank search as absent", () => {
    expect(normalizeQueueQuery({ search: "   " }).search).toBeUndefined();
  });
});

// Regression (BR-61): the Lab 2 My Tickets normaliser only knew "NEW", so every
// other status filter was silently dropped once Lab 3 added seven statuses.
describe("Lab 2 list normaliser accepts all eight statuses", () => {
  it.each(TICKET_STATUSES)("keeps status=%s", (status) => {
    expect(normalizeTicketQuery({ status }).status).toBe(status);
  });
});

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
