import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { Role } from "../api.js";
import { Button } from "./Button.js";

interface AppShellProps {
  userName: string;
  role: Role;
  onLogout: () => void;
  children: ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

// Role-specific destinations (ui-spec §6/§7, AC-53). Only the acting role's items
// are rendered, so another role's destinations are absent from the DOM entirely.
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  REQUESTER: [
    { to: "/tickets", label: "My Tickets", end: true },
    { to: "/tickets/new", label: "Create Ticket" },
  ],
  IT_STAFF: [{ to: "/staff/tickets", label: "Ticket Queue" }],
  ADMINISTRATOR: [{ to: "/admin/users", label: "User Management" }],
};

const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

// Application shell: identity, role-specific navigation, active-page indication,
// role badge, logout, and responsive mobile navigation (ui-spec §7.1).
export function AppShell({ userName, role, onLogout, children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const nav = NAV_BY_ROLE[role];

  return (
    <div className="zg-shell">
      <header className="zg-header">
        <div className="zg-header__inner">
          <span className="zg-brand">TokTickIT</span>

          <Button
            variant="tertiary"
            className="zg-nav-toggle"
            aria-expanded={navOpen}
            aria-controls="zg-primary-nav"
            onClick={() => setNavOpen((open) => !open)}
          >
            Menu
          </Button>

          <nav
            id="zg-primary-nav"
            className={`zg-nav${navOpen ? " zg-nav--open" : ""}`}
            aria-label="Primary"
          >
            {nav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `zg-nav-link${isActive ? " zg-nav-link--active" : ""}`
                }
                onClick={() => setNavOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="zg-identity">
            <span className="zg-identity__name">{userName}</span>
            <span className={`zg-badge zg-badge--role-${role.toLowerCase()}`}>{ROLE_LABEL[role]}</span>
            <Button variant="tertiary" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="zg-main">{children}</main>
    </div>
  );
}
