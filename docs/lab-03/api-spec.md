# Lab 3 REST API Contract

**Sprint:** Lab 3 — Users, Roles, IT Staff Ticketing, and Admin Screens
**Contract:** [`specification.md`](./specification.md) · [`tests.md`](./tests.md) · [`ui-spec.md`](./ui-spec.md)
**Supersedes:** [Lab 2 api-spec](../lab-02/api-spec.md) — its routes survive, its
authentication mechanism does not
**Status:** Approved for implementation

Every endpoint documents its success response and its behaviour for
unauthenticated access, forbidden access, invalid input, missing resources,
conflicts, and unexpected server errors, as §6.2 of the handout requires. Each is
traceable to numbered acceptance criteria and planned tests.

---

## 1. Conventions

### 1.1 Base

| Item | Value |
|------|-------|
| Base URL (dev) | `http://localhost:3000` |
| Frontend origin | `http://localhost:5173` |
| CORS | Explicit origin allowlist with `credentials: true`. **No wildcard** — a wildcard is incompatible with credentialed requests and would defeat D-05 |
| Request content type | `application/json`, except attachment upload (`multipart/form-data`) |
| Response content type | `application/json`, except attachment download |
| Timestamps | ISO 8601 UTC |

### 1.2 Authentication mechanism

| Decision | Value |
|----------|-------|
| Password hashing | bcrypt via `bcryptjs`, work factor 10, read from `BCRYPT_COST` |
| Session credential | 32 bytes from `crypto.randomBytes`, base64url-encoded |
| At rest | `SHA-256(token)` in `Session.tokenHash`; the raw token is never stored or logged |
| Cookie name | `toktickit_session` |
| Cookie flags | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`, `Secure` when `NODE_ENV=production` |
| Lifetime | 8 hours absolute; no sliding renewal (D-06) |
| Logout | Deletes the session row, so the cookie is inert even if replayed |

Every client request carries `credentials: "include"` so the cookie travels
cross-origin in development.

> **The `X-Requester-Id` header of Lab 2 is gone.** Any request still sending it
> is served exactly as if it had not: the acting user comes from the session
> alone (BR-03). AUTHZ-02 asserts this rather than trusting it.

### 1.3 Request lifecycle

Every protected route runs the same three gates, in this order:

1. **Authenticate.** Read the cookie, hash it, look up a session whose
   `expiresAt` is in the future, load the user, and confirm the user is still
   active. Any failure → **401**, before any resource is read (BR-13).
2. **Password gate.** If `user.mustChangePassword` is true, every route except
   `GET /api/auth/me`, `POST /api/auth/password`, and `POST /api/auth/logout`
   returns **403** with `passwordChangeRequired: true` (BR-02).
3. **Authorize.** Apply the §6.1 matrix. A role refusal → **403**. An ownership
   refusal → **404**, identical to a resource that does not exist.

An account deactivated *during* a live session fails gate 1 on its next request,
so deactivation takes effect immediately rather than at expiry.

### 1.4 Refusal semantics

This is the distinction the sprint turns on.

| Refusal | Status | What the caller learns |
|---------|--------|------------------------|
| Not signed in | 401 | Nothing |
| Password change outstanding | 403 + `passwordChangeRequired` | Only that they must change it |
| Role not permitted | 403 | That the route exists — which their own role list already told them |
| Resource not owned | 404 | Nothing; identical to a resource that never existed |
| Resource absent | 404 | Nothing |

Using 403 for an ownership refusal would confirm that another user's Ticket
exists. Using 404 for a role refusal would be a lie that makes a permission bug
indistinguishable from a routing bug. Both directions matter, and both are
tested (AUTHZ-03, AUTHZ-06).

### 1.5 Error shape

Unchanged from Lab 2:

```json
{ "error": "Human-readable summary",
  "fields": { "password": "Password must be 12–128 characters." } }
```

`fields` appears only on 400. `passwordChangeRequired: true` appears only on the
gate-2 refusal. **No error body ever contains a stack trace, SQL, ORM text, a
filesystem path, a password, or a password hash** (BR-04).

### 1.6 Status codes

| Status | Meaning in this API |
|--------|--------------------|
| 200 | Retrieval, update, logout, download |
| 201 | Ticket, comment, note, attachment, or user created |
| 400 | Validation failure; unknown reference id; malformed body |
| 401 | No session, expired, invalidated, failed login, or user deactivated |
| 403 | Role not permitted, or password change outstanding |
| 404 | Resource absent, or present but not owned |
| 409 | Duplicate email; invalid status transition; last-Administrator guard; self-deactivation; attachment limit |
| 413 / 415 | Attachment too large / unsupported type (Lab 2, unchanged) |
| 500 | Unexpected failure, reported safely |

### 1.7 Endpoint summary

`own` = the caller's own Ticket only. `any` = any Ticket.

| # | Method | Path | Access |
|---|--------|------|--------|
| 1 | GET | `/api/health` | public |
| 2 | POST | `/api/auth/login` | public |
| 3 | POST | `/api/auth/logout` | authenticated |
| 4 | GET | `/api/auth/me` | authenticated |
| 5 | POST | `/api/auth/password` | authenticated |
| 6 | GET | `/api/categories` | authenticated |
| 7 | GET | `/api/related-systems` | authenticated |
| 8 | POST | `/api/tickets` | Requester |
| 9 | GET | `/api/tickets` | authenticated (own) |
| 10 | GET | `/api/tickets/:id` | own / staff / admin |
| 11 | POST | `/api/tickets/:id/attachments` | own / staff / admin |
| 12 | GET | `/api/tickets/:id/attachments` | own / staff / admin |
| 13 | GET | `/api/attachments/:id/download` | own / staff / admin |
| 14 | DELETE | `/api/attachments/:id` | own / staff / admin |
| 15 | GET | `/api/tickets/:id/comments` | own / staff / admin |
| 16 | POST | `/api/tickets/:id/comments` | own / staff / admin |
| 17 | POST | `/api/tickets/:id/resolution-signal` | Requester (own) |
| 18 | GET | `/api/tickets/:id/notes` | staff / admin |
| 19 | POST | `/api/tickets/:id/notes` | staff / admin |
| 20 | PATCH | `/api/tickets/:id/owner` | staff / admin |
| 21 | PATCH | `/api/tickets/:id/it-priority` | staff / admin |
| 22 | PATCH | `/api/tickets/:id/status` | staff / admin |
| 23 | GET | `/api/staff/tickets` | staff / admin |
| 24 | GET | `/api/staff/assignees` | staff / admin |
| 25 | GET | `/api/admin/users` | admin |
| 26 | POST | `/api/admin/users` | admin |
| 27 | PATCH | `/api/admin/users/:id` | admin |
| 28 | POST | `/api/admin/users/:id/initial-password` | admin |

---

## 2. Authentication

### 2.1 `POST /api/auth/login` — public

**Request**

```json
{ "email": "somchai@kmutt.ac.th", "password": "TokTickIT!dev2026" }
```

Email is trimmed and lower-cased before lookup (BR-12).

**200** — sets `Set-Cookie: toktickit_session=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`

```json
{ "id": 1,
  "name": "Somchai Prasert",
  "email": "somchai@kmutt.ac.th",
  "role": "REQUESTER",
  "mustChangePassword": false }
```

The body carries no password field of any kind (API-01).

**Errors**

| Case | Status | Body |
|------|--------|------|
| Unknown email | 401 | `{ "error": "Email or password is incorrect." }` |
| Wrong password | 401 | **Byte-identical to the previous row** |
| Deactivated account, wrong password | 401 | **Byte-identical**; deactivation is not revealed |
| Deactivated account, correct password | 401 | `{ "error": "This account is deactivated. Contact an administrator." }` |
| Missing email or password | 400 | `fields` naming the missing input |
| Unexpected failure | 500 | `{ "error": "Unable to sign in" }` |

The password is verified **before** the activation check, so the deactivation
message reaches only someone who already holds the credential (BR-06, D-07). A
failed login runs a bcrypt comparison against a dummy hash when the email is
unknown, so the two paths take comparable time and the response cannot be timed
apart.

No lockout is applied (BR-07, D-08).

*Traceability:* AC-01, AC-03…AC-06, AC-11 · API-01, API-03…API-06, API-10, UI-01, UI-04, UI-05, E2E-01

---

### 2.2 `POST /api/auth/logout` — authenticated

No request body. Deletes the session row and clears the cookie.

**200** `{ "ok": true }`

Calling it without a session returns 401. Calling it twice returns 401 the second
time, because the row is already gone — which is the observable proof that
invalidation is real rather than cosmetic (API-07).

*Traceability:* AC-07 · API-07, UI-13, E2E-01

---

### 2.3 `GET /api/auth/me` — authenticated

Exempt from the password gate, so the client can discover it must route to the
change screen.

**200**

```json
{ "id": 4, "name": "Anong Srisai", "email": "anong@kmutt.ac.th",
  "role": "IT_STAFF", "mustChangePassword": false }
```

| Case | Status |
|------|--------|
| No or expired session | 401 |
| Unexpected failure | 500 |

*Traceability:* AC-01, AC-53 · API-01, UI-10…UI-13

---

### 2.4 `POST /api/auth/password` — authenticated

Serves both the mandatory first-login change and a voluntary change. Exempt from
the password gate.

**Request**

```json
{ "currentPassword": "TokTickIT!dev2026", "newPassword": "correct horse battery" }
```

| Field | Rule | BR |
|-------|------|-----|
| `currentPassword` | Must match the stored hash | BR-01 |
| `newPassword` | 12–128 characters, differs from the current password, not in the blocklist | BR-10 |

**200** `{ "ok": true, "mustChangePassword": false }`

On success the user's `mustChangePassword` is cleared and **every other session
belonging to that user is deleted**; the calling session survives so the user is
not thrown out of the screen they just used (BR-11).

**Errors**

| Case | Status | Body |
|------|--------|------|
| `currentPassword` wrong | 400 | `fields.currentPassword` — a generic "incorrect" without confirming anything about the account |
| `newPassword` shorter than 12 or longer than 128 | 400 | `fields.newPassword: "Password must be 12–128 characters."` |
| `newPassword` equals `currentPassword` | 400 | `fields.newPassword` |
| `newPassword` in the blocklist | 400 | `fields.newPassword` |
| No session | 401 | §1.4 |
| Unexpected failure | 500 | `{ "error": "Unable to change password" }` |

*Traceability:* AC-02, AC-08, AC-09 · UNIT-03, API-02, API-08, API-09, UI-06…UI-09, E2E-02

---

## 3. Reference Data and Requester Tickets

These routes keep the Lab 2 contract — request shape, response shape, query
parameters, pagination metadata, and attachment rules are **unchanged**. Only the
identity source moves. See [Lab 2 api-spec §2.2–§2.10](../lab-02/api-spec.md) for
the full shapes; this section documents the delta.

### 3.1 What changed

| Endpoint | Change |
|----------|--------|
| `GET /api/categories`, `/api/related-systems` | Guard moves from `X-Requester-Id` to the session; response unchanged |
| `POST /api/tickets` | Submitter is the authenticated user. `itPriority` is set to `requestedPriority` at creation (BR-31). **Requester role only** — IT Staff and Administrators do not raise tickets |
| `GET /api/tickets` | Still the caller's own tickets. Each item gains `itPriority` and `owner` |
| `GET /api/tickets/:id` | Now readable by staff and admins for **any** ticket. Response is role-shaped — see §3.2 |
| Attachment routes | Ownership is the ticket's, resolved from the session. Staff and admins may act on any ticket's attachments |

`Ticket.requesterId` keeps its name in every payload (D-11), so a Lab 2 client
reading `requesterId` still works.

### 3.2 `GET /api/tickets/:id` — role-shaped response

**200 for the owning Requester**

```json
{ "id": 12, "ticketNumber": "TKT-2026-000012",
  "summary": "Laptop battery drains quickly",
  "description": "…",
  "requester":     { "id": 1, "name": "Somchai Prasert", "email": "somchai@kmutt.ac.th" },
  "category":      { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "requestedPriority": "MEDIUM",
  "itPriority": "HIGH",
  "currentStatus": "IN_PROGRESS",
  "owner": { "id": 4, "name": "Anong Srisai" },
  "resolutionSignalledAt": null,
  "ticketDate": "2026-09-01T09:14:00.000Z",
  "createdAt":  "2026-09-01T09:14:00.000Z",
  "updatedAt":  "2026-09-03T11:02:00.000Z",
  "attachments": [ … ],
  "publicComments": [ … ] }
```

**200 for IT Staff or an Administrator** — the same body plus:

```json
  "internalNotes": [
    { "id": 8, "body": "Ordered a replacement battery, ETA Friday.",
      "author": { "id": 4, "name": "Anong Srisai" },
      "createdAt": "2026-09-03T11:02:00.000Z" }
  ],
  "permittedTransitions": ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]
```

The Requester's body **omits the `internalNotes` key entirely** — it is not an
empty array, because an empty array would still confirm the concept exists and
would tempt a client into rendering a "0 notes" affordance (AUTHZ-10).

`permittedTransitions` is computed from the §5.7 matrix so the UI never has to
re-implement it. It is advisory; `PATCH …/status` re-checks server-side (BR-35).

**Errors**

| Case | Status | Body |
|------|--------|------|
| Requester, ticket belongs to another Requester | 404 | `{ "error": "Ticket not found" }` |
| Ticket does not exist | 404 | **Byte-identical** |
| `:id` not an integer | 404 | **Byte-identical** |
| No session | 401 | §1.4 |
| Unexpected failure | 500 | `{ "error": "Unable to load ticket" }` |

*Traceability:* AC-16, AC-17, AC-20, AC-40 · API-11, AUTHZ-06, AUTHZ-07, AUTHZ-10, REG-01, REG-06

---

## 4. Public Comments

### 4.1 `GET /api/tickets/:id/comments`

Readable by the owning Requester, IT Staff, and Administrators.

**200**

```json
[ { "id": 3, "body": "I tried the update but the problem is still there.",
    "author": { "id": 1, "name": "Somchai Prasert", "role": "REQUESTER" },
    "createdAt": "2026-09-02T04:11:00.000Z" } ]
```

Ordered by `createdAt` ascending. The author's role is included so the UI can
label who is speaking without a second lookup.

### 4.2 `POST /api/tickets/:id/comments`

**Request** `{ "body": "We have ordered a replacement battery." }`

| Field | Rule | BR |
|-------|------|-----|
| `body` | Trimmed, 1–2000 characters, not whitespace-only | BR-44 |

Author and timestamp come from the server and are ignored if sent (BR-43).

**201** — the created comment, in the §4.1 shape.

**Errors**

| Case | Status | Body |
|------|--------|------|
| Empty or whitespace-only `body` | 400 | `fields.body: "Comment cannot be empty."` |
| `body` over 2000 characters | 400 | `fields.body` |
| Ticket is `CLOSED` or `CANCELLED` | 409 | `{ "error": "This ticket is closed and can no longer be updated." }` |
| Requester, ticket not owned | 404 | `{ "error": "Ticket not found" }` |
| No session | 401 | §1.4 |
| Unexpected failure | 500 | safe message |

Bodies are stored and returned as plain text. The client renders them as text
nodes, never as HTML (BR-45), so a comment cannot inject markup into another
user's page.

*Traceability:* AC-22, AC-23, AC-26, AC-41 · UNIT-04, API-12, API-14, API-28, AUTHZ-08, UI-14, E2E-06

---

### 4.3 `POST /api/tickets/:id/resolution-signal` — Requester, own ticket

No request body.

**200**

```json
{ "resolutionSignalledAt": "2026-09-04T08:30:00.000Z",
  "resolutionSignalledBy": { "id": 1, "name": "Somchai Prasert" },
  "currentStatus": "IN_PROGRESS" }
```

`currentStatus` is returned **unchanged** — it is in the response precisely so a
test and a reviewer can see that signalling did not resolve anything (BR-23,
AC-25). Only IT Staff or an Administrator may set `RESOLVED`.

Signalling twice overwrites the timestamp rather than erroring; the signal is a
current opinion, not an event log.

**Errors**

| Case | Status | Body |
|------|--------|------|
| Caller is IT Staff or an Administrator | 403 | `{ "error": "Only the requester can signal resolution." }` |
| Ticket not owned, or absent | 404 | `{ "error": "Ticket not found" }` |
| Ticket in a terminal status | 409 | safe message (BR-22) |
| No session | 401 | §1.4 |

*Traceability:* AC-25 · API-13, UI-15, E2E-06

---

## 5. Internal Notes — IT Staff and Administrator only

### 5.1 `GET /api/tickets/:id/notes`

**200**

```json
[ { "id": 8, "body": "Ordered a replacement battery, ETA Friday.",
    "author": { "id": 4, "name": "Anong Srisai", "role": "IT_STAFF" },
    "createdAt": "2026-09-03T11:02:00.000Z" } ]
```

### 5.2 `POST /api/tickets/:id/notes`

**Request** `{ "body": "Customer has a second device; low urgency." }`

Same body rules as §4.2. **201** returns the created note.

**Errors**

| Case | Status | Body |
|------|--------|------|
| Caller is a Requester | 403 | `{ "error": "You do not have permission to perform this action." }` — **no note text, author, or count** |
| Empty or over-long `body` | 400 | `fields.body` |
| Ticket in a terminal status | 409 | safe message |
| Ticket does not exist | 404 | `{ "error": "Ticket not found" }` |
| No session | 401 | §1.4 |

**Why 403 and not 404 here.** A Requester asking for notes on *their own* ticket
already knows the ticket exists, so hiding it would serve no purpose — the thing
being protected is the note content, and the 403 body carries none of it. On a
ticket they do **not** own, §1.3 gate 3 reaches the ownership check first and the
response is 404, so the existence of another user's ticket still stays hidden.
That ordering is deliberate and is asserted by AUTHZ-09.

*Traceability:* AC-24, AC-40, AC-41 · API-27, API-28, AUTHZ-09, AUTHZ-10, UI-16, UI-24, E2E-05, E2E-06

---

## 6. Ticket Operations — IT Staff and Administrator

### 6.1 `PATCH /api/tickets/:id/owner`

Claim, reassign, and release share one endpoint because they are one state
change on one field.

**Request**

```json
{ "ownerId": 4 }
```

| Value | Meaning |
|-------|---------|
| `{ "ownerId": 4 }` | Assign or reassign to user 4 |
| `{ "ownerId": null }` | Release to unassigned |

To claim, the client sends its own id. A dedicated `/claim` route would be a
second way to write the same column, and the two would eventually disagree.

**200** — `{ "id": 12, "owner": { "id": 4, "name": "Anong Srisai" } }`

**Errors**

| Case | Status | Body |
|------|--------|------|
| `ownerId` names a Requester | 400 | `fields.ownerId: "Ticket owner must be IT Staff or an Administrator."` (BR-26) |
| `ownerId` names a deactivated user | 400 | `fields.ownerId: "That user is deactivated."` (BR-28) |
| `ownerId` names no user | 400 | `fields.ownerId` |
| Caller is a Requester | 403 | role refusal |
| Ticket does not exist | 404 | `{ "error": "Ticket not found" }` |
| No session | 401 | §1.4 |

A deactivated user **keeps** tickets already assigned to them; only new
assignment is blocked (BR-29).

*Traceability:* AC-33, AC-34, AC-35 · API-20, API-21, API-22, AUTHZ-11, UI-21, E2E-05

---

### 6.2 `PATCH /api/tickets/:id/it-priority`

**Request** `{ "itPriority": "HIGH" }` — one of `LOW`, `MEDIUM`, `HIGH`.

**200** — `{ "id": 12, "itPriority": "HIGH", "requestedPriority": "MEDIUM" }`

Both values are returned so the caller can see they are now independent. There is
no endpoint that changes `requestedPriority`; it is immutable after creation
(BR-30).

| Case | Status |
|------|--------|
| Unknown priority value | 400 with `fields.itPriority` |
| Caller is a Requester | 403 |
| Ticket absent | 404 |

*Traceability:* AC-36 · API-23, AUTHZ-11, UI-22, E2E-05

---

### 6.3 `PATCH /api/tickets/:id/status`

**Request** `{ "status": "IN_PROGRESS" }`

The target must be reachable from the ticket's current status under the §5.7
matrix.

**200**

```json
{ "id": 12, "currentStatus": "IN_PROGRESS",
  "permittedTransitions": ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"] }
```

**Errors**

| Case | Status | Body |
|------|--------|------|
| Transition not permitted from the current status | 409 | `{ "error": "Cannot move a Resolved ticket to In Progress." }` |
| Ticket is `CLOSED` or `CANCELLED` | 409 | `{ "error": "This ticket is closed and can no longer be updated." }` (BR-36) |
| Unknown status value | 400 | `fields.status` |
| Caller is a Requester | 403 | role refusal (BR-37) |
| Ticket absent | 404 | `{ "error": "Ticket not found" }` |

The check reads the current status inside the same transaction as the write, so
two staff members transitioning the same ticket concurrently cannot both pass a
stale check.

409 rather than 400: the request is well formed, and would have been valid
against a different ticket state. That is a conflict with current state, which is
what 409 means.

*Traceability:* AC-37, AC-38, AC-39 · UNIT-06, UNIT-07, UNIT-08, API-24, API-25, API-26, UI-23, E2E-05

---

## 7. IT Staff Queue

### 7.1 `GET /api/staff/tickets`

Every ticket in the system, regardless of submitter.

**Query parameters**

| Parameter | Values | Default | Invalid input |
|-----------|--------|---------|---------------|
| `search` | Ticket Number or Summary, trimmed, case-insensitive | none | Blank after trim → absent |
| `status` | any `TicketStatus` | none | Unknown → ignored |
| `itPriority` | `LOW` \| `MEDIUM` \| `HIGH` | none | Unknown → ignored |
| `categoryId` | integer | none | Non-integer → ignored |
| `ownerId` | integer, `unassigned`, or `me` | none | Unknown → ignored |
| `sort` | `ticketDate` \| `updatedAt` \| `itPriority` \| `ticketNumber` | `updatedAt` | Unknown → default |
| `order` | `asc` \| `desc` | `desc` | Unknown → default |
| `page` | integer ≥ 1 | 1 | `< 1` or non-integer → 1 |
| `pageSize` | 10 \| 20 \| 50 | 20 | Outside the set → 20 |

**Invalid parameters never fail the request** — they fall back to the documented
default, continuing Lab 2 BR-36. Every sort applies `id DESC` as a deterministic
secondary key.

`ownerId=me` resolves to the authenticated user's id server-side, so the client
never has to interpolate its own identity into a query string.

`itPriority` sorts by severity (`HIGH` → `LOW`), not alphabetically, because
alphabetical order on that enum is meaningless to a person triaging work.

**200**

```json
{
  "items": [
    { "id": 12, "ticketNumber": "TKT-2026-000012",
      "summary": "Laptop battery drains quickly",
      "category":      { "id": 2, "name": "Hardware" },
      "requester":     { "id": 1, "name": "Somchai Prasert" },
      "owner":         { "id": 4, "name": "Anong Srisai" },
      "requestedPriority": "MEDIUM",
      "itPriority": "HIGH",
      "currentStatus": "IN_PROGRESS",
      "resolutionSignalled": false,
      "ticketDate": "2026-09-01T09:14:00.000Z",
      "updatedAt":  "2026-09-03T11:02:00.000Z" } ],
  "page": 1, "pageSize": 20, "totalItems": 47, "totalPages": 3,
  "counts": { "unassigned": 9, "mine": 6 }
}
```

`owner` is `null` for an unassigned ticket. `description` is omitted — it is
unbounded and never rendered in a queue row. `resolutionSignalled` is a boolean
rather than the timestamp, because the queue only needs the badge.

`counts` carries the two figures the queue header shows. §3.2 of the handout
excludes dashboards and KPIs "beyond simple queue counts", which these are.

| Case | Status |
|------|--------|
| Success, including zero matches | 200 |
| Caller is a Requester | 403, no queue data |
| No session | 401 |
| Unexpected failure | 500 |

*Traceability:* AC-13, AC-27…AC-32 · UNIT-05, API-15…API-19, AUTHZ-03, UI-17…UI-20

---

### 7.2 `GET /api/staff/assignees`

Backs the reassign picker. Deliberately minimal: the queue needs names to assign
work, not the user directory, which stays behind `/api/admin/users`.

**200**

```json
[ { "id": 4, "name": "Anong Srisai", "role": "IT_STAFF" },
  { "id": 9, "name": "Kittipong Sae-Lim", "role": "ADMINISTRATOR" } ]
```

Only **active** users whose role is `IT_STAFF` or `ADMINISTRATOR`, ordered by
name. No email address, no activation flag, no timestamps — a staff member does
not need the directory to hand over a ticket, and every field omitted is a field
that cannot leak.

| Case | Status |
|------|--------|
| Caller is a Requester | 403 |
| No session | 401 |

*Traceability:* AC-34 · API-21, UI-21

---

## 8. Administrator User Management

Every route in this section is Administrator-only. IT Staff receive 403, not 404
— the routes are not secret, the data behind them is (AUTHZ-05).

### 8.1 `GET /api/admin/users`

| Parameter | Values | Default |
|-----------|--------|---------|
| `search` | Matches name or email, trimmed, case-insensitive | none |
| `role` | `REQUESTER` \| `IT_STAFF` \| `ADMINISTRATOR` | none |

No pagination and no sorting parameters: §3.2 excludes both for the user list.
Results are ordered by name ascending.

**200**

```json
[ { "id": 1, "name": "Somchai Prasert", "email": "somchai@kmutt.ac.th",
    "role": "REQUESTER", "isActive": true,
    "mustChangePassword": false,
    "createdAt": "2026-08-01T00:00:00.000Z" } ]
```

**No `passwordHash` field exists in any response shape in this document.**
API-29 asserts its absence rather than trusting the serialiser.

*Traceability:* AC-43, AC-44, AC-45 · API-29, API-30, API-31, AUTHZ-04, AUTHZ-05, UI-26, UI-27

---

### 8.2 `POST /api/admin/users`

**Request**

```json
{ "name": "Wanida Chaiyo", "email": "wanida@kmutt.ac.th",
  "role": "IT_STAFF", "isActive": true,
  "initialPassword": "TokTickIT!dev2026" }
```

| Field | Rule | BR |
|-------|------|-----|
| `name` | Trimmed, 1–120 characters | — |
| `email` | Trimmed, lower-cased, valid format, unique | BR-12, BR-51 |
| `role` | Exactly one of the three values | BR-17, BR-52 |
| `isActive` | Boolean, default `true` | — |
| `initialPassword` | Same policy as §2.4's `newPassword` | BR-10 |

**201**

```json
{ "id": 14, "name": "Wanida Chaiyo", "email": "wanida@kmutt.ac.th",
  "role": "IT_STAFF", "isActive": true, "mustChangePassword": true }
```

`mustChangePassword` is always `true` on creation and is **not** accepted from
the request — an Administrator cannot mint an account that skips the change
(BR-49).

**Errors**

| Case | Status | Body |
|------|--------|------|
| Email already in use, in any casing | 409 | `{ "error": "That email address is already registered." }` |
| Invalid or missing `role` | 400 | `fields.role` |
| `initialPassword` fails the policy | 400 | `fields.initialPassword` |
| Missing `name` or malformed `email` | 400 | `fields` naming each |
| Caller is not an Administrator | 403 | role refusal |

*Traceability:* AC-46, AC-47, AC-48 · API-32, API-33, API-34, UI-28, E2E-07

---

### 8.3 `PATCH /api/admin/users/:id`

Editable fields: `name`, `email`, `role`, `isActive`. Nothing else — no password,
no `mustChangePassword`, no timestamps (BR-50).

**Request** `{ "role": "ADMINISTRATOR", "isActive": true }`

**200** — the updated user in the §8.1 shape.

**Errors — the guard rails**

| Case | Status | Body |
|------|--------|------|
| Email already in use by another user | 409 | `{ "error": "That email address is already registered." }` |
| Administrator deactivating **themselves** | 409 | `{ "error": "You cannot deactivate your own account." }` (BR-54) |
| Administrator changing **their own** role | 409 | `{ "error": "You cannot change your own role." }` (BR-55) |
| Deactivating the last active Administrator | 409 | `{ "error": "The system must keep at least one active administrator." }` (BR-56) |
| Changing the last active Administrator's role away from `ADMINISTRATOR` | 409 | **Same message** — the outcome is identical, so the message is too |
| Invalid `role` | 400 | `fields.role` |
| User does not exist | 404 | `{ "error": "User not found" }` |
| Caller is not an Administrator | 403 | role refusal |

The last-Administrator check counts active Administrators **excluding the row
being edited**, inside the same transaction as the write. Counting outside the
transaction would let two concurrent edits each see one other Administrator and
both succeed, leaving zero (API-36).

There is no delete route. Deactivation is the only removal (BR-57).

*Traceability:* AC-47, AC-49, AC-50 · API-33, API-35, API-36, AUTHZ-12, UI-29, E2E-08

---

### 8.4 `POST /api/admin/users/:id/initial-password`

**Request** `{ "initialPassword": "TokTickIT!dev2026" }`

**200** `{ "id": 14, "mustChangePassword": true }`

Three things happen atomically: the hash is replaced, `mustChangePassword` is set
to `true`, and **every session belonging to that user is deleted** (BR-53). The
last of those matters — without it, a user whose password an Administrator has
just reset would keep working from an open tab, which is exactly the situation
the reset was meant to end (API-38).

The new password is never returned or echoed; the Administrator already knows it,
having typed it, and a response body is a place it could be logged.

**Errors**

| Case | Status | Body |
|------|--------|------|
| `initialPassword` fails the policy | 400 | `fields.initialPassword` |
| User does not exist | 404 | `{ "error": "User not found" }` |
| Caller is not an Administrator | 403 | role refusal |

*Traceability:* AC-51, AC-52 · API-37, API-38, UI-30, E2E-07

---

## 9. Validation Summary

Every rule is enforced server-side regardless of what the client checks first.

| Field | Rule | Failure |
|-------|------|---------|
| `email` | Trimmed, lower-cased, valid format, unique | 400 `fields.email`, or 409 on duplicate |
| `password` / `newPassword` / `initialPassword` | 12–128, differs from current, not blocklisted | 400 `fields.<name>` |
| `name` | Trimmed, 1–120 | 400 `fields.name` |
| `role` | One of three enum values | 400 `fields.role` |
| Comment / note `body` | Trimmed, 1–2000 | 400 `fields.body` |
| `itPriority` | `LOW` \| `MEDIUM` \| `HIGH` | 400 `fields.itPriority` |
| `status` | Reachable under the §5.7 matrix | 409 |
| `ownerId` | Active `IT_STAFF` or `ADMINISTRATOR`, or `null` | 400 `fields.ownerId` |
| Queue query parameters | Invalid values fall back to defaults | never fails |
| Attachment type / size / count | Lab 2 rules, unchanged | 415 / 413 / 409 |

Trimming happens **before** length checks throughout, so `"   "` fails a minimum
rather than passing as three characters.

---

## 10. Traceability

| Area | Acceptance criteria | Planned tests |
|------|--------------------|---------------|
| Login | AC-01, AC-03…AC-06 | API-01, API-03…API-06, UI-01…UI-05, E2E-01 |
| Session and cookie | AC-07, AC-10, AC-11 | API-07, API-10, AUTHZ-01, E2E-01, E2E-03 |
| Password change | AC-02, AC-08, AC-09 | UNIT-03, API-02, API-08, API-09, UI-06…UI-09, E2E-02 |
| Identity binding | AC-12, AC-21 | AUTHZ-02, REG-03 |
| Role refusals | AC-13…AC-15 | AUTHZ-03, AUTHZ-04, AUTHZ-05 |
| Ownership refusals | AC-16, AC-17, AC-23 | AUTHZ-06, AUTHZ-07, AUTHZ-08 |
| Requester regression | AC-18…AC-20 | API-11, REG-01, REG-02, REG-06 |
| Comments | AC-22, AC-26, AC-41 | UNIT-04, API-12, API-14, API-28, UI-14 |
| Resolution signal | AC-25 | API-13, UI-15, E2E-06 |
| Internal Notes | AC-24, AC-40, AC-42 | API-27, AUTHZ-09, AUTHZ-10, UI-16, UI-24 |
| Queue | AC-27…AC-32 | UNIT-05, API-15…API-19, UI-17…UI-20 |
| Ownership operations | AC-33…AC-35 | API-20, API-21, API-22, UI-21 |
| Priority | AC-36 | API-23, UI-22 |
| Status workflow | AC-37…AC-39 | UNIT-06…UNIT-08, API-24…API-26, UI-23 |
| User administration | AC-43…AC-52 | API-29…API-38, AUTHZ-12, UI-26…UI-30, E2E-07, E2E-08 |

---

## 11. Migration Notes for API Consumers

| Lab 2 | Lab 3 |
|-------|-------|
| `X-Requester-Id: 1` on every scoped request | `toktickit_session` cookie, set by `POST /api/auth/login` |
| Requester chosen in the client | Requester derived from the session, never from the client |
| 401 when the header was missing or unknown | 401 when there is no valid session — same semantics, new source |
| 404 for a ticket not owned | Unchanged |
| No role concept | 403 introduced for role refusals, distinct from 404 |
| `fetch(url)` | `fetch(url, { credentials: "include" })` |

Lab 2 D-07 chose a header rather than a query parameter or a body field precisely
so this change would be confined to one middleware and one fetch wrapper. No
route path, request shape, or response shape from Lab 2 changes in this sprint —
only the source of identity, and the additive fields listed in §3.1.
