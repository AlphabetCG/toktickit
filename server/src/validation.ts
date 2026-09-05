// Field validation for ticket creation. Pure and synchronous so it runs
// identically on the boundaries in UNIT-03; reference-id existence (BR-41) is
// checked against the database in the route because it needs I/O.

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type RequestedPriority = (typeof PRIORITIES)[number];

const trim = (raw: unknown): string => (typeof raw === "string" ? raw.trim() : "");

// Summary: trimmed, 5–150 characters (BR-39).
export function validateSummary(raw: unknown): string | undefined {
  const value = trim(raw);
  if (value.length < 5 || value.length > 150) return "Summary must be 5–150 characters.";
  return undefined;
}

// Description: trimmed, 20–5000 characters (BR-40).
export function validateDescription(raw: unknown): string | undefined {
  const value = trim(raw);
  if (value.length < 20 || value.length > 5000) return "Description must be 20–5000 characters.";
  return undefined;
}

// Requested Priority: one of the three fixed values (D-02).
export function validatePriority(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !PRIORITIES.includes(raw as RequestedPriority)) {
    return "Select a valid priority.";
  }
  return undefined;
}
