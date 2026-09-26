import { useEffect, useState } from "react";
import { getComments, postComment, ValidationError, type Comment, type Role } from "../api.js";
import { Button } from "./Button.js";
import { LoadingSkeleton, ErrorCallout } from "./States.js";

const BODY_MAX = 2000;

const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Public Comments panel (ui-spec §7.1). Visible to the requester and IT team;
 * newest last so the thread reads chronologically. Bodies render as text nodes,
 * never HTML, so a comment cannot inject markup (BR-45).
 */
export function PublicComments({ ticketId }: { ticketId: number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let ignore = false;
    getComments(ticketId)
      .then((list) => {
        if (!ignore) {
          setComments(list);
          setLoad("ready");
        }
      })
      .catch(() => !ignore && setLoad("error"));
    return () => {
      ignore = true;
    };
  }, [ticketId]);

  const trimmed = body.trim();
  const canPost = trimmed.length >= 1 && trimmed.length <= BODY_MAX && !posting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    setPosting(true);
    setError(undefined);
    try {
      const created = await postComment(ticketId, trimmed);
      setComments((prev) => [...prev, created]);
      setBody("");
    } catch (err) {
      setError(err instanceof ValidationError ? err.fields.body ?? "Unable to post the comment." : "Unable to post the comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="zg-panel zg-comments" aria-label="Public Comments">
      <div className="zg-list-head">
        <h2 className="zg-section-title" style={{ margin: 0, border: "none" }}>
          Public Comments
        </h2>
      </div>
      <p className="zg-field-message">Visible to the requester and the IT team</p>

      {load === "loading" && <LoadingSkeleton rows={2} label="Loading comments…" />}
      {load === "error" && <ErrorCallout message="We couldn't load the comments. Please try again." />}

      {load === "ready" && (
        <>
          {comments.length > 0 ? (
            <ul className="zg-comment-list">
              {comments.map((c) => (
                <li key={c.id} className="zg-comment">
                  <p className="zg-comment__meta">
                    <span className="zg-comment__author">{c.author.name}</span>{" "}
                    <span className="zg-comment__role">({ROLE_LABEL[c.author.role]})</span>{" "}
                    · {formatWhen(c.createdAt)}
                  </p>
                  {/* Rendered as a text node, never HTML (BR-45). */}
                  <p className="zg-comment__body">{c.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="zg-field-message">No comments yet.</p>
          )}

          <form className="zg-comment-form" onSubmit={submit}>
            <label className="zg-label" htmlFor="comment-body">
              Add a comment
            </label>
            <textarea
              id="comment-body"
              className="zg-field zg-field--multiline"
              rows={3}
              maxLength={BODY_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="zg-list-head">
              <span className={`zg-counter${trimmed.length > BODY_MAX ? " zg-counter--over" : ""}`}>
                {body.length} / {BODY_MAX}
              </span>
              <Button type="submit" variant="primary" disabled={!canPost} busy={posting} busyLabel="Posting…">
                Post comment
              </Button>
            </div>
            {error && <p className="zg-field-message zg-field-message--error">{error}</p>}
          </form>
        </>
      )}
    </section>
  );
}
