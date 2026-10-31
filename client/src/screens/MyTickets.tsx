import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  getTickets,
  getCategories,
  getRelatedSystems,
  type TicketListResponse,
  type Category,
  type RelatedSystem,
} from "../api.js";
import { useAuth } from "../auth.js";
import { Button } from "../components/Button.js";
import { PriorityBadge, StatusBadge, statusLabel, type TicketStatus } from "../components/Badge.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";
import { formatDate } from "../format.js";

const PAGE_SIZES = [10, 20, 50];
const SORTS = [
  { value: "ticketDate", label: "Ticket Date" },
  { value: "ticketNumber", label: "Ticket Number" },
  { value: "updatedAt", label: "Last Updated" },
];
// The Queue's order (Lab 3 ui-spec §6.3), so both lists read the same way.
const STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "REOPENED",
  "CLOSED",
  "CANCELLED",
];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
// The status select carries the group as its own option value (ui-spec §9).
const ALL_OPEN = "group:active";

interface Query {
  search: string;
  categoryId: string;
  relatedSystemId: string;
  priority: string;
  status: string;
  /** Lab 4: "active" = the five open statuses (api-spec §4); an explicit status wins. */
  statusGroup: string;
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
  status: "",
  statusGroup: "",
  sort: "ticketDate",
  order: "desc",
  page: 1,
  pageSize: 10,
};

type Load = "loading" | "ready" | "error";

/**
 * Lab 4 (ui-spec §9): the query string is the filter state. Each recognised
 * parameter is read; anything unrecognised falls back to its default, as the API
 * does (Lab 2 BR-36).
 */
function readQuery(params: URLSearchParams): Query {
  const get = (k: string) => params.get(k) ?? "";
  const id = (k: string) => (/^\d+$/.test(get(k)) ? get(k) : "");
  const status = (STATUSES as string[]).includes(get("status")) ? get("status") : "";
  const page = Number(get("page"));
  const pageSize = Number(get("pageSize"));
  return {
    search: get("search"),
    categoryId: id("categoryId"),
    relatedSystemId: id("relatedSystemId"),
    priority: PRIORITIES.includes(get("priority")) ? get("priority") : "",
    status,
    statusGroup: !status && get("statusGroup") === "active" ? "active" : "",
    sort: SORTS.some((o) => o.value === get("sort")) ? get("sort") : INITIAL.sort,
    order: get("order") === "asc" ? "asc" : get("order") === "desc" ? "desc" : INITIAL.order,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : INITIAL.pageSize,
  };
}

/** Only values that differ from the defaults go into the URL. */
function writeQuery(q: Query): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value !== "" && value !== INITIAL[key as keyof Query]) out.set(key, String(value));
  }
  return out;
}

export function MyTickets() {
  const { user } = useAuth();
  const requesterId = user!.id; // re-scopes the fetch effects when the user changes
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // Keyed on the string, so a re-render with the same URL keeps the same object
  // and the fetch below does not re-run.
  const paramKey = params.toString();
  const query = useMemo(() => readQuery(new URLSearchParams(paramKey)), [paramKey]);
  const fromDashboard = Boolean((location.state as { fromDashboard?: boolean } | null)?.fromDashboard);

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [searchText, setSearchText] = useState(query.search);
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [load, setLoad] = useState<Load>("loading");

  // Filter dropdown options, loaded once. If they fail the list's own error state
  // still covers the screen; filters simply have fewer options.
  useEffect(() => {
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([c, s]) => {
        setCategories(c);
        setSystems(s);
      })
      .catch(() => undefined);
  }, [requesterId]);

  // A change writes the URL as a new history entry, so Back restores the previous
  // filter (UI-39). Any change other than an explicit page move returns to page 1.
  // Rebuilt whenever the URL changes, so it never writes onto a stale query.
  const update = useCallback(
    (patch: Partial<Query>) => setParams(writeQuery({ ...query, ...patch, page: patch.page ?? 1 })),
    [query, setParams]
  );

  // Back/Forward changes the URL; the search box follows it.
  useEffect(() => setSearchText(query.search), [query.search]);

  // Debounce the search box into the query (BR-31). A filter change in the
  // meantime restarts the timer with the fresh `update`, so that filter is kept.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText !== query.search) update({ search: searchText });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, query.search, update]);

  // Fetch on any query change. AbortController discards a slow earlier response so
  // it cannot overwrite a newer one (the stale-response race).
  useEffect(() => {
    const controller = new AbortController();
    setLoad("loading");
    getTickets(query, { signal: controller.signal })
      .then((res) => {
        setData(res);
        setLoad("ready");
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setLoad("error");
      });
    return () => controller.abort();
  }, [requesterId, query, retryKey]);

  const filtersActive = Boolean(
    query.search || query.categoryId || query.relatedSystemId || query.priority || query.status || query.statusGroup
  );

  function clearFilters() {
    setSearchText("");
    setParams(new URLSearchParams());
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
        <select
          className="zg-field"
          aria-label="Filter by status"
          value={query.status || (query.statusGroup ? ALL_OPEN : "")}
          onChange={(e) =>
            update(e.target.value === ALL_OPEN ? { status: "", statusGroup: "active" } : { status: e.target.value, statusGroup: "" })
          }
        >
          <option value="">All statuses</option>
          <option value={ALL_OPEN}>All open</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
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

      {/* Why the list is shorter than usual, when a dashboard sent the user here (ui-spec §9). */}
      {fromDashboard && filtersActive && (
        <p className="zg-filtered-note">
          Filtered from Dashboard ·{" "}
          <button type="button" className="zg-link-button" onClick={clearFilters}>
            Show all tickets
          </button>
        </p>
      )}

      {load === "loading" && <LoadingSkeleton rows={5} label="Loading tickets…" />}

      {load === "error" && (
        <ErrorCallout
          message="We couldn't load your tickets. Please try again."
          onRetry={() => setRetryKey((k) => k + 1)}
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
                    <StatusBadge value={t.currentStatus as TicketStatus} />
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
