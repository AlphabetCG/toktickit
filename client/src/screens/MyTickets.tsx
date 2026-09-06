import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getTickets,
  getCategories,
  getRelatedSystems,
  type TicketListResponse,
  type Category,
  type RelatedSystem,
} from "../api.js";
import { useRequester } from "../requester.js";
import { Button } from "../components/Button.js";
import { PriorityBadge, StatusBadge } from "../components/Badge.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

const PAGE_SIZES = [10, 20, 50];
const SORTS = [
  { value: "ticketDate", label: "Ticket Date" },
  { value: "ticketNumber", label: "Ticket Number" },
  { value: "updatedAt", label: "Last Updated" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface Query {
  search: string;
  categoryId: string;
  relatedSystemId: string;
  priority: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}

const INITIAL: Query = {
  search: "",
  categoryId: "",
  relatedSystemId: "",
  priority: "",
  sort: "ticketDate",
  order: "desc",
  page: 1,
  pageSize: 10,
};

type Load = "loading" | "ready" | "error";

export function MyTickets() {
  const { requester } = useRequester();
  const requesterId = requester!.id;
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState<Query>(INITIAL);
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [load, setLoad] = useState<Load>("loading");

  // Filter dropdown options, loaded once. If they fail the list's own error state
  // still covers the screen; filters simply have fewer options.
  useEffect(() => {
    Promise.all([getCategories(requesterId), getRelatedSystems(requesterId)])
      .then(([c, s]) => {
        setCategories(c);
        setSystems(s);
      })
      .catch(() => undefined);
  }, [requesterId]);

  // Debounce the search box into the query (BR-31), resetting to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((q) => (q.search === searchText ? q : { ...q, search: searchText, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch on any query change. AbortController discards a slow earlier response so
  // it cannot overwrite a newer one (the stale-response race).
  useEffect(() => {
    const controller = new AbortController();
    setLoad("loading");
    getTickets(requesterId, query, { signal: controller.signal })
      .then((res) => {
        setData(res);
        setLoad("ready");
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setLoad("error");
      });
    return () => controller.abort();
  }, [requesterId, query]);

  const filtersActive = Boolean(
    query.search || query.categoryId || query.relatedSystemId || query.priority
  );

  function update(patch: Partial<Query>) {
    // Any change other than an explicit page move returns to page 1.
    setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 1 }));
  }

  function clearFilters() {
    setSearchText("");
    setQuery({ ...INITIAL });
  }

  return (
    <section>
      <div className="zg-list-head">
        <h1 className="zg-page-title">My Tickets</h1>
        <Button variant="primary" onClick={() => navigate("/tickets/new")}>
          + Create Ticket
        </Button>
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
        <select className="zg-field" aria-label="Filter by category" value={query.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="zg-field" aria-label="Filter by related system" value={query.relatedSystemId} onChange={(e) => update({ relatedSystemId: e.target.value })}>
          <option value="">All systems</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="zg-field" aria-label="Filter by priority" value={query.priority} onChange={(e) => update({ priority: e.target.value })}>
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <select className="zg-field" aria-label="Sort by" value={query.sort} onChange={(e) => update({ sort: e.target.value })}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <Button
          variant="secondary"
          aria-label={`Sort direction: ${query.order === "desc" ? "descending" : "ascending"}`}
          title={`Sort direction: ${query.order === "desc" ? "descending" : "ascending"}`}
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

      {load === "loading" && <LoadingSkeleton rows={5} label="Loading tickets…" />}

      {load === "error" && (
        <ErrorCallout
          message="We couldn't load your tickets. Please try again."
          onRetry={() => setQuery((q) => ({ ...q }))}
        />
      )}

      {load === "ready" && data && data.totalItems === 0 && (
        filtersActive ? (
          <EmptyState
            heading="No tickets match your filters"
            body="Try a different search term, or clear the filters to see all your tickets."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            heading="No tickets yet"
            body="When you raise an IT request it will appear here."
            action={<Button variant="primary" onClick={() => navigate("/tickets/new")}>+ Create Ticket</Button>}
          />
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
                <th>Priority</th>
                <th>Status</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr
                  key={t.id}
                  className="zg-row"
                  tabIndex={0}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/tickets/${t.id}`);
                  }}
                >
                  <td data-label="Ticket No.">
                    <Link to={`/tickets/${t.id}`} onClick={(e) => e.stopPropagation()}>
                      {t.ticketNumber}
                    </Link>
                  </td>
                  <td data-label="Summary" className="zg-cell-summary" title={t.summary}>
                    {t.summary}
                  </td>
                  <td data-label="Category">{t.category.name}</td>
                  <td data-label="Priority">
                    <PriorityBadge value={t.requestedPriority} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge value={t.currentStatus as "NEW"} />
                  </td>
                  <td data-label="Last Updated">{formatDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="zg-pagination">
            <span className="zg-result-count">
              Showing {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.totalItems)} of {data.totalItems}
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
