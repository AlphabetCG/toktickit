import { useState } from "react";
import {
  uploadAttachment,
  removeAttachment,
  downloadAttachment,
  type Attachment,
} from "../api.js";
import { validateFile } from "../attachmentValidation.js";
import { Button } from "./Button.js";
import { RemovedBadge } from "./Badge.js";
import { ErrorCallout } from "./States.js";

const MAX_ACTIVE = 5;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  requesterId: number;
  ticketId: number;
  initial: Attachment[];
}

export function AttachmentSection({ requesterId, ticketId, initial }: Props) {
  const [items, setItems] = useState<Attachment[]>(initial);
  const [fileError, setFileError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busyRemove, setBusyRemove] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const active = items.filter((a) => !a.removedAt);
  const removed = items.filter((a) => a.removedAt);
  const atCap = active.length >= MAX_ACTIVE;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    const err = validateFile(file);
    if (err) {
      setFileError(err); // specific reason, never a generic failure (BR-52)
      return;
    }
    setFileError(undefined);
    setUploading(true);
    try {
      const created = await uploadAttachment(requesterId, ticketId, file);
      setItems((prev) => [...prev, created]);
    } catch (uploadErr) {
      setFileError((uploadErr as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(a: Attachment) {
    setDownloadingId(a.id);
    try {
      await downloadAttachment(requesterId, a.id, a.originalFilename);
    } catch {
      setFileError(`Unable to download "${a.originalFilename}".`);
    } finally {
      setDownloadingId(null);
    }
  }

  const reasonValid = reason.trim().length >= 3 && reason.trim().length <= 200;

  async function confirmRemove() {
    if (removingId === null || !reasonValid) return;
    setBusyRemove(true);
    try {
      const updated = await removeAttachment(requesterId, removingId, reason.trim());
      setItems((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setRemovingId(null);
      setReason("");
    } catch {
      setFileError("Unable to remove the attachment. Please try again.");
    } finally {
      setBusyRemove(false);
    }
  }

  return (
    <section className="zg-panel zg-attachments" aria-label="Attachments">
      <div className="zg-list-head">
        <h2 className="zg-section-title" style={{ margin: 0, border: "none" }}>
          Attachments ({active.length} of {MAX_ACTIVE})
        </h2>
        <label className={`zg-btn zg-btn--secondary${atCap || uploading ? " zg-btn--disabled" : ""}`}>
          + Add attachment
          <input
            type="file"
            hidden
            aria-label="Add attachment"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={atCap || uploading}
            onChange={onPick}
          />
        </label>
      </div>

      <p className="zg-field-message">
        {atCap
          ? "Maximum of 5 attachments reached. Remove one to add another."
          : "JPG, PNG, WEBP, or PDF · up to 5 MB each · maximum 5 files"}
      </p>

      {fileError && <ErrorCallout message={fileError} />}

      {active.length > 0 && (
        <ul className="zg-attachment-list">
          {active.map((a) => (
            <li key={a.id} className="zg-attachment">
              <span className="zg-attachment__name">{a.originalFilename}</span>
              <span className="zg-attachment__meta">{formatSize(a.sizeBytes)}</span>
              <span className="zg-attachment__actions">
                <Button
                  variant="tertiary"
                  busy={downloadingId === a.id}
                  busyLabel="Downloading…"
                  onClick={() => onDownload(a)}
                >
                  Download
                </Button>
                <Button variant="destructive" onClick={() => { setRemovingId(a.id); setReason(""); }}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {removed.length > 0 && (
        <div className="zg-attachment-removed" data-testid="removed-attachments">
          <h3 className="zg-label">Removed attachments</h3>
          <ul className="zg-attachment-list">
            {removed.map((a) => (
              <li key={a.id} className="zg-attachment zg-attachment--removed">
                <span className="zg-attachment__name">{a.originalFilename}</span>
                <RemovedBadge />
                {a.removalReason && <span className="zg-attachment__reason">{a.removalReason}</span>}
                {/* No download control at all for a removed file (BR-08, BR-55). */}
              </li>
            ))}
          </ul>
        </div>
      )}

      {removingId !== null && (
        <div className="zg-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Remove attachment">
          <div className="zg-dialog">
            <h3 className="zg-panel__heading">Remove attachment</h3>
            <p className="zg-panel__body">
              The file stays on record but can no longer be downloaded.
            </p>
            <label className="zg-label" htmlFor="removal-reason">
              Reason for removal<span className="zg-required" aria-hidden="true">*</span>
            </label>
            <textarea
              id="removal-reason"
              className="zg-field zg-field--multiline"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="zg-field-message">3–200 characters</p>
            <div className="zg-form-actions">
              <Button variant="secondary" onClick={() => setRemovingId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={!reasonValid} busy={busyRemove} busyLabel="Removing…" onClick={confirmRemove}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
