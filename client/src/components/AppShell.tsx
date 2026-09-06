import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "./Button.js";

interface AppShellProps {
  /** Name of the selected Development Requester, when one has been chosen. */
  requesterName?: string;
  onChangeRequester?: () => void;
  children: ReactNode;
}

const NAV = [
  { to: "/tickets", label: "My Tickets" },
  { to: "/tickets/new", label: "Create Ticket" },
];

// Application shell: identity, navigation, active-page indication, Requester
// identity, and responsive mobile navigation (ui-spec section 7).
export function AppShell({ requesterName, onChangeRequester, children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);

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

          {/* Visibility is a CSS concern, not the `hidden` attribute — `hidden`
              would drop the navigation from the accessibility tree at every
              width, not just while the mobile disclosure is collapsed. */}
          <nav
            id="zg-primary-nav"
            className={`zg-nav${navOpen ? " zg-nav--open" : ""}`}
            aria-label="Primary"
          >
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                /* NavLink sets aria-current="page"; the underline class marks it
                   visually, so the active page is never colour alone. */
                className={({ isActive }) =>
                  `zg-nav-link${isActive ? " zg-nav-link--active" : ""}`
                }
                onClick={() => setNavOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {requesterName && (
            <div className="zg-identity">
              <span>{requesterName}</span>
              {onChangeRequester && (
                <Button variant="tertiary" onClick={onChangeRequester}>
                  Change Requester
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="zg-main">{children}</main>
    </div>
  );
}
