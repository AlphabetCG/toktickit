const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

// Confirms the backend is up (health), then returns the seeded categories.
// Throws if either request fails, so the UI can show a single Offline state.
export async function checkSystem(): Promise<Category[]> {
  const health = await fetch(`${API_URL}/api/health`);
  if (!health.ok) throw new Error(`Health check failed: HTTP ${health.status}`);

  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) throw new Error(`Categories request failed: HTTP ${res.status}`);

  return res.json();
}
