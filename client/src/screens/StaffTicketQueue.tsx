import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getStaffQueue,
  getCategories,
  ForbiddenError,
  type QueueResponse,
  type Category,
} from "../api.js";
import { Button } from "../components/Button.js";
import { PriorityBadge, StatusBadge, type TicketStatus } from "../components/Badge.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

const PAGE_SIZES = [10, 20, 50];

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_FOR_REQUESTER", label: "Waiting for Requester" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REOPENED", label: "Reopened" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SORTS = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "ticketDate", label: "Ticket Date" },
  { value: "itPriority", label: "IT Priority" },
  { value: "ticketNumber", label: "Ticket Number" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

interface Query {
  search: string;
  status: string;
  itPriority: string;
  ownerId: string;
  categoryId: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}

// §9.3 defaults: most recently touched first, 20 rows — a triage view is scanned.
const INITIAL: Query = {
  search: "",
  status: "",
  itPriority: "",
  ownerId: "",
  categoryId: "",
  sort: "updatedAt",
  order: "desc",
  page: 1,
  pageSize: 20,
};

type Load = "loading" | "ready" | "forbidden" | "error";

/**
 * IT Staff Ticket Queue (ui-spec §6.3). Seven columns at desktop; the shared
 * `.zg-table` becomes cards below 768px rather than scrolling sideways.
 */
export function StaffTicketQueue() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState<Query>(INITIAL);
  const [data, setData] = useState<QueueResponse | null>(null);
  const [load, setLoad] = useState<Load>("loading");

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => undefined); // the queue's own states cover a failed load
  }, []);

  // Debounce search into the query, back to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((q) => (q.search === searchText ? q : { ...q, search: searchText, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // AbortController discards a slow earlier response so it cannot overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController();
    setLoad("loading");
    getStaffQueue(query, { signal: controller.signal })
      .then((res) => {
        setData(res);
        setLoad("ready");
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setLoad(err instanceof ForbiddenError ? "forbidden" : "error");
      });
    return () => controller.abort();
  }, [query]);

  const filtersActive = Boolean(query.search || query.status || query.itPriority || query.ownerId || query.categoryId);

  function update(patch: Partial<Query>) {
    setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 1 }));
  }

  function clearFilters() {
    setSearchText("");
    setQuery({ ...INITIAL });
  }

  if (load === "forbidden") {
    return (
      <EmptyState
        heading="You don't have access to the ticket queue"
        body="The queue is available to IT Staff and Administrators."
      />
    );
  }

  const direction = query.order === "desc" ? "descending" : "ascending";

  return (
    <section>
      <div className="zg-list-head">
        <h1 className="zg-page-title">Ticket Queue</h1>
        {data && (
          <p className="zg-queue-counts" aria-label="Queue counts">
            {data.counts.unassigned} unassigned · {data.counts.mine} assigned to me
          </p>
        )}
      </div>

      <div className="zg-toolbar">
        <input
          className="zg-field zg-search"
          type="search"
          placeholder="Search number or summary"
          aria-label="Search tickets"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select className="zg-field" aria-label="Filter by status" value={query.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select className="zg-field" aria-label="Filter by IT priority" value={query.itPriority} onChange={(e) => update({ itPriority: e.target.value })}>
          <option value="">All IT priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select className="zg-field" aria-label="Filter by owner" value={query.ownerId} onChange={(e) => update({ ownerId: e.target.value })}>
          <option value="">All owners</option>
          <option value="unassigned">Unassigned</option>
          <option value="me">Assigned to me</option>
        </select>
        <select className="zg-field" aria-label="Filter by category" value={query.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="zg-field" aria-label="Sort by" value={query.sort} onChange={(e) => update({ sort: e.target.value })}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <Button
          variant="secondary"
          aria-label={`Sort direction: ${direction}`}
          title={`Sort direction: ${direction}`}
          onClick={() => update({ order: query.order === "desc" ? "asc" : "desc" })}
        >
          {query.order === "desc" ? "↓" : "↑"}
        </Button>
        {filtersActive && (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {load === "loading" && <LoadingSkeleton rows={6} label="Loading the ticket queue…" />}

      {load === "error" && (
        <ErrorCallout
          message="We couldn't load the ticket queue. Please try again."
          onRetry={() => setQuery((q) => ({ ...q }))}
        />
      )}

      {load === "ready" && data && data.totalItems === 0 && (
        filtersActive ? (
          <EmptyState
            heading="No tickets match your filters"
            body="Try a different search term, or clear the filters to see the whole queue."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState heading="No tickets in the queue" body="New requests will appear here as they arrive." />
        )
      )}

      {load === "ready" && data && data.totalItems > 0 && (
        <>
          <table className="zg-table">
            <thead>
              <tr>
                <th>Ticket No.</th>
                <th>Summary</th>
                <th>Category</th>
                <th>IT Priority</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr
                  key={t.id}
                  className="zg-row"
                  tabIndex={0}
                  onClick={() => navigate(`/staff/tickets/${t.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/staff/tickets/${t.id}`);
                  }}
                >
                  <td data-label="Ticket No.">
                    <Link to={`/staff/tickets/${t.id}`} onClick={(e) => e.stopPropagation()}>
                      {t.ticketNumber}
                    </Link>
                  </td>
                  <td data-label="Summary" className="zg-cell-summary" title={t.summary}>
                    {t.summary}
                  </td>
                  <td data-label="Category">{t.category.name}</td>
                  <td data-label="IT Priority">
                    <PriorityBadge value={t.itPriority} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge value={t.currentStatus} />
                    {t.resolutionSignalled && <span className="zg-signal-chip">Requester says resolved</span>}
                  </td>
                  <td data-label="Owner">
                    {/* "Unassigned" as muted text — an empty cell reads as a rendering bug. */}
                    {t.owner ? t.owner.name : <span className="zg-muted">Unassigned</span>}
                  </td>
                  <td data-label="Last Updated">{formatDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="zg-pagination">
            <span className="zg-result-count">
              Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.totalItems)} of{" "}
              {data.totalItems}
            </span>
            <div className="zg-pager" role="navigation" aria-label="Pagination">
              <Button variant="secondary" disabled={data.page <= 1} aria-label="Previous page" title="Previous page" onClick={() => update({ page: data.page - 1 })}>
                ‹
              </Button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === data.page ? "primary" : "secondary"}
                  aria-current={p === data.page ? "page" : undefined}
                  onClick={() => update({ page: p })}
                >
                  {p}
                </Button>
              ))}
              <Button variant="secondary" disabled={data.page >= data.totalPages} aria-label="Next page" title="Next page" onClick={() => update({ page: data.page + 1 })}>
                ›
              </Button>
            </div>
            <label className="zg-rows-per-page">
              Rows:
              <select className="zg-field" aria-label="Rows per page" value={query.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })}>
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </section>
  );
}
