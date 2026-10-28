// Actions Taken rules (specification §5.1, §5.2). Pure and synchronous so every
// boundary can be asserted directly (UNIT-01…UNIT-03). Validation is split the way
// api-spec §2.4 orders its errors:
//   • parseActionInput — types, lengths, and required keys, checked before the
//     version comparison; and
//   • actionRuleErrors — rules over the whole resulting action (Result for a
//     Completed action, the Follow-up Note, the Action Date/Time window), checked
//     after the transition, because they depend on the merged values.

export type ActionStatusValue = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

// BR-14: the five permitted moves. Completed and Cancelled are final (BR-15).
const ACTION_TRANSITIONS: Record<ActionStatusValue, readonly ActionStatusValue[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const ACTION_STATUSES = Object.keys(ACTION_TRANSITIONS) as ActionStatusValue[];

// BR-13: a new action may record work planned, under way, or already done — never
// cancelled work.
const STARTING_STATUSES: readonly ActionStatusValue[] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];

export const ACTION_STATUS_LABEL: Record<ActionStatusValue, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const isActionStatus = (v: unknown): v is ActionStatusValue =>
  typeof v === "string" && (ACTION_STATUSES as string[]).includes(v);

export function isActionTransitionPermitted(from: ActionStatusValue, to: ActionStatusValue): boolean {
  return ACTION_TRANSITIONS[from].includes(to);
}

export function isActionFinal(status: ActionStatusValue): boolean {
  return ACTION_TRANSITIONS[status].length === 0;
}

// BR-10: a started or completed action may sit at most this far in the future.
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

export const DESCRIPTION_MAX = 2000;
export const RESULT_MAX = 2000;
export const FOLLOW_UP_NOTE_MAX = 1000;
export const ATTACHMENT_NOTES_MAX = 500;
export const CLIENT_REQUEST_ID_MAX = 64;

/** Every field the rules judge, after trimming. */
export interface ActionValues {
  actionAt: Date;
  description: string;
  result: string;
  status: ActionStatusValue;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

export interface ParsedAction {
  values: Partial<ActionValues>;
  performedById?: number;
  fields: Record<string, string>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Reads the request body. Absent keys stay absent so an edit leaves them as
 * stored; `partial: false` (create) makes Action Date/Time and Description
 * required. Status here is the *starting* status, so Cancelled is rejected;
 * an edit's status change is judged by the transition matrix instead.
 */
export function parseActionInput(body: Record<string, unknown>, { partial }: { partial: boolean }): ParsedAction {
  const values: Partial<ActionValues> = {};
  const fields: Record<string, string> = {};
  const has = (key: string) => body[key] !== undefined;

  if (has("actionAt")) {
    const raw = body.actionAt;
    const date = typeof raw === "string" && ISO_DATE.test(raw) ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) fields.actionAt = "Enter the date and time of the action.";
    else values.actionAt = date;
  } else if (!partial) {
    fields.actionAt = "Enter the date and time of the action.";
  }

  if (has("description") || !partial) {
    const text = typeof body.description === "string" ? body.description.trim() : "";
    if (text.length < 1 || text.length > DESCRIPTION_MAX) {
      fields.description = `Describe the action in 1–${DESCRIPTION_MAX} characters.`;
    } else values.description = text;
  }

  if (has("result")) {
    const text = typeof body.result === "string" ? body.result.trim() : null;
    if (text === null || text.length > RESULT_MAX) fields.result = `Result must be at most ${RESULT_MAX} characters.`;
    else values.result = text;
  }

  if (has("status")) {
    if (!isActionStatus(body.status) || (!partial && !STARTING_STATUSES.includes(body.status))) {
      fields.status = partial
        ? "Choose a valid action status."
        : "A new action starts as Planned, In Progress, or Completed.";
    } else values.status = body.status;
  }

  if (has("followUpRequired")) {
    if (typeof body.followUpRequired !== "boolean") fields.followUpRequired = "Choose yes or no.";
    else values.followUpRequired = body.followUpRequired;
  }

  if (has("followUpNote")) {
    const text = typeof body.followUpNote === "string" ? body.followUpNote.trim() : null;
    if (text === null || text.length > FOLLOW_UP_NOTE_MAX) {
      fields.followUpNote = `Follow-up note must be at most ${FOLLOW_UP_NOTE_MAX} characters.`;
    } else values.followUpNote = text;
  }
  // BR-08: with follow-up "no", a sent note is discarded, not stored.
  if (values.followUpRequired === false) {
    values.followUpNote = "";
    delete fields.followUpNote;
  }

  if (has("attachmentNotes")) {
    const text = typeof body.attachmentNotes === "string" ? body.attachmentNotes.trim() : null;
    if (text === null || text.length > ATTACHMENT_NOTES_MAX) {
      fields.attachmentNotes = `Attachment notes must be at most ${ATTACHMENT_NOTES_MAX} characters.`;
    } else values.attachmentNotes = text;
  }

  let performedById: number | undefined;
  if (has("performedById")) {
    const raw = body.performedById;
    if (Number.isInteger(raw) && (raw as number) > 0) performedById = raw as number;
    else fields.performedById = "Choose an active IT Staff member.";
  }

  return { values, performedById, fields };
}

/** Rules over a complete action (BR-07, BR-08, BR-10). */
export function actionRuleErrors(
  action: ActionValues,
  { ticketDate, now }: { ticketDate: Date; now: Date }
): Record<string, string> {
  const fields: Record<string, string> = {};
  if (action.status === "COMPLETED" && action.result.length < 1) {
    fields.result = "Record the result before completing the action.";
  }
  if (action.followUpRequired && action.followUpNote.length < 1) {
    fields.followUpNote = "Describe the follow-up that is needed.";
  }
  if (action.actionAt.getTime() < ticketDate.getTime()) {
    fields.actionAt = "The action cannot be earlier than the Ticket Date.";
  } else if (action.status !== "PLANNED" && action.actionAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    fields.actionAt = "Only a Planned action can be dated in the future.";
  }
  return fields;
}
