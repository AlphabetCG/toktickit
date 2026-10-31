// The resolution gate (specification §5.4). Pure, so every condition and the
// tie-break can be asserted directly (UNIT-04, UNIT-05). The status route
// evaluates it inside the writing transaction, under a lock on the Ticket row
// (BR-27).

import { permittedTransitions, type Status } from "./transitions.js";

export interface GateAction {
  id: number;
  status: string;
  actionAt: Date;
  followUpRequired: boolean;
}

export type UnmetCode = "noCompletedAction" | "openAction" | "followUpOutstanding";

export interface ResolutionGate {
  satisfied: boolean;
  unmet: { code: UnmetCode; message: string }[];
}

const OPEN = ["PLANNED", "IN_PROGRESS"];

/**
 * BR-25: a Ticket may be resolved only with (a) at least one Completed action,
 * (b) no Planned or In Progress action, and (c) a most recent Completed action —
 * by Action Date/Time, then id — that requests no follow-up. Every unmet
 * condition is reported, so the UI can list them all (BR-28).
 */
export function evaluateResolutionGate(actions: GateAction[]): ResolutionGate {
  const unmet: ResolutionGate["unmet"] = [];
  const completed = actions
    .filter((a) => a.status === "COMPLETED")
    .sort((a, b) => a.actionAt.getTime() - b.actionAt.getTime() || a.id - b.id);
  const open = actions.filter((a) => OPEN.includes(a.status)).length;

  if (completed.length === 0) unmet.push({ code: "noCompletedAction", message: "Complete at least one action." });
  if (open > 0) {
    unmet.push({ code: "openAction", message: `Finish or cancel ${open} open action${open === 1 ? "" : "s"}.` });
  }
  // BR-26: an earlier follow-up is satisfied by a newer Completed action without one.
  if (completed.length > 0 && completed[completed.length - 1].followUpRequired) {
    unmet.push({
      code: "followUpOutstanding",
      message: "Record the requested follow-up as a newer completed action.",
    });
  }
  return { satisfied: unmet.length === 0, unmet };
}

/** BR-28: Lab 3's matrix, without RESOLVED while the gate is unmet. */
export function gatedTransitions(from: Status, gateSatisfied: boolean): Status[] {
  const all = permittedTransitions(from);
  return gateSatisfied ? all : all.filter((s) => s !== "RESOLVED");
}
