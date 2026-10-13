# Lab 4 UI Specification — Zen Green, Final

**Sprint:** Lab 4 — Actions Taken, Dashboards, and Final Regression
**Contract:** [`specification.md`](./specification.md) · [`tests.md`](./tests.md) · [`api-spec.md`](./api-spec.md)
**Extends:** [Lab 3 ui-spec](../lab-03/ui-spec.md), which extends
[Lab 2 ui-spec](../lab-02/ui-spec.md) — **inherited, not replaced**
**Status:** Approved for implementation

Implementation is checked against this file and the captured screenshots, never
from memory. This is the final sprint: the goal is one coherent application, so
every new element reuses an existing component before anything new is drawn.

---

## 1. Relationship to Lab 3

### 1.1 Inherited unchanged

Everything in the Lab 2 and Lab 3 ui-specs stays in force and is **not**
restated here:

| Source | Carried forward |
|--------|-----------------|
| Lab 2 §1 | Every colour, typography, spacing, shape, and breakpoint token |
| Lab 2 §2–§4 | `.zg-field` states, form conventions, four button variants plus disabled and busy, one primary per region |
| Lab 2 §6 + Lab 3 §5 | Eleven screen states: initial, loading, validation, submitting, success, API failure, empty, no-results, forbidden, not-found, conflict |
| Lab 3 §2 | `--zg-info*` and `--zg-internal*` token pairs |
| Lab 3 §3 | Ticket status, priority, and role badges |
| Lab 3 §7 | The Public Comment / Internal Note boundary |
| Lab 2 §10 + Lab 3 §9 | Keyboard, focus, labelling, never-colour-alone, contrast, touch targets, dialog focus rules |
| Lab 2 §11 + Lab 3 §10 | Two breakpoints, three viewports, no horizontal page scroll |

### 1.2 Extended by this sprint

| Area | Extension |
|------|-----------|
| Tokens | One typography token for metric values (§2.1); no new colour |
| Components | Metric card, count strip, compact Ticket list, action-status badge, follow-up chip, conflict banner, history list (§2) |
| Shell | *Dashboard* for every role; Administrator gains *Ticket Queue* (§3) |
| Screens | Three dashboards (§5, §6); Actions Taken and Status history on both Ticket Details (§7, §8) |
| Lists | My Tickets, Ticket Queue, and User Management read and write their filters in the URL (§9) |
| Polish | A concrete removal and consolidation list (§10) |

---

## 2. Token and Component Additions

### 2.1 Token

Appended to `client/src/theme.css`. Nothing existing is redefined.

```css
:root {
  /* Metric values on dashboard cards — the one number the eye should land on. */
  --zg-fs-metric: 2rem;
}
```

No colour is added. Every Lab 4 surface uses an existing token pair, so a
dashboard cannot drift into a second palette (STYLE-01).

### 2.2 Metric card — `.zg-metric`

```
┌────────────────────────────┐
│  Open and unassigned       │  label   --zg-fs-label, --zg-text-muted
│  4                         │  value   --zg-fs-metric, --zg-fw-semibold, --zg-text
│  View list ›               │  cue     --zg-fs-small, --zg-primary
└────────────────────────────┘
```

- The **whole card is one link** (`<a class="zg-metric">`) to the metric's
  `href`. Its accessible name is the full sentence — "Open and unassigned: 4 —
  view list" — so a screen reader does not announce a bare number (STYLE-03).
- `--zg-surface`, `--zg-border`, `--zg-radius-lg`, `--zg-shadow`; hover raises
  the border to `--zg-primary`; focus shows the standard focus ring.
- A metric whose `href` is `null` renders as `<div class="zg-metric zg-metric--static">`
  with no cue and no hover — it never pretends to be a link.
- **Zero is shown as `0`**, in the same weight, never as a dash or blank. An
  empty-looking card reads as "failed to load".
- Values use tabular numerals (`font-variant-numeric: tabular-nums`) so a row of
  cards lines up.

### 2.3 Count strip — `.zg-count-strip`

For *By status* and *Open by IT Priority*: one row of compact links, each a
badge plus its count.

```
By status
[New] 2   [Open] 1   [In Progress] 3   [Waiting for Requester] 1   [Resolved] 2 …
```

Each item is a link with the accessible name "In Progress: 3 tickets". The
badges are the existing Ticket status and priority badges — the strip adds no
colour of its own. Items wrap onto further lines; the strip never scrolls
sideways.

### 2.4 Compact Ticket list — `.zg-mini-list`

The dashboard lists. Each row is one link to the Ticket:

```
TKT-2026-000012  [In Progress]  [High]
Laptop battery drains quickly                      Updated 13 Oct, 16:00
```

At most five rows (BR-48). The list has a heading, an optional *View all ›* link
to the right of the heading, and its own empty message (§4).

### 2.5 Action-status badge — `.zg-badge--action-*`

The shared `.zg-badge`, with the **square** `--zg-radius-sm` corner instead of the
pill radius, so an action status can never be mistaken for a Ticket status in the
same panel. Text always carries the meaning.

| Value | Class | Text | Surface / text |
|-------|-------|------|----------------|
| `PLANNED` | `.zg-badge--action-planned` | "Planned" | transparent, `--zg-border-strong` outline / `--zg-text-muted` |
| `IN_PROGRESS` | `.zg-badge--action-in-progress` | "In progress" | `--zg-info-surface` / `--zg-info` |
| `COMPLETED` | `.zg-badge--action-completed` | "Completed" | `--zg-pale` / `--zg-success` |
| `CANCELLED` | `.zg-badge--action-cancelled` | "Cancelled" | `--zg-disabled-bg` / `--zg-text-muted`, text struck through |

### 2.6 Follow-up chip — `.zg-chip--follow-up`

"Follow-up needed" on `--zg-warning-surface` / `--zg-warning`, with the
Follow-up Note directly beneath in body text. It is the only warning-coloured
element in an action row, because it is the only thing in the row that asks for
more work (Lab 2's "warnings only, never decoration").

### 2.7 Conflict banner — `.zg-callout--conflict`

The Lab 3 §5 conflict callout, extended for stale writes:

```
┌─ ⚠ This ticket was changed by someone else. ──────────── [ Reload ] ┐
│  Status is now Waiting for Requester. Your changes are still below.  │
└──────────────────────────────────────────────────────────────────────┘
```

- `--zg-warning-surface`, `role="alert"`, placed **at the top of the panel whose
  write failed**, never at page level.
- The second line names what changed, taken from `current` in the 409 body.
- **The user's input stays in the form** until they choose *Reload* (AC-40).
  *Reload* refetches the Ticket and its actions and then closes the banner; if
  the form was a dialog, the dialog stays open with the user's values so they
  can resubmit against the new version.

### 2.8 History list — `.zg-history`

An ordered list (`<ol>`), oldest first, one line per entry:

```
1 Oct, 09:00   New                         Somchai Prasert
1 Oct, 10:12   New → In Progress           Anong Srisai
3 Oct, 15:40   In Progress → Resolved      Anong Srisai
```

Statuses are the Ticket status badges; the arrow is text ("→", with the
accessible text "to"). The actor is the name, "IT Support" (Requester view of a
staff change), "You" (Requester's own entries), or "Recorded at upgrade" for a
backfilled entry, in `--zg-text-muted` italics (BR-35).

---

## 3. Application Shell — Dashboard navigation

| Role | Destinations, in order |
|------|------------------------|
| Requester | **Dashboard** · My Tickets · Create Ticket |
| IT Staff | **Dashboard** · Ticket Queue |
| Administrator | **Dashboard** · Ticket Queue · User Management |

- *Dashboard* is always first and links to `/dashboard`, which renders the
  role's dashboard. After login, and for any unknown route, every role lands
  there (BR-62, AC-53).
- The active-page indicator follows the most specific match: on
  `/staff/tickets/12`, *Ticket Queue* is active; on `/dashboard`, *Dashboard* is.
- Destinations of other roles stay **absent from the DOM** (Lab 3 §4.2).
- The identity area, mobile *Menu* disclosure, and header height are unchanged.

---

## 4. Screen States for Lab 4 regions

Every region below uses the existing `LoadingSkeleton`, `EmptyState`, and
`ErrorCallout` components; none draws its own.

| Region | Loading | Empty | Safe failure | Forbidden | Conflict |
|--------|---------|-------|--------------|-----------|----------|
| Dashboard (whole) | Skeleton cards in the final grid, `aria-busy` | — (cards show 0) | `ErrorCallout` "We couldn't load your dashboard." + *Try again* | Lab 3 forbidden panel | — |
| Each dashboard list | (part of the dashboard skeleton) | Its own sentence, §5–§6 | — | — | — |
| Actions Taken section | Skeleton rows | "No actions recorded yet." (staff adds: "Use *Add action* to record the work.") | `ErrorCallout` + *Try again*, section only | — | §2.7 banner |
| Action form dialog | Submit busy label "Saving…" | — | Callout inside the dialog; values kept | — | §2.7 banner inside the dialog |
| Ticket Operations (status) | Busy label "Applying…" | — | Inline callout; selection kept | — | §2.7 banner, or the gate message (§7.4) |
| Status history | Skeleton rows | (never empty — creation is always recorded) | `ErrorCallout` + *Try again* | — | — |

A failed region never blanks the rest of the screen.

---

## 5. IT Staff and Administrator Dashboard

### 5.1 Layout — desktop ≥ 992 px

```
Dashboard
Good afternoon, Anong                                       Updated 16:05

┌ Open and unassigned ┐ ┌ Open and assigned ┐ ┌ My open actions ┐ ┌ Open, high priority ┐
│ 4                   │ │ to me  2          │ │ 3               │ │ 1                   │
│ View list ›         │ │ View list ›       │ │                 │ │ View list ›         │
└─────────────────────┘ └───────────────────┘ └─────────────────┘ └─────────────────────┘

By status          [New] 2  [Open] 1  [In Progress] 3  [Waiting for Requester] 1 …
Open by IT Priority  [Low] 2  [Medium] 3  [High] 1

┌─ My open actions ─────────────────┐ ┌─ Urgent ──────────────── View all › ┐
│ (≤ 5 action rows)                 │ │ (≤ 5 ticket rows, oldest first)     │
└───────────────────────────────────┘ └─────────────────────────────────────┘
┌─ Recently updated ─────────────────────────────────────────── View all › ┐
│ (≤ 5 ticket rows, newest first)                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Users (Administrator only) ─────────────────────────────────────────────┐
│ Requesters 6 ›   IT Staff 4 ›   Administrators 2 ›   Inactive 2          │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Four metric cards** in one row, then the two count strips, then the lists.
  The cards answer "how much"; the lists answer "which ones".
- *My open actions* list rows show the action-status badge, the Action
  Date/Time, the action description (cut to 120 characters by the API), and the
  Ticket number and summary; the row links to the Ticket.
- *Urgent* rows: Ticket number, status badge, owner name or "Unassigned", and
  how long it has waited ("Opened 9 days ago").
- The **Users** card renders only when the response contains `userCounts`
  (AC-49). It uses three small metric links and one static count.
- "Updated 16:05" is `generatedAt`, so a user can tell a stale tab from a live one.

### 5.2 Empty messages

| List | Message |
|------|---------|
| My open actions | "You have no open actions." |
| Urgent | "No open high-priority tickets." |
| Recently updated | "No tickets were updated in the last 7 days." |

### 5.3 Responsive

| Width | Arrangement |
|-------|-------------|
| Desktop ≥ 992 px | Cards 4 across; *My open actions* and *Urgent* side by side; *Recently updated* full width |
| Tablet 768–991 px | Cards 2 × 2; every list full width |
| Mobile < 768 px | Cards 2 × 2 with the value scaled to `--zg-fs-section` × 1.5; count strips wrap; lists full width, each row stacking number, badges, then summary |

---

## 6. Requester Dashboard

### 6.1 Layout — desktop

```
Dashboard
Hello, Somchai                                        [ + Create ticket ]

┌ Open tickets ┐ ┌ Waiting for you ┐ ┌ Resolved, awaiting closure ┐
│ 3            │ │ 1               │ │ 1                          │
│ View list ›  │ │ View list ›     │ │ View list ›                │
└──────────────┘ └─────────────────┘ └────────────────────────────┘

┌─ Needs your attention ────────────────────────────────── View all › ┐
│ TKT-2026-000012  [Waiting for Requester]                             │
│ Laptop battery drains quickly — the IT team is waiting for your reply│
└──────────────────────────────────────────────────────────────────────┘
┌─ Recently updated ─────────── View all › ┐ ┌─ Recently resolved ─────┐
│ (≤ 5)                                     │ │ (≤ 5, "Resolved 12 Oct")│
└───────────────────────────────────────────┘ └─────────────────────────┘
```

- **Three metric cards.** *Waiting for you* is the one that asks the Requester
  to act, so its card carries the warning-surface status badge beside the label.
- *Needs your attention* is placed **first and full width**: it is the reason a
  Requester opens the dashboard.
- *+ Create ticket* is the page's single primary action.
- Nothing here duplicates My Tickets: no search, no filters, no pagination. *View
  all ›* hands over to My Tickets with the filter applied.

### 6.2 Empty messages

| List | Message |
|------|---------|
| Needs your attention | "Nothing needs your attention right now." |
| Recently updated | "None of your tickets changed in the last 7 days." |
| Recently resolved | "No tickets were resolved in the last 30 days." |
| Requester with no Tickets at all | The three cards show 0, and the list area is replaced by one `EmptyState`: "You haven't raised a ticket yet." with *Create ticket* (UI-31) |

### 6.3 Responsive

| Width | Arrangement |
|-------|-------------|
| Desktop | Cards 3 across; *Needs your attention* full width; the two other lists side by side |
| Tablet | Cards 3 across (they fit at 768 px); lists full width |
| Mobile | Cards stack 1 per row, value and label on one line; *Create ticket* full width under the greeting; lists full width |

---

## 7. Actions Taken on IT Staff Ticket Detail

### 7.1 Placement

The Lab 3 §6.4 order, with two sections inserted after Ticket Operations, because
recording work is the next thing a staff member does after taking a Ticket:

```
Ticket Information → Ticket Operations → Actions Taken → Status History
→ Attachments → Public Comments → Internal Notes
```

### 7.2 List — view mode

```
┌─ Actions Taken (3) ──────────────────────────────── [ + Add action ] ┐
│ Date / Time      Action                      Performed by   Status    │
│ 14 Oct, 09:30    Replace the laptop battery  Krit Wongsa    [Planned] │
│                  Result: —                                [Edit] [⋯] │
│ 13 Oct, 15:10    Ran battery diagnostics     Anong Srisai  [Completed]│
│                  Result: Capacity at 41 %.                            │
│                  [Follow-up needed] Order a replacement battery.      │
│                  Files: see battery-report.pdf                        │
└──────────────────────────────────────────────────────────────────────┘
```

- Ordered by Action Date/Time, then id (BR-12) — the API order, never re-sorted
  on the client.
- Each row shows every field: Action Date/Time, Description, Result ("—" when
  empty), Performed by, the action-status badge, the follow-up chip and note when
  follow-up is required, and Attachment Notes prefixed "Files:".
- *Created by* appears in small muted text only when it differs from the
  performer: "Recorded by Anong Srisai".
- **Row controls by status** (BR-14, BR-15):

| Action status | Controls |
|---------------|----------|
| Planned | *Edit* · *Start* · *Complete* · *Cancel action* |
| In progress | *Edit* · *Complete* · *Cancel action* |
| Completed, Cancelled | none — the row uses the read-only style |

  On desktop *Edit* is a tertiary button and the other three sit in a `⋯` menu
  button with an accessible name "More actions for 14 Oct, 09:30". On mobile all
  controls are full-width buttons in the card.
- *+ Add action* is the section's primary button. On a Resolved, Closed, or
  Cancelled Ticket it is replaced by a muted sentence — "Reopen this ticket to
  record more work." or "This ticket is closed." (BR-19, UI-11).

### 7.3 Create and edit — the action form dialog

A modal dialog (`role="dialog"`, `aria-modal="true"`, labelled by its heading),
the same dialog component User Management uses. Full-screen sheet on mobile.

```
┌─ Add action ──────────────────────────────────────────────────── ✕ ┐
│ Action date and time *      [ 14/10/2026 09:30 ]                    │
│ Status *                    ( ) Planned  (•) In progress  ( ) Completed│
│ Performed by *              [ Anong Srisai (you)          ▾ ]       │
│ Action description *        [                                    ]  │
│                             [                                    ]  │
│                             0 / 2000                                │
│ Result                      [                                    ]  │
│                             Required to complete the action.        │
│ Follow-up required?         [ ] Yes                                 │
│ Follow-up note *            [                                    ]  ← only when Yes
│ Attachment notes            [ e.g. see photo router-front.jpg    ]  │
│                             Which of this ticket's files to look at.│
│                                         [ Cancel ]  [ Save action ] │
└─────────────────────────────────────────────────────────────────────┘
```

| Field | Control | Notes |
|-------|---------|-------|
| Action date and time | `<input type="datetime-local">` | Defaults to now; sent as ISO 8601 with the browser's offset |
| Status | Radio group | Create only; offers Planned, In progress, Completed. Hidden in edit mode, where status changes use the row controls |
| Performed by | Select of active IT Staff and Administrators | Defaults to the current user, labelled "(you)". In edit mode a deactivated stored performer appears as "Krit Wongsa (deactivated)" and stays selectable only while unchanged (BR-05) |
| Action description | Textarea, 4 rows | Character counter; required |
| Result | Textarea, 3 rows | The hint switches to "Required" when Completed is selected |
| Follow-up required? | Checkbox | Checking it reveals Follow-up note and moves focus to it |
| Follow-up note | Textarea, 2 rows | Required when visible; its value is discarded when unchecked |
| Attachment notes | Single-line input | Placeholder is an example, never the label |

- **Validation** follows Lab 2 §3: the message sits directly beneath its own
  field, in reserved space, linked by `aria-describedby`; on submit, focus moves
  to the first invalid field (STYLE-05). Server `fields` errors land in the same
  places (UI-08).
- **Single flight:** *Save action* is disabled with the busy label "Saving…"
  while the request is in flight. The dialog generates one `clientRequestId` when
  it opens and reuses it for every retry from that dialog (BR-44).
- **Failure keeps data:** on a network error, 500, or 409 the dialog stays open
  with every value intact (AC-60).
- *Complete* from a row whose Result is empty opens this dialog in edit mode with
  Completed pre-selected and focus on Result, instead of failing (UI-05).
- *Cancel action* opens a confirmation dialog: "Cancel this action? It will stay
  in the list as Cancelled and can't be changed afterwards." — buttons *Keep
  action* (secondary, initial focus) and *Cancel action* (danger) (BR-16).

### 7.4 Ticket Operations — status with the gate

The Lab 3 status select keeps its place, with one addition beneath it:

```
Status   [ In Progress            ▾ ]   [ Apply ]
         To resolve this ticket:
         • Complete at least one action.
         • Finish or cancel 1 open action.
```

- The select lists `permittedTransitions` only; Resolved is absent while the gate
  is unmet (BR-28, UI-15).
- The "To resolve this ticket:" list renders whenever `resolutionGate.satisfied`
  is false **and** the current status could otherwise move to Resolved. Its items
  are the API's `unmet[].message` strings, in `--zg-text-muted`, with an info
  icon that has no meaning of its own.
- After a successful change, the header status badge, the select's options, the
  gate list, and Status History all refresh from the response and a refetch —
  no page reload (AC-30).
- Choosing **Cancelled** keeps Lab 3's confirmation and adds the cascade: "1 open
  action will also be cancelled." when any exist (UI-21).
- A 409 `resolutionGate` (a race) shows the returned reasons in the gate list and
  refreshes the Ticket (UI-22); a 409 `stale` shows the §2.7 banner (UI-18).
- Owner and IT Priority controls send `expectedVersion` and use the same banner.

### 7.5 Status History section

The §2.8 list in its own card under Actions Taken, heading "Status history". It
has no controls, and the read-only style.

---

## 8. Requester Ticket Detail additions

Inserted after the Ticket Information card, before Attachments:

- **Actions Taken** — the §7.2 list, **read-only**: no *Add action*, no row
  controls, no *Created by*, performer by name. A one-line caption reads "Work the
  IT team has recorded on this ticket." Empty: "The IT team hasn't recorded any
  work yet."
- **Status history** — the §2.8 list with staff shown as "IT Support".

Both use the read-only field style (STYLE-04). There is still no Internal Notes
region on this screen in any state. The resolution-signal action and its chip are
unchanged from Lab 3 §8.1.

---

## 9. Lists driven by the URL

My Tickets, the Ticket Queue, and User Management keep their Lab 2/3 layouts and
gain one behaviour: **the query string is the filter state.**

- On first load, each recognised parameter pre-selects its control and is sent
  to the API; unrecognised values are ignored, as the API ignores them.
- Changing a filter, sort, or page updates the query string with
  `replace: false`, so *Back* returns to the previous filter (UI-39).
- My Tickets and the Queue add one status-filter option, **"All open"**
  (`statusGroup=active`), placed directly under "All statuses".
- A filtered list arrived at from a dashboard shows a small "Filtered from
  Dashboard · Clear filters" line above the results, so the user knows why the
  list is shorter than usual.

---

## 10. Final Polish — removals and consolidations

The labsheet asks that temporary, duplicate, obsolete, or inconsistent elements
be removed. Each item below is a concrete change verified in Issue 8.

| # | Found | Change |
|---|-------|--------|
| P-01 | Six private date formatters (`formatDate`, `formatWhen`, `formatDateTime`) across screens and components, with differing output | One shared `client/src/format.ts` with `formatDate` and `formatDateTime`; every screen uses it |
| P-02 | The Queue header line "9 unassigned · 6 assigned to me" counts **all** statuses, while the dashboard counts open Tickets | Relabelled "9 unassigned · 6 assigned to me (all statuses)" so the same words never show two different numbers; the dashboard labels say "Open" (spec §5.8) |
| P-03 | Post-login landing differs by role | Every role lands on `/dashboard` (§3) |
| P-04 | Administrators had no route to the Ticket screens they are permitted to use | *Ticket Queue* in their navigation (§3) |
| P-05 | Any `console.log`, `TODO`, placeholder copy, or `href="#"` in `client/src` | Removed; UI-42 keeps them out |
| P-06 | Any button rendering without an explicit `type` | Every `Button` keeps the Lab 3 `type="button"` default; real submits declare `type="submit"` |
| P-07 | Inconsistent empty-state wording across screens | Every empty message is a full sentence in the pattern of §5.2 and §6.2 |

---

## 11. Accessibility

Lab 2 §10 and Lab 3 §9 continue in full. This sprint adds:

- **Metric cards and count-strip items** have full-sentence accessible names;
  the visible number is never the only announcement (§2.2, §2.3).
- **Action form** fields have visible labels, required markers with text
  ("required" in the accessible name), and error text linked by
  `aria-describedby`. Revealing Follow-up note moves focus to it; hiding it
  returns focus to the checkbox.
- **Dialogs** — action form, cancel action, cancel Ticket — trap focus, close on
  Escape, and return focus to the control that opened them (RESP-04).
- The **`⋯` menu** is a button with `aria-haspopup="menu"` and
  `aria-expanded`; its items are reachable with arrow keys and Escape closes it.
- **Status, action status, priority, and follow-up** are carried by text in
  every badge and chip; Cancelled actions are struck through *and* say
  "Cancelled".
- The **conflict banner** and the gate list are announced (`role="alert"` /
  `aria-live="polite"`) when they appear, so a screen-reader user learns why
  *Apply* did not take effect.
- **History arrows** have the accessible text "to", so "In Progress → Resolved"
  reads as a sentence.

---

## 12. Responsive Rules

Lab 2 §11 applies: two breakpoints, no page-level horizontal scroll, nothing
clipped, overlapped, or hidden; controls at least 44 px tall on mobile.

| Screen / region | Desktop ≥ 992 px | Tablet 768–991 px | Mobile < 768 px |
|-----------------|------------------|-------------------|-----------------|
| Staff / Admin Dashboard | §5.3 | §5.3 | §5.3 |
| Requester Dashboard | §6.3 | §6.3 | §6.3 |
| Actions Taken list | Four-column table, details beneath each row | Same table; Performed by folds under Date / Time | One card per action: badge and date on top, description, result, follow-up, files, performer, then full-width controls |
| Action form | Dialog, max width 40 rem | Same | Full-screen sheet; *Save action* sticky at the bottom |
| Status history | One line per entry | Same | Date on its own line above the transition and actor |
| Ticket Operations gate list | Under the status select | Same | Same, full width |

---

## 13. Visual and Accessibility Checklist

Completed by hand against this document and the captured screenshots — **not from
memory** — before the release PR. This is the Part 9 evidence.

### 13.1 Per screen × per viewport

Repeat for the IT Staff dashboard, Administrator dashboard, Requester dashboard,
Staff Ticket Detail with Actions Taken (list, form, cancel confirmation, gate
list), and Requester Ticket Detail with Actions Taken, at desktop, tablet, and
mobile:

- [ ] **Design consistency** — Zen Green tokens only; no new colour; one primary button per region; existing badges and states reused
- [ ] **Horizontal overflow** — no page-level sideways scroll
- [ ] **Clipping** — no truncated label, value, badge, or button text
- [ ] **Overlap** — no badge, chip, or validation message colliding with another element
- [ ] **Editable vs read-only** — the action form uses the editable style; Requester actions, Completed and Cancelled rows, and history use the read-only style
- [ ] **Validation placement** — every action-form message sits beneath its own field
- [ ] **Keyboard focus** — every card, list row, row control, menu item, and dialog control shows a visible ring in tab order

### 13.2 Dashboards

- [ ] Every metric card shows a number, including `0`, and a *View list* cue only when it links
- [ ] Each card's number equals the total on the list it opens (spot-check two per dashboard)
- [ ] Every list shows at most five rows and its own empty sentence when empty
- [ ] The Administrator sees the Users card; IT Staff do not
- [ ] A Requester sees only their own Tickets

### 13.3 Actions Taken and workflow

- [ ] Action-status badges are square and distinguishable from the round Ticket status badges
- [ ] Follow-up is visible as text, not only colour
- [ ] Resolved is absent from the status select until the gate is met, and the reasons are listed
- [ ] The conflict banner keeps the user's typed values
- [ ] Status history reads oldest first; the Requester sees "IT Support"

### 13.4 Navigation and polish

- [ ] Each role lands on *Dashboard*, which is the active item
- [ ] The Administrator's navigation shows Dashboard, Ticket Queue, User Management
- [ ] Every §10 polish item is done
- [ ] The browser console shows no error on any screen

---

## 14. Screenshot Paths

Captured by `e2e/lab-04/responsive.spec.ts` (RESP-01…RESP-03) as Part 5, 6, 8,
and 9 evidence. `<vp>` is `desktop`, `tablet`, or `mobile`.

```
artifacts/lab-04/screenshots/
├── staff-dashboard/
│   ├── <vp>-staff-dashboard.png
│   ├── <vp>-staff-dashboard-zero.png
│   ├── <vp>-admin-dashboard.png
│   ├── desktop-staff-dashboard-loading.png
│   └── desktop-staff-dashboard-failure.png
├── requester-dashboard/
│   ├── <vp>-requester-dashboard.png
│   ├── <vp>-requester-dashboard-empty.png
│   └── desktop-requester-dashboard-failure.png
└── actions-taken/
    ├── <vp>-staff-detail-actions.png
    ├── <vp>-action-form-create.png
    ├── desktop-action-form-validation.png
    ├── desktop-action-cancel-confirm.png
    ├── desktop-gate-unmet.png
    ├── desktop-stale-conflict.png
    └── <vp>-requester-detail-actions.png
```
