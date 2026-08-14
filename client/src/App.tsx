import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// The four states the UI must handle in Issue 4.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem(); // Issue 2: real health API call
      setCategories(result.categories);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <p className="mt-4 mb-0">
          System Status: <span className="fw-semibold text-success">Online</span>
        </p>
      )}

      {state === "error" && (
        <div className="mt-4">
          <p className="mb-1">
            System Status: <span className="fw-semibold text-danger">Offline</span>
          </p>
          <p className="text-danger mb-0">Unable to connect to TokTickIT API</p>
        </div>
      )}

      {/* TODO(Issue 4): when state === "success", also render `categories`. */}
    </div>
  );
}
