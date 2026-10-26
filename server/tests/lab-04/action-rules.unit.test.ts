import { describe, it, expect } from "vitest";
import {
  ACTION_STATUSES,
  isActionTransitionPermitted,
  isActionFinal,
  parseActionInput,
  actionRuleErrors,
  CLOCK_SKEW_MS,
  type ActionStatusValue,
  type ActionValues,
} from "../../src/actionRules.js";

// UNIT-01…UNIT-03 (docs/lab-04/tests.md §2.1). The matrix below is transcribed
// from specification.md BR-14 as the list of permitted cells, independently of
// the implementation's table.
const PERMITTED: [ActionStatusValue, ActionStatusValue][] = [
  ["PLANNED", "IN_PROGRESS"],
  ["PLANNED", "COMPLETED"],
  ["PLANNED", "CANCELLED"],
  ["IN_PROGRESS", "COMPLETED"],
  ["IN_PROGRESS", "CANCELLED"],
];
const ALL: ActionStatusValue[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const permitted = new Set(PERMITTED.map(([a, b]) => `${a}>${b}`));
const FORBIDDEN = ALL.flatMap((a) => ALL.map((b) => [a, b] as [ActionStatusValue, ActionStatusValue])).filter(
  ([a, b]) => !permitted.has(`${a}>${b}`)
);

it("knows exactly the four action statuses of BR-13", () => {
  expect([...ACTION_STATUSES].sort()).toEqual([...ALL].sort());
});

// UNIT-01 — AC-11, AC-13, BR-14
describe("UNIT-01: action status transitions", () => {
  it("covers all 16 cells", () => {
    expect(PERMITTED.length + FORBIDDEN.length).toBe(16);
  });

  it.each(PERMITTED)("%s → %s is permitted", (from, to) => {
    expect(isActionTransitionPermitted(from, to)).toBe(true);
  });

  it.each(FORBIDDEN)("%s → %s is rejected", (from, to) => {
    expect(isActionTransitionPermitted(from, to)).toBe(false);
  });

  it("treats Completed and Cancelled as final, and nothing else", () => {
    expect(ALL.filter(isActionFinal).sort()).toEqual(["CANCELLED", "COMPLETED"]);
  });
});

const TICKET_DATE = new Date("2026-10-01T00:00:00.000Z");
const NOW = new Date("2026-10-20T12:00:00.000Z");
const ctx = { ticketDate: TICKET_DATE, now: NOW };

const valid = (over: Partial<ActionValues> = {}): ActionValues => ({
  actionAt: new Date("2026-10-10T09:00:00.000Z"),
  description: "Replaced the battery.",
  result: "",
  status: "PLANNED",
  followUpRequired: false,
  followUpNote: "",
  attachmentNotes: "",
  ...over,
});

// UNIT-02 — AC-06, AC-07, AC-08, AC-10, BR-06…BR-09
describe("UNIT-02: action field validation", () => {
  const fieldsFor = (body: Record<string, unknown>) =>
    parseActionInput({ actionAt: "2026-10-10T09:00:00.000Z", description: "Valid", ...body }, { partial: false })
      .fields;

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["2001 characters", "x".repeat(2001)],
  ])("rejects a %s description", (_case, description) => {
    expect(fieldsFor({ description }).description).toBeTruthy();
  });

  it.each([
    ["1 character", "x"],
    ["2000 characters", "x".repeat(2000)],
  ])("accepts a %s description, trimmed", (_case, description) => {
    const parsed = parseActionInput(
      { actionAt: "2026-10-10T09:00:00.000Z", description: `  ${description}  ` },
      { partial: false }
    );
    expect(parsed.fields.description).toBeUndefined();
    expect(parsed.values.description).toBe(description);
  });

  it("requires a description and an Action Date/Time on create, but not on a partial edit", () => {
    const create = parseActionInput({}, { partial: false }).fields;
    expect(create.description).toBeTruthy();
    expect(create.actionAt).toBeTruthy();
    expect(parseActionInput({}, { partial: true }).fields).toEqual({});
  });

  it("requires a Result only for a Completed action", () => {
    expect(actionRuleErrors(valid({ status: "COMPLETED", result: "" }), ctx).result).toBeTruthy();
    expect(actionRuleErrors(valid({ status: "COMPLETED", result: "Done." }), ctx).result).toBeUndefined();
    expect(actionRuleErrors(valid({ status: "PLANNED", result: "" }), ctx).result).toBeUndefined();
    expect(actionRuleErrors(valid({ status: "IN_PROGRESS", result: "" }), ctx).result).toBeUndefined();
    expect(fieldsFor({ result: "x".repeat(2001) }).result).toBeTruthy();
  });

  it("requires a Follow-up Note when follow-up is yes, and discards it when no", () => {
    expect(actionRuleErrors(valid({ followUpRequired: true, followUpNote: "" }), ctx).followUpNote).toBeTruthy();
    expect(
      actionRuleErrors(valid({ followUpRequired: true, followUpNote: "Call back Friday." }), ctx).followUpNote
    ).toBeUndefined();
    const discarded = parseActionInput(
      { actionAt: "2026-10-10T09:00:00.000Z", description: "x", followUpRequired: false, followUpNote: "Ignored" },
      { partial: false }
    );
    expect(discarded.values.followUpNote).toBe("");
    expect(fieldsFor({ followUpRequired: true, followUpNote: "x".repeat(1001) }).followUpNote).toBeTruthy();
    expect(fieldsFor({ followUpRequired: "yes" }).followUpRequired).toBeTruthy();
  });

  it("accepts 500 characters of Attachment Notes and rejects 501", () => {
    expect(fieldsFor({ attachmentNotes: "x".repeat(500) }).attachmentNotes).toBeUndefined();
    expect(fieldsFor({ attachmentNotes: "x".repeat(501) }).attachmentNotes).toBeTruthy();
  });

  it("never accepts Cancelled, or an unknown value, as a starting status", () => {
    expect(fieldsFor({ status: "CANCELLED" }).status).toBeTruthy();
    expect(fieldsFor({ status: "DONE" }).status).toBeTruthy();
    expect(fieldsFor({ status: "COMPLETED", result: "Done." }).status).toBeUndefined();
  });
});

// UNIT-03 — AC-09, BR-10
describe("UNIT-03: Action Date/Time rules", () => {
  const limit = new Date(NOW.getTime() + CLOCK_SKEW_MS);
  const plusOneSecond = new Date(limit.getTime() + 1000);

  it("is a five-minute allowance", () => {
    expect(CLOCK_SKEW_MS).toBe(5 * 60 * 1000);
  });

  it("rejects a time earlier than the Ticket Date", () => {
    const before = new Date(TICKET_DATE.getTime() - 1000);
    expect(actionRuleErrors(valid({ actionAt: before }), ctx).actionAt).toBeTruthy();
    expect(actionRuleErrors(valid({ actionAt: TICKET_DATE }), ctx).actionAt).toBeUndefined();
  });

  it("accepts a future time only while the action is Planned", () => {
    const future = new Date(NOW.getTime() + 24 * 3_600_000);
    expect(actionRuleErrors(valid({ actionAt: future, status: "PLANNED" }), ctx).actionAt).toBeUndefined();
    expect(actionRuleErrors(valid({ actionAt: future, status: "IN_PROGRESS" }), ctx).actionAt).toBeTruthy();
    expect(actionRuleErrors(valid({ actionAt: future, status: "COMPLETED", result: "Done." }), ctx).actionAt).toBeTruthy();
  });

  it.each(["IN_PROGRESS", "COMPLETED"] as const)(
    "accepts now + 5 min and rejects now + 5 min + 1 s for a %s action",
    (status) => {
      const base = { status, result: "Done." };
      expect(actionRuleErrors(valid({ ...base, actionAt: limit }), ctx).actionAt).toBeUndefined();
      expect(actionRuleErrors(valid({ ...base, actionAt: plusOneSecond }), ctx).actionAt).toBeTruthy();
    }
  );

  it("rejects a value that is not an ISO 8601 date", () => {
    expect(parseActionInput({ actionAt: "next tuesday", description: "x" }, { partial: false }).fields.actionAt).toBeTruthy();
  });
});
