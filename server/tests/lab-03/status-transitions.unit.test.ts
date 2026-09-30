import { describe, it, expect } from "vitest";
import {
  STATUSES,
  isTransitionPermitted,
  permittedTransitions,
  isTerminal,
  type Status,
} from "../../src/transitions.js";

// UNIT-06…UNIT-08 (docs/lab-03/tests.md §2.1). The expected matrix is transcribed
// here independently from specification.md §5.7 — as the list of ✅ cells — so the
// test cannot pass by reading the implementation's own table back to itself.
const PERMITTED: [Status, Status][] = [
  ["NEW", "OPEN"],
  ["NEW", "IN_PROGRESS"],
  ["NEW", "CANCELLED"],
  ["OPEN", "IN_PROGRESS"],
  ["OPEN", "WAITING_FOR_REQUESTER"],
  ["OPEN", "CANCELLED"],
  ["IN_PROGRESS", "WAITING_FOR_REQUESTER"],
  ["IN_PROGRESS", "RESOLVED"],
  ["IN_PROGRESS", "CANCELLED"],
  ["WAITING_FOR_REQUESTER", "IN_PROGRESS"],
  ["WAITING_FOR_REQUESTER", "RESOLVED"],
  ["WAITING_FOR_REQUESTER", "CANCELLED"],
  ["RESOLVED", "CLOSED"],
  ["RESOLVED", "REOPENED"],
  ["REOPENED", "IN_PROGRESS"],
  ["REOPENED", "WAITING_FOR_REQUESTER"],
  ["REOPENED", "RESOLVED"],
  ["REOPENED", "CANCELLED"],
];

const ALL: Status[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

const key = ([from, to]: [Status, Status]) => `${from}->${to}`;
const permittedKeys = new Set(PERMITTED.map(key));
const FORBIDDEN: [Status, Status][] = ALL.flatMap((from) =>
  ALL.map((to) => [from, to] as [Status, Status])
).filter((pair) => !permittedKeys.has(key(pair)));

it("knows exactly the eight statuses of spec §5.7", () => {
  expect([...STATUSES].sort()).toEqual([...ALL].sort());
});

// UNIT-06 — AC-37, BR-35
describe("UNIT-06: every ✅ cell of the matrix is accepted", () => {
  it.each(PERMITTED)("%s → %s is permitted", (from, to) => {
    expect(isTransitionPermitted(from, to)).toBe(true);
    expect(permittedTransitions(from)).toContain(to);
  });
});

// UNIT-07 — AC-38, BR-35
describe("UNIT-07: every — cell of the matrix is rejected", () => {
  it.each(FORBIDDEN)("%s → %s is rejected", (from, to) => {
    expect(isTransitionPermitted(from, to)).toBe(false);
  });

  it("rejects RESOLVED → IN_PROGRESS in particular", () => {
    expect(isTransitionPermitted("RESOLVED", "IN_PROGRESS")).toBe(false);
  });

  it("never permits a status to transition to itself", () => {
    for (const s of ALL) expect(isTransitionPermitted(s, s)).toBe(false);
  });
});

// UNIT-08 — AC-39, BR-36
describe("UNIT-08: terminal statuses", () => {
  it.each(["CLOSED", "CANCELLED"] as Status[])("no transition leaves %s", (from) => {
    expect(isTerminal(from)).toBe(true);
    expect(permittedTransitions(from)).toEqual([]);
    for (const to of ALL) expect(isTransitionPermitted(from, to)).toBe(false);
  });

  it("treats no other status as terminal", () => {
    for (const s of ALL.filter((x) => x !== "CLOSED" && x !== "CANCELLED")) expect(isTerminal(s)).toBe(false);
  });
});
