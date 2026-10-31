import { useEffect, useId, useRef, useState } from "react";
import {
  getActions,
  updateAction,
  ConflictError,
  type ActionTaken,
  type ActionStatus,
  type Assignee,
  type TicketStatusValue,
} from "../api.js";
import { ActionStatusBadge, actionStatusLabel } from "./Badge.js";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";
import { ActionForm, type ActionFormMode } from "./ActionForm.js";
import { LoadingSkeleton, ErrorCallout } from "./States.js";
import { formatDateTime } from "../format.js";

type Load = "loading" | "ready" | "error";

const FINAL: ActionStatus[] = ["COMPLETED", "CANCELLED"];
// BR-19: no new work on a Ticket that is not active.
const INACTIVE_REASON: Partial<Record<TicketStatusValue, string>> = {
  RESOLVED: "Reopen this ticket to record more work.",
  CLOSED: "This ticket is closed.",
  CANCELLED: "This ticket is closed.",
};

type StaffProps = {
  mode: "staff";
  assignees: Assignee[];
  currentUserId: number;
  /** Refetches the Ticket after a stale write, so its panels show the winner. */
  onTicketReload?: () => void;
  /**
   * Reports the list after every load (`mutated` false) and after every action
   * write here (`mutated` true), so Ticket Detail can count open actions and
   * refresh the resolution gate (Lab 4 ui-spec §7.4).
   */
  onActionsChange?: (actions: ActionTaken[], mutated: boolean) => void;
};
type RequesterProps = { mode: "requester" };

type ActionsTakenProps = {
  ticketId: number;
  ticketStatus: TicketStatusValue;
  /** Bumped by the parent when it changed actions itself, e.g. a Ticket cancel (BR-20). */
  reloadKey?: number;
} & (StaffProps | RequesterProps);

/**
 * Actions Taken (ui-spec §7.2, §8). Staff record and progress work here; a
 * Requester sees the same list read-only, without creator identity (BR-18). The
 * list keeps the API's order — Action Date/Time, then id — and is never re-sorted
 * on the client (BR-12).
 */
export function ActionsTaken(props: ActionsTakenProps) {
  const { ticketId, ticketStatus } = props;
  const staff = props.mode === "staff" ? props : null;
  const inactiveReason = INACTIVE_REASON[ticketStatus];

  const [load, setLoad] = useState<Load>("loading");
  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [form, setForm] = useState<ActionFormMode | null>(null);
  const [cancelling, setCancelling] = useState<ActionTaken | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ message: string; detail: string }>();
  const [opError, setOpError] = useState<string>();

  function publish(list: ActionTaken[], mutated: boolean) {
    setActions(list);
    staff?.onActionsChange?.(list, mutated);
  }

  async function fetchActions(): Promise<ActionTaken[]> {
    // A missing body is treated as no actions rather than a crash.
    const list = (await getActions(ticketId)) ?? [];
    publish(list, false);
    setLoad("ready");
    return list;
  }

  function loadActions() {
    setLoad("loading");
    fetchActions().catch(() => setLoad("error"));
  }

  useEffect(loadActions, [ticketId, props.reloadKey]);

  async function reloadAll(): Promise<ActionTaken[]> {
    staff?.onTicketReload?.();
    return fetchActions().catch(() => actions);
  }

  function replace(updated: ActionTaken) {
    publish(actions.map((a) => (a.id === updated.id ? updated : a)), true);
  }

  // Start, Complete, and Cancel from a row: one version-checked PATCH each.
  async function changeStatus(action: ActionTaken, status: ActionStatus) {
    setBusy(true);
    setConflict(undefined);
    setOpError(undefined);
    try {
      replace(await updateAction(action.id, { expectedVersion: action.version, status }));
    } catch (err) {
      if (err instanceof ConflictError && err.conflict === "stale") {
        const current = err.current as ActionTaken | undefined;
        setConflict({
          message: "This action was changed by someone else.",
          detail: current ? `Status is now ${actionStatusLabel(current.status)}.` : "Reload to see the latest version.",
        });
      } else {
        setOpError(err instanceof Error && err.name === "ConflictError" ? err.message : "We couldn't update the action. Please try again.");
        await fetchActions().catch(() => undefined);
      }
    } finally {
      setBusy(false);
      setCancelling(null);
    }
  }

  function complete(action: ActionTaken) {
    // Completing needs a Result (BR-07): ask for it instead of failing (UI-05).
    if (action.result.trim().length === 0) setForm({ kind: "edit", action, completing: true });
    else void changeStatus(action, "COMPLETED");
  }

  function onSaved(saved: ActionTaken) {
    setForm(null);
    const exists = actions.some((a) => a.id === saved.id);
    const next = exists ? actions.map((a) => (a.id === saved.id ? saved : a)) : [...actions, saved];
    // Keep BR-12's order for a new or re-dated action.
    publish([...next].sort((a, b) => a.actionAt.localeCompare(b.actionAt) || a.id - b.id), true);
  }

  const heading = load === "ready" ? `Actions Taken (${actions.length})` : "Actions Taken";

  return (
    <section className="zg-panel zg-actions" aria-label="Actions Taken">
      <div className="zg-list-head">
        <h2 className="zg-section-title zg-actions__title">{heading}</h2>
        {staff && load === "ready" && !inactiveReason && (
          <Button variant="primary" onClick={() => setForm({ kind: "create" })}>
            + Add action
          </Button>
        )}
      </div>

      {props.mode === "requester" && <p className="zg-field-message">Work the IT team has recorded on this ticket.</p>}
      {staff && inactiveReason && <p className="zg-muted zg-actions__inactive">{inactiveReason}</p>}

      {conflict && (
        <div className="zg-callout zg-callout--conflict" role="alert">
          <span>
            <strong>{conflict.message}</strong> {conflict.detail}
          </span>
          <Button
            variant="secondary"
            onClick={() => void reloadAll().then(() => setConflict(undefined))}
          >
            Reload
          </Button>
        </div>
      )}
      {opError && <ErrorCallout message={opError} />}

      {load === "loading" && <LoadingSkeleton rows={3} label="Loading actions…" />}
      {load === "error" && (
        <ErrorCallout message="We couldn't load the actions." onRetry={loadActions} retryLabel="Try again" />
      )}

      {load === "ready" && actions.length === 0 &&
        (staff ? (
          <div className="zg-actions__empty">
            <p className="zg-panel__body">No actions recorded yet.</p>
            {!inactiveReason && <p className="zg-field-message">Use + Add action to record the work.</p>}
          </div>
        ) : (
          <p className="zg-panel__body">The IT team hasn't recorded any work yet.</p>
        ))}

      {load === "ready" && actions.length > 0 && (
        <>
          <div className="zg-actions__head" aria-hidden="true">
            <span>Date / Time</span>
            <span>Action</span>
            <span>Performed by</span>
            <span>Status</span>
          </div>
          <ol className="zg-actions__list">
            {actions.map((a) => {
              const final = FINAL.includes(a.status);
              const readOnly = !staff || final || Boolean(inactiveReason);
              return (
                <li key={a.id} className={`zg-action-row${readOnly ? " zg-action-row--readonly" : ""}`}>
                  <span className="zg-action-row__when">{formatDateTime(a.actionAt)}</span>
                  <div className="zg-action-row__main">
                    <p className="zg-action-row__description">{a.description}</p>
                    <p className="zg-action-row__result">
                      <span className="zg-action-row__label">Result: </span>
                      <span>{a.result || "—"}</span>
                    </p>
                    {a.followUpRequired && (
                      <div className="zg-action-row__follow-up">
                        <span className="zg-chip zg-chip--follow-up">Follow-up needed</span>
                        <p>{a.followUpNote}</p>
                      </div>
                    )}
                    {a.attachmentNotes && <p className="zg-action-row__files">Files: {a.attachmentNotes}</p>}
                    {staff && a.createdBy && a.createdBy.id !== a.performedBy.id && (
                      <p className="zg-action-row__recorded">Recorded by {a.createdBy.name}</p>
                    )}
                  </div>
                  <span className="zg-action-row__performer">
                    <span className="zg-action-row__label">Performed by: </span>
                    {a.performedBy.name}
                  </span>
                  <span className="zg-action-row__status">
                    <ActionStatusBadge value={a.status} />
                  </span>
                  {!readOnly && (
                    <RowControls
                      action={a}
                      busy={busy}
                      onEdit={() => setForm({ kind: "edit", action: a })}
                      onStart={() => void changeStatus(a, "IN_PROGRESS")}
                      onComplete={() => complete(a)}
                      onCancel={() => setCancelling(a)}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {staff && form && (
        <ActionForm
          ticketId={ticketId}
          mode={form}
          assignees={staff.assignees}
          currentUserId={staff.currentUserId}
          onClose={() => setForm(null)}
          onSaved={onSaved}
          onReload={reloadAll}
        />
      )}

      {cancelling && (
        <Dialog title="Cancel this action?" onClose={() => setCancelling(null)}>
          <p className="zg-panel__body">It will stay in the list as Cancelled and can't be changed afterwards.</p>
          <div className="zg-form-actions">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Keep action
            </Button>
            <Button variant="destructive" busy={busy} busyLabel="Cancelling…" onClick={() => void changeStatus(cancelling, "CANCELLED")}>
              Cancel action
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

interface RowControlsProps {
  action: ActionTaken;
  busy: boolean;
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * Row controls (ui-spec §7.2). Edit is a tertiary button; Start, Complete, and
 * Cancel action sit in a "⋯" menu on desktop (arrow keys move, Escape closes) and
 * show as full-width buttons in the mobile card.
 */
function RowControls({ action, busy, onEdit, onStart, onComplete, onCancel }: RowControlsProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

  function openMenu() {
    setOpen(true);
    setTimeout(() => items()[0]?.focus(), 0);
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      toggle.current?.focus();
    }
  }

  // Back to ⋯ before the item disappears, so a dialog the item opens returns
  // focus there when it closes (RESP-04). On mobile the toggle is hidden and the
  // items stay on screen, so focus stays on the item.
  const choose = (run: () => void) => () => {
    setOpen(false);
    if (toggle.current?.offsetParent) toggle.current.focus();
    run();
  };

  return (
    <div className="zg-action-row__controls">
      <Button variant="tertiary" disabled={busy} onClick={onEdit}>
        Edit
      </Button>
      <button
        ref={toggle}
        type="button"
        className="zg-btn zg-btn--tertiary zg-action-menu__toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`More actions for ${formatDateTime(action.actionAt)}`}
        disabled={busy}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        ⋯
      </button>
      <div
        ref={menu}
        id={menuId}
        role="menu"
        className={`zg-action-menu${open ? " zg-action-menu--open" : ""}`}
        onKeyDown={onMenuKey}
      >
        {action.status === "PLANNED" && (
          <button type="button" role="menuitem" className="zg-btn zg-btn--secondary" disabled={busy} onClick={choose(onStart)}>
            Start
          </button>
        )}
        <button type="button" role="menuitem" className="zg-btn zg-btn--secondary" disabled={busy} onClick={choose(onComplete)}>
          Complete
        </button>
        <button type="button" role="menuitem" className="zg-btn zg-btn--destructive" disabled={busy} onClick={choose(onCancel)}>
          Cancel action
        </button>
      </div>
    </div>
  );
}
