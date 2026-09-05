# Lab 2 UI Specification — Zen Green Theme

**Sprint:** Lab 2 — Requester Ticketing MVP with UI Foundation
**Contract:** [`specification.md`](./specification.md) · [`tests.md`](./tests.md)
**Status:** Approved for implementation

This document is the visual contract. Implementation is checked **against this
file and the captured screenshots, never from memory**. Later labs reuse these
rules rather than inventing a new visual system per screen; modest aesthetic
improvement is allowed, but the interface must stay recognisably consistent with
what is written here.

---

## 1. Design Tokens

Every token is declared once as a CSS custom property on `:root` in
`client/src/theme.css`. **Components reference tokens only.** A hardcoded hex
value or a raw Bootstrap colour utility in a component is a defect (STYLE-04).

### 1.1 Colour

Values marked **fixed** are mandated by the lab sheet and must not change.

```css
:root {
  /* Brand — fixed */
  --zg-primary:          #006B3C;  /* app header, primary actions, strong emphasis */
  --zg-secondary:        #0B7A46;  /* active tabs, focus accents, links, hover */
  --zg-pale:             #EAF6EF;  /* selected rows, success surfaces, subtle emphasis */

  /* Structure — fixed intent */
  --zg-page-bg:          #F5F7F6;  /* quiet near-white page background */
  --zg-surface:          #FFFFFF;  /* cards and panels */
  --zg-text:             #1C2B24;  /* dark charcoal-green, never pure black */

  /* Fields — fixed intent */
  --zg-field-bg:         #FFFFFF;  /* editable */
  --zg-field-readonly:   #F0F3F0;  /* soft gray-green, clearly distinct, still readable */

  /* Feedback — fixed intent */
  --zg-error:            #B3261E;  /* dark red text and border */
  --zg-warning:          #B26A00;  /* amber callout or badge only */
  --zg-success:          #0B7A46;  /* green confirmation */

  /* Derived */
  --zg-primary-hover:    #005830;
  --zg-border:           #D4DDD8;  /* clear neutral field and card border */
  --zg-border-strong:    #B9C7C0;
  --zg-text-muted:       #5A6B62;
  --zg-focus-ring:       rgba(11, 122, 70, 0.35);
  --zg-error-surface:    #FDECEA;
  --zg-warning-surface:  #FFF6E5;
  --zg-disabled-bg:      #E8ECEA;
  --zg-disabled-text:    #8A9691;
  --zg-shadow:           0 1px 2px rgba(28, 43, 36, 0.06),
                         0 2px 8px rgba(28, 43, 36, 0.04);
}
```

| Token | Where it is allowed | Where it is forbidden |
|-------|--------------------|----------------------|
| `--zg-primary` | App header background, primary button, active nav indicator | Body text, field borders, decorative fills |
| `--zg-secondary` | Links, focus accents, hover states, active tab underline | Large filled areas that compete with the header |
| `--zg-pale` | Selected row, success panel, subtle section emphasis | Whole-page background |
| `--zg-warning` | Amber callouts and badges carrying an actual warning | Ordinary decoration or emphasis |
| `--zg-error` | Validation text, invalid borders, destructive button text | Any non-error emphasis |

### 1.2 Typography

```css
:root {
  --zg-font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
             "Noto Sans Thai", sans-serif;

  --zg-fs-page-title:  1.5rem;    /* 24px — screen heading */
  --zg-fs-section:     1.125rem;  /* 18px — card / section heading */
  --zg-fs-body:        1rem;      /* 16px — inputs and body copy */
  --zg-fs-label:       0.875rem;  /* 14px — field labels, table headers */
  --zg-fs-small:       0.8125rem; /* 13px — validation, helper, badge, metadata */

  --zg-fw-regular:     400;
  --zg-fw-medium:      500;       /* labels, table headers */
  --zg-fw-semibold:    600;       /* headings, primary button, badge text */

  --zg-lh-tight:       1.3;       /* headings */
  --zg-lh-body:        1.55;      /* body and description text */
}
```

Rules: one label weight (`--zg-fw-medium`) across every screen. Field labels never
drop below `--zg-fs-label`. Body text never falls below `--zg-fs-body` at any
viewport — mobile reduces layout width, never legibility.

### 1.3 Spacing

A 4 px scale. Ad-hoc pixel values are not permitted.

```css
:root {
  --zg-space-1: 0.25rem;  /*  4px — label to control */
  --zg-space-2: 0.5rem;   /*  8px — control to validation message */
  --zg-space-3: 0.75rem;  /* 12px — inside compact controls */
  --zg-space-4: 1rem;     /* 16px — between fields */
  --zg-space-5: 1.5rem;   /* 24px — between field groups */
  --zg-space-6: 2rem;     /* 32px — between cards / sections */
  --zg-space-7: 3rem;     /* 48px — page top and bottom padding */
}
```

### 1.4 Shape and elevation

```css
:root {
  --zg-radius-sm:   4px;   /* badges, small chips */
  --zg-radius-md:   6px;   /* inputs, buttons */
  --zg-radius-lg:   10px;  /* cards and panels */
  --zg-control-h:   2.5rem;/* 40px — one shared control height */
  --zg-border-w:    1px;
  --zg-page-max-w:  1120px;
}
```

Cards use `--zg-surface`, a `--zg-border` hairline, `--zg-radius-lg`, and
`--zg-shadow` — restrained, never a heavy drop shadow.

### 1.5 Breakpoints

```css
/* mobile-first; these are the only breakpoints */
--zg-bp-tablet:  768px;   /* tablet and up */
--zg-bp-desktop: 992px;   /* desktop and up */
```

---

## 2. Control States

Every input, select, and textarea implements all five states. Class names are
normative.

| State | Class | Appearance |
|-------|-------|-----------|
| **Editable** | `.zg-field` | `--zg-field-bg` background, `--zg-border` 1 px border, `--zg-radius-md`, height `--zg-control-h` |
| **Read-only** | `.zg-field--readonly` | `--zg-field-readonly` background, same border, no caret, not focusable for editing but still selectable text |
| **Invalid** | `.zg-field--invalid` | `--zg-error` 1 px border; message rendered below (§3.3). Text colour stays `--zg-text` — the message carries the meaning, not red input text |
| **Disabled** | `[disabled]` | `--zg-disabled-bg` background, `--zg-disabled-text` text, `cursor: not-allowed`, cannot receive focus or be activated |
| **Focused** | `:focus-visible` | 2 px `--zg-focus-ring` outline with 2 px offset, plus a `--zg-secondary` border. **Never `outline: none`.** |

Read-only and editable fields must be distinguishable at a glance — this is
checked by hand in §11 and asserted by STYLE-04.

Multiline `Description` uses `.zg-field .zg-field--multiline`: minimum 6 rows,
`resize: vertical` only, and a `max-height` that keeps the page from breaking.

---

## 3. Form Conventions

### 3.1 Field anatomy

```
┌───────────────────────────────────────┐
│ Label *                    ← --zg-fs-label, --zg-fw-medium
│ ┌───────────────────────────────────┐ │  gap: --zg-space-1
│ │ control                           │ │  height: --zg-control-h
│ └───────────────────────────────────┘ │
│ Helper or validation message          │  gap: --zg-space-2, --zg-fs-small
└───────────────────────────────────────┘
```

Labels sit **above** controls on every screen and at every viewport. Floating and
inline labels are not used.

### 3.2 Required-field marker

Required fields render `<span class="zg-required" aria-hidden="true">*</span>`
in `--zg-error` immediately after the label text. The control also carries
`aria-required="true"`.

**The asterisk never replaces the validation message.** A failed required field
shows both (AC-37 / STYLE-01).

### 3.3 Validation message placement

Messages render in `.zg-field-message` directly beneath the field they concern,
in `--zg-error` at `--zg-fs-small`, wired with `aria-describedby` and
`aria-invalid="true"`.

- One message per field, naming the actual rule
  ("Summary must be 5–150 characters"), never "Invalid input".
- A single unexplained banner at the top of the form is **not acceptable**
  (BR-44). A summary banner may accompany field messages but never replace them.
- Message space is reserved so appearing text does not shift the layout.
- On submit failure, focus moves to the first invalid control.

### 3.4 Entered values survive failure

Validation failure and API failure both preserve every entered value
(BR-45, BR-46). Forms are never cleared on error.

---

## 4. Button Hierarchy

| Level | Class | Appearance | Use |
|-------|-------|-----------|-----|
| **Primary** | `.zg-btn--primary` | `--zg-primary` fill, white text, `--zg-fw-semibold` | The single main action per screen: Continue, Submit Ticket |
| **Secondary** | `.zg-btn--secondary` | `--zg-surface` fill, `--zg-border-strong` border, `--zg-text` | Cancel, Clear filters, Back |
| **Tertiary** | `.zg-btn--tertiary` | No fill or border, `--zg-secondary` text | Low-weight inline actions: Change Requester, Download |
| **Destructive** | `.zg-btn--destructive` | `--zg-surface` fill, `--zg-error` border and text | Remove attachment |
| **Disabled** | `[disabled]` on any level | `--zg-disabled-bg` / `--zg-disabled-text` | Unavailable actions |
| **Busy** | `.zg-btn--busy` | Disabled appearance plus a spinner and changed label | In-flight requests |

Rules:

- **Every button carries visible text.** Icons support text; they never replace
  it. Icon-only controls are permitted only for compact row actions and always
  carry `aria-label` plus a tooltip (§10).
- Exactly one primary button per screen.
- Destructive actions never use a filled red background — the outline plus the
  confirmation step carries the weight.
- Busy state sets `disabled` **and** `aria-busy="true"`, changes the label
  ("Submitting…"), and is asserted by STYLE-05.

---

## 5. Badges

One shared `.zg-badge` component. **Meaning is always carried by text**; colour
only reinforces it (AC-39 / STYLE-03).

### 5.1 Requested Priority

| Value | Class | Text | Surface |
|-------|-------|------|---------|
| `LOW` | `.zg-badge--priority-low` | "Low" | `--zg-disabled-bg` / `--zg-text-muted` |
| `MEDIUM` | `.zg-badge--priority-medium` | "Medium" | `--zg-warning-surface` / `--zg-warning` |
| `HIGH` | `.zg-badge--priority-high` | "High" | `--zg-error-surface` / `--zg-error` |

### 5.2 Current Status

| Value | Class | Text | Surface |
|-------|-------|------|---------|
| `NEW` | `.zg-badge--status-new` | "New" | `--zg-pale` / `--zg-primary` |

Lab 2 has one status (BR-02). The component is built to take more so Lab 3 adds
values without redesign.

### 5.3 Attachment state

| State | Class | Text |
|-------|-------|------|
| Active | *(no badge)* | — |
| Removed | `.zg-badge--removed` | "Removed" |

Badges use `--zg-radius-sm`, `--zg-fs-small`, `--zg-fw-semibold`, and padding
`--zg-space-1` / `--zg-space-3`.

---

## 6. Screen States

Every screen that fetches or submits data implements **all** applicable states.
A screen missing its empty state is not done.

| State | Presentation |
|-------|-------------|
| **Initial** | The form or list at rest, no messages shown |
| **Loading** | Skeleton rows for lists, spinner plus "Loading…" for forms. Never a blank screen. Container keeps its height so the layout does not jump |
| **Validation failure** | Per-field messages (§3.3); focus on the first invalid control; entered values preserved |
| **Submitting** | Primary button busy and disabled; the rest of the form stays readable and is not blanked |
| **Success** | `--zg-pale` panel with a `--zg-success` heading, the generated Ticket Number in `--zg-fw-semibold`, and the next action |
| **API failure** | `--zg-error-surface` callout with `--zg-error` text, a plain-language message, and a Retry action. Never a raw status code or stack trace |
| **Empty** | Illustration-free centred panel: heading, one explanatory line, and the primary action |
| **No results** | Distinct wording from Empty, plus a **Clear filters** action (BR-57, BR-58) |

---

## 7. Application Shell

```
┌────────────────────────────────────────────────────────────────┐
│  TokTickIT      My Tickets   Create Ticket    Somchai P.  ▾    │  --zg-primary
└────────────────────────────────────────────────────────────────┘
                  ▔▔▔▔▔▔▔▔▔▔  ← active indicator
```

Required elements (lab sheet §8):

- **TokTickIT identity** on the left, `--zg-fs-section`, `--zg-fw-semibold`, white.
- **My Tickets** and **Create Ticket** navigation.
- **Development Requester identity** on the right, showing the selected name.
- **Clear active-page indication** — a 3 px `--zg-pale` underline plus
  `aria-current="page"`. Colour alone never marks the active page.
- **Change Requester** action in the identity menu (`.zg-btn--tertiary`).
- **Responsive mobile navigation** — below 768 px the links collapse into a
  disclosure toggle with `aria-expanded`; the Requester name stays visible.

Header height is `3.5rem`; content is constrained to `--zg-page-max-w` and
centred.

---

## 8. Screens

### 8.1 Development Requester Selection

A centred card, maximum width `28rem`, on `--zg-page-bg`.

```
┌──────────────────────────────────────┐
│              TokTickIT               │  --zg-fs-page-title
│                                      │
│  Select a Development Requester to   │  --zg-text-muted, --zg-fs-small
│  test requester-specific ticket      │
│  behavior. This is not a login       │
│  screen. Authentication and          │
│  role-based access will be           │
│  introduced in Lab 3.                │
│                                      │
│  Development Requester *             │
│  ┌────────────────────────────────┐  │
│  │ Choose a requester…          ▾ │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │           Continue             │  │  --zg-btn--primary, full width
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

Required elements and behaviour:

- TokTickIT title.
- The "this is not a login screen" explanation, always visible — not hidden
  behind a tooltip or disclosure (BR-61).
- Dropdown populated with **active Requesters only**, loaded from PostgreSQL
  (BR-20, BR-13). Each option shows name and email.
- Continue is disabled until a Requester is chosen.
- **Loading:** dropdown replaced by a skeleton; Continue disabled.
- **Empty** (no active Requesters): explanatory panel replaces the dropdown; the
  form cannot be submitted (BR-24).
- **API failure:** error callout plus Retry; the application cannot be entered
  (BR-23).
- Keyboard-accessible: the select is reachable by Tab, Enter activates Continue.

After selection: the shell shows the Requester name, a Change Requester action
becomes available, and all Requester-scoped data reloads on any change (BR-22).

### 8.2 Create Ticket

System-generated values first, classification grouped, then the long text, then
attachments, then actions. Two columns at desktop; single column below 768 px.

```
Create Ticket                                            --zg-fs-page-title

┌─ Ticket Information ────────────────────────────────────────────┐
│  Ticket Number              Ticket Date                          │
│  ┌────────────────────┐     ┌────────────────────┐               │
│  │ Generated on save  │ RO  │ Set on save        │ RO            │
│  └────────────────────┘     └────────────────────┘               │
│  Requester                                                       │
│  ┌────────────────────┐                                          │
│  │ Somchai P.         │ RO                                       │
│  └────────────────────┘                                          │
├─ Classification ────────────────────────────────────────────────┤
│  Category *                 Related System *                     │
│  ┌────────────────────┐     ┌────────────────────┐               │
│  │                  ▾ │     │                  ▾ │               │
│  └────────────────────┘     └────────────────────┘               │
│  Requested Priority *                                            │
│  ( ) Low   (•) Medium   ( ) High                                 │
├─ Problem ───────────────────────────────────────────────────────┤
│  Ticket Summary *                                    0 / 150     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  └────────────────────────────────────────────────────────────┘ │
│  Description *                                      0 / 5000     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │                                            (6 rows min)    │ │
│  └────────────────────────────────────────────────────────────┘ │
├─ Attachments ───────────────────────────────────────────────────┤
│  JPG, PNG, WEBP, or PDF · up to 5 MB each · maximum 5 files      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  + Choose files                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│  (selected file rows appear here — §9)                          │
└─────────────────────────────────────────────────────────────────┘

                                    [ Cancel ]  [ Submit Ticket ]
```

Rules:

- `RO` marks read-only fields using `.zg-field--readonly` — visually distinct
  from editable fields (BR-16). Ticket Number and Ticket Date show placeholder
  text explaining they are generated on save; they are never editable.
- Requester is read-only and populated from the selected Development Requester
  (BR-18).
- Summary and Description span the full content width — they are never squeezed
  into a half column.
- Live character counters sit right-aligned above each of Summary and
  Description, turning `--zg-error` past the limit.
- Requested Priority uses a radio group, not a select — three options are faster
  to scan than a dropdown, and the group is keyboard-navigable by arrow keys.
- Attachment constraints are stated **before** the user picks a file, not only
  in the error afterwards.
- **The Attachments section is delivered in Issue #17** (`specification.md` D-12):
  Create Ticket saves the Ticket, and its success panel routes to Ticket Detail,
  where files are attached. The upload lifecycle is built once, on that screen.
- Actions bottom-right at desktop; full-width stacked with the primary on top
  below 768 px.
- **Success state** replaces the form with the confirmation panel:

```
┌────────────────────────────────────────────────────────────┐
│  ✓  Ticket created                            --zg-success  │
│                                                             │
│  Your ticket number is  TKT-2026-000001       --zg-fw-semibold │
│                                                             │
│  [ View ticket ]   [ Create another ]                       │
└────────────────────────────────────────────────────────────┘
```

### 8.3 My Tickets

```
My Tickets                                        [ + Create Ticket ]

┌─────────────────────────────────────────────────────────────────┐
│ ┌───────────────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│ │ 🔍 Search number or…  │ │Category ▾│ │ System ▾ │ │Priority▾│ │
│ └───────────────────────┘ └──────────┘ └──────────┘ └─────────┘ │
│ Sort: [ Ticket Date ▾ ] [ ↓ ]                  [ Clear filters ] │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────┬───────────┬──────────┬──────────┬────────────┐
│ Ticket No.   │ Summary              │ Category  │ Priority │ Status   │ Last Updated│
├──────────────┼──────────────────────┼───────────┼──────────┼──────────┼────────────┤
│TKT-2026-0001 │ Laptop battery dra…  │ Hardware  │ [Medium] │ [New]    │ 26 Aug 2026│
└──────────────┴──────────────────────┴───────────┴──────────┴──────────┴────────────┘

                        Showing 1–10 of 23    [ ‹ ] 1 2 3 [ › ]   Rows: [10 ▾]
```

**Columns and why.** Ticket Number identifies the ticket when quoting it to IT;
Summary is what the Requester actually recognises; Category and Priority are the
two facets they filter by, so showing them makes the filter result legible;
Status is required to understand where the ticket stands; Last Updated is the
default sort key, so it must be visible to make the ordering explicable.
Description and Related System are omitted — Description is far too long for a
row, and Related System is available on the Detail screen.

- Summary truncates with an ellipsis at one line and carries the full text as a
  tooltip; the 150-character limit (D-04) keeps truncation rare at desktop width.
- The whole row is a link to Ticket Detail, reachable by keyboard.
- Table header uses `--zg-fs-label`, `--zg-fw-medium`, `--zg-pale` background.
- Rows alternate `--zg-surface` and `#FBFCFB`; hover uses `--zg-pale`.

**Controls.**

| Control | Behaviour |
|---------|-----------|
| Search | Debounced 300 ms; searches Ticket Number and Summary (BR-31); clearing restores the unfiltered list |
| Filters | Category, Related System, Priority, Status — each a select defaulting to "All" |
| Sort | Field select (Ticket Date, Ticket Number, Last Updated) plus a direction toggle with an accessible label |
| Clear filters | `.zg-btn--secondary`; visible whenever any filter or search is active, and always in the no-results state |
| Pagination | Previous / numbered pages / Next, plus a rows-per-page select offering 10, 20, 50 (BR-35). Current page has `aria-current="page"` |
| Result count | "Showing 1–10 of 23", derived from the response metadata (BR-37) |

**Empty vs no-results — distinct by contract (BR-57):**

| | Empty | No results |
|-|-------|-----------|
| When | The Requester owns no tickets at all | Filters or search matched nothing |
| Heading | "No tickets yet" | "No tickets match your filters" |
| Body | "When you raise an IT request it will appear here." | "Try a different search term, or clear the filters to see all your tickets." |
| Action | `[ + Create Ticket ]` primary | `[ Clear filters ]` secondary |

**Mobile representation (< 768 px)** — the table becomes cards, not a
horizontally scrolling table:

```
┌───────────────────────────────────┐
│ TKT-2026-000001        [New]      │
│ Laptop battery drains quickly     │
│ Hardware · [Medium]               │
│ Updated 26 Aug 2026            ›  │
└───────────────────────────────────┘
```

Each card is a single tap target of at least 44 px. Filters collapse behind a
"Filters" disclosure showing an active-filter count.

### 8.4 Requester Ticket Detail (View Mode)

Read-only throughout (BR-59). Ticket information is visually separated from the
attachment area and its actions.

```
‹ Back to My Tickets

TKT-2026-000001                                  [New]  [Medium]

┌─ Ticket Information ────────────────────────────────────────────┐
│  Ticket Date        26 Aug 2026 16:14                            │
│  Requester          Somchai P. (somchai@kmutt.ac.th)             │
│  Category           Hardware                                     │
│  Related System     Corporate Laptop                             │
│  Requested Priority [Medium]                                     │
│  Current Status     [New]                                        │
│                                                                  │
│  Summary                                                         │
│  Laptop battery drains quickly                                   │
│                                                                  │
│  Description                                                     │
│  The battery drops from 100% to 20% in about an hour …            │
└──────────────────────────────────────────────────────────────────┘

┌─ Attachments (2 of 5) ──────────────────────────────────────────┐
│  (attachment rows — §9)                     [ + Add attachment ] │
└──────────────────────────────────────────────────────────────────┘
```

- Ticket information renders as label/value pairs, **not disabled inputs** — a
  greyed-out form field implies "you could edit this elsewhere", which is false.
  Two columns at desktop, one below 768 px.
- Summary and Description are full width, `--zg-lh-body`, preserving line breaks.
- The Ticket Number is the page heading, with Status and Priority badges beside it.
- The attachment card is visually separate — its own card with its own heading
  and the only actions on the screen.
- No Public Comments, Internal Notes, Actions Taken, or status controls appear
  anywhere. They are out of scope.

---

## 9. Attachments

### 9.1 Selection

The control states the rules before a file is chosen:

> JPG, PNG, WEBP, or PDF · up to 5 MB each · maximum 5 files

`<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf">`
is wrapped by a `.zg-btn--secondary` styled label. The `accept` attribute is a
convenience only — validation is enforced client-side and again by the server
(BR-42, BR-51).

The Add attachment control is disabled once five active attachments exist, with
helper text "Maximum of 5 attachments reached" (BR-06).

### 9.2 Attachment row states

Each attachment renders as a `.zg-attachment` row: icon, original filename,
size, upload date, and a state-dependent action.

| State | Class | Appearance | Action |
|-------|-------|-----------|--------|
| **Active** | `.zg-attachment--active` | `--zg-surface`, `--zg-border` | `[ Download ]` tertiary, `[ Remove ]` destructive |
| **Uploading** | `.zg-attachment--uploading` | Determinate progress bar in `--zg-secondary`, filename muted | None; row is `aria-busy="true"` |
| **Invalid** | `.zg-attachment--invalid` | `--zg-error-surface`, `--zg-error` border, specific reason beneath the filename | `[ Remove from list ]` |
| **Removed** | `.zg-attachment--removed` | Muted text, `Removed` badge, removal reason and date shown | **No download control at all** |
| **Unavailable** | `.zg-attachment--unavailable` | Muted, warning icon, "File unavailable" | `[ Retry ]` |

Rules:

- **Removed attachments stay listed** with their metadata and reason (BR-08,
  BR-55). The download control is *absent from the DOM*, not merely disabled —
  a disabled control invites a workaround (UI-18).
- Filenames wrap or middle-truncate; they are never clipped unreadably at any
  viewport.
- Invalid files name the actual reason — "Unsupported file type", "File exceeds
  5 MB", or "Maximum of 5 attachments reached" — never a generic "Upload failed"
  (BR-52, UI-20).
- Removed attachments do not count toward the five shown in the card heading
  (BR-56).

### 9.3 Removal confirmation

Removal always requires confirmation **and** a reason (BR-53).

```
┌─ Remove attachment ─────────────────────────────┐
│  Remove “battery-log.pdf” from this ticket?      │
│  The file stays on record but can no longer be   │
│  downloaded.                                     │
│                                                  │
│  Reason for removal *                            │
│  ┌────────────────────────────────────────────┐ │
│  └────────────────────────────────────────────┘ │
│  3–200 characters                                │
│                                                  │
│              [ Cancel ]   [ Remove ]             │
└──────────────────────────────────────────────────┘
```

The Remove button stays disabled until the reason meets the length rule (UI-19).
The dialog traps focus, closes on Escape, and returns focus to the row that
opened it.

---

## 10. Accessibility

- **Keyboard.** Every interactive control is reachable and operable by keyboard.
  Tab order follows visual order. Dialogs trap focus and restore it on close.
  `outline: none` without a replacement indicator is forbidden (AC-38).
- **Focus visibility.** `:focus-visible` renders the 2 px `--zg-focus-ring`
  outline on every control, including table rows acting as links.
- **Labelling.** Every control has a programmatic label. Icon-only controls carry
  `aria-label` **and** a tooltip (STYLE-02).
- **Never colour alone.** Badges, the active-nav indicator, validation, and
  attachment states all carry text or an icon in addition to colour (AC-39).
- **Announcements.** Loading regions use `aria-busy`; validation summaries and
  API failures use `role="alert"`; the success panel uses `role="status"`.
- **Contrast.** Text on any surface meets WCAG AA (4.5:1 for body, 3:1 for large
  text). `--zg-text` on `--zg-surface`, and white on `--zg-primary`, both pass.
- **Touch targets** are at least 44 × 44 px below 768 px.
- **Language.** `<html lang="en">`; the Thai-capable font stack is declared in
  §1.2 for names and content.

---

## 11. Responsive Rules

| Viewport | Required behaviour |
|----------|-------------------|
| **Desktop ≥ 992 px** | Multi-column layout as specified; content centred at `--zg-page-max-w`; My Tickets renders as a table |
| **Tablet 768–991 px** | Two columns where practical; Summary and Description keep full content width; table keeps Ticket No., Summary, Status, and Last Updated, dropping Category and Priority into the Summary cell |
| **Mobile < 768 px** | Fields stack one per row; buttons full width and touch-friendly; My Tickets becomes cards; navigation collapses; **no horizontal page scrolling** |
| **All sizes** | No clipped labels, no overlapping messages, no hidden buttons, no unreadable attachment names |

Implementation notes:

- Mobile-first CSS: base styles target mobile; `min-width` media queries add
  tablet and desktop.
- Only the two breakpoints in §1.5 are used. Ad-hoc breakpoints are not permitted.
- Any element that genuinely must scroll horizontally — none are expected — must
  scroll inside its own container. **The page body never scrolls sideways.**
- Verified by RESP-01 … RESP-04, which assert
  `document.documentElement.scrollWidth <= clientWidth` at each viewport.

---

## 12. Visual Inspection Checklist

Completed by hand against this document and the captured screenshots — **not
from memory** — before the release PR. Automated tests cannot see clipping or
overlap.

### Per screen × per viewport

Repeat for Create Ticket, My Tickets, and Ticket Detail at desktop, tablet, and
mobile:

- [ ] No horizontal page scrolling
- [ ] No clipped or truncated labels
- [ ] No overlapping validation messages
- [ ] No hidden or unreachable buttons
- [ ] Attachment filenames readable
- [ ] Filters, pagination, and attachment controls usable
- [ ] Editable and read-only fields visually distinct
- [ ] Validation messages beneath their own field
- [ ] Consistent field heights and label weights
- [ ] Button hierarchy correct; exactly one primary action
- [ ] Zen Green tokens applied; no stray palette, no raw Bootstrap colours

### Cross-cutting

- [ ] Header, active-page indicator, and Requester identity present on every screen
- [ ] Priority and Status badges consistent everywhere they appear
- [ ] Empty and no-results states are visibly different from each other
- [ ] Every screen state from §6 has been seen at least once
- [ ] Removed attachments show metadata and reason, and expose no download control
- [ ] Focus is visible on every control when tabbing through
- [ ] Required fields show the asterisk and still produce a message on failure

---

## 13. Screenshot Paths

Captured by `e2e/lab-02/responsive.spec.ts` and used as the Part 9 evidence.

```
artifacts/lab-02/screenshots/
├── create-ticket/
│   ├── desktop-initial.png
│   ├── desktop-validation-failure.png
│   ├── desktop-submitting.png
│   ├── desktop-success.png
│   ├── desktop-api-failure.png
│   ├── desktop-invalid-attachment.png
│   ├── tablet-initial.png
│   └── mobile-initial.png
├── my-tickets/
│   ├── desktop-list.png
│   ├── desktop-filtered.png
│   ├── desktop-empty.png
│   ├── desktop-no-results.png
│   ├── tablet-list.png
│   └── mobile-cards.png
├── ticket-detail/
│   ├── desktop-detail.png
│   ├── desktop-attachment-removed.png
│   ├── desktop-remove-dialog.png
│   ├── tablet-detail.png
│   └── mobile-detail.png
└── requester-selection/
    ├── desktop-initial.png
    ├── desktop-loading.png
    ├── desktop-empty.png
    ├── desktop-failure.png
    └── mobile-initial.png
```
