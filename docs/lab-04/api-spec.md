# Lab 4 REST API Contract

**Sprint:** Lab 4 — Actions Taken, Dashboards, and Final Regression
**Contract:** [`specification.md`](./specification.md) · [`tests.md`](./tests.md) · [`ui-spec.md`](./ui-spec.md)
**Extends:** [Lab 3 api-spec](../lab-03/api-spec.md) — every route, the
authentication mechanism, the three-gate request lifecycle, the refusal
semantics, and the error shape carry over unchanged
**Status:** Approved for implementation

Every endpoint documents its success response and its behaviour for
unauthenticated access, forbidden access, invalid input, missing resources,
conflicts, and unexpected server errors (labsheet §6). Each is traceable to
numbered acceptance criteria and planned tests.

---

## 1. Conventions — what Lab 4 adds

Lab 3 §1.1–§1.6 apply as written: JSON bodies, ISO 8601 UTC timestamps, the
`toktickit_session` cookie, gates 401 → 403 `passwordChangeRequired` → 403 role /
404 ownership, and `{ "error": string, "fields"?: object }` with no stack, SQL,
ORM text, path, or password material in any error.

### 1.1 Stale-update detection

Protected writes carry the version the client last read:

```json
{ "status": "IN_PROGRESS", "expectedVersion": 4 }
```

The server applies the change with one conditional update —
`UPDATE … WHERE id = $1 AND version = $2` — and increments `version` in the same
statement. Zero rows updated means someone else wrote first:

```json
HTTP/1.1 409 Conflict
{ "error": "This ticket was changed by someone else. Reload to see the latest version.",
  "conflict": "stale",
  "current": { "version": 5, "currentStatus": "WAITING_FOR_REQUESTER",
               "owner": { "id": 4, "name": "Anong Srisai" }, "itPriority": "HIGH" } }
```

| Rule | Detail |
|------|--------|
| Versioned resources | `Ticket` (status, owner, IT Priority) and `ActionTaken` (any edit or status change) |
| Missing or non-integer `expectedVersion` | 400, `fields.expectedVersion: "Reload the ticket and try again."` |
| Not versioned | Creates and appends: Ticket, action, comment, note, attachment, resolution signal |
| `current` | The resource's current version plus the fields the client needs to redraw; never data the caller could not already read |
| Retries | A retried write that already succeeded meets a newer version and is refused, never applied twice (BR-45) |

### 1.2 The `conflict` discriminator

Every Lab 4 409 carries `conflict`, so the client can tell the cases apart without
parsing the message. Lab 3's 409 bodies are unchanged and carry no `conflict`.

| `conflict` | Meaning | Extra keys |
|------------|---------|-----------|
| `stale` | Version mismatch | `current` |
| `resolutionGate` | `→ RESOLVED` with the gate unmet | `unmet[]` |
| `transition` | Ticket or action transition not permitted from the current state | `current` |
| `ticketInactive` | Action write on a Resolved, Closed, or Cancelled Ticket | — |
| `actionFinal` | Edit or status change of a Completed or Cancelled action | — |

### 1.3 Status codes

| Status | Lab 4 uses |
|--------|-----------|
| 200 | Reads; action edit; ticket PATCHes; idempotent replay of an action create |
| 201 | Action created |
| 400 | Validation, with `fields`; missing `expectedVersion`; invalid performer |
| 401 / 403 / 404 | Lab 3 §1.3–§1.4, unchanged |
| 409 | §1.2 |
| 500 | `{ "error": "Unable to …" }`, nothing else |

### 1.4 Endpoint summary

Routes 1–28 are Lab 3's (Lab 3 §1.7). Routes marked **changed** keep their path
and method.

| # | Method | Path | Access | Lab 4 |
|---|--------|------|--------|-------|
| 8 | POST | `/api/tickets` | Requester | **changed** — appends the creation history entry |
| 9 | GET | `/api/tickets` | own | **changed** — accepts `statusGroup` |
| 10 | GET | `/api/tickets/:id` | own / staff / admin | **changed** — `version`, `resolvedAt`, `resolutionGate` |
| 20 | PATCH | `/api/tickets/:id/owner` | staff / admin | **changed** — requires `expectedVersion` |
| 21 | PATCH | `/api/tickets/:id/it-priority` | staff / admin | **changed** — requires `expectedVersion` |
| 22 | PATCH | `/api/tickets/:id/status` | staff / admin | **changed** — version, gate, history, cascade |
| 23 | GET | `/api/staff/tickets` | staff / admin | **changed** — accepts `statusGroup` |
| 29 | GET | `/api/tickets/:id/actions` | own / staff / admin | new |
| 30 | POST | `/api/tickets/:id/actions` | staff / admin | new |
| 31 | PATCH | `/api/actions/:id` | staff / admin | new |
| 32 | GET | `/api/tickets/:id/status-history` | own / staff / admin | new |
| 33 | GET | `/api/dashboard/requester` | Requester | new |
| 34 | GET | `/api/dashboard/staff` | staff / admin | new |

---

## 2. Actions Taken

### 2.1 Action Taken resource

```json
{ "id": 31,
  "ticketId": 12,
  "actionAt": "2026-10-14T02:30:00.000Z",
  "description": "Replaced the laptop battery.",
  "result": "Battery holds charge for 6 hours.",
  "status": "COMPLETED",
  "performedBy": { "id": 6, "name": "Krit Wongsa" },
  "createdBy":   { "id": 4, "name": "Anong Srisai" },
  "followUpRequired": false,
  "followUpNote": "",
  "attachmentNotes": "See photo battery-label.jpg",
  "version": 3,
  "completedAt": "2026-10-14T02:41:00.000Z",
  "createdAt":   "2026-10-14T02:20:00.000Z",
  "updatedAt":   "2026-10-14T02:41:00.000Z" }
```

**Role shaping.** For a Requester the `createdBy` key is **absent**, and no email
appears anywhere (BR-18, AC-21). `clientRequestId` is never returned to anyone.

### 2.2 `GET /api/tickets/:id/actions`

**200** — `{ "items": [ <Action Taken>, … ] }`, ordered `actionAt ASC, id ASC`
(BR-12). A Ticket with no actions returns `{ "items": [] }`.

| Case | Status | Body |
|------|--------|------|
| Requester, another Requester's Ticket | 404 | `{ "error": "Ticket not found" }` |
| Ticket absent or `:id` not an integer | 404 | **Byte-identical** |
| No session / password gate | 401 / 403 | Lab 3 §1.3 |
| Unexpected failure | 500 | `{ "error": "Unable to load actions" }` |

*Traceability:* AC-17, AC-21, AC-22 · API-01, AUTHZ-03, AUTHZ-04, UI-01, UI-10

### 2.3 `POST /api/tickets/:id/actions`

**Request**

```json
{ "clientRequestId": "6f1c2b0e-3a4d-4c1e-9b7a-2f5d8e9c1a20",
  "actionAt": "2026-10-14T02:30:00.000Z",
  "description": "Replace the laptop battery.",
  "result": "",
  "status": "PLANNED",
  "performedById": 6,
  "followUpRequired": false,
  "followUpNote": "",
  "attachmentNotes": "" }
```

| Field | Required | Rule |
|-------|----------|------|
| `clientRequestId` | no | 1–64 characters; omitted → server generates one, not idempotent (BR-44) |
| `actionAt` | yes | ISO 8601; ≥ Ticket Date; future only when `status` is `PLANNED`, otherwise ≤ now + 5 min (BR-10) |
| `description` | yes | trimmed 1–2000 (BR-06) |
| `result` | when `COMPLETED` | trimmed 0–2000; 1–2000 when `COMPLETED` (BR-07) |
| `status` | no | `PLANNED` (default), `IN_PROGRESS`, or `COMPLETED`; never `CANCELLED` (BR-13) |
| `performedById` | no | active `IT_STAFF` or `ADMINISTRATOR`; default the caller (BR-04) |
| `followUpRequired` | no | boolean, default `false` |
| `followUpNote` | when follow-up | trimmed 1–1000 when `followUpRequired`; otherwise discarded (BR-08) |
| `attachmentNotes` | no | trimmed 0–500 (BR-09) |
| `createdById`, `version`, `ticketId`, `completedAt` | — | ignored if sent (BR-03) |

**201** — the created Action Taken (§2.1). `completedAt` is set when created as
`COMPLETED`. The Ticket's `updatedAt` advances; its `version` does not (BR-42).

**200** — replay: an action with the same `clientRequestId` already exists on this
Ticket. The body is that existing action, unchanged, even if the replayed body
differs.

**Errors** (checked in this order)

| Case | Status | Body |
|------|--------|------|
| No session / password gate | 401 / 403 | Lab 3 §1.3 |
| Ticket absent, or a Requester's Ticket that is not theirs | 404 | `{ "error": "Ticket not found" }` |
| Requester, own Ticket | 403 | `{ "error": "Only IT Staff can record actions." }` |
| Ticket Resolved, Closed, or Cancelled | 409 | `conflict: "ticketInactive"`, `"Reopen the ticket before recording more work."` |
| Field rule broken | 400 | `fields` naming every failing field |
| `performedById` a Requester / deactivated / unknown | 400 | `fields.performedById`: `"Choose an active IT Staff member."` |
| Unexpected failure | 500 | `{ "error": "Unable to save the action" }` |

The Ticket row is locked (`SELECT … FOR UPDATE`) for the duration of the insert,
so the create cannot interleave with a status change's gate check (BR-27).

*Traceability:* AC-01…AC-10, AC-15, AC-18, AC-19, AC-20 · API-02…API-11, API-15,
API-16, API-17, API-19, AUTHZ-01, AUTHZ-02, UI-02, UI-03, UI-12, E2E-01

### 2.4 `PATCH /api/actions/:id`

Edits fields, changes status, or both. Absent keys are left as stored; the
resulting action must satisfy every §2.3 rule.

**Request**

```json
{ "expectedVersion": 2,
  "status": "COMPLETED",
  "result": "Battery holds charge for 6 hours." }
```

| Key | Rule |
|-----|------|
| `expectedVersion` | required integer (§1.1) |
| `status` | permitted action transition only (BR-14) |
| `actionAt`, `description`, `result`, `performedById`, `followUpRequired`, `followUpNote`, `attachmentNotes` | as §2.3 |

`performedById` naming a deactivated user is accepted **only** when it equals the
stored performer (BR-05).

**200** — the updated action with `version` incremented. `completedAt` is set on
`→ COMPLETED`.

**Errors** (checked in this order)

| Case | Status | Body |
|------|--------|------|
| No session / password gate | 401 / 403 | Lab 3 §1.3 |
| Action absent, or on a Ticket that is not the Requester's | 404 | `{ "error": "Action not found" }` |
| Requester, action on own Ticket | 403 | `{ "error": "Only IT Staff can record actions." }` |
| `expectedVersion` missing or malformed; a field fails its format rule | 400 | `fields` |
| Version mismatch | 409 | `conflict: "stale"`, `current` = the stored action |
| Ticket Resolved, Closed, or Cancelled | 409 | `conflict: "ticketInactive"` |
| Action Completed or Cancelled | 409 | `conflict: "actionFinal"`, `"Completed and cancelled actions cannot be changed. Record a new action instead."` |
| Status transition not permitted | 409 | `conflict: "transition"`, e.g. `"Cannot move a Planned action to Planned."` |
| A rule over the merged result fails (Completed without result, future date on a started action, date before Ticket Date, inactive new performer) | 400 | `fields` |
| Unexpected failure | 500 | `{ "error": "Unable to update the action" }` |

*Traceability:* AC-04, AC-11…AC-13, AC-15, AC-20, AC-38 · API-05, API-12…API-15,
API-18, WF-14, UI-04…UI-08, UI-13, E2E-01, E2E-03

---

## 3. Ticket Workflow

### 3.1 `GET /api/tickets/:id` — Lab 4 additions

Both role shapes gain:

```json
  "version": 4,
  "resolvedAt": null
```

The IT Staff and Administrator shape also gains the gate, and
`permittedTransitions` now respects it:

```json
  "resolutionGate": {
    "satisfied": false,
    "unmet": [
      { "code": "noCompletedAction", "message": "Complete at least one action." },
      { "code": "openAction", "message": "Finish or cancel 1 open action." }
    ] },
  "permittedTransitions": ["WAITING_FOR_REQUESTER", "CANCELLED"]
```

| `unmet[].code` | When (BR-25) |
|----------------|--------------|
| `noCompletedAction` | No action is `COMPLETED` |
| `openAction` | At least one action is `PLANNED` or `IN_PROGRESS`; the message states how many |
| `followUpOutstanding` | The most recent Completed action (by `actionAt`, then id) requests follow-up |

`resolutionGate` is computed for every staff read, even when `RESOLVED` is not
reachable from the current status, so the UI can explain the rule in advance. A
Requester's body has no `resolutionGate` key.

*Traceability:* AC-29 · WF-05, UI-15, UI-16

### 3.2 `PATCH /api/tickets/:id/status`

**Request** `{ "status": "RESOLVED", "expectedVersion": 4 }`

**200**

```json
{ "id": 12, "currentStatus": "RESOLVED", "version": 5,
  "resolvedAt": "2026-10-14T03:00:00.000Z",
  "permittedTransitions": ["CLOSED", "REOPENED"],
  "cancelledActions": 0 }
```

**What one successful call does, in one transaction** under a lock on the Ticket
row:

1. Compare `expectedVersion`; check the §5.3 matrix.
2. For `→ RESOLVED`, evaluate the gate over the Ticket's actions (BR-25, BR-27).
3. Write the status and `version + 1`.
4. Set `resolvedAt` on `→ RESOLVED`; clear it on `→ REOPENED` (BR-31).
5. On `→ CANCELLED`, cancel every `PLANNED` and `IN_PROGRESS` action and report
   how many in `cancelledActions` (BR-20).
6. Append one `TicketStatusChange` (BR-32).

**Errors** (checked in this order)

| Case | Status | Body |
|------|--------|------|
| No session / password gate | 401 / 403 | Lab 3 §1.3 |
| Caller is a Requester | 403 | role refusal (BR-23) |
| Ticket absent | 404 | `{ "error": "Ticket not found" }` |
| Unknown status; `expectedVersion` missing or malformed | 400 | `fields.status` / `fields.expectedVersion` |
| Version mismatch | 409 | `conflict: "stale"`, `current` |
| Ticket is Closed or Cancelled | 409 | `conflict: "transition"`, `"This ticket is closed and can no longer be updated."` |
| Transition not in the matrix | 409 | `conflict: "transition"`, `"Cannot move a Resolved ticket to In Progress."` |
| `→ RESOLVED` with the gate unmet | 409 | `conflict: "resolutionGate"`, `"This ticket cannot be resolved yet."`, `unmet[]` as §3.1 |
| Unexpected failure | 500 | `{ "error": "Unable to change the status" }` |

No refusal appends history (BR-36).

*Traceability:* AC-16, AC-25…AC-28, AC-32, AC-34, AC-37, AC-39, AC-41 · WF-01…WF-04,
WF-07, WF-08, WF-10, WF-12, WF-13, WF-15, WF-16, AUTHZ-08, UI-17, UI-18, UI-22, E2E-04…E2E-06

### 3.3 `PATCH /api/tickets/:id/owner` and `/it-priority`

Lab 3 §6.1 and §6.2 apply, plus:

- **Request** gains `expectedVersion` (required): `{ "ownerId": 4, "expectedVersion": 4 }`.
- **200** gains `"version": 5`.
- **409** `conflict: "stale"` with `current` on a version mismatch.
- **400** `fields.expectedVersion` when it is missing.

*Traceability:* AC-37, AC-39 · WF-13, WF-15

### 3.4 `POST /api/tickets` — Lab 4 addition

Unchanged request and response. The creation transaction also appends
`{ fromStatus: null, toStatus: "NEW", changedById: <requester> }` (BR-32).

*Traceability:* AC-33 · WF-09

### 3.5 `GET /api/tickets/:id/status-history`

**200 for IT Staff or an Administrator**

```json
{ "items": [
  { "id": 101, "fromStatus": null, "toStatus": "IN_PROGRESS",
    "changedAt": "2026-10-10T08:00:00.000Z", "actor": { "kind": "system" } },
  { "id": 140, "fromStatus": "IN_PROGRESS", "toStatus": "RESOLVED",
    "changedAt": "2026-10-14T03:00:00.000Z",
    "actor": { "kind": "staff", "id": 4, "name": "Anong Srisai" } }
] }
```

**200 for the owning Requester** — the same entries, with staff identity removed:

```json
    "actor": { "kind": "staff" }
```

| `actor.kind` | Source row | Staff sees | Requester sees | UI label |
|--------------|-----------|------------|----------------|----------|
| `requester` | Changed by the Ticket's Requester (creation) | `id`, `name` | `id`, `name` | the name, or "You" for the Requester |
| `staff` | Changed by IT Staff or an Administrator | `id`, `name` | nothing else | the name, or "IT Support" |
| `system` | Backfilled at migration (`changedById` null) | — | — | "Recorded at upgrade" |

Ordered `changedAt ASC, id ASC` (BR-34). There is no POST, PATCH, PUT, or DELETE
on this resource; any such request is 404 (BR-33).

| Case | Status |
|------|--------|
| Requester, another Requester's Ticket; Ticket absent | 404, byte-identical |
| No session / password gate | 401 / 403 |
| Unexpected failure | 500 `{ "error": "Unable to load the status history" }` |

*Traceability:* AC-33, AC-36 · WF-09, WF-11, AUTHZ-04, UI-19, UI-20

---

## 4. List endpoints — `statusGroup`

`GET /api/tickets` (Lab 2 contract) and `GET /api/staff/tickets` (Lab 3 §7.1)
accept one more parameter:

| Parameter | Values | Effect |
|-----------|--------|--------|
| `statusGroup` | `active` | `currentStatus IN (NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED)` (BR-46) |

An explicit `status` takes precedence and `statusGroup` is ignored. Any other
value is ignored, continuing Lab 2 BR-36's "invalid parameters fall back"
behaviour. The response echoes nothing new; pagination metadata is unchanged.

*Traceability:* AC-48 · UNIT-07, API-25, API-31

---

## 5. Requester Dashboard

### 5.1 `GET /api/dashboard/requester`

Requester only. Takes **no** query parameters; any sent are ignored, so no
parameter can widen the scope beyond the session user (BR-53).

**200**

```json
{ "generatedAt": "2026-10-14T03:05:00.000Z",
  "metrics": {
    "openTickets":     { "value": 3, "href": "/tickets?statusGroup=active" },
    "waitingForMe":    { "value": 1, "href": "/tickets?status=WAITING_FOR_REQUESTER" },
    "awaitingClosure": { "value": 1, "href": "/tickets?status=RESOLVED" }
  },
  "needsAttention": {
    "items": [ <ticket summary>, … ],
    "viewAllHref": "/tickets?status=WAITING_FOR_REQUESTER" },
  "recentlyUpdated": {
    "items": [ … ],
    "viewAllHref": "/tickets?sort=updatedAt&order=desc" },
  "recentlyResolved": { "items": [ … ] } }
```

**Ticket summary** (every list item):

```json
{ "id": 12, "ticketNumber": "TKT-2026-000012", "summary": "Laptop battery drains quickly",
  "currentStatus": "WAITING_FOR_REQUESTER", "updatedAt": "2026-10-13T09:00:00.000Z",
  "resolvedAt": null, "href": "/tickets/12" }
```

| Key | Query (`requesterId = session user`) | Order | Limit |
|-----|--------------------------------------|-------|-------|
| `openTickets` | `currentStatus` ∈ active | — | count |
| `waitingForMe` | `currentStatus = WAITING_FOR_REQUESTER` | — | count |
| `awaitingClosure` | `currentStatus = RESOLVED` | — | count |
| `needsAttention` | `currentStatus = WAITING_FOR_REQUESTER` | `updatedAt DESC, id DESC` | 5 |
| `recentlyUpdated` | `updatedAt ≥ now − 7 days` | `updatedAt DESC, id DESC` | 5 |
| `recentlyResolved` | `currentStatus ∈ {RESOLVED, CLOSED}` and `resolvedAt ≥ now − 30 days` | `resolvedAt DESC, id DESC` | 5 |

`now` is the server clock at request time; windows are rolling and inclusive at
the boundary (BR-49). Every metric is present with `value: 0` when nothing
matches, and every list is `items: []` (BR-50). No Ticket description is
returned (BR-47).

| Case | Status | Body |
|------|--------|------|
| Caller is IT Staff or an Administrator | 403 | `{ "error": "This dashboard is for requesters." }` |
| No session / password gate | 401 / 403 | Lab 3 §1.3 |
| Unexpected failure | 500 | `{ "error": "Unable to load the dashboard" }` |

*Traceability:* AC-42, AC-43, AC-45…AC-48, AC-51 · API-20…API-25, AUTHZ-05, PERF-01,
UI-29…UI-32, E2E-09

---

## 6. IT Staff and Administrator Dashboard

### 6.1 `GET /api/dashboard/staff`

IT Staff and Administrators. No query parameters.

**200**

```json
{ "generatedAt": "2026-10-14T03:05:00.000Z",
  "metrics": {
    "unassignedOpen":   { "value": 4, "href": "/staff/tickets?ownerId=unassigned&statusGroup=active" },
    "mineOpen":         { "value": 2, "href": "/staff/tickets?ownerId=me&statusGroup=active" },
    "myOpenActions":    { "value": 3, "href": null },
    "highPriorityOpen": { "value": 1, "href": "/staff/tickets?itPriority=HIGH&statusGroup=active" }
  },
  "byStatus": {
    "NEW":  { "value": 2, "href": "/staff/tickets?status=NEW" },
    "OPEN": { "value": 1, "href": "/staff/tickets?status=OPEN" },
    "…":    "one entry for each of the eight statuses"
  },
  "openByItPriority": {
    "LOW":    { "value": 2, "href": "/staff/tickets?itPriority=LOW&statusGroup=active" },
    "MEDIUM": { "value": 3, "href": "/staff/tickets?itPriority=MEDIUM&statusGroup=active" },
    "HIGH":   { "value": 1, "href": "/staff/tickets?itPriority=HIGH&statusGroup=active" }
  },
  "myActions": { "items": [ <action summary>, … ] },
  "urgent": {
    "items": [ <staff ticket summary>, … ],
    "viewAllHref": "/staff/tickets?itPriority=HIGH&statusGroup=active&sort=ticketDate&order=asc" },
  "recentlyUpdated": {
    "items": [ … ],
    "viewAllHref": "/staff/tickets?sort=updatedAt&order=desc" } }
```

**Administrator only** — one more key:

```json
  "userCounts": {
    "activeByRole": {
      "REQUESTER":     { "value": 6, "href": "/admin/users?role=REQUESTER" },
      "IT_STAFF":      { "value": 4, "href": "/admin/users?role=IT_STAFF" },
      "ADMINISTRATOR": { "value": 2, "href": "/admin/users?role=ADMINISTRATOR" } },
    "inactive": { "value": 2, "href": null } }
```

For IT Staff the `userCounts` key is **absent**, not null (AC-49).

**Staff ticket summary**

```json
{ "id": 12, "ticketNumber": "TKT-2026-000012", "summary": "Laptop battery drains quickly",
  "currentStatus": "IN_PROGRESS", "itPriority": "HIGH",
  "owner": { "id": 4, "name": "Anong Srisai" },
  "ticketDate": "2026-10-01T02:00:00.000Z", "updatedAt": "2026-10-13T09:00:00.000Z",
  "href": "/staff/tickets/12" }
```

**Action summary**

```json
{ "id": 31, "status": "PLANNED", "actionAt": "2026-10-15T02:00:00.000Z",
  "description": "Replace the laptop battery.",
  "ticket": { "id": 12, "ticketNumber": "TKT-2026-000012", "summary": "Laptop battery drains quickly" },
  "href": "/staff/tickets/12" }
```

`description` here is the action's, cut to 120 characters with "…"; the
Ticket's own description is never included (BR-47).

| Key | Query | Order | Limit |
|-----|-------|-------|-------|
| `unassignedOpen` | `ownerId IS NULL` and status ∈ active | — | count |
| `mineOpen` | `ownerId = session user` and status ∈ active | — | count |
| `myOpenActions` | actions with `performedById = session user`, `status ∈ {PLANNED, IN_PROGRESS}`, Ticket status ∈ active | — | count |
| `highPriorityOpen` | `itPriority = HIGH` and status ∈ active | — | count |
| `byStatus.<S>` | `currentStatus = S`, all Tickets | — | count × 8 |
| `openByItPriority.<P>` | `itPriority = P` and status ∈ active | — | count × 3 |
| `myActions` | as `myOpenActions` | `actionAt ASC, id ASC` | 5 |
| `urgent` | status ∈ active and `itPriority = HIGH` | `ticketDate ASC, id ASC` | 5 |
| `recentlyUpdated` | `updatedAt ≥ now − 7 days` | `updatedAt DESC, id DESC` | 5 |
| `userCounts.activeByRole.<R>` | `isActive` and `role = R` | — | count × 3 |
| `userCounts.inactive` | `NOT isActive` | — | count |

`href: null` marks a metric whose set no list screen can express; the UI renders
it as a plain value and the list beneath it carries the per-row links (BR-51).
`byStatus` uses `GROUP BY "currentStatus"` and fills missing statuses with 0;
the queries run in one read transaction so the numbers on one response are
mutually consistent.

| Case | Status | Body |
|------|--------|------|
| Caller is a Requester | 403 | `{ "error": "This dashboard is for IT Staff." }` |
| No session / password gate | 401 / 403 | Lab 3 §1.3 |
| Unexpected failure | 500 | `{ "error": "Unable to load the dashboard" }` |

*Traceability:* AC-44…AC-46, AC-48, AC-49, AC-51, AC-52 · API-26…API-32, AUTHZ-05,
PERF-02, UI-23…UI-28, E2E-08

---

## 7. Regression — unchanged endpoints

Every Lab 2 and Lab 3 route not named in §1.4 as changed keeps its exact
request, response, and error contract: health, authentication, password change,
reference data, attachments, Public Comments, the resolution signal, Internal
Notes, the assignee list, and every Administrator user route. They are re-run by
the Lab 2 and Lab 3 suites (AC-58); the only Lab 3 tests edited are those listed
in `tests.md` §2.12.
