import { useState } from "react";
import { postNote, ValidationError, type Note, type Role } from "../api.js";
import { Button } from "./Button.js";

const BODY_MAX = 2000;

const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface InternalNotesProps {
  ticketId: number;
  initial: Note[];
  /** Set on a CLOSED or CANCELLED ticket: the composer is disabled with this reason (AC-41). */
  disabledReason?: string;
}

/**
 * Internal Notes (ui-spec §7.2) — staff-only content, so four independent signals
 * keep it from being mistaken for a Public Comment: the heading names the audience;
 * the region uses the internal surface, a different hue family from every other
 * card; a persistent audience label sits beside the input and is announced with
 * it (aria-describedby); and the button says "Add note", never "Post" (BR-47).
 * Rendered only on the IT Staff / Administrator detail — never for a Requester.
 */
export function InternalNotes({ ticketId, initial, disabledReason }: InternalNotesProps) {
  const [notes, setNotes] = useState<Note[]>(initial);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string>();

  const trimmed = body.trim();
  const canPost = !disabledReason && trimmed.length >= 1 && trimmed.length <= BODY_MAX && !posting;
  const describedBy = ["note-audience", disabledReason ? "note-disabled-reason" : ""].filter(Boolean).join(" ");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    setPosting(true);
    setError(undefined);
    try {
      const created = await postNote(ticketId, trimmed);
      setNotes((prev) => [...prev, created]);
      setBody("");
    } catch (err) {
      setError(err instanceof ValidationError ? err.fields.body ?? err.message : (err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="zg-panel zg-notes" aria-label="Internal Notes">
      <h2 className="zg-section-title zg-notes__title">Internal Notes · Visible to IT Staff only</h2>

      {notes.length > 0 ? (
        <ul className="zg-comment-list">
          {notes.map((n) => (
            <li key={n.id} className="zg-comment">
              <p className="zg-comment__meta">
                <span className="zg-comment__author">{n.author.name}</span>{" "}
                <span className="zg-comment__role">({ROLE_LABEL[n.author.role]})</span> · {formatWhen(n.createdAt)}
              </p>
              {/* Text node, never HTML (BR-45). */}
              <p className="zg-comment__body">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zg-field-message">No internal notes yet.</p>
      )}

      <form className="zg-comment-form" onSubmit={submit}>
        <div className="zg-list-head">
          <label className="zg-label" htmlFor="note-body">
            Add an internal note
          </label>
          <span id="note-audience" className="zg-notes__audience">
            <span aria-hidden="true">🔒 </span>Visible to IT Staff only
          </span>
        </div>
        <textarea
          id="note-body"
          className="zg-field zg-field--multiline zg-notes__input"
          rows={3}
          maxLength={BODY_MAX}
          value={body}
          disabled={Boolean(disabledReason)}
          aria-describedby={describedBy}
          onChange={(e) => setBody(e.target.value)}
        />
        {disabledReason && (
          <p id="note-disabled-reason" className="zg-field-message">
            {disabledReason}
          </p>
        )}
        <div className="zg-list-head">
          <span className="zg-counter">
            {body.length} / {BODY_MAX}
          </span>
          <Button type="submit" variant="secondary" disabled={!canPost} busy={posting} busyLabel="Adding…">
            Add note
          </Button>
        </div>
        {error && (
          <p className="zg-field-message zg-field-message--error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
