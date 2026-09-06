import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentSection } from "../../src/components/AttachmentSection.js";
import * as api from "../../src/api.js";

// UI-18…UI-20 from docs/lab-02/tests.md. Contract: ui-spec §9.
vi.mock("../../src/api.js");
const uploadAttachment = vi.mocked(api.uploadAttachment);

const active = (id: number): api.Attachment => ({
  id,
  originalFilename: `active-${id}.png`,
  mimeType: "image/png",
  sizeBytes: 2048,
  uploadedAt: "2026-08-26T09:15:00.000Z",
  removedAt: null,
  removalReason: null,
  removedBy: null,
});

const removed = (id: number): api.Attachment => ({
  id,
  originalFilename: `removed-${id}.png`,
  mimeType: "image/png",
  sizeBytes: 2048,
  uploadedAt: "2026-08-26T09:15:00.000Z",
  removedAt: "2026-08-26T10:00:00.000Z",
  removalReason: "Uploaded the wrong screenshot",
  removedBy: { id: 1, name: "Somchai" },
});

const renderSection = (initial: api.Attachment[]) =>
  render(<AttachmentSection requesterId={1} ticketId={1} initial={initial} />);

describe("Attachment section", () => {
  beforeEach(() => vi.clearAllMocks());

  // UI-18 — AC-31, BR-55
  it("UI-18: lists a removed attachment with its reason and no download control", () => {
    renderSection([active(1), removed(2)]);

    const removedRegion = screen.getByTestId("removed-attachments");
    expect(within(removedRegion).getByText("removed-2.png")).toBeInTheDocument();
    expect(within(removedRegion).getByText("Removed")).toBeInTheDocument();
    expect(within(removedRegion).getByText("Uploaded the wrong screenshot")).toBeInTheDocument();
    // The download control is absent from the DOM, not merely disabled.
    expect(within(removedRegion).queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });

  // UI-19 — AC-33, BR-53
  it("UI-19: keeps Remove disabled until a valid reason is entered", async () => {
    const user = userEvent.setup();
    renderSection([active(1)]);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Remove" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Reason for removal/), "wrong file");
    expect(confirm).toBeEnabled();
  });

  // UI-20 — AC-27, AC-28, BR-52
  it("UI-20: shows a specific reason for a rejected file and makes no upload call", async () => {
    renderSection([]);

    const badFile = new File(["not an image"], "notes.txt", { type: "text/plain" });
    const input = screen.getByLabelText("Add attachment") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(await screen.findByText(/Unsupported file type/i)).toBeInTheDocument();
    expect(uploadAttachment).not.toHaveBeenCalled();
  });
});
