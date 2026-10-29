import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getTicket,
  getAssignees,
  setTicketOwner,
  setItPriority,
  setTicketStatus,
  NotFoundError,
  ValidationError,
  ConflictError,
  type ActionTaken,
  type Assignee,
  type RequestedPriority,
  type TicketDetail,
  type TicketStatusValue,
} from "../api.js";
import { useAuth } from "../auth.js";
import { PriorityBadge, StatusBadge, statusLabel } from "../components/Badge.js";
import { AttachmentSection } from "../components/AttachmentSection.js";
import { PublicComments } from "../components/PublicComments.js";
import { InternalNotes } from "../components/InternalNotes.js";
import { ActionsTaken } from "../components/ActionsTaken.js";
import { StatusHistory } from "../components/StatusHistory.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

type Load = "loading" | "ready" | "notfound" | "error";
type Unmet = { code: string; message: string }[];

const TERMINAL: TicketStatusValue[] = ["CLOSED", "CANCELLED"];
const CLOSED_REASON = "This ticket is closed and can no longer be updated.";
// The statuses the §5.3 matrix lets move to Resolved; the gate list explains the
// rule only where Resolved would otherwise be offered (ui-spec §7.4).
const RESOLVABLE_FROM: TicketStatusValue[] = ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Read-only label/value pair — never a disabled input (ui-spec §6.4, Lab 2 §8.4). */
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="zg-info">
      <dt className="zg-info__label">{label}</dt>
      <dd className="zg-info__value">{children}</dd>
    </div>
  );
}

// Turns a refused operation into the message shown inline in the operations panel.
function operationMessage(err: unknown): string {
  if (err instanceof ValidationError) return Object.values(err.fields)[0] ?? err.message;
  return (err as Error).message;
}

/**
 * IT Staff Ticket Detail (ui-spec §6.4; Lab 4 §7). Ticket information is
 * read-only; Ticket Operations is the only editable region. Every operation sends
 * the version last read (BR-61); a stale write shows the conflict banner (§2.7).
 * The Status select offers only the API's gate-aware permittedTransitions, and
 * lists what is missing before the Ticket can be resolved (BR-28).
 */
export function StaffTicketDetail() {
  const { id } = useParams();
  const ticketId = Number(id);
  const { user } = useAuth();

  const [load, setLoad] = useState<Load>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [nextStatus, setNextStatus] = useState<TicketStatusValue | "">("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [openActions, setOpenActions] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);
  const [actionsKey, setActionsKey] = useState(0);

  function loadTicket() {
    if (!Number.isInteger(ticketId)) {
      setLoad("notfound");
      return;
    }
    setLoad("loading");
    getTicket(ticketId)
      .then((t) => {
        setTicket(t);
        setLoad("ready");
      })
      .catch((err) => setLoad(err instanceof NotFoundError ? "notfound" : "error"));
  }

  // A quiet refetch: the screen stays in place (AC-30).
  const refreshTicket = () => getTicket(ticketId).then(setTicket).catch(() => undefined);

  useEffect(loadTicket, [ticketId]);
  useEffect(() => {
    getAssignees()
      .then(setAssignees)
      .catch(() => undefined); // the owner select still shows the current owner
  }, []);

  // Shared refusal handling: a stale write shows the banner (§2.7); any other
  // refusal is shown inline and the real state reloaded.
  async function refuse(err: unknown) {
    if (err instanceof ConflictError && err.conflict === "stale") {
      const current = err.current as { currentStatus?: TicketStatusValue } | undefined;
      setConflict(current?.currentStatus ? `Status is now ${statusLabel(current.currentStatus)}.` : "");
      return;
    }
    setOpError(operationMessage(err));
    if (!(err instanceof ValidationError)) await refreshTicket();
  }

  // Owner and IT Priority: version-checked, applied on change (ui-spec §7.4).
  async function run(action: (version: number) => Promise<Partial<TicketDetail>>) {
    if (!ticket) return;
    setBusy(true);
    setOpError(undefined);
    setConflict(undefined);
    try {
      // 0 never matches a stored version (≥ 1), so a missing one fails as stale.
      const patch = await action(ticket.version ?? 0);
      setTicket((t) => (t ? { ...t, ...patch } : t));
    } catch (err) {
      await refuse(err);
    } finally {
      setBusy(false);
    }
  }

  const changeOwner = (ownerId: number | null) =>
    run(async (v) => {
      const r = await setTicketOwner(ticketId, ownerId, v);
      return { owner: r.owner, version: r.version };
    });

  const changePriority = (itPriority: RequestedPriority) =>
    run(async (v) => {
      const r = await setItPriority(ticketId, itPriority, v);
      return { itPriority: r.itPriority, version: r.version };
    });

  async function applyStatus(status: TicketStatusValue) {
    if (!ticket) return;
    setConfirmingCancel(false);
    setBusy(true);
    setOpError(undefined);
    setConflict(undefined);
    try {
      const r = await setTicketStatus(ticketId, status, ticket.version ?? 0);
      setTicket((t) =>
        t
          ? { ...t, currentStatus: r.currentStatus, version: r.version, resolvedAt: r.resolvedAt, permittedTransitions: r.permittedTransitions }
          : t
      );
      setNextStatus("");
      setHistoryKey((k) => k + 1);
      if (r.cancelledActions > 0) setActionsKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ConflictError && err.conflict === "resolutionGate") {
        // A race: the gate was met when the options were drawn (UI-22, BR-27).
        setTicket((t) => (t ? { ...t, resolutionGate: { satisfied: false, unmet: err.unmet ?? [] } } : t));
        setNextStatus("");
        await refreshTicket();
      } else {
        // A stale conflict keeps the chosen target so the user can resubmit (UI-18).
        if (!(err instanceof ConflictError && err.conflict === "stale")) setNextStatus("");
        await refuse(err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    await refreshTicket();
    setConflict(undefined);
    setHistoryKey((k) => k + 1);
  }

  function onActionsChange(actions: ActionTaken[], mutated: boolean) {
    setOpenActions(actions.filter((a) => a.status === "PLANNED" || a.status === "IN_PROGRESS").length);
    // Recorded work changes the resolution gate (BR-25).
    if (mutated) void refreshTicket();
  }

  function onApply() {
    if (!nextStatus) return;
    // Cancelling is terminal and irreversible, so it is confirmed first (BR-24).
    if (nextStatus === "CANCELLED") setConfirmingCancel(true);
    else void applyStatus(nextStatus);
  }

  if (load === "loading") return <LoadingSkeleton rows={6} label="Loading ticket…" />;
  if (load === "notfound") {
    return (
      <EmptyState
        heading="Ticket not found"
        body="This ticket does not exist."
        action={<Link className="zg-btn zg-btn--secondary" to="/staff/tickets">Back to queue</Link>}
      />
    );
  }
  if (load === "error" || !ticket) {
    return <ErrorCallout message="We couldn't load this ticket. Please try again." onRetry={loadTicket} />;
  }

  const status = ticket.currentStatus as TicketStatusValue;
  const terminal = TERMINAL.includes(status);
  const transitions = ticket.permittedTransitions ?? [];
  const gate = ticket.resolutionGate;
  const showGate = Boolean(gate && !gate.satisfied && gate.unmet.length > 0 && RESOLVABLE_FROM.includes(status));
  // A deactivated owner keeps the ticket (BR-29) but is not an assignee option, so
  // the select still shows them rather than silently displaying "Unassigned".
  const ownerOptions =
    ticket.owner && !assignees.some((a) => a.id === ticket.owner!.id)
      ? [...assignees, { id: ticket.owner.id, name: ticket.owner.name, role: "IT_STAFF" as const }]
      : assignees;

  return (
    <section>
      <Link to="/staff/tickets" className="zg-back-link">‹ Back to queue</Link>

      <div className="zg-detail-head">
        <h1 className="zg-page-title" style={{ margin: 0 }}>{ticket.ticketNumber}</h1>
        <span className="zg-detail-badges">
          <StatusBadge value={status} />
          <span className="zg-badge-label">IT Priority</span>
          <PriorityBadge value={ticket.itPriority} />
          {ticket.resolutionSignalledAt && <span className="zg-signal-chip">Requester says resolved</span>}
        </span>
      </div>

      <div className="zg-panel zg-detail-info" data-testid="ticket-information">
        <dl className="zg-info-grid">
          <Info label="Requester">{ticket.requester.name} ({ticket.requester.email})</Info>
          <Info label="Requested Priority"><PriorityBadge value={ticket.requestedPriority} /></Info>
          <Info label="Category">{ticket.category.name}</Info>
          <Info label="Related System">{ticket.relatedSystem.name}</Info>
          <Info label="Ticket Date">{formatDate(ticket.ticketDate)}</Info>
          <Info label="Last Updated">{formatDate(ticket.updatedAt)}</Info>
        </dl>
        <div className="zg-info">
          <dt className="zg-info__label">Summary</dt>
          <dd className="zg-info__value zg-detail-text">{ticket.summary}</dd>
        </div>
        <div className="zg-info">
          <dt className="zg-info__label">Description</dt>
          <dd className="zg-info__value zg-detail-text">{ticket.description}</dd>
        </div>
      </div>

      <section className="zg-panel zg-ops" aria-label="Ticket Operations">
        <h2 className="zg-section-title zg-ops__title">Ticket Operations</h2>

        {conflict !== undefined && (
          <div className="zg-callout zg-callout--conflict" role="alert">
            <span>
              <strong>This ticket was changed by someone else.</strong> {conflict} Your changes are still below.
            </span>
            <Button variant="secondary" onClick={() => void reload()}>
              Reload
            </Button>
          </div>
        )}
        {opError && <ErrorCallout message={opError} />}

        <div className="zg-ops__row">
          <label className="zg-label" htmlFor="owner">Owner</label>
          <select
            id="owner"
            className="zg-field"
            value={ticket.owner?.id ?? ""}
            disabled={busy}
            onChange={(e) => void changeOwner(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Unassigned</option>
            {ownerOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {/* Claim only when unassigned; Release only when assigned (ui-spec §6.4). */}
          {ticket.owner ? (
            <Button variant="secondary" disabled={busy} onClick={() => void changeOwner(null)}>Release</Button>
          ) : (
            <Button variant="secondary" disabled={busy || !user} onClick={() => void changeOwner(user!.id)}>Claim</Button>
          )}
        </div>

        <div className="zg-ops__row">
          <label className="zg-label" htmlFor="itPriority">IT Priority</label>
          <select
            id="itPriority"
            className="zg-field"
            value={ticket.itPriority}
            disabled={busy}
            onChange={(e) => void changePriority(e.target.value as RequestedPriority)}
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="zg-ops__row">
          <label className="zg-label" htmlFor="status">Status</label>
          {terminal || transitions.length === 0 ? (
            <p className="zg-field-message" id="status">{CLOSED_REASON}</p>
          ) : (
            <>
              <select
                id="status"
                className="zg-field"
                value={nextStatus}
                disabled={busy}
                onChange={(e) => setNextStatus(e.target.value as TicketStatusValue | "")}
              >
                <option value="">Choose a new status…</option>
                {transitions.map((t) => (
                  <option key={t} value={t}>{statusLabel(t)}</option>
                ))}
                {/* A stale target stays selected so it can be resubmitted (UI-18). */}
                {nextStatus && !transitions.includes(nextStatus) && (
                  <option value={nextStatus}>{statusLabel(nextStatus)}</option>
                )}
              </select>
              <Button variant="primary" disabled={!nextStatus || busy} busy={busy} busyLabel="Applying…" onClick={onApply}>
                Apply
              </Button>
            </>
          )}
        </div>

        {showGate && gate && (
          <div className="zg-gate" aria-live="polite">
            <p className="zg-gate__title">To resolve this ticket:</p>
            <ul className="zg-gate__list">
              {gate.unmet.map((u) => (
                <li key={u.code}>{u.message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {confirmingCancel && (
        // The name "Cancel ticket" is Lab 3's, kept so its E2E suite runs unchanged.
        <Dialog title="Cancel this ticket?" label="Cancel ticket" onClose={() => setConfirmingCancel(false)}>
          <p className="zg-panel__body">Cancelling is permanent. This ticket cannot be reopened.</p>
          {openActions > 0 && (
            <p className="zg-panel__body">
              {openActions} open action{openActions === 1 ? "" : "s"} will also be cancelled.
            </p>
          )}
          <div className="zg-form-actions">
            <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>Keep ticket</Button>
            <Button variant="destructive" busy={busy} busyLabel="Cancelling…" onClick={() => void applyStatus("CANCELLED")}>
              Cancel ticket
            </Button>
          </div>
        </Dialog>
      )}

      {/* Lab 4 §7.1: recording work comes right after taking the Ticket. */}
      <ActionsTaken
        ticketId={ticket.id}
        ticketStatus={status}
        mode="staff"
        assignees={assignees}
        currentUserId={user?.id ?? 0}
        reloadKey={actionsKey}
        onTicketReload={() => void refreshTicket()}
        onActionsChange={onActionsChange}
      />
      <StatusHistory ticketId={ticket.id} viewer="staff" refreshKey={historyKey} />

      <AttachmentSection ticketId={ticket.id} initial={ticket.attachments} />
      <PublicComments ticketId={ticket.id} disabledReason={terminal ? CLOSED_REASON : undefined} />
      <InternalNotes
        ticketId={ticket.id}
        initial={ticket.internalNotes ?? []}
        disabledReason={terminal ? CLOSED_REASON : undefined}
      />
    </section>
  );
}
