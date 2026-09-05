import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRequesters, type Requester } from "../api.js";
import { useRequester } from "../requester.js";
import { Field } from "../components/Field.js";
import { Button } from "../components/Button.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

type LoadState = "loading" | "ready" | "empty" | "error";

/**
 * Development Requester Selection (ui-spec §8.1). Not a login (BR-61). Loads
 * active Requesters from the database (BR-20) and implements loading, empty
 * (BR-24), and API-failure (BR-23) states so the app cannot be entered until a
 * Requester is chosen (BR-19).
 */
export function RequesterSelection() {
  const navigate = useNavigate();
  const { select } = useRequester();
  const [load, setLoad] = useState<LoadState>("loading");
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [chosenId, setChosenId] = useState("");

  async function loadRequesters() {
    setLoad("loading");
    try {
      const list = await getRequesters();
      setRequesters(list);
      setLoad(list.length === 0 ? "empty" : "ready");
    } catch {
      setLoad("error");
    }
  }

  useEffect(() => {
    loadRequesters();
  }, []);

  function handleContinue() {
    const chosen = requesters.find((r) => String(r.id) === chosenId);
    if (!chosen) return;
    select(chosen);
    navigate("/tickets");
  }

  return (
    <div className="zg-select-page">
      <div className="zg-select-card">
        <h1 className="zg-select-title">TokTickIT</h1>
        {/* Always visible, never behind a tooltip or disclosure (BR-61). */}
        <p className="zg-select-intro">
          Select a Development Requester to test requester-specific ticket behavior.
          This is not a login screen. Authentication and role-based access will be
          introduced in Lab 3.
        </p>

        {load === "error" ? (
          <ErrorCallout
            message="We couldn't load the Development Requesters. Please try again."
            onRetry={loadRequesters}
          />
        ) : load === "empty" ? (
          <EmptyState
            heading="No active Requesters"
            body="There are no active Development Requesters to select. Seed the database or activate a Requester, then retry."
            action={
              <Button variant="secondary" onClick={loadRequesters}>
                Retry
              </Button>
            }
          />
        ) : (
          <>
            <Field
              id="requester"
              label="Development Requester"
              required
              hint="Choose the identity you want to test as."
            >
              {load === "loading" ? (
                <LoadingSkeleton rows={1} label="Loading Requesters…" />
              ) : (
                <select
                  id="requester"
                  className="zg-field"
                  aria-describedby="requester-message"
                  value={chosenId}
                  onChange={(e) => setChosenId(e.target.value)}
                >
                  <option value="">Choose a requester…</option>
                  {requesters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.email}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Button
              variant="primary"
              className="zg-select-continue"
              disabled={load !== "ready" || chosenId === ""}
              onClick={handleContinue}
            >
              Continue
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
