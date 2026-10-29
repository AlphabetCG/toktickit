import { useRef, useState } from "react";
import {
  createAction,
  updateAction,
  ValidationError,
  ConflictError,
  type ActionTaken,
  type ActionStatus,
  type Assignee,
} from "../api.js";
import { actionStatusLabel } from "./Badge.js";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";
import { Field, TextField, TextAreaField, fieldClass } from "./Field.js";
import { ErrorCallout } from "./States.js";

const DESCRIPTION_MAX = 2000;
const RESULT_MAX = 2000;
const FOLLOW_UP_NOTE_MAX = 1000;
const ATTACHMENT_NOTES_MAX = 500;

// A new action records work planned, under way, or already done (BR-13).
const STARTING: ActionStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED"];

// Fields in on-screen order, so focus can move to the first invalid one.
const FIELD_ORDER = ["actionAt", "status", "performedById", "description", "result", "followUpNote", "attachmentNotes"];
const FIELD_ID: Record<string, string> = {
  actionAt: "action-at",
  status: "action-status-PLANNED",
  performedById: "action-performer",
  description: "action-description",
  result: "action-result",
  followUpNote: "action-follow-up-note",
  attachmentNotes: "action-attachment-notes",
};

export type ActionFormMode =
  | { kind: "create" }
  | { kind: "edit"; action: ActionTaken; completing?: boolean };

interface FormState {
  actionAt: string;
  status: ActionStatus;
  performedById: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

// <input type="datetime-local"> speaks local time without a zone.
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function newRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function initialState(mode: ActionFormMode, currentUserId: number): FormState {
  if (mode.kind === "create") {
    return {
      actionAt: toLocalInput(new Date()),
      status: "PLANNED",
      performedById: String(currentUserId),
      description: "",
      result: "",
      followUpRequired: false,
      followUpNote: "",
      attachmentNotes: "",
    };
  }
  const a = mode.action;
  return {
    actionAt: toLocalInput(new Date(a.actionAt)),
    status: mode.completing ? "COMPLETED" : a.status,
    performedById: String(a.performedBy.id),
    description: a.description,
    result: a.result,
    followUpRequired: a.followUpRequired,
    followUpNote: a.followUpNote,
    attachmentNotes: a.attachmentNotes,
  };
}

interface ActionFormProps {
  ticketId: number;
  mode: ActionFormMode;
  assignees: Assignee[];
  currentUserId: number;
  onClose: () => void;
  onSaved: (action: ActionTaken) => void;
  /** Refetches the Ticket and its actions after a stale write; resolves to the actions (ui-spec §2.7). */
  onReload: () => Promise<ActionTaken[]>;
}

/**
 * The action form dialog (ui-spec §7.3): create and edit share one form. Every
 * value survives a failure (AC-60), one clientRequestId is reused for every retry
 * from this dialog (BR-44), and Save is single-flight (AC-59).
 */
export function ActionForm({ ticketId, mode, assignees, currentUserId, onClose, onSaved, onReload }: ActionFormProps) {
  const editing = mode.kind === "edit" ? mode.action : null;
  const completing = mode.kind === "edit" && Boolean(mode.completing);
  const [form, setForm] = useState<FormState>(() => initialState(mode, currentUserId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [conflict, setConflict] = useState<{ message: string; detail: string }>();
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(editing?.version ?? 0);
  const [clientRequestId] = useState(newRequestId);
  const inFlight = useRef(false);
  const initialActionAt = useRef(form.actionAt);
  const resultRef = useRef<HTMLTextAreaElement>(null);
  const followUpRef = useRef<HTMLInputElement>(null);

  const finishing = form.status === "COMPLETED";
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Performer choices: active staff, the current user marked "(you)", and a
  // stored performer deactivated since, kept selectable while unchanged (BR-05).
  const options = assignees.map((a) => ({ id: a.id, label: a.id === currentUserId ? `${a.name} (you)` : a.name }));
  if (editing && !assignees.some((a) => a.id === editing.performedBy.id)) {
    options.push({ id: editing.performedBy.id, label: `${editing.performedBy.name} (deactivated)` });
  }

  function localErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.actionAt || Number.isNaN(new Date(form.actionAt).getTime())) e.actionAt = "Enter the date and time of the action.";
    const description = form.description.trim();
    if (description.length < 1 || description.length > DESCRIPTION_MAX) {
      e.description = `Describe the action in 1–${DESCRIPTION_MAX} characters.`;
    }
    const result = form.result.trim();
    if (result.length > RESULT_MAX) e.result = `Result must be at most ${RESULT_MAX} characters.`;
    else if (finishing && result.length < 1) e.result = "Record the result before completing the action.";
    if (form.followUpRequired) {
      const note = form.followUpNote.trim();
      if (note.length < 1) e.followUpNote = "Describe the follow-up that is needed.";
      else if (note.length > FOLLOW_UP_NOTE_MAX) e.followUpNote = `Follow-up note must be at most ${FOLLOW_UP_NOTE_MAX} characters.`;
    }
    if (form.attachmentNotes.trim().length > ATTACHMENT_NOTES_MAX) {
      e.attachmentNotes = `Attachment notes must be at most ${ATTACHMENT_NOTES_MAX} characters.`;
    }
    return e;
  }

  function focusFirst(fields: Record<string, string>) {
    const first = FIELD_ORDER.find((k) => fields[k]);
    if (first) document.getElementById(FIELD_ID[first])?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // single flight, even within one event loop turn
    const local = localErrors();
    setErrors(local);
    if (Object.keys(local).length > 0) {
      focusFirst(local);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setFailure(undefined);
    setConflict(undefined);

    // An untouched date keeps the stored instant, seconds included.
    const actionAt =
      editing && form.actionAt === initialActionAt.current ? editing.actionAt : new Date(form.actionAt).toISOString();
    const values = {
      actionAt,
      description: form.description.trim(),
      result: form.result.trim(),
      performedById: Number(form.performedById),
      followUpRequired: form.followUpRequired,
      followUpNote: form.followUpRequired ? form.followUpNote.trim() : "",
      attachmentNotes: form.attachmentNotes.trim(),
    };
    try {
      const saved = editing
        ? await updateAction(editing.id, {
            ...values,
            expectedVersion: version,
            ...(completing ? { status: "COMPLETED" as const } : {}),
          })
        : await createAction(ticketId, { ...values, status: form.status, clientRequestId });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.fields);
        focusFirst(err.fields);
      } else if (err instanceof ConflictError && err.conflict === "stale") {
        const current = err.current as ActionTaken | undefined;
        setConflict({
          message: "This action was changed by someone else.",
          detail: current
            ? `Status is now ${actionStatusLabel(current.status)}. Your changes are still below.`
            : "Your changes are still below.",
        });
      } else {
        setFailure(err instanceof ConflictError ? err.message : "We couldn't save the action. Please try again.");
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  // Reload refetches, then lets the user resubmit their values against the
  // version that won (ui-spec §2.7).
  async function reload() {
    const latest = await onReload();
    const mine = editing && latest.find((a) => a.id === editing.id);
    if (mine) setVersion(mine.version);
    setConflict(undefined);
  }

  function toggleFollowUp(checked: boolean) {
    set("followUpRequired", checked);
    if (checked) {
      // Reveal the note, then move focus to it (ui-spec §11).
      setTimeout(() => document.getElementById(FIELD_ID.followUpNote)?.focus(), 0);
    } else {
      followUpRef.current?.focus();
    }
  }

  const title = mode.kind === "create" ? "Add action" : completing ? "Complete action" : "Edit action";

  return (
    <Dialog title={title} onClose={onClose} className="zg-action-form" initialFocus={completing ? resultRef : undefined}>
      <form onSubmit={submit} noValidate>
        {conflict && (
          <div className="zg-callout zg-callout--conflict" role="alert">
            <span>
              <strong>{conflict.message}</strong> {conflict.detail}
            </span>
            <Button variant="secondary" onClick={() => void reload()}>
              Reload
            </Button>
          </div>
        )}
        {failure && <ErrorCallout message={failure} />}

        <TextField
          id={FIELD_ID.actionAt}
          label="Action date and time"
          type="datetime-local"
          required
          invalid={!!errors.actionAt}
          message={errors.actionAt}
          value={form.actionAt}
          onChange={(e) => set("actionAt", e.target.value)}
        />

        {mode.kind === "create" && (
          <fieldset className="zg-field-group zg-fieldset" aria-describedby="action-status-message">
            <legend className="zg-label">
              Status<span className="zg-required" aria-hidden="true">*</span>
            </legend>
            <div className="zg-radio-row">
              {STARTING.map((s) => (
                <label key={s} className="zg-radio">
                  <input
                    id={`action-status-${s}`}
                    type="radio"
                    name="action-status"
                    checked={form.status === s}
                    onChange={() => set("status", s)}
                  />
                  {actionStatusLabel(s)}
                </label>
              ))}
            </div>
            <p id="action-status-message" className={`zg-field-message${errors.status ? " zg-field-message--error" : ""}`}>
              {errors.status ?? ""}
            </p>
          </fieldset>
        )}

        <Field id={FIELD_ID.performedById} label="Performed by" required invalid={!!errors.performedById} message={errors.performedById}>
          <select
            id={FIELD_ID.performedById}
            className={fieldClass({ invalid: !!errors.performedById })}
            aria-required
            aria-invalid={!!errors.performedById || undefined}
            aria-describedby={`${FIELD_ID.performedById}-message`}
            value={form.performedById}
            onChange={(e) => set("performedById", e.target.value)}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <TextAreaField
          id={FIELD_ID.description}
          label="Action description"
          required
          rows={4}
          maxLength={DESCRIPTION_MAX}
          invalid={!!errors.description}
          message={errors.description}
          hint={`${form.description.length} / ${DESCRIPTION_MAX}`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />

        <Field id={FIELD_ID.result} label="Result" required={finishing} invalid={!!errors.result} message={errors.result} hint={finishing ? "Required" : "Required to complete the action."}>
          <textarea
            ref={resultRef}
            id={FIELD_ID.result}
            rows={3}
            maxLength={RESULT_MAX}
            className={fieldClass({ invalid: !!errors.result, multiline: true })}
            aria-required={finishing || undefined}
            aria-invalid={!!errors.result || undefined}
            aria-describedby={`${FIELD_ID.result}-message`}
            value={form.result}
            onChange={(e) => set("result", e.target.value)}
          />
        </Field>

        <div className="zg-field-group">
          <label className="zg-checkbox">
            <input
              ref={followUpRef}
              id="action-follow-up"
              type="checkbox"
              checked={form.followUpRequired}
              onChange={(e) => toggleFollowUp(e.target.checked)}
            />
            Follow-up required?
          </label>
        </div>

        {form.followUpRequired && (
          <TextAreaField
            id={FIELD_ID.followUpNote}
            label="Follow-up note"
            required
            rows={2}
            maxLength={FOLLOW_UP_NOTE_MAX}
            invalid={!!errors.followUpNote}
            message={errors.followUpNote}
            value={form.followUpNote}
            onChange={(e) => set("followUpNote", e.target.value)}
          />
        )}

        <TextField
          id={FIELD_ID.attachmentNotes}
          label="Attachment notes"
          maxLength={ATTACHMENT_NOTES_MAX}
          placeholder="e.g. see photo router-front.jpg"
          hint="Which of this ticket's files to look at."
          invalid={!!errors.attachmentNotes}
          message={errors.attachmentNotes}
          value={form.attachmentNotes}
          onChange={(e) => set("attachmentNotes", e.target.value)}
        />

        <div className="zg-form-actions zg-action-form__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
            Save action
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
