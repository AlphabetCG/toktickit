import { describe, it, expect } from "vitest";
import { ACTIVE_STATUSES, windowStart, isWithinWindow } from "../../src/dashboardRules.js";
import { normalizeQueueQuery } from "../../src/queueQuery.js";

// UNIT-06, UNIT-07 (docs/lab-04/tests.md §2.1). Contract: specification BR-46,
// BR-49; api-spec §4.
const NOW = new Date("2026-10-20T05:00:00.000Z");
const HOUR = 3_600_000;
const MINUTE = 60_000;

// UNIT-06 — AC-47, BR-49
describe("UNIT-06: rolling windows from the server's current time", () => {
  it.each([
    [7, 168],
    [30, 720],
  ])("last %i days starts exactly %i hours before now", (days, hours) => {
    expect(windowStart(NOW, days).getTime()).toBe(NOW.getTime() - hours * HOUR);
  });

  it.each([7, 30])("a record exactly on the %i-day boundary is inside; a minute earlier is outside", (days) => {
    const boundary = new Date(NOW.getTime() - days * 24 * HOUR);
    expect(isWithinWindow(boundary, NOW, days)).toBe(true);
    expect(isWithinWindow(new Date(boundary.getTime() - MINUTE), NOW, days)).toBe(false);
    expect(isWithinWindow(NOW, NOW, days)).toBe(true);
  });
});

// UNIT-07 — BR-46, FR-16
describe("UNIT-07: the active set and statusGroup", () => {
  it("is exactly the five active statuses", () => {
    expect([...ACTIVE_STATUSES].sort()).toEqual(["IN_PROGRESS", "NEW", "OPEN", "REOPENED", "WAITING_FOR_REQUESTER"]);
  });

  it("normalises statusGroup=active", () => {
    expect(normalizeQueueQuery({ statusGroup: "active" }).statusGroup).toBe("active");
  });

  it.each([["closed"], ["ACTIVE"], [""], [["active"]]])("ignores an invalid statusGroup %j", (value) => {
    expect(normalizeQueueQuery({ statusGroup: value }).statusGroup).toBeUndefined();
  });

  it("lets an explicit status win over the group", () => {
    const q = normalizeQueueQuery({ status: "RESOLVED", statusGroup: "active" });
    expect(q.status).toBe("RESOLVED");
    expect(q.statusGroup).toBeUndefined();
  });

  it("keeps the group when the explicit status is invalid and falls back", () => {
    const q = normalizeQueueQuery({ status: "DONE", statusGroup: "active" });
    expect(q.status).toBeUndefined();
    expect(q.statusGroup).toBe("active");
  });
});
