import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTicket, NotFoundError, type TicketDetail } from "../api.js";
import { useRequester } from "../requester.js";
import { PriorityBadge, StatusBadge } from "../components/Badge.js";
import { AttachmentSection } from "../components/AttachmentSection.js";
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
  const { requester } = useRequester();
  const ticketId = Number(id);

  const [load, setLoad] = useState<Load>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);

  function loadTicket() {
    if (!requester || !Number.isInteger(ticketId)) {
      setLoad("notfound");
      return;
    }
    setLoad("loading");
    getTicket(requester.id, ticketId)
      .then((t) => {
        setTicket(t);
        setLoad("ready");
      })
      .catch((err) => setLoad(err instanceof NotFoundError ? "notfound" : "error"));
  }

  useEffect(loadTicket, [requester, ticketId]);

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
        </span>
      </div>

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

      <AttachmentSection requesterId={requester!.id} ticketId={ticket.id} initial={ticket.attachments} />
    </section>
  );
}
