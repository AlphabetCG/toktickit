import { useEffect, useState } from "react";
import {
  listUsers,
  createUser,
  updateUser,
  setInitialPassword,
  ForbiddenError,
  ValidationError,
  type AdminUser,
  type Role,
} from "../api.js";
import { useAuth } from "../auth.js";
import { RoleBadge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { TextField, Field } from "../components/Field.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "REQUESTER", label: "Requester" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "ADMINISTRATOR", label: "Administrator" },
];

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 12;
const OWN_STATUS = "You cannot deactivate your own account.";
const OWN_ROLE = "You cannot change your own role.";

type Load = "loading" | "ready" | "forbidden" | "error";
type Panel = { kind: "create" } | { kind: "edit"; user: AdminUser } | null;

interface Form {
  name: string;
  email: string;
  role: Role | "";
  isActive: boolean;
  initialPassword: string;
}

const EMPTY_FORM: Form = { name: "", email: "", role: "", isActive: true, initialPassword: "" };

// Routes a guard refusal to the control that caused it (ui-spec §6.5, UI-29), so
// each conflict reads as the server's specific message beside the right field.
function placeConflict(message: string, roleChanged: boolean): Record<string, string> {
  if (/email address/i.test(message)) return { email: message };
  if (/deactivate your own/i.test(message)) return { isActive: message };
  if (/own role/i.test(message)) return { role: message };
  if (/active administrator/i.test(message)) return roleChanged ? { role: message } : { isActive: message };
  return { form: message };
}

/**
 * Administrator User Management (ui-spec §6.5). One deliberately small screen: a
 * search box and one role filter, no pagination, no sorting, no delete (§3.2,
 * BR-57). Create and Edit share one panel; setting a new initial password is a
 * separate action behind its own confirmation, because it ends the user's sessions.
 */
export function UserManagement() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<string>();

  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string>();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let ignore = false;
    setLoad("loading");
    listUsers({ search, role: roleFilter })
      .then((list) => {
        if (ignore) return;
        setUsers(list);
        setLoad("ready");
      })
      .catch((err) => !ignore && setLoad(err instanceof ForbiddenError ? "forbidden" : "error"));
    return () => {
      ignore = true;
    };
  }, [search, roleFilter, reloadKey]);

  const filtersActive = Boolean(search || roleFilter);
  const editing = panel?.kind === "edit" ? panel.user : null;
  const self = editing !== null && editing.id === me?.id;

  function openCreate() {
    setForm(EMPTY_FORM);
    setErrors({});
    setNotice(undefined);
    setPanel({ kind: "create" });
  }

  function openEdit(user: AdminUser) {
    setForm({ name: user.name, email: user.email, role: user.role, isActive: user.isActive, initialPassword: "" });
    setErrors({});
    setNotice(undefined);
    setPanel({ kind: "edit", user });
  }

  function localErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    const name = form.name.trim();
    if (name.length < 1 || name.length > 120) e.name = "Name must be 1–120 characters.";
    if (!EMAIL_FORMAT.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (!form.role) e.role = "Choose a role.";
    if (panel?.kind === "create" && form.initialPassword.length < PASSWORD_MIN) {
      e.initialPassword = `Password must be at least ${PASSWORD_MIN} characters.`;
    }
    return e;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !panel) return;
    const local = localErrors();
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    setSaving(true);
    setErrors({});
    const payload = { name: form.name.trim(), email: form.email.trim(), role: form.role as Role, isActive: form.isActive };
    try {
      if (panel.kind === "create") {
        await createUser({ ...payload, initialPassword: form.initialPassword });
        setNotice(`Created ${payload.name}. They must choose a new password at their first sign-in.`);
      } else {
        await updateUser(panel.user.id, payload);
        setNotice(`Saved ${payload.name}.`);
      }
      setPanel(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fields);
      else setErrors(placeConflict((err as Error).message, editing !== null && payload.role !== editing.role));
    } finally {
      setSaving(false);
    }
  }

  async function confirmReset() {
    if (!editing) return;
    if (resetPassword.length < PASSWORD_MIN) {
      setResetError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    try {
      await setInitialPassword(editing.id, resetPassword);
      setResetting(false);
      setResetPassword("");
      setNotice(`New initial password set for ${editing.name}. They have been signed out and must choose a new password at their next sign-in.`);
    } catch (err) {
      setResetError(err instanceof ValidationError ? err.fields.initialPassword ?? err.message : (err as Error).message);
    }
  }

  if (load === "forbidden") {
    return <EmptyState heading="You don't have access to User Management" body="This screen is available to Administrators only." />;
  }

  return (
    <section>
      <div className="zg-list-head">
        <h1 className="zg-page-title">User Management</h1>
        <Button variant="primary" onClick={openCreate}>+ Create user</Button>
      </div>

      {notice && (
        <div className="zg-callout zg-callout--success" role="status">
          {notice}
        </div>
      )}

      <div className="zg-toolbar">
        <input
          className="zg-field zg-search"
          type="search"
          placeholder="Search name or email"
          aria-label="Search users"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select className="zg-field" aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Role: All</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {filtersActive && (
          <Button
            variant="secondary"
            onClick={() => {
              setSearchText("");
              setSearch("");
              setRoleFilter("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {load === "loading" && <LoadingSkeleton rows={5} label="Loading users…" />}
      {load === "error" && (
        <ErrorCallout message="We couldn't load the users. Please try again." onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {load === "ready" && users.length === 0 && (
        filtersActive ? (
          <EmptyState heading="No users match your search" body="Try a different name or email, or clear the filter." />
        ) : (
          <EmptyState heading="No users yet" body="Create the first account to get started." />
        )
      )}

      {load === "ready" && users.length > 0 && (
        <table className="zg-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th><span className="zg-visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td data-label="Name">{u.name}</td>
                <td data-label="Email" className="zg-cell-email">{u.email}</td>
                <td data-label="Role"><RoleBadge value={u.role} /></td>
                {/* A word, not a coloured dot (ui-spec §6.5). */}
                <td data-label="Status">{u.isActive ? "Active" : "Inactive"}</td>
                <td data-label="Actions">
                  <Button variant="tertiary" aria-label={`Edit ${u.name}`} onClick={() => openEdit(u)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {panel && (
        <div className="zg-dialog-backdrop" role="dialog" aria-modal="true" aria-label={panel.kind === "create" ? "Create user" : "Edit user"}>
          <form className="zg-dialog zg-user-form" onSubmit={save} noValidate>
            <h3 className="zg-panel__heading">{panel.kind === "create" ? "Create user" : "Edit user"}</h3>
            {errors.form && <ErrorCallout message={errors.form} />}

            <TextField
              id="user-name"
              label="Name"
              required
              invalid={!!errors.name}
              message={errors.name}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              id="user-email"
              label="Email"
              type="email"
              required
              invalid={!!errors.email}
              message={errors.email}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            {/* One role, always — a single select, never checkboxes (§3.2). */}
            <Field
              id="user-role"
              label="Role"
              required
              invalid={!!errors.role}
              message={errors.role ?? (self ? OWN_ROLE : undefined)}
            >
              <select
                id="user-role"
                className={`zg-field${errors.role ? " zg-field--invalid" : ""}`}
                aria-describedby="user-role-message"
                value={form.role}
                disabled={self}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                <option value="">Choose a role…</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>

            <fieldset className="zg-field-group zg-fieldset" aria-describedby="user-status-message">
              <legend className="zg-label">Status</legend>
              <div className="zg-radio-row">
                {[
                  { label: "Active", value: true },
                  { label: "Inactive", value: false },
                ].map((o) => (
                  <label key={o.label} className="zg-radio">
                    <input
                      type="radio"
                      name="user-status"
                      checked={form.isActive === o.value}
                      disabled={self}
                      onChange={() => setForm({ ...form, isActive: o.value })}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              {/* Your own row: the refusal is anticipated, not only reported (AC-49). */}
              <p id="user-status-message" className={`zg-field-message${errors.isActive ? " zg-field-message--error" : ""}`}>
                {errors.isActive ?? (self ? OWN_STATUS : "")}
              </p>
            </fieldset>

            {panel.kind === "create" && (
              <TextField
                id="user-initial-password"
                label="Initial password"
                type="password"
                autoComplete="new-password"
                required
                hint={`At least ${PASSWORD_MIN} characters. They will change it at first sign-in.`}
                invalid={!!errors.initialPassword}
                message={errors.initialPassword}
                value={form.initialPassword}
                onChange={(e) => setForm({ ...form, initialPassword: e.target.value })}
              />
            )}

            {panel.kind === "edit" && (
              <div className="zg-user-form__reset">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResetPassword("");
                    setResetError(undefined);
                    setResetting(true);
                  }}
                >
                  Set new initial password
                </Button>
              </div>
            )}

            <div className="zg-form-actions">
              <Button variant="secondary" onClick={() => setPanel(null)}>Cancel</Button>
              <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
                {panel.kind === "create" ? "Create user" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {resetting && editing && (
        <div className="zg-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Set new initial password">
          <div className="zg-dialog">
            <h3 className="zg-panel__heading">Set a new initial password for {editing.name}?</h3>
            <p className="zg-panel__body">
              They will be signed out and must choose a new password at their next sign-in.
            </p>
            <TextField
              id="reset-password"
              label="New initial password"
              type="password"
              autoComplete="new-password"
              required
              hint={`At least ${PASSWORD_MIN} characters.`}
              invalid={!!resetError}
              message={resetError}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
            <div className="zg-form-actions">
              <Button variant="secondary" onClick={() => setResetting(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void confirmReset()}>Set password</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
