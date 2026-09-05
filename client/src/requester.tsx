import { createContext, useContext, useState, type ReactNode } from "react";
import type { Requester } from "./api.js";

const STORAGE_KEY = "toktickit.requester";

interface RequesterContextValue {
  requester: Requester | null;
  /** Persist and activate a selection. */
  select: (requester: Requester) => void;
  /** Clear the selection (Change Requester) and return to the selector. */
  clear: () => void;
}

const RequesterContext = createContext<RequesterContextValue | null>(null);

function readStored(): Requester | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Requester>;
    if (typeof parsed.id === "number" && typeof parsed.name === "string") {
      return { id: parsed.id, name: parsed.name, email: parsed.email ?? "" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Holds the selected Development Requester. Persisted in localStorage so it
 * survives a reload (BR-21, D-10); the server re-validates the id on every
 * scoped request, so this is persistence, not a security boundary.
 */
export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequester] = useState<Requester | null>(readStored);

  const select = (r: Requester) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    setRequester(r);
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRequester(null);
  };

  return (
    <RequesterContext.Provider value={{ requester, select, clear }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester(): RequesterContextValue {
  const ctx = useContext(RequesterContext);
  if (!ctx) throw new Error("useRequester must be used within a RequesterProvider");
  return ctx;
}
