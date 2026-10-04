# Lab 3 UI Specification — Zen Green, Extended

**Sprint:** Lab 3 — Users, Roles, IT Staff Ticketing, and Admin Screens
**Contract:** [`specification.md`](./specification.md) · [`tests.md`](./tests.md) · [`api-spec.md`](./api-spec.md)
**Extends:** [Lab 2 ui-spec](../lab-02/ui-spec.md) — **inherited, not replaced**
**Status:** Approved for implementation

Implementation is checked against this file and the captured screenshots, never
from memory. New screens must look like part of the same application, not a
second visual system.

---

## 1. Relationship to Lab 2

### 1.1 Inherited unchanged

Everything in Lab 2's ui-spec stays in force and is **not** restated here:

| Lab 2 section | Carried forward |
|---------------|-----------------|
| §1 Design tokens | Every colour, typography, spacing, shape, and breakpoint token |
| §2 Control states | `.zg-field` and its five states, including the focus ring |
| §3 Form conventions | Label above, required asterisk, per-field message with reserved space |
| §4 Button hierarchy | Four variants plus disabled and busy; one primary per screen |
| §6 Screen states | Initial, loading, validation, submitting, success, API failure, empty, no-results |
| §9 Attachments | Five attachment states and the removal dialog, unchanged |
| §10 Accessibility | Keyboard, focus visibility, labelling, never-colour-alone, contrast, touch targets |
| §11 Responsive rules | Two breakpoints, three viewports, no horizontal page scroll |

A Lab 3 component that reaches for a literal colour, a new breakpoint, or a
second button style is a defect (STYLE-01).

### 1.2 Extended by this sprint

| Area | Extension |
|------|-----------|
| Tokens | Two additions: an informational pair and an internal-channel pair (§2) |
| Badges | Status grows from one value to eight; role badges added (§3) |
| Shell | Authenticated identity, role badge, logout, role-specific navigation (§4) |
| Screen states | Forbidden, not-found, and conflict join the set (§5) |
| Screens | Five new, two changed, one deleted (§6–§8) |
| Confidentiality | The Public Comment / Internal Note boundary (§7) |

---

## 2. Token Additions

Appended to `client/src/theme.css`. Nothing existing is redefined.

```css
:root {
  /* Informational — an active, neutral state that is neither success nor warning.
     A cool hue so "in progress" cannot be mistaken for "done" at a glance. */
  --zg-info: #1b5e8a;
  --zg-info-surface: #e6f0f7;

  /* Internal channel — the surface for staff-only content. Deliberately outside
     the green family so an Internal Note is a different *kind* of thing on the
     page, not a darker shade of a Public Comment (BR-47). */
  --zg-internal: #3a4750;
  --zg-internal-surface: #eef1f4;
  --zg-internal-border: #c7d0d9;
}
```

**Why a new hue family rather than a darker green.** Two surfaces from the same
family read as "more" and "less" of the same thing. The Internal Note boundary is
categorical, not a matter of degree, and it is the one place in this application
where a mistake leaks private text to a customer. A cool grey-blue against a
green application makes the two channels non-confusable at a glance, including
for a reader with a red-green colour vision deficiency — and the text label in
§7.2 carries the meaning regardless.

`--zg-warning` keeps its Lab 2 restriction: warnings only, never decoration.

---

## 3. Badges

One shared `.zg-badge` component still serves every badge. **Meaning is always
carried by text**; colour only reinforces it (continues Lab 2 AC-39).

### 3.1 Ticket status — eight values

| Value | Class | Text | Surface / text |
|-------|-------|------|----------------|
| `NEW` | `.zg-badge--status-new` | "New" | `--zg-pale` / `--zg-primary` |
| `OPEN` | `.zg-badge--status-open` | "Open" | `--zg-pale` / `--zg-secondary` |
| `IN_PROGRESS` | `.zg-badge--status-in-progress` | "In Progress" | `--zg-info-surface` / `--zg-info` |
| `WAITING_FOR_REQUESTER` | `.zg-badge--status-waiting` | "Waiting for Requester" | `--zg-warning-surface` / `--zg-warning` |
| `RESOLVED` | `.zg-badge--status-resolved` | "Resolved" | `--zg-pale` / `--zg-success` |
| `REOPENED` | `.zg-badge--status-reopened` | "Reopened" | `--zg-error-surface` / `--zg-error` |
| `CLOSED` | `.zg-badge--status-closed` | "Closed" | `--zg-disabled-bg` / `--zg-text-muted` |
| `CANCELLED` | `.zg-badge--status-cancelled` | "Cancelled" | transparent, `--zg-border-strong` outline / `--zg-text-muted` |

`WAITING_FOR_REQUESTER` earns the warning surface because it is genuinely an
attention state — work is blocked on someone outside the team — not decoration.
`REOPENED` earns the error surface for the same reason: a fix did not hold.

`CLOSED` and `CANCELLED` are both terminal and both muted, so they are separated
by **fill**: closed is filled, cancelled is outlined. Colour alone never
distinguishes them; the labels differ too.

On mobile the long label "Waiting for Requester" wraps rather than truncating. A
truncated status is a status nobody can read.

### 3.2 Priority — two fields, one component

`LOW` / `MEDIUM` / `HIGH` keep their Lab 2 classes for both Requested Priority
and IT Priority. Because the same badge serves two meanings, **every occurrence
is labelled**:

```
Requested Priority   [ Medium ]      ← read-only everywhere, always
IT Priority          [ High   ] ▾    ← a control for staff, a badge for everyone else
```

A bare priority badge with no adjacent label is a defect — a reader cannot tell
whose opinion it represents.

### 3.3 Role

| Value | Class | Text |
|-------|-------|------|
| `REQUESTER` | `.zg-badge--role-requester` | "Requester" |
| `IT_STAFF` | `.zg-badge--role-staff` | "IT Staff" |
| `ADMINISTRATOR` | `.zg-badge--role-admin` | "Administrator" |

Role badges are **outlined**, not filled: transparent surface, `--zg-border-strong`
border, `--zg-text-muted` text. An outline keeps them from competing with the
filled status badges in the same row of the user list and the same header strip
as the ticket status.

---

## 4. Application Shell

```
┌────────────────────────────────────────────────────────────────┐
│  TokTickIT     Ticket Queue                                     │
│                              Anong Srisai  (IT Staff)  ▾        │
└────────────────────────────────────────────────────────────────┘
                ▔▔▔▔▔▔▔▔▔▔▔▔  active indicator
```

### 4.1 Changes from Lab 2

- The Development Requester name and **Change Requester** action are **removed**,
  along with the `/select` route and its `localStorage` state (FR-10).
- The identity area shows the authenticated user's **name** and a **role badge**.
- The identity menu holds **Change password** and **Logout**.
- Navigation is built from the role, not filtered by CSS.

### 4.2 Role-specific navigation

| Role | Destinations |
|------|--------------|
| Requester | My Tickets · Create Ticket |
| IT Staff | Ticket Queue |
| Administrator | User Management |

Destinations a role cannot use are **absent from the DOM**, not hidden or
disabled (FR-08, AC-53). A disabled link advertises a capability and invites
someone to look for the URL; an absent one says nothing. The server refuses
regardless (BR-16) — the navigation is a convenience, not the boundary.

The active-page indicator, mobile disclosure, and header height are unchanged
from Lab 2 §7.

### 4.3 Unauthenticated shell

Login and Change Password render **without** the navigation shell: the brand and
the card only. Showing a navigation bar to someone who cannot use any of it is
noise, and it would leak the destination list before authentication.

---

## 5. Screen States

Lab 2's eight states continue. Three join them.

| State | Presentation |
|-------|-------------|
| **Forbidden** | A centred `.zg-panel` with a plain explanation — "You do not have permission to view this page." — and a link to the caller's own landing page. Never a raw 403 |
| **Not found** | The same panel shape with "That item could not be found." It is deliberately **identical** for a resource that does not exist and one the user does not own, mirroring the API (BR-15) |
| **Conflict** | An inline `--zg-warning-surface` callout beside the control that caused it, carrying the server's specific message — "Cannot move a Resolved ticket to In Progress", "The system must keep at least one active administrator" — never a generic failure |

A conflict is **not** a page-level error: the rest of the screen is still valid
and the user's other work must survive it.

---

## 6. New Screens

### 6.1 Login

A centred card, maximum width `26rem`, on `--zg-page-bg`.

```
┌──────────────────────────────────────┐
│              TokTickIT               │  --zg-fs-page-title
│        Sign in to continue           │  --zg-text-muted
│                                      │
│  Email *                             │
│  ┌────────────────────────────────┐  │
│  └────────────────────────────────┘  │
│                                      │
│  Password *                          │
│  ┌────────────────────────────────┐  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │            Sign in             │  │  primary, full width
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- Email input uses `type="email"`, `autocomplete="username"`; password uses
  `autocomplete="current-password"` so password managers work.
- **Validation** is per-field and local: an empty field never reaches the API.
- **Busy**: the button is disabled with `aria-busy` and reads "Signing in…"; a
  double click produces one request (UI-03).
- **Credential failure** renders one callout above the button carrying the
  server's uniform message. The entered **email is preserved**; the password is
  cleared.
- **Deactivated account** renders the same callout with the deactivation
  message — visually identical, textually distinct, exactly as the API
  distinguishes them (AC-05).
- No "forgot password" link: password reset is excluded from scope (§3.2), and a
  link that goes nowhere is worse than no link.

### 6.2 Change Password

The same card shape. Two modes, one screen.

**Mandatory mode** — reached when `mustChangePassword` is true. A leading
callout states why, and there is no navigation away:

```
┌──────────────────────────────────────┐
│  Choose a new password               │
│  ┌────────────────────────────────┐  │
│  │ Your account uses a temporary  │  │  --zg-pale callout
│  │ password. Choose a new one to  │  │
│  │ continue.                      │  │
│  └────────────────────────────────┘  │
│                                      │
│  Current password *                  │
│  [                                ]  │
│  New password *                      │
│  [                                ]  │
│  At least 12 characters.             │  helper, shown before failure
│  Confirm new password *              │
│  [                                ]  │
│                                      │
│  [        Save password          ]   │
└──────────────────────────────────────┘
```

**Voluntary mode** — reached from the identity menu. Identical fields, no
callout, and a Cancel action returning to the previous screen.

- The length rule is **helper text shown up front**, not a message that appears
  only after failure (UI-07). A rule the user learns by failing is a rule the
  design failed to communicate.
- The confirmation field is validated locally; a mismatch never reaches the API.
- `autocomplete="new-password"` on both new-password fields.
- On success, mandatory mode continues into the role's landing page and
  voluntary mode returns with a success callout.

### 6.3 IT Staff Ticket Queue

```
Ticket Queue                        9 unassigned · 6 assigned to me

┌─────────────────────────────────────────────────────────────────┐
│ [🔍 Search number or summary] [Status ▾] [IT Priority ▾]         │
│ [Owner ▾] [Category ▾]   Sort: [Last Updated ▾] [↓]  [Clear]     │
└─────────────────────────────────────────────────────────────────┘

┌────────────┬──────────────────┬──────────┬──────────┬───────────────┬────────────┬────────────┐
│ Ticket No. │ Summary          │ Category │IT Priority│ Status        │ Owner      │Last Updated│
├────────────┼──────────────────┼──────────┼──────────┼───────────────┼────────────┼────────────┤
│TKT-2026-…12│ Laptop battery…  │ Hardware │ [High]   │ [In Progress] │Anong Srisai│ 3 Sep 2026 │
│TKT-2026-…13│ VPN drops hourly │ Network  │ [Medium] │ [New]         │ Unassigned │ 3 Sep 2026 │
└────────────┴──────────────────┴──────────┴──────────┴───────────────┴────────────┴────────────┘

                    Showing 1–20 of 47   [‹] 1 2 3 [›]   Rows: [20 ▾]
```

**Columns, and why these seven.** The handout lists nine candidates and asks for
a justified subset rather than a mega-grid.

| Kept | Reason |
|------|--------|
| Ticket Number | The identifier quoted in conversation |
| Summary | The only column a human actually scans to recognise work |
| Category | The coarsest routing signal, and a filter facet |
| IT Priority | The triage signal this screen exists to act on |
| Status | Where the work stands |
| Owner | Whether it is anyone's problem yet — the queue's core question |
| Last Updated | The default sort key, so the ordering is explicable |

| Dropped | Reason |
|---------|--------|
| Requested Priority | The customer's opinion is context for the detail screen; showing two priority columns side by side invites acting on the wrong one |
| Created Date | Last Updated is more actionable for triage, and two dates in one row is noise |
| Requester name | Available in detail; the queue is organised around work, not people, and the name pushes Summary below a readable width |

- **Owner** renders "Unassigned" as muted text, not an empty cell. An empty cell
  reads as a rendering bug.
- A **resolution-signal marker** appears next to Status when the Requester has
  signalled — a small "Requester says resolved" chip, so staff can find work that
  is probably finished.
- The whole row links to the detail screen and is keyboard-reachable.
- **Header counts** show unassigned and assigned-to-me totals from the API's
  `counts`. These are the "simple queue counts" §3.2 permits, and nothing more.
- **Empty** ("No tickets in the queue") and **no-results** ("No tickets match
  your filters", plus Clear filters) stay distinct, as in Lab 2.

**Mobile (< 768 px)** — cards, never a sideways-scrolling table:

```
┌───────────────────────────────────┐
│ TKT-2026-000012    [In Progress]  │
│ Laptop battery drains quickly     │
│ Hardware · IT Priority [High]     │
│ Anong Srisai · 3 Sep 2026      ›  │
└───────────────────────────────────┘
```

Filters collapse behind a "Filters" disclosure showing an active count.

### 6.4 IT Staff Ticket Detail

Extends Lab 2's detail. Ticket information stays read-only; a separate panel
holds the operational controls.

```
‹ Back to queue

TKT-2026-000012                  [In Progress]  IT Priority [High]

┌─ Ticket Information ────────────────────────────────────────────┐
│  Requester    Somchai Prasert    Requested Priority  [Medium]    │
│  Category     Hardware           Related System      Corporate…  │
│  Ticket Date  1 Sep 2026         Last Updated        3 Sep 2026  │
│  Summary / Description …                            (read-only)  │
└──────────────────────────────────────────────────────────────────┘

┌─ Ticket Operations ─────────────────────────────────────────────┐
│  Owner        [ Anong Srisai        ▾ ]  [ Claim ] [ Release ]   │
│  IT Priority  [ High                ▾ ]                          │
│  Status       [ Waiting for Requester ▾ ]  [ Apply ]             │
└──────────────────────────────────────────────────────────────────┘

┌─ Attachments (2 of 5) ──────────────────────────────────────────┐
│  (Lab 2 attachment rows, unchanged)                              │
└──────────────────────────────────────────────────────────────────┘

┌─ Public Comments ───────────────────────────────────────────────┐   green
│  (§7.1)                                                          │
└──────────────────────────────────────────────────────────────────┘

┌─ Internal Notes · Visible to IT Staff only ─────────────────────┐   cool grey
│  (§7.2)                                                          │
└──────────────────────────────────────────────────────────────────┘
```

- **Ticket Information is read-only** and uses label/value pairs, not disabled
  inputs — continuing Lab 2 §8.4's reasoning that a greyed-out field implies it
  is editable somewhere.
- **Ticket Operations** is the only editable region, visually separated by its
  own card. Its fields use the editable control style; everything above uses the
  read-only style (STYLE-04).
- The **Status** select offers **only the transitions permitted from the current
  status**, taken from the API's `permittedTransitions` (UI-23). Offering an
  impossible transition and then rejecting it wastes the user's attempt.
- Choosing **Cancelled** opens a confirmation dialog naming the consequence —
  "Cancelling is permanent. This ticket cannot be reopened." (BR-38).
- **Claim** appears only when the ticket is unassigned; **Release** only when it
  is assigned. The owner select lists active IT Staff and Administrators only.
- A **conflict** from the status or owner endpoint renders inline in this panel
  (§5), leaving the rest of the screen usable.
- On a `CLOSED` or `CANCELLED` ticket, both composers are disabled with an
  explanation, and the operations panel offers no transitions (UI-25).

### 6.5 Administrator User Management

One screen. No pagination, no multi-column sorting, no simultaneous filters —
all excluded by §3.2.

```
User Management                                    [ + Create user ]

┌─────────────────────────────────────────────────────────────────┐
│ [🔍 Search name or email]              [Role: All ▾]  [ Clear ]  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────────┬───────────────┬──────────┬────────┐
│ Name             │ Email                │ Role          │ Status   │        │
├──────────────────┼──────────────────────┼───────────────┼──────────┼────────┤
│ Somchai Prasert  │ somchai@kmutt.ac.th  │ (Requester)   │ Active   │ [Edit] │
│ Anong Srisai     │ anong@kmutt.ac.th    │ (IT Staff)    │ Active   │ [Edit] │
│ Prasit Noi       │ prasit@kmutt.ac.th   │ (Requester)   │ Inactive │ [Edit] │
└──────────────────┴──────────────────────┴───────────────┴──────────┴────────┘
```

Exactly the five things §8.5 requires: Name, Email, Role, Status, and an Edit
action. **Status** is a word — "Active" / "Inactive" — not a coloured dot.

**Create and Edit** open the same panel, differing only in title and in whether
the initial-password field is present:

```
┌─ Edit user ─────────────────────────────────┐
│  Name *          [                        ]  │
│  Email *         [                        ]  │
│  Role *          [ IT Staff             ▾ ]  │
│  Status          (•) Active  ( ) Inactive    │
│  ───────────────────────────────────────────  │
│  [ Set new initial password ]                │
│                                              │
│              [ Cancel ]  [ Save ]            │
└──────────────────────────────────────────────┘
```

- **One role, always** — a single select, never checkboxes. Multiple roles are
  excluded (§3.2) and a checkbox list would imply otherwise.
- **Set new initial password** is a separate action behind its own confirmation,
  not a field on the edit form. It has a different consequence from an edit — it
  ends the user's sessions — and folding it into Save would let an Administrator
  reset a password while intending to fix a typo in a name.
- The confirmation states both consequences plainly: "They will be signed out and
  must choose a new password at their next sign-in."
- **Guard refusals render as conflicts** (§5) beside the control that caused
  them, each with the server's specific message (UI-29):
  - deactivating yourself,
  - changing your own role,
  - removing the last active Administrator,
  - a duplicate email address.
- The Status control for **your own row** is disabled with an adjacent
  explanation, so the refusal is anticipated rather than only reported. The
  server still refuses regardless (AC-49).
- No delete control exists anywhere on this screen (BR-57).

---

## 7. Public Comments and Internal Notes

The confidentiality boundary of this sprint. The two are never adjacent in a way
that lets a hurried person type in the wrong box.

### 7.1 Public Comments

```
┌─ Public Comments ───────────────────────────────────────────────┐
│  Visible to the requester and the IT team                        │
│                                                                  │
│  Somchai Prasert (Requester) · 2 Sep 2026 11:45                  │
│  I tried the update but the problem is still there.              │
│                                                                  │
│  Anong Srisai (IT Staff) · 3 Sep 2026 09:12                      │
│  We have ordered a replacement battery.                          │
│  ──────────────────────────────────────────────────────────────  │
│  Add a comment                                                   │
│  [                                                            ]  │
│  0 / 2000                              [ Post comment ]          │
└──────────────────────────────────────────────────────────────────┘
```

Surface `--zg-surface` with the standard card border. Each entry shows author
name, **role badge**, and timestamp. Newest last, so the thread reads
chronologically like a conversation.

### 7.2 Internal Notes

```
┌─ Internal Notes · Visible to IT Staff only ─────────────────────┐
│                                                                  │
│  Anong Srisai (IT Staff) · 3 Sep 2026 11:02                      │
│  Customer has a second device; low urgency.                      │
│  ──────────────────────────────────────────────────────────────  │
│  Add an internal note        🔒 Visible to IT Staff only         │
│  [                                                            ]  │
│  0 / 2000                              [ Add note ]              │
└──────────────────────────────────────────────────────────────────┘
```

**Four independent signals**, because one is not enough for content that must
never reach a customer:

1. The section **heading** names the audience.
2. The whole region uses `--zg-internal-surface` with `--zg-internal-border` — a
   different hue family from every other card on the page (§2).
3. A **persistent label beside the input itself**, not only in the heading above
   it, so it is in view at the moment of typing (BR-47, STYLE-05). It is
   associated with the textarea via `aria-describedby`, so a screen-reader user
   hears it on focus rather than having to hunt for it.
4. The submit button reads **"Add note"**, never "Post" — a different verb from
   the public composer, so muscle memory cannot carry a user across.

The Internal Notes region is **absent from the Requester's Ticket Detail
entirely** — no heading, no empty state, no count (UI-16, AUTHZ-10).

### 7.3 Shared rules

- Both are **append-only**: no edit or delete control exists (BR-42).
- The counter turns `--zg-error` past 2000 characters and the button disables.
- Whitespace-only content leaves the button disabled; the API is never called.
- Bodies render as **text nodes**, never as HTML (BR-45).
- Both composers are disabled with an explanation on a terminal ticket (BR-46).

---

## 8. Changed and Removed Screens

### 8.1 Requester Ticket Detail

Lab 2's layout is unchanged, plus:

- a **Public Comments** panel (§7.1) below Attachments;
- a **"Problem appears resolved"** action in the header area, secondary variant,
  behind a confirmation that states what it does and does not do — "This tells
  the IT team the problem looks fixed. They will confirm and close the ticket.";
- after signalling, a `--zg-pale` confirmation chip replaces the action, and
  **the status badge is visibly unchanged** (AC-25, UI-15).

No Internal Notes region exists on this screen in any state.

### 8.2 Deleted

`RequesterSelection`, the `/select` route, the `RequesterProvider` state, and
every `X-Requester-Id` call site are removed outright (FR-10, REG-03).

---

## 9. Accessibility Additions

Lab 2 §10 continues in full. This sprint adds:

- **Login and Change Password** are completable by keyboard alone with focus
  visible at every step (AC-56, E2E-04).
- **Autocomplete attributes** are correct on all three password fields so
  password managers work rather than being fought.
- The mandatory-change callout uses `role="status"`; forbidden and not-found
  panels use `role="alert"`.
- The Internal Note audience label is programmatically associated with its
  textarea, not merely adjacent to it (§7.2).
- **Role and status are conveyed by text** in every badge, so role-based
  differences are never signalled by colour alone.
- The confirmation dialogs for Cancelled, initial-password reset, and resolution
  signal all trap focus, close on Escape, and restore focus to their trigger.

---

## 10. Responsive Rules

Lab 2 §11 applies unchanged: two breakpoints, no page-level horizontal scroll at
any width, and nothing clipped, overlapped, or hidden.

| Screen | Desktop ≥ 992 px | Tablet 768–991 px | Mobile < 768 px |
|--------|------------------|-------------------|-----------------|
| Login, Change Password | Centred card, fixed max width | Same | Card fills the width with the standard gutter |
| Ticket Queue | Seven-column table | Table drops Category and Owner into the Summary cell | Cards (§6.3) |
| Staff Ticket Detail | Two-column information, full-width panels | Two columns where they fit | Single column, panels stacked in the §6.4 order |
| User Management | Five-column table | Same, Email allowed to wrap | Cards: name and role on one line, email below, Edit full width |
| Comments and Notes | Full width within the panel | Same | Same; composer and button stack |

The operations panel keeps its controls at full width on mobile so a status
select is never a sliver.

---

## 11. Visual Inspection Checklist

Completed by hand against this document and the captured screenshots — **not from
memory** — before the release PR. This is the Part 9 evidence.

### 11.1 Per screen × per viewport

Repeat for Login, Change Password, Ticket Queue, Staff Ticket Detail, and User
Management at desktop, tablet, and mobile:

- [ ] **Horizontal overflow** — no page-level sideways scroll
- [ ] **Clipping** — no truncated label, value, or button text
- [ ] **Overlap** — no validation message or badge colliding with another element
- [ ] **Editable vs read-only** — the two field styles are distinguishable at a glance
- [ ] **Validation placement** — every message sits beneath its own field, never only as a banner
- [ ] **Focus** — tabbing shows a visible ring on every control, including table rows that act as links
- [ ] **Design consistency** — Zen Green tokens only; no literal colour, no second button style, no ad-hoc spacing

### 11.2 Role navigation

- [ ] Signed in as a Requester: My Tickets and Create Ticket only; no Queue, no User Management **in the DOM**
- [ ] Signed in as IT Staff: Ticket Queue present; no User Management
- [ ] Signed in as an Administrator: User Management present
- [ ] The identity area shows the name and the correct role badge in all three
- [ ] Logout returns to Login, and a direct URL afterwards does not render data

### 11.3 Badges

- [ ] All eight statuses render with readable text at every viewport
- [ ] "Waiting for Requester" wraps rather than truncating on mobile
- [ ] Closed and Cancelled are distinguishable without relying on colour
- [ ] Requested Priority and IT Priority are always labelled, never bare
- [ ] Role badges are outlined and do not compete with status badges

### 11.4 Confidentiality

- [ ] Public Comments and Internal Notes are unmistakable at a glance
- [ ] The note composer's audience label is visible while typing, not only above
- [ ] The two submit buttons use different verbs
- [ ] A Requester's Ticket Detail shows no trace of a note region, in any state

---

## 12. Screenshot Paths

Captured by `e2e/lab-03/responsive.spec.ts` and used as the Part 5–9 evidence.

```
artifacts/lab-03/screenshots/
├── authentication/
│   ├── desktop-login-initial.png
│   ├── desktop-login-validation.png
│   ├── desktop-login-busy.png
│   ├── desktop-login-failure.png
│   ├── desktop-login-deactivated.png
│   ├── desktop-change-password-mandatory.png
│   ├── desktop-change-password-validation.png
│   ├── desktop-after-logout.png
│   ├── tablet-login-initial.png
│   └── mobile-login-initial.png
├── staff-queue/
│   ├── desktop-queue.png
│   ├── desktop-queue-filtered.png
│   ├── desktop-queue-empty.png
│   ├── desktop-queue-no-results.png
│   ├── desktop-queue-forbidden.png
│   ├── tablet-queue.png
│   └── mobile-queue-cards.png
├── staff-ticket-detail/
│   ├── desktop-detail.png
│   ├── desktop-operations-panel.png
│   ├── desktop-status-confirm-cancel.png
│   ├── desktop-comments-and-notes.png
│   ├── desktop-conflict-inline.png
│   ├── desktop-requester-view-no-notes.png
│   ├── tablet-detail.png
│   └── mobile-detail.png
└── user-management/
    ├── desktop-list.png
    ├── desktop-search-filtered.png
    ├── desktop-create.png
    ├── desktop-edit.png
    ├── desktop-duplicate-email.png
    ├── desktop-last-admin-guard.png
    ├── desktop-initial-password-confirm.png
    ├── tablet-list.png
    └── mobile-list.png
```
