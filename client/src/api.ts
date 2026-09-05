const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Requester {
  id: number;
  name: string;
  email: string;
}

// Active Development Requesters for the selection screen. Public endpoint — the
// selector must load before any Requester exists in the client's state. Throws
// on failure so the selector can show its error state with a retry (BR-23).
export async function getRequesters(): Promise<Requester[]> {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) throw new Error(`Requesters request failed: HTTP ${res.status}`);
  return res.json();
}
