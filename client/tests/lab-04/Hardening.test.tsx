import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CreateTicket } from "../../src/screens/CreateTicket.js";
import { UserManagement } from "../../src/screens/UserManagement.js";
import { StaffTicketQueue } from "../../src/screens/StaffTicketQueue.js";
import { PublicComments } from "../../src/components/PublicComments.js";
import { InternalNotes } from "../../src/components/InternalNotes.js";
import * as api from "../../src/api.js";

// UI-40…UI-42 (docs/lab-04/tests.md §2.7). Contract: spec AC-59, AC-60, FR-22;
// ui-spec §10 P-01, P-02, P-05, P-06.
vi.mock("../../src/api.js", async (importOriginal) => {
  const real = await importOriginal<typeof api>();
  return {
    ...real,
    getCategories: vi.fn(),
    getRelatedSystems: vi.fn(),
    createTicket: vi.fn(),
    getComments: vi.fn(),
    postComment: vi.fn(),
    postNote: vi.fn(),
    listUsers: vi.fn(),
    createUser: vi.fn(),
    getStaffQueue: vi.fn(),
  };
});
vi.mock("../../src/auth.js", () => {
  const user = { id: 1, name: "Arthit Admin", email: "arthit@t.test", role: "ADMINISTRATOR" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});

const mocked = {
  getCategories: vi.mocked(api.getCategories),
  getRelatedSystems: vi.mocked(api.getRelatedSystems),
  createTicket: vi.mocked(api.createTicket),
  getComments: vi.mocked(api.getComments),
  postComment: vi.mocked(api.postComment),
  postNote: vi.mocked(api.postNote),
  listUsers: vi.mocked(api.listUsers),
  createUser: vi.mocked(api.createUser),
  getStaffQueue: vi.mocked(api.getStaffQueue),
};

/** A promise the test settles by hand, so a request stays in flight. */
function pending<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const withRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getCategories.mockResolvedValue([{ id: 1, name: "Hardware" }]);
  mocked.getRelatedSystems.mockResolvedValue([{ id: 7, name: "Corporate Laptop" }]);
  mocked.getComments.mockResolvedValue([]);
  mocked.listUsers.mockResolvedValue([]);
});

/**
 * Each important form (AC-59, AC-60): how to render it, fill it, find its submit
 * button, mock its request, and read back every value the user entered.
 */
interface FormCase {
  name: string;
  render: () => void;
  fill: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
  submit: () => HTMLElement;
  request: { mockReturnValue: (v: never) => unknown; mockRejectedValue: (e: unknown) => unknown };
  calls: () => number;
  values: () => Record<string, string>;
  expected: Record<string, string>;
}

const TICKET_DESCRIPTION = "The battery drops from full to nearly empty within an hour of light use.";

const FORMS: FormCase[] = [
  {
    name: "Create Ticket",
    render: () => withRouter(<CreateTicket />),
    fill: async (user) => {
      await user.selectOptions(await screen.findByLabelText(/Category/), "1");
      await user.selectOptions(screen.getByLabelText(/Related System/), "7");
      await user.type(screen.getByLabelText(/Ticket Summary/), "Battery drains fast");
      await user.type(screen.getByLabelText(/Description/), TICKET_DESCRIPTION);
    },
    submit: () => screen.getByRole("button", { name: /Submit Ticket|Submitting…/ }),
    request: mocked.createTicket as unknown as FormCase["request"],
    calls: () => mocked.createTicket.mock.calls.length,
    values: () => ({
      category: (screen.getByLabelText(/Category/) as HTMLSelectElement).value,
      system: (screen.getByLabelText(/Related System/) as HTMLSelectElement).value,
      summary: (screen.getByLabelText(/Ticket Summary/) as HTMLInputElement).value,
      description: (screen.getByLabelText(/Description/) as HTMLTextAreaElement).value,
    }),
    expected: { category: "1", system: "7", summary: "Battery drains fast", description: TICKET_DESCRIPTION },
  },
  {
    name: "Public Comment",
    render: () => withRouter(<PublicComments ticketId={12} />),
    fill: async (user) => user.type(await screen.findByLabelText("Add a comment"), "Still happening after the restart."),
    submit: () => screen.getByRole("button", { name: /Post comment|Posting…/ }),
    request: mocked.postComment as unknown as FormCase["request"],
    calls: () => mocked.postComment.mock.calls.length,
    values: () => ({ body: (screen.getByLabelText("Add a comment") as HTMLTextAreaElement).value }),
    expected: { body: "Still happening after the restart." },
  },
  {
    name: "Internal Note",
    render: () => withRouter(<InternalNotes ticketId={12} initial={[]} />),
    fill: async (user) => user.type(screen.getByLabelText("Add an internal note"), "Battery cycle count is 900."),
    submit: () => screen.getByRole("button", { name: /Add note|Adding…/ }),
    request: mocked.postNote as unknown as FormCase["request"],
    calls: () => mocked.postNote.mock.calls.length,
    values: () => ({ body: (screen.getByLabelText("Add an internal note") as HTMLTextAreaElement).value }),
    expected: { body: "Battery cycle count is 900." },
  },
  {
    name: "user create",
    render: () => withRouter(<UserManagement />),
    fill: async (user) => {
      await user.click(await screen.findByRole("button", { name: "+ Create user" }));
      await user.type(within(dialog()).getByLabelText(/Name/), "Wanida Chaiyo");
      await user.type(within(dialog()).getByLabelText(/Email/), "wanida@t.test");
      await user.selectOptions(within(dialog()).getByLabelText(/^Role/), "IT_STAFF");
      await user.type(within(dialog()).getByLabelText(/Initial password/), "FreshInitial!2026");
    },
    submit: () => within(dialog()).getByRole("button", { name: /Create user|Saving…/ }),
    request: mocked.createUser as unknown as FormCase["request"],
    calls: () => mocked.createUser.mock.calls.length,
    values: () => ({
      name: (within(dialog()).getByLabelText(/Name/) as HTMLInputElement).value,
      email: (within(dialog()).getByLabelText(/Email/) as HTMLInputElement).value,
      role: (within(dialog()).getByLabelText(/^Role/) as HTMLSelectElement).value,
      password: (within(dialog()).getByLabelText(/Initial password/) as HTMLInputElement).value,
    }),
    expected: { name: "Wanida Chaiyo", email: "wanida@t.test", role: "IT_STAFF", password: "FreshInitial!2026" },
  },
];

// UI-40 — AC-59, FR-19
describe("UI-40: a double click sends one request", () => {
  it.each(FORMS.map((f) => [f.name, f] as const))("%s", async (_name, form) => {
    const flight = pending<never>();
    form.request.mockReturnValue(flight.promise as never);
    const user = userEvent.setup();
    form.render();
    await form.fill(user);

    await user.dblClick(form.submit());

    expect(form.calls()).toBe(1);
    // While the one request is in flight, the button says so and cannot be pressed.
    expect(form.submit()).toBeDisabled();
    expect(form.submit()).toHaveAttribute("aria-busy", "true");
  });
});

// UI-41 — AC-60, FR-20
describe("UI-41: entered values survive a recoverable failure", () => {
  const failures = [
    ["a 500", () => new Error("Request failed: HTTP 500")],
    ["a network error", () => new TypeError("Failed to fetch")],
  ] as const;

  for (const form of FORMS) {
    it.each(failures)(`${form.name} keeps every value after %s`, async (_label, failure) => {
      form.request.mockRejectedValue(failure());
      const user = userEvent.setup();
      form.render();
      await form.fill(user);

      await user.click(form.submit());

      expect(await screen.findByText(/unable|couldn't|could not|failed|something went wrong/i)).toBeInTheDocument();
      expect(form.calls()).toBe(1);
      expect(form.values()).toEqual(form.expected);
      // The form can be sent again once the user is ready.
      expect(form.submit()).toBeEnabled();
    });
  }
});

// UI-42 — FR-22, ui-spec §10
describe("UI-42: no placeholder, duplicate, or obsolete UI in the source", () => {
  const SRC = join(process.cwd(), "src");
  const files = (function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|css)$/.test(name) ? [path] : [];
    });
  })(SRC);
  const sources = files.map((path) => ({ file: relative(SRC, path).replace(/\\/g, "/"), text: readFileSync(path, "utf8") }));
  const offenders = (pattern: RegExp, only = sources) => only.filter((s) => pattern.test(s.text)).map((s) => s.file);

  it("scans the whole client source", () => {
    expect(sources.map((s) => s.file)).toEqual(expect.arrayContaining(["App.tsx", "theme.css", "screens/MyTickets.tsx"]));
  });

  it.each([
    ["TODO", /\bTODO\b/],
    ["Lorem", /\bLorem\b/i],
    ["Coming soon", /coming soon/i],
    ["console.log", /console\.log\s*\(/],
    ['href="#"', /href=["']#["']/],
  ])("P-05: no file contains %s", (_label, pattern) => {
    expect(offenders(pattern)).toEqual([]);
  });

  it("P-01: dates are formatted only by the shared format.ts", () => {
    expect(sources.map((s) => s.file)).toContain("format.ts");
    expect(offenders(/toLocale(Date|Time)?String\s*\(/).filter((f) => f !== "format.ts")).toEqual([]);
  });

  it("P-06: every raw <button> declares its type", () => {
    const untyped = sources.flatMap((s) =>
      [...s.text.matchAll(/<button\b[^>]*>/g)].filter((m) => !/\btype=/.test(m[0])).map(() => s.file)
    );
    expect(untyped).toEqual([]);
  });

  // Headings stay short titles (Lab 2/3 tests name them exactly); the message a
  // user reads, a list's `empty` text or an EmptyState's `body`, is a sentence.
  it("P-07: every empty message and empty-state body is a full sentence", () => {
    const messages = sources.flatMap((s) => [...s.text.matchAll(/\b(?:empty|body)="([^"]+)"/g)].map((m) => `${s.file}: ${m[1]}`));
    expect(messages.length).toBeGreaterThan(10);
    expect(messages.filter((m) => !/^[^:]+: [A-Z].*[.!?]$/.test(m))).toEqual([]);
  });

  it("P-02: the Queue says its counts cover every status, so they never read as the dashboard's open counts", async () => {
    mocked.getStaffQueue.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
      counts: { unassigned: 9, mine: 6 },
    });
    render(
      <MemoryRouter initialEntries={["/staff/tickets"]}>
        <StaffTicketQueue />
      </MemoryRouter>
    );
    expect(await screen.findByLabelText("Queue counts")).toHaveTextContent("9 unassigned · 6 assigned to me (all statuses)");
  });
});
