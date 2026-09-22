import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.js";
import { AppShell } from "./components/AppShell.js";
import { Login } from "./screens/Login.js";
import { ChangePassword } from "./screens/ChangePassword.js";
import { CreateTicket } from "./screens/CreateTicket.js";
import { MyTickets } from "./screens/MyTickets.js";
import { RequesterTicketDetail } from "./screens/RequesterTicketDetail.js";
import { LoadingSkeleton } from "./components/States.js";

// Staff and Administrator destinations exist so role navigation is complete
// (AC-53); their screens arrive in later Lab 3 issues.
function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="zg-page-title">{title}</h1>
      <p className="zg-field-message">This area arrives in a later Lab 3 issue.</p>
    </section>
  );
}

// The role's default landing path once past the password gate.
function roleLanding(role: string): string {
  if (role === "IT_STAFF") return "/staff/tickets";
  if (role === "ADMINISTRATOR") return "/admin/users";
  return "/tickets";
}

function RoleRoutes({ role }: { role: string }) {
  return (
    <Routes>
      <Route path="/change-password" element={<ChangePassword />} />
      {role === "REQUESTER" && (
        <>
          <Route path="/tickets" element={<MyTickets />} />
          <Route path="/tickets/new" element={<CreateTicket />} />
          <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
        </>
      )}
      {role === "IT_STAFF" && <Route path="/staff/tickets" element={<Placeholder title="Ticket Queue" />} />}
      {role === "ADMINISTRATOR" && <Route path="/admin/users" element={<Placeholder title="User Management" />} />}
      <Route path="*" element={<Navigate to={roleLanding(role)} replace />} />
    </Routes>
  );
}

function AuthedApp() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="zg-auth-page">
        <LoadingSkeleton rows={3} label="Loading…" />
      </div>
    );
  }

  // Not signed in — only the login screen is reachable (AC-10 on the client side;
  // the server enforces it regardless).
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Password change outstanding — nothing but the change screen is reachable (AC-02).
  if (user.mustChangePassword) {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <AppShell userName={user.name} role={user.role} onLogout={handleLogout}>
      <RoleRoutes role={user.role} />
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}
