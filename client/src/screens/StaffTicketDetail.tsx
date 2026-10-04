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
import { Button } from "../components/Button.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

type Load = "loading" | "ready" | "notfound" | "error";

const TERMINAL: TicketStatusValue[] = ["CLOSED", "CANCELLED"];
const CLOSED_REASON = "This ticket is closed and can no longer be updated.";

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
 * IT Staff Ticket Detail (ui-spec §6.4). Ticket information is read-only; the
 * Ticket Operations card is the only editable region. The Status select offers
 * only the API's permittedTransitions, and Cancelled asks for confirmation (BR-38).
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

  useEffect(loadTicket, [ticketId]);
  useEffect(() => {
    getAssignees()
      .then(setAssignees)
      .catch(() => undefined); // the owner select still shows the current owner
  }, []);

  // Runs one operation, keeping the rest of the screen usable on a refusal: the
  // conflict or validation message renders inline in this panel (ui-spec §6.4).
  async function run(action: () => Promise<Partial<TicketDetail>>) {
    setBusy(true);
    setOpError(undefined);
    try {
      const patch = await action();
      setTicket((t) => (t ? { ...t, ...patch } : t));
    } catch (err) {
      setOpError(operationMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const changeOwner = (ownerId: number | null) =>
    run(async () => ({ owner: (await setTicketOwner(ticketId, ownerId)).owner }));

  const changePriority = (itPriority: RequestedPriority) =>
    run(async () => ({ itPriority: (await setItPriority(ticketId, itPriority)).itPriority }));

  // A status conflict means someone else moved the ticket first, so the offered
  // transitions are stale: show the server's reason and reload the real state.
  async function applyStatus(status: TicketStatusValue) {
    setConfirmingCancel(false);
    setBusy(true);
    setOpError(undefined);
    try {
      const r = await setTicketStatus(ticketId, status);
      setTicket((t) => (t ? { ...t, currentStatus: r.currentStatus, permittedTransitions: r.permittedTransitions } : t));
    } catch (err) {
      setOpError(operationMessage(err));
      if (!(err instanceof ValidationError)) {
        await getTicket(ticketId).then(setTicket).catch(() => undefined);
      }
    } finally {
      setNextStatus("");
      setBusy(false);
    }
  }

  function onApply() {
    if (!nextStatus) return;
    // Cancelling is terminal and irreversible, so it is confirmed first (BR-38).
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
              </select>
              <Button variant="primary" disabled={!nextStatus || busy} busy={busy} busyLabel="Applying…" onClick={onApply}>
                Apply
              </Button>
            </>
          )}
        </div>
      </section>

      {confirmingCancel && (
        <div className="zg-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Cancel ticket">
          <div className="zg-dialog">
            <h3 className="zg-panel__heading">Cancel this ticket?</h3>
            <p className="zg-panel__body">Cancelling is permanent. This ticket cannot be reopened.</p>
            <div className="zg-form-actions">
              <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>Keep ticket</Button>
              <Button variant="destructive" busy={busy} busyLabel="Cancelling…" onClick={() => void applyStatus("CANCELLED")}>
                Cancel ticket
              </Button>
            </div>
          </div>
        </div>
      )}

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
