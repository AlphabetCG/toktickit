import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { RequesterProvider, useRequester } from "./requester.js";
import { AppShell } from "./components/AppShell.js";
import { RequesterSelection } from "./screens/RequesterSelection.js";
import { CreateTicket } from "./screens/CreateTicket.js";

// Placeholder for My Tickets, which Issue #16 builds. Keeps the shell,
// navigation, and route guard testable now.
function MyTicketsPlaceholder() {
  const { requester } = useRequester();
  return (
    <section>
      <h1 className="zg-page-title">My Tickets</h1>
      <p>
        Viewing as <strong>{requester?.name}</strong> ({requester?.email}). Your
        tickets will appear here (Issue #16).
      </p>
    </section>
  );
}

// The Requester-scoped half of the app. Rendered only once a Requester exists.
function ScopedApp() {
  const { requester, clear } = useRequester();
  const navigate = useNavigate();

  // Guard: no Requester selected → the selection screen, whatever ticket URL was
  // requested (BR-19, AC-01, UI-05).
  if (!requester) return <RequesterSelection />;

  function changeRequester() {
    clear();
    navigate("/select");
  }

  return (
    // Keying the shell by requester id remounts every scoped screen on switch, so
    // no data from the previous Requester can survive on screen (BR-22, AC-04).
    <AppShell key={requester.id} requesterName={requester.name} onChangeRequester={changeRequester}>
      <Routes>
        <Route path="/tickets" element={<MyTicketsPlaceholder />} />
        <Route path="/tickets/new" element={<CreateTicket />} />
        <Route path="*" element={<Navigate to="/tickets" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <RequesterProvider>
      <Routes>
        <Route path="/select" element={<RequesterSelection />} />
        <Route path="*" element={<ScopedApp />} />
      </Routes>
    </RequesterProvider>
  );
}
