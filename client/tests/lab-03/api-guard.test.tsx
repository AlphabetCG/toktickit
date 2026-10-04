import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getStaffQueue,
  ForbiddenError,
  PasswordChangeRequiredError,
  UnauthenticatedError,
} from "../../src/api.js";

// api-spec §1.4: a 403 means either the password gate (body carries
// passwordChangeRequired) or a role refusal. The real api.ts must tell them
// apart — screen tests mock the API module and so never exercise this.
function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))
  );
}

describe("api guard: refusal classification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a 403 role refusal to ForbiddenError", async () => {
    stubFetch(403, { error: "You do not have access to this resource" });
    await expect(getStaffQueue({})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("maps a 403 password-gate refusal to PasswordChangeRequiredError", async () => {
    stubFetch(403, { error: "Password change required", passwordChangeRequired: true });
    await expect(getStaffQueue({})).rejects.toBeInstanceOf(PasswordChangeRequiredError);
  });

  it("maps a 401 to UnauthenticatedError", async () => {
    stubFetch(401, { error: "Not signed in" });
    await expect(getStaffQueue({})).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
