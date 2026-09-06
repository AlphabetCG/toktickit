import type { ReactNode } from "react";
import { Button } from "./Button.js";

// The screen states every fetching or submitting screen must implement
// (ui-spec section 6). A screen missing its empty state is not done.

/** Keeps the container's height so the layout does not jump when data arrives. */
export function LoadingSkeleton({ rows = 3, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="zg-skeleton-row" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  heading: string;
  body: string;
  action?: ReactNode;
}

/**
 * Used for both "nothing yet" and "nothing matched" — the two are distinct
 * states with distinct wording and actions (BR-57, BR-58).
 */
export function EmptyState({ heading, body, action }: EmptyStateProps) {
  return (
    <div className="zg-panel">
      <h2 className="zg-panel__heading">{heading}</h2>
      <p className="zg-panel__body">{body}</p>
      {action}
    </div>
  );
}

interface ErrorCalloutProps {
  message: string;
  onRetry?: () => void;
}

/** Safe message only — never a status code or stack trace (BR-47). */
export function ErrorCallout({ message, onRetry }: ErrorCalloutProps) {
  return (
    <div className="zg-callout" role="alert">
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
