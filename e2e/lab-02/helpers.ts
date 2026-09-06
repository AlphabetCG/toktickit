import { expect, type Page } from "@playwright/test";

// The four active seed Requesters (server/prisma/seed.ts). Selection is by the
// visible option text, so the auto-increment ids do not need to be known.
export const REQUESTERS = {
  somchai: "Somchai Prasert",
  nadia: "Nadia Rahman",
  anong: "Anong Srisai",
  peter: "Peter Chen",
} as const;

export const TICKET_NUMBER_RE = /^TKT-\d{4}-\d{6}$/;

// A per-run token keeps summaries unique so a search matches exactly the Ticket a
// test just created, even though the database accumulates rows across runs.
export function runToken(): string {
  return `E2E-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** A minimal but valid 1×1 PNG — passes the server's magic-byte sniff (BR-51). */
export const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64"
);

/** Selects a seed Requester through the real selection screen (ui-spec §8.1). */
export async function selectRequester(page: Page, name: string): Promise<void> {
  await page.goto("/select");
  const select = page.locator("#requester");
  await expect(select).toBeVisible();
  const value = await page
    .locator("#requester option", { hasText: name })
    .first()
    .getAttribute("value");
  await select.selectOption(value!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/tickets");
}

/** Switches the active Requester from anywhere in the shell (BR-22, AC-04). */
export async function changeRequester(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Change Requester" }).click();
  await page.waitForURL("**/select");
  const value = await page
    .locator("#requester option", { hasText: name })
    .first()
    .getAttribute("value");
  await page.locator("#requester").selectOption(value!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/tickets");
}

export interface TicketFields {
  category?: string;
  system?: string;
  priority?: "Low" | "Medium" | "High";
  summary: string;
  description: string;
}

/**
 * Fills and submits Create Ticket, returning the official Ticket Number shown on
 * the success panel (ui-spec §8.2). Leaves the page on the success state.
 */
export async function createTicket(page: Page, fields: TicketFields): Promise<string> {
  await page.goto("/tickets/new");
  await page.locator("#categoryId").selectOption({ label: fields.category ?? "Hardware" });
  await page.locator("#relatedSystemId").selectOption({ label: fields.system ?? "Corporate Laptop" });
  await page.getByRole("radio", { name: fields.priority ?? "Medium" }).check();
  await page.locator("#summary").fill(fields.summary);
  await page.locator("#description").fill(fields.description);
  await page.getByRole("button", { name: "Submit Ticket" }).click();

  const panel = page.getByRole("status");
  await expect(panel).toBeVisible();
  const number = await panel.locator(".zg-ticket-number").innerText();
  return number.trim();
}

/** Follows the success panel's View ticket action and returns the Ticket id. */
export async function openCreatedTicket(page: Page): Promise<number> {
  await page.getByRole("button", { name: "View ticket" }).click();
  await page.waitForURL(/\/tickets\/\d+$/);
  const match = page.url().match(/\/tickets\/(\d+)$/);
  return Number(match![1]);
}
