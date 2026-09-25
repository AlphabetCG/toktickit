import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword, ValidationError, type AuthUser } from "../api.js";
import { useAuth } from "../auth.js";
import { TextField } from "../components/Field.js";
import { Button } from "../components/Button.js";
import { ErrorCallout } from "../components/States.js";

const PASSWORD_MIN = 12;

function roleLanding(user: AuthUser | null): string {
  if (user?.role === "IT_STAFF") return "/staff/tickets";
  if (user?.role === "ADMINISTRATOR") return "/admin/users";
  return "/tickets";
}

/**
 * Change Password (ui-spec §6.2). Mandatory mode (mustChangePassword) shows a
 * leading callout and offers no way out; voluntary mode adds a Cancel. The length
 * rule is helper text shown up front, and the confirmation is checked locally so a
 * mismatch never reaches the API.
 */
export function ChangePassword() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const mandatory = user?.mustChangePassword ?? false;

  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = "Current password is required.";
    if (newPassword.length < PASSWORD_MIN) errors.newPassword = `Password must be at least ${PASSWORD_MIN} characters.`;
    if (confirm !== newPassword) errors.confirm = "The two passwords do not match.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors); // confirmation mismatch and empties never call the API
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      await refresh(); // clears the gate flag in context
      if (mandatory) {
        navigate(roleLanding(user), { replace: true });
      } else {
        setDone(true);
        setCurrent("");
        setNew("");
        setConfirm("");
        setSubmitting(false);
      }
    } catch (err) {
      if (err instanceof ValidationError) setFieldErrors(err.fields);
      else setFieldErrors({ currentPassword: "Unable to change the password. Please try again." });
      setSubmitting(false);
    }
  }

  return (
    <div className="zg-auth-page">
      <form className="zg-auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="zg-auth-title">Choose a new password</h1>

        {mandatory && (
          <div className="zg-callout zg-callout--info" role="status">
            Your account uses a temporary password. Choose a new one to continue.
          </div>
        )}
        {done && <div className="zg-callout zg-callout--success" role="status">Your password has been changed.</div>}

        <TextField
          id="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          invalid={!!fieldErrors.currentPassword}
          message={fieldErrors.currentPassword}
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextField
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          invalid={!!fieldErrors.newPassword}
          message={fieldErrors.newPassword}
          hint={`At least ${PASSWORD_MIN} characters.`}
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
        />
        <TextField
          id="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          invalid={!!fieldErrors.confirm}
          message={fieldErrors.confirm}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <div className="zg-form-actions">
          {!mandatory && (
            <Button type="button" variant="secondary" onClick={() => navigate(roleLanding(user))}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" busy={submitting} busyLabel="Saving…">
            Save password
          </Button>
        </div>
      </form>
    </div>
  );
}
