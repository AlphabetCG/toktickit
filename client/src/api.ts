const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// TODO(Issue 2 & 4): fetch `${API_URL}/api/health`, then `${API_URL}/api/categories`,
// throwing if either response is not ok, and return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  throw new Error("checkSystem not implemented yet");
}
