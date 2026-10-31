import { expect, type APIRequestContext, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { apiAs, signIn, type TestUser } from "../lab-03/helpers";

// Lab 4 additions to the Lab 3 helpers. Fixtures go through the real API as the
// role that may make them (IT Staff record actions and change status), never
// behind the server's back, so every E2E state is one the application can reach.

export * from "../lab-03/helpers";

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const;
export type Viewport = keyof typeof VIEWPORTS;

/** A signed-in page in its own browser context, so two users never share a cookie. */
export async function pageAs(
  browser: Browser,
  user: TestUser,
  options: BrowserContextOptions & { path?: string } = {}
): Promise<Page> {
  const { path, ...context } = options;
  const page = await (await browser.newContext(context)).newPage();
  await signIn(page, user);
  if (path) await page.goto(path);
  return page;
}

/** Collects every console error and uncaught exception the page reports (AC-61). */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export async function withApi<T>(user: TestUser, fn: (ctx: APIRequestContext) => Promise<T>): Promise<T> {
  const ctx = await apiAs(user.email, user.password);
  try {
    return await fn(ctx);
  } finally {
    await ctx.dispose();
  }
}

async function versionOf(ctx: APIRequestContext, ticketId: number): Promise<number> {
  const res = await ctx.get(`/api/tickets/${ticketId}`);
  expect(res.status(), `read ticket ${ticketId}`).toBe(200);
  return (await res.json()).version;
}

/** Moves a Ticket to `status` as `staff` (BR-61: with the version just read). */
export async function setStatus(staff: TestUser, ticketId: number, status: string): Promise<void> {
  await withApi(staff, async (ctx) => {
    const res = await ctx.patch(`/api/tickets/${ticketId}/status`, {
      data: { status, expectedVersion: await versionOf(ctx, ticketId) },
    });
    expect(res.status(), `status → ${status}`).toBe(200);
  });
}

/** Assigns a Ticket to `ownerId` as `staff`. */
export async function setOwner(staff: TestUser, ticketId: number, ownerId: number): Promise<void> {
  await withApi(staff, async (ctx) => {
    const res = await ctx.patch(`/api/tickets/${ticketId}/owner`, {
      data: { ownerId, expectedVersion: await versionOf(ctx, ticketId) },
    });
    expect(res.status(), "assign owner").toBe(200);
  });
}

export interface ActionInput {
  description: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  result?: string;
  performedById?: number;
  followUpRequired?: boolean;
  followUpNote?: string;
  actionAt?: string;
}

/** Records an Action Taken as `staff` and returns its id. */
export async function addAction(staff: TestUser, ticketId: number, input: ActionInput): Promise<number> {
  return withApi(staff, async (ctx) => {
    const res = await ctx.post(`/api/tickets/${ticketId}/actions`, {
      data: { actionAt: new Date().toISOString(), result: "", ...input },
    });
    expect(res.status(), `add action: ${await res.text()}`).toBe(201);
    return (await res.json()).id;
  });
}

// --- Responsive and containment checks (RESP-01…RESP-05) ------------------------

const SHOT_ROOT = join(process.cwd(), "artifacts", "lab-04", "screenshots");

/** Writes `artifacts/lab-04/screenshots/<group>/<name>.png` (ui-spec §14). */
export async function shot(page: Page, group: string, name: string, fullPage = true): Promise<void> {
  const dir = join(SHOT_ROOT, group);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage });
}

/** AC-62: the page itself never scrolls sideways (sub-pixel tolerance). */
export async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where}: page must not scroll horizontally`).toBeLessThanOrEqual(1);
}

/** Below 768 px every visible button and single-line field is at least 44 px tall (ui-spec §12). */
export async function expectTouchSized(page: Page, where: string): Promise<void> {
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".zg-btn, input.zg-field, select.zg-field"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ what: el.getAttribute("aria-label") || el.id || el.textContent?.trim() || el.tagName, h: el.getBoundingClientRect().height }))
      .filter((c) => c.h < 44)
  );
  expect(small, `${where}: controls under 44 px tall`).toEqual([]);
}

/**
 * RESP-05: every metric card, action row, and form control lies inside the panel
 * (or dialog) that contains it, and no two visible controls overlap.
 */
export async function expectContained(page: Page, where: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed";
    const name = (el: Element) =>
      el.getAttribute("aria-label") || el.id || (el.textContent ?? "").trim().slice(0, 40) || el.tagName;
    const out: string[] = [];
    const items = Array.from(
      document.querySelectorAll(".zg-metric, .zg-action-row, .zg-btn, .zg-field, .zg-badge, .zg-chip")
    ).filter(visible);
    for (const el of items) {
      const box = el.parentElement?.closest(".zg-dialog, .zg-panel, .zg-metrics, .zg-mini-list");
      if (!box) continue;
      const r = el.getBoundingClientRect();
      const p = box.getBoundingClientRect();
      if (r.left < p.left - 1 || r.right > p.right + 1) out.push(`outside its panel: ${name(el)}`);
    }
    // A modal covers the page behind it by design, so only its own controls are
    // compared; a sticky or fixed bar (the mobile Save action) floats over the
    // content scrolling beneath it, also by design.
    const scope = document.querySelector('[role="dialog"]') ?? document;
    const floats = (el: Element) => {
      for (let n: Element | null = el; n && n !== scope; n = n.parentElement) {
        if (["sticky", "fixed"].includes(getComputedStyle(n).position)) return true;
      }
      return false;
    };
    const controls = Array.from(scope.querySelectorAll(".zg-btn, .zg-field, .zg-metric")).filter(
      (el) => visible(el) && !floats(el)
    );
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i];
        const b = controls[j];
        if (a.contains(b) || b.contains(a)) continue;
        const r = a.getBoundingClientRect();
        const s = b.getBoundingClientRect();
        const overlapX = Math.min(r.right, s.right) - Math.max(r.left, s.left);
        const overlapY = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
        if (overlapX > 1 && overlapY > 1) out.push(`overlap: ${name(a)} × ${name(b)}`);
      }
    }
    return out;
  });
  expect(problems, `${where}: containment`).toEqual([]);
}

/** The number a metric card announces, read from its accessible name ("Label: 4 — view list"). */
export async function metricValue(page: Page, label: string): Promise<number> {
  const name = await page.getByRole("link", { name: new RegExp(`^${label}: \\d+`) }).getAttribute("aria-label");
  const match = /: (\d+)/.exec(name ?? "");
  expect(match, `metric ${label}`).not.toBeNull();
  return Number(match![1]);
}

/** The total a list screen shows: "Showing 1–20 of N", or 0 on its empty state. */
export async function listTotal(page: Page): Promise<number> {
  const showing = page.locator(".zg-result-count");
  const empty = page.getByRole("heading", { name: /^No tickets/ });
  await expect(showing.or(empty).first()).toBeVisible();
  if (await empty.isVisible()) return 0;
  return Number(/of (\d+)/.exec((await showing.textContent()) ?? "")![1]);
}
