import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ValidationError, type AuthUser } from "../api.js";
import { useAuth } from "../auth.js";
import { TextField } from "../components/Field.js";
import { Button } from "../components/Button.js";
import { ErrorCallout } from "../components/States.js";

// The role's landing page after a successful sign-in (ui-spec §6.1).
export function landingFor(user: AuthUser): string {
  if (user.mustChangePassword) return "/change-password";
  if (user.role === "IT_STAFF") return "/staff/tickets";
  if (user.role === "ADMINISTRATOR") return "/admin/users";
  return "/tickets";
}

/**
 * Login (ui-spec §6.1). Per-field local validation keeps an empty field from ever
 * reaching the API; a credential or deactivation failure renders one callout with
 * the server's uniform message, preserving the email and clearing the password.
 */
export function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // one request per submission (BR-43)

    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = "Email is required.";
    if (!password) errors.password = "Password is required.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors); // no API call on a local failure
      return;
    }

    setFieldErrors({});
    setFailure(undefined);
    setSubmitting(true);
    try {
      const user = await signIn(email.trim(), password);
      navigate(landingFor(user), { replace: true });
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fields);
      } else {
        // Uniform credential message, or the distinct deactivation message — both
        // come from the server verbatim (AC-03, AC-05).
        setFailure((err as Error).message);
        setPassword("");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="zg-auth-page">
      <form className="zg-auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="zg-auth-title">TokTickIT</h1>
        <p className="zg-auth-subtitle">Sign in to continue</p>

        {failure && <ErrorCallout message={failure} />}

        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          required
          invalid={!!fieldErrors.email}
          message={fieldErrors.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          invalid={!!fieldErrors.password}
          message={fieldErrors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          type="submit"
          variant="primary"
          className="zg-auth-submit"
          busy={submitting}
          busyLabel="Signing in…"
        >
          Sign in
        </Button>
      </form>
    </div>
  );
}
