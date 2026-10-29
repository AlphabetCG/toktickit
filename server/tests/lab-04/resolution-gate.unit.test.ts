import { describe, it, expect } from "vitest";
import { evaluateResolutionGate, gatedTransitions, type GateAction } from "../../src/resolutionGate.js";
import { STATUSES, permittedTransitions } from "../../src/transitions.js";

// UNIT-04, UNIT-05 (docs/lab-04/tests.md §2.1). Contract: specification BR-25,
// BR-26, BR-28; api-spec §3.1.
let nextId = 1;
const at = (day: number) => new Date(Date.UTC(2026, 9, day, 9, 0, 0));
const act = (status: GateAction["status"], day: number, followUpRequired = false, id = nextId++): GateAction => ({
  id,
  status,
  actionAt: at(day),
  followUpRequired,
});
const codes = (actions: GateAction[]) => evaluateResolutionGate(actions).unmet.map((u) => u.code);

// UNIT-04 — AC-26, AC-27, AC-28, BR-25, BR-26
describe("UNIT-04: the resolution gate", () => {
  it("is unmet with no Completed action, naming noCompletedAction", () => {
    expect(evaluateResolutionGate([])).toEqual({
      satisfied: false,
      unmet: [{ code: "noCompletedAction", message: "Complete at least one action." }],
    });
    expect(codes([act("CANCELLED", 1)])).toEqual(["noCompletedAction"]);
  });

  it("is unmet while any action is Planned or In Progress, and counts them", () => {
    const gate = evaluateResolutionGate([act("COMPLETED", 1), act("PLANNED", 2), act("IN_PROGRESS", 3)]);
    expect(gate.satisfied).toBe(false);
    expect(gate.unmet).toEqual([{ code: "openAction", message: "Finish or cancel 2 open actions." }]);
    expect(evaluateResolutionGate([act("COMPLETED", 1), act("PLANNED", 2)]).unmet[0].message).toBe(
      "Finish or cancel 1 open action."
    );
  });

  it("is unmet when the latest Completed action requests follow-up", () => {
    expect(codes([act("COMPLETED", 1), act("COMPLETED", 2, true)])).toEqual(["followUpOutstanding"]);
  });

  it("is satisfied once a newer Completed action requests no follow-up", () => {
    expect(evaluateResolutionGate([act("COMPLETED", 1, true), act("COMPLETED", 2)])).toEqual({ satisfied: true, unmet: [] });
  });

  it("ignores Cancelled actions and earlier follow-ups", () => {
    expect(evaluateResolutionGate([act("COMPLETED", 1, true), act("COMPLETED", 3), act("CANCELLED", 4, true)]).satisfied).toBe(true);
  });

  it("breaks an Action Date/Time tie by id", () => {
    const later = act("COMPLETED", 5, false, 200);
    const earlierId = act("COMPLETED", 5, true, 100);
    expect(codes([later, earlierId])).toEqual([]); // id 200 is the most recent
    const followUpWins = act("COMPLETED", 5, true, 300);
    expect(codes([later, followUpWins])).toEqual(["followUpOutstanding"]);
  });

  it("reports every unmet condition at once", () => {
    expect(codes([act("PLANNED", 1)])).toEqual(["noCompletedAction", "openAction"]);
  });
});

// UNIT-05 — AC-25, AC-29, BR-28
describe("UNIT-05: gate-aware permitted transitions", () => {
  it.each(STATUSES)("with the gate met, %s offers exactly Lab 3's matrix", (from) => {
    expect(gatedTransitions(from, true)).toEqual(permittedTransitions(from));
  });

  it.each(STATUSES)("with the gate unmet, %s loses RESOLVED and nothing else", (from) => {
    expect(gatedTransitions(from, false)).toEqual(permittedTransitions(from).filter((s) => s !== "RESOLVED"));
  });
});
