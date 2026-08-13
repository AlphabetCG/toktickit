import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// The four states the UI must handle in Issue 4.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    // TODO(Issue 4): call checkSystem(), then either store the categories and
    // show Online + the list, or show Offline + a useful message.
    setState("loading");
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {/* TODO(Issue 4): render the loading / success / error states here. */}
    </div>
  );
}
