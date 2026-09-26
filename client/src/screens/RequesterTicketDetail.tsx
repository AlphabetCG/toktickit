import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTicket, signalResolution, NotFoundError, type TicketDetail } from "../api.js";
import { useAuth } from "../auth.js";
import { PriorityBadge, StatusBadge } from "../components/Badge.js";
import { AttachmentSection } from "../components/AttachmentSection.js";
import { PublicComments } from "../components/PublicComments.js";
import { Button } from "../components/Button.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

type Load = "loading" | "ready" | "notfound" | "error";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Read-only label/value pair — never a disabled input (AC-23, ui-spec §8.4). */
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="zg-info">
      <dt className="zg-info__label">{label}</dt>
      <dd className="zg-info__value">{children}</dd>
    </div>
  );
}

export function RequesterTicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const ticketId = Number(id);

  const [load, setLoad] = useState<Load>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [signalledAt, setSignalledAt] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [signalling, setSignalling] = useState(false);

  function loadTicket() {
    if (!user || !Number.isInteger(ticketId)) {
      setLoad("notfound");
      return;
    }
    setLoad("loading");
    getTicket(ticketId)
      .then((t) => {
        setTicket(t);
        setSignalledAt(t.resolutionSignalledAt);
        setLoad("ready");
      })
      .catch((err) => setLoad(err instanceof NotFoundError ? "notfound" : "error"));
  }

  useEffect(loadTicket, [user, ticketId]);

  async function confirmSignal() {
    setSignalling(true);
    try {
      const result = await signalResolution(ticketId);
      setSignalledAt(result.resolutionSignalledAt);
      setConfirming(false);
    } finally {
      setSignalling(false);
    }
  }

  if (load === "loading") return <LoadingSkeleton rows={6} label="Loading ticket…" />;

  if (load === "notfound") {
    return (
      <EmptyState
        heading="Ticket not found"
        body="This ticket does not exist, or it belongs to another Requester."
        action={<Link className="zg-btn zg-btn--secondary" to="/tickets">Back to My Tickets</Link>}
      />
    );
  }

  if (load === "error" || !ticket) {
    return <ErrorCallout message="We couldn't load this ticket. Please try again." onRetry={loadTicket} />;
  }

  return (
    <section>
      <Link to="/tickets" className="zg-back-link">‹ Back to My Tickets</Link>

      <div className="zg-detail-head">
        <h1 className="zg-page-title" style={{ margin: 0 }}>{ticket.ticketNumber}</h1>
        <span className="zg-detail-badges">
          <StatusBadge value={ticket.currentStatus as "NEW"} />
          <PriorityBadge value={ticket.requestedPriority} />
          {/* After signalling, a pale chip replaces the action; the status badge
              above is deliberately unchanged (AC-25, ui-spec §8.1). */}
          {signalledAt ? (
            <span className="zg-signal-chip">✓ You reported this resolved</span>
          ) : (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Problem appears resolved
            </Button>
          )}
        </span>
      </div>

      {confirming && (
        <div className="zg-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Report resolved">
          <div className="zg-dialog">
            <h3 className="zg-panel__heading">Report this problem as resolved?</h3>
            <p className="zg-panel__body">
              This tells the IT team the problem looks fixed. They will confirm and close the
              ticket. It does not change the ticket's status yourself.
            </p>
            <div className="zg-form-actions">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="primary" busy={signalling} busyLabel="Sending…" onClick={confirmSignal}>
                Yes, it looks resolved
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="zg-panel zg-detail-info">
        <dl className="zg-info-grid">
          <Info label="Ticket Date">{formatDateTime(ticket.ticketDate)}</Info>
          <Info label="Requester">
            {ticket.requester.name} ({ticket.requester.email})
          </Info>
          <Info label="Category">{ticket.category.name}</Info>
          <Info label="Related System">{ticket.relatedSystem.name}</Info>
          <Info label="Requested Priority"><PriorityBadge value={ticket.requestedPriority} /></Info>
          <Info label="Current Status"><StatusBadge value={ticket.currentStatus as "NEW"} /></Info>
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

      <AttachmentSection ticketId={ticket.id} initial={ticket.attachments} />

      {/* Public Comments only. No Internal Notes region on the Requester's
          detail in any state (AC-24, ui-spec §8.1). */}
      <PublicComments ticketId={ticket.id} />
    </section>
  );
}
