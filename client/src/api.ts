const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2: call the real backend health endpoint. Throws when the request fails
// or the backend is unreachable, letting the UI show a single Offline state.
// Issue 4 will also fetch `${API_URL}/api/categories` and fill `categories`.
export async function checkSystem(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  // TODO(Issue 4): also GET `${API_URL}/api/categories` and return them here.
  return { online: true, categories: [] };
}
