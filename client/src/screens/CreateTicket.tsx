import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  getRelatedSystems,
  createTicket,
  ValidationError,
  type Category,
  type RelatedSystem,
  type RequestedPriority,
  type CreatedTicket,
} from "../api.js";
import { useRequester } from "../requester.js";
import { Field, TextField, fieldClass } from "../components/Field.js";
import { Button } from "../components/Button.js";
import { LoadingSkeleton, ErrorCallout } from "../components/States.js";

const PRIORITIES: { value: RequestedPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const SUMMARY_MAX = 150;
const DESCRIPTION_MAX = 5000;

// Client-side mirror of the server rules (BR-42): improves feedback, but the
// backend stays authoritative.
function clientErrors(values: {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  description: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const summary = values.summary.trim();
  const description = values.description.trim();
  if (summary.length < 5 || summary.length > SUMMARY_MAX) {
    errors.summary = "Summary must be 5–150 characters.";
  }
  if (description.length < 20 || description.length > DESCRIPTION_MAX) {
    errors.description = "Description must be 20–5000 characters.";
  }
  if (!values.categoryId) errors.categoryId = "Select a valid category.";
  if (!values.relatedSystemId) errors.relatedSystemId = "Select a valid related system.";
  return errors;
}

type RefLoad = "loading" | "ready" | "error";
type SubmitState = "idle" | "submitting" | "error";

export function CreateTicket() {
  const navigate = useNavigate();
  const { requester } = useRequester();
  const requesterId = requester!.id;

  const [refLoad, setRefLoad] = useState<RefLoad>("loading");
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [priority, setPriority] = useState<RequestedPriority>("MEDIUM");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [created, setCreated] = useState<CreatedTicket | null>(null);

  async function loadReferenceData() {
    setRefLoad("loading");
    try {
      const [cats, sys] = await Promise.all([
        getCategories(requesterId),
        getRelatedSystems(requesterId),
      ]);
      setCategories(cats);
      setSystems(sys);
      setRefLoad("ready");
    } catch {
      setRefLoad("error");
    }
  }

  useEffect(() => {
    loadReferenceData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitState === "submitting") return; // no duplicate submissions (BR-43)

    const errors = clientErrors({ categoryId, relatedSystemId, summary, description });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors); // messages beneath fields; no API call (BR-44)
      return;
    }

    setFieldErrors({});
    setSubmitState("submitting");
    try {
      const ticket = await createTicket(requesterId, {
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        requestedPriority: priority,
        summary,
        description,
      });
      setCreated(ticket);
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fields);
        setSubmitState("idle"); // values preserved (BR-45)
      } else {
        setSubmitState("error"); // safe message; values preserved (BR-46)
      }
    }
  }

  function createAnother() {
    setCreated(null);
    setCategoryId("");
    setRelatedSystemId("");
    setPriority("MEDIUM");
    setSummary("");
    setDescription("");
    setFieldErrors({});
    setSubmitState("idle");
  }

  // Success (AC-07): the confirmation replaces the form and shows the number.
  if (created) {
    return (
      <section className="zg-panel zg-success-panel" role="status">
        <h1 className="zg-panel__heading">✓ Ticket created</h1>
        <p className="zg-panel__body">
          Your ticket number is{" "}
          <strong className="zg-ticket-number">{created.ticketNumber}</strong>
        </p>
        <div className="zg-form-actions">
          <Button variant="primary" onClick={() => navigate(`/tickets/${created.id}`)}>
            View ticket
          </Button>
          <Button variant="secondary" onClick={createAnother}>
            Create another
          </Button>
        </div>
      </section>
    );
  }

  if (refLoad === "error") {
    return (
      <section>
        <h1 className="zg-page-title">Create Ticket</h1>
        <ErrorCallout
          message="We couldn't load the form's reference data. Please try again."
          onRetry={loadReferenceData}
        />
      </section>
    );
  }

  const summaryOver = summary.length > SUMMARY_MAX;
  const descriptionOver = description.length > DESCRIPTION_MAX;

  return (
    <section>
      <h1 className="zg-page-title">Create Ticket</h1>

      <form onSubmit={handleSubmit} noValidate>
        {/* System-generated values first, read-only (BR-16, BR-18). */}
        <h2 className="zg-section-title">Ticket Information</h2>
        <div className="zg-field-row">
          <TextField id="ticketNumber" label="Ticket Number" readOnly value="" hint="Generated on save" />
          <TextField id="ticketDate" label="Ticket Date" readOnly value="" hint="Set on save" />
        </div>
        <TextField id="requester" label="Requester" readOnly value={requester!.name} />

        <h2 className="zg-section-title">Classification</h2>
        <div className="zg-field-row">
          <Field id="categoryId" label="Category" required invalid={!!fieldErrors.categoryId} message={fieldErrors.categoryId}>
            {refLoad === "loading" ? (
              <LoadingSkeleton rows={1} label="Loading categories…" />
            ) : (
              <select
                id="categoryId"
                className={fieldClass({ invalid: !!fieldErrors.categoryId })}
                aria-describedby="categoryId-message"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Choose a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field id="relatedSystemId" label="Related System" required invalid={!!fieldErrors.relatedSystemId} message={fieldErrors.relatedSystemId}>
            {refLoad === "loading" ? (
              <LoadingSkeleton rows={1} label="Loading related systems…" />
            ) : (
              <select
                id="relatedSystemId"
                className={fieldClass({ invalid: !!fieldErrors.relatedSystemId })}
                aria-describedby="relatedSystemId-message"
                value={relatedSystemId}
                onChange={(e) => setRelatedSystemId(e.target.value)}
              >
                <option value="">Choose a related system…</option>
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <fieldset className="zg-field-group zg-fieldset">
          <legend className="zg-label">
            Requested Priority<span className="zg-required" aria-hidden="true">*</span>
          </legend>
          <div className="zg-radio-row">
            {PRIORITIES.map((p) => (
              <label key={p.value} className="zg-radio">
                <input
                  type="radio"
                  name="requestedPriority"
                  value={p.value}
                  checked={priority === p.value}
                  onChange={() => setPriority(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        <h2 className="zg-section-title">Problem</h2>
        <div className="zg-field-group">
          <div className="zg-label-row">
            <label className="zg-label" htmlFor="summary">
              Ticket Summary<span className="zg-required" aria-hidden="true">*</span>
            </label>
            <span className={`zg-counter${summaryOver ? " zg-counter--over" : ""}`}>
              {summary.length} / {SUMMARY_MAX}
            </span>
          </div>
          <input
            id="summary"
            className={fieldClass({ invalid: !!fieldErrors.summary })}
            aria-describedby="summary-message"
            aria-required="true"
            aria-invalid={fieldErrors.summary ? true : undefined}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <p id="summary-message" className="zg-field-message zg-field-message--error">
            {fieldErrors.summary ?? ""}
          </p>
        </div>

        <div className="zg-field-group">
          <div className="zg-label-row">
            <label className="zg-label" htmlFor="description">
              Description<span className="zg-required" aria-hidden="true">*</span>
            </label>
            <span className={`zg-counter${descriptionOver ? " zg-counter--over" : ""}`}>
              {description.length} / {DESCRIPTION_MAX}
            </span>
          </div>
          <textarea
            id="description"
            rows={6}
            className={fieldClass({ invalid: !!fieldErrors.description, multiline: true })}
            aria-describedby="description-message"
            aria-required="true"
            aria-invalid={fieldErrors.description ? true : undefined}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p id="description-message" className="zg-field-message zg-field-message--error">
            {fieldErrors.description ?? ""}
          </p>
        </div>

        {submitState === "error" && (
          <ErrorCallout message="We couldn't create your ticket. Your details are preserved — please try again." />
        )}

        <div className="zg-form-actions">
          <Button type="button" variant="secondary" onClick={() => navigate("/tickets")}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            busy={submitState === "submitting"}
            busyLabel="Submitting…"
          >
            Submit Ticket
          </Button>
        </div>
      </form>
    </section>
  );
}
