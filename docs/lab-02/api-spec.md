# Lab 2 REST API Contract

**Sprint:** Lab 2 — Requester Ticketing MVP
**Contract:** [`specification.md`](./specification.md) · [`tests.md`](./tests.md) · [`ui-spec.md`](./ui-spec.md)
**Status:** Approved for implementation

Every endpoint below documents its success response, validation failures,
ownership failures, missing-resource behaviour, and safe unexpected-error
behaviour. Each is traceable to numbered acceptance criteria and planned tests.

---

## 1. Conventions

### 1.1 Base

| Item | Value |
|------|-------|
| Base URL (dev) | `http://localhost:3000` |
| Frontend origin | `http://localhost:5173` (allowed by CORS) |
| Request content type | `application/json`, except attachment upload (`multipart/form-data`) |
| Response content type | `application/json`, except attachment download (the file's own type) |
| Timestamps | ISO 8601 UTC, e.g. `2026-08-26T09:14:00.000Z` |
| Identifiers | Integer, server-assigned |

### 1.2 Requester context

Every Requester-scoped request carries:

```http
X-Requester-Id: 1
```

The server resolves this to an **active** `RequesterUser` on every request and
scopes all queries by it. The value is never taken from the request body, the
path, or a query parameter.

| Condition | Status | Body |
|-----------|--------|------|
| Header absent | 401 | `{ "error": "No Development Requester selected" }` |
| Not an integer | 401 | same |
| No such Requester | 401 | same |
| Requester exists but `isActive = false` | 401 | same |

The response is deliberately identical in all four cases so the endpoint never
becomes a probe for which Requester ids exist.

> **This is not authentication** (BR-03). It is a testing mechanism that
> simulates multi-user ownership before Lab 3. It is shaped like an auth header
> precisely so Lab 3 can replace it with `Authorization: Bearer …` without
> changing a single route signature (D-07).

Endpoints requiring the header are marked **Scoped** below. `/api/health` and
`/api/requesters` are **Public** — the selector must load before any Requester
exists in the client's state.

### 1.3 Error shape

Every error response, without exception:

```json
{ "error": "Human-readable summary",
  "fields": { "summary": "Summary must be 5–150 characters." } }
```

`fields` appears only on validation failures (400). It maps a request field name
to one message.

**No error body ever contains a stack trace, SQL fragment, ORM message, or
filesystem path** (BR-47). Unexpected failures are logged server-side with full
detail and returned to the client as a bare 500.

### 1.4 Status codes

| Status | Meaning in this API |
|--------|--------------------|
| 200 | Successful retrieval, download, or soft removal |
| 201 | Ticket created; attachment uploaded |
| 400 | Validation failure; unknown or inactive reference id; missing removal reason |
| 401 | Missing, malformed, unknown, or inactive `X-Requester-Id` |
| 404 | Resource does not exist **or** is not owned by the selected Requester |
| 409 | Attachment limit reached; attachment already removed |
| 413 | Upload exceeds 5 MB |
| 415 | Unsupported file type |
| 500 | Unexpected server error, reported safely |

### 1.5 Ownership model

`Ticket` and `Attachment` are Requester-owned. Every route touching them
re-derives ownership from `X-Requester-Id` and scopes the database query by it —
`WHERE requesterId = :ctx` rather than fetch-then-compare.

**Not-found and not-owned return byte-identical 404 responses** (BR-28, D-06).
A 403 would confirm the resource exists, leaking that another Requester holds a
ticket with that id. The lab sheet asks for safe errors and states the ticket
data "is not returned"; 404 satisfies both.

Attachments inherit ownership through their Ticket (BR-29). An attachment id is
never trusted on its own — the query joins to `Ticket` and filters by requester.

### 1.6 Endpoint summary

| # | Method | Path | Access | Capability |
|---|--------|------|--------|-----------|
| 0 | GET | `/api/health` | Public | Liveness (Lab 1) |
| 1 | GET | `/api/requesters` | Public | Active Development Requesters |
| 2 | GET | `/api/categories` | Scoped | Active Categories |
| 3 | GET | `/api/related-systems` | Scoped | Active Related Systems |
| 4 | POST | `/api/tickets` | Scoped | Create a Ticket |
| 5 | GET | `/api/tickets` | Scoped | The Requester's Tickets, paginated |
| 6 | GET | `/api/tickets/:id` | Scoped | One owned Ticket |
| 7 | POST | `/api/tickets/:id/attachments` | Scoped | Upload an Attachment |
| 8 | GET | `/api/tickets/:id/attachments` | Scoped | Attachment metadata |
| 9 | GET | `/api/attachments/:id/download` | Scoped | Download an active Attachment |
| 10 | DELETE | `/api/attachments/:id` | Scoped | Soft-remove an Attachment |

---

## 2. Endpoint Reference

### 2.0 `GET /api/health`

Carried over from Lab 1, unchanged.

**200**

```json
{ "status": "ok", "service": "TokTickIT API" }
```

No errors other than 500.

---

### 2.1 `GET /api/requesters` — active Development Requesters

Public: the selection screen calls this before any Requester is chosen.

**200**

```json
[ { "id": 1, "name": "Somchai Prasert", "email": "somchai@kmutt.ac.th" },
  { "id": 2, "name": "Naree Wongchai",  "email": "naree@kmutt.ac.th" } ]
```

Ordered by `name` ascending. **Inactive Requesters are never included**
(BR-13, BR-20). An empty array is a valid response and drives the empty state in
`ui-spec.md` §8.1 (BR-24).

| Case | Status | Notes |
|------|--------|-------|
| Success | 200 | Array, possibly empty |
| Unexpected failure | 500 | `{ "error": "Unable to load requesters" }` |

*Traceability:* AC-02, AC-06 · API-01, UI-01, UI-04

---

### 2.2 `GET /api/categories` — active Categories

**Scoped.**

**200**

```json
[ { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" } ]
```

Only `isActive = true` rows, ordered by `id` ascending — a fixed order so the
Create Ticket dropdown never reshuffles between loads.

| Case | Status |
|------|--------|
| Success | 200 |
| Requester context invalid | 401 |
| Unexpected failure | 500 |

*Traceability:* AC-10 · API-03, UI-07

---

### 2.3 `GET /api/related-systems` — active Related Systems

**Scoped.** Identical contract to §2.2.

**200**

```json
[ { "id": 1, "name": "Email" },
  { "id": 2, "name": "Campus Wi-Fi" },
  { "id": 3, "name": "VPN" },
  { "id": 4, "name": "LEB2 App" },
  { "id": 5, "name": "Grade Submission App" },
  { "id": 6, "name": "Printer" },
  { "id": 7, "name": "Corporate Laptop" } ]
```

*Traceability:* AC-10 · API-03, UI-07

---

### 2.4 `POST /api/tickets` — create a Ticket

**Scoped.** Creates one validated Ticket for the selected Requester.

**Request**

```json
{ "categoryId": 2,
  "relatedSystemId": 7,
  "requestedPriority": "MEDIUM",
  "summary": "Laptop battery drains quickly",
  "description": "The battery drops from 100% to 20% in about an hour even when I am only using a browser. It started after last week's update." }
```

**Field rules**

| Field | Type | Required | Rule | BR |
|-------|------|----------|------|-----|
| `categoryId` | integer | yes | Must exist and be active | BR-41 |
| `relatedSystemId` | integer | yes | Must exist and be active | BR-41 |
| `requestedPriority` | enum | yes | `LOW` \| `MEDIUM` \| `HIGH` | D-02 |
| `summary` | string | yes | Trimmed, 5–150 characters | BR-39 |
| `description` | string | yes | Trimmed, 20–5000 characters | BR-40 |

`ticketNumber`, `ticketDate`, `currentStatus`, and `requesterId` are **ignored if
sent** — the server owns them (BR-16, BR-18).

**201**

```json
{ "id": 1,
  "ticketNumber": "TKT-2026-000001",
  "currentStatus": "NEW",
  "ticketDate": "2026-08-26T09:14:00.000Z",
  "requesterId": 1 }
```

The Ticket Number is allocated inside the creation transaction from
`TicketNumberSequence` so concurrent creates cannot collide (BR-01, BR-14).

**Errors**

| Case | Status | Body |
|------|--------|------|
| Missing or short `summary` | 400 | `{ "error": "Validation failed", "fields": { "summary": "Summary must be 5–150 characters." } }` |
| Missing or short `description` | 400 | `fields.description` |
| Missing or unknown `requestedPriority` | 400 | `fields.requestedPriority` |
| `categoryId` unknown or inactive | 400 | `fields.categoryId: "Select a valid category."` |
| `relatedSystemId` unknown or inactive | 400 | `fields.relatedSystemId` |
| Multiple invalid fields | 400 | All offending fields in one `fields` object — the client shows every message at once |
| Requester context invalid | 401 | §1.2 |
| Unexpected failure | 500 | `{ "error": "Unable to create ticket" }` |

Validation runs entirely before any write. A 400 never leaves a partial Ticket.

*Traceability:* AC-07, AC-08, AC-09, AC-12 · UNIT-01, UNIT-02, UNIT-03,
API-04, API-05, API-06, API-07, API-08, API-09, UI-11, E2E-01

---

### 2.5 `GET /api/tickets` — the Requester's Tickets

**Scoped.** Returns only Tickets owned by the selected Requester (BR-27).

**Query parameters**

| Parameter | Type | Values | Default | Invalid input |
|-----------|------|--------|---------|---------------|
| `search` | string | Free text, trimmed | none | Blank after trim → treated as absent |
| `categoryId` | integer | Any Category id | none | Non-integer → ignored |
| `relatedSystemId` | integer | Any Related System id | none | Non-integer → ignored |
| `priority` | enum | `LOW` \| `MEDIUM` \| `HIGH` | none | Unknown → ignored |
| `status` | enum | `NEW` | none | Unknown → ignored |
| `sort` | enum | `ticketDate` \| `ticketNumber` \| `updatedAt` | `ticketDate` | Unknown → default |
| `order` | enum | `asc` \| `desc` | `desc` | Unknown → default |
| `page` | integer | ≥ 1 | `1` | `< 1` or non-integer → `1` |
| `pageSize` | integer | `10` \| `20` \| `50` | `10` | Outside the set → `10` |

**Invalid parameters never fail the request** (BR-36). They fall back to the
documented default so a hand-edited URL degrades gracefully rather than
returning 400.

`search` matches `ticketNumber` **or** `summary`, case-insensitively (BR-31).
Every sort applies `id DESC` as a secondary key so ordering is deterministic
when the primary key ties (BR-34).

Filters compose with ownership, never replace it — a `categoryId` matching
another Requester's Tickets still returns none of them (BR-38).

**Example**

```http
GET /api/tickets?search=laptop&categoryId=2&sort=ticketDate&order=desc&page=1&pageSize=10
X-Requester-Id: 1
```

**200**

```json
{
  "items": [
    { "id": 1,
      "ticketNumber": "TKT-2026-000001",
      "summary": "Laptop battery drains quickly",
      "category":      { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM",
      "currentStatus": "NEW",
      "ticketDate": "2026-08-26T09:14:00.000Z",
      "updatedAt":  "2026-08-26T09:14:00.000Z" }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 23,
  "totalPages": 3
}
```

`description` is deliberately absent from list items — it is unbounded in
practical terms and never rendered in a row (`ui-spec.md` §8.3).

`totalItems` counts rows matching the filters, not the Requester's whole ticket
count, so "Showing 1–10 of 23" reflects what the user is actually looking at
(BR-37).

A page beyond `totalPages` returns `items: []` with correct metadata — not a 404.
An empty `items` array with `totalItems: 0` drives the empty and no-results
states, which the client distinguishes by whether any filter is active (BR-57).

| Case | Status |
|------|--------|
| Success, including zero matches | 200 |
| Requester context invalid | 401 |
| Unexpected failure | 500 |

*Traceability:* AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22 ·
UNIT-06, API-10 … API-16, UI-12 … UI-16, E2E-02

---

### 2.6 `GET /api/tickets/:id` — one owned Ticket

**Scoped.**

**200**

```json
{ "id": 1,
  "ticketNumber": "TKT-2026-000001",
  "summary": "Laptop battery drains quickly",
  "description": "The battery drops from 100% to 20% in about an hour …",
  "requester":     { "id": 1, "name": "Somchai Prasert", "email": "somchai@kmutt.ac.th" },
  "category":      { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "ticketDate": "2026-08-26T09:14:00.000Z",
  "createdAt":  "2026-08-26T09:14:00.000Z",
  "updatedAt":  "2026-08-26T09:14:00.000Z",
  "attachments": [
    { "id": 5, "originalFilename": "battery-log.pdf", "mimeType": "application/pdf",
      "sizeBytes": 481232, "uploadedAt": "2026-08-26T09:15:00.000Z",
      "removedAt": null, "removalReason": null, "removedBy": null },
    { "id": 6, "originalFilename": "screenshot.png", "mimeType": "image/png",
      "sizeBytes": 214880, "uploadedAt": "2026-08-26T09:16:00.000Z",
      "removedAt": "2026-08-26T10:02:00.000Z",
      "removalReason": "Uploaded the wrong screenshot",
      "removedBy": { "id": 1, "name": "Somchai Prasert" } }
  ]
}
```

Attachments are embedded so the Detail screen renders in one round trip.
**Removed attachments are included** with their reason — they remain visible as
metadata (BR-08, BR-55). Ordered by `uploadedAt` ascending.

| Case | Status | Body |
|------|--------|------|
| Owned Ticket | 200 | As above |
| Ticket belongs to another Requester | 404 | `{ "error": "Ticket not found" }` |
| Ticket does not exist | 404 | **Byte-identical to the previous row** |
| `:id` not an integer | 404 | Same |
| Requester context invalid | 401 | §1.2 |
| Unexpected failure | 500 | `{ "error": "Unable to load ticket" }` |

*Traceability:* AC-23, AC-24, AC-25 · API-17, API-18, API-19, UI-17, E2E-04

---

### 2.7 `POST /api/tickets/:id/attachments` — upload

**Scoped.** `multipart/form-data` with a single `file` part.

```http
POST /api/tickets/1/attachments
X-Requester-Id: 1
Content-Type: multipart/form-data; boundary=…

--…
Content-Disposition: form-data; name="file"; filename="battery-log.pdf"
Content-Type: application/pdf
--…
```

**Rules**

| Rule | Detail | BR |
|------|--------|-----|
| Permitted types | JPEG, PNG, WEBP, PDF | BR-04 |
| Type detection | Detected MIME type, not the filename extension | BR-51 |
| Size limit | 5 MB (5 × 1024 × 1024 bytes) | BR-05 |
| Active limit | Five per Ticket; removed attachments do not count | BR-06, BR-56 |
| Stored name | Server-generated UUID plus a validated extension | BR-50 |
| Ownership | The Ticket must belong to the selected Requester | BR-30 |

The original filename is stored as **data only**, never used as a path segment,
which is what prevents `../../etc/passwd` from escaping the upload directory
(BR-50, UNIT-05).

**201**

```json
{ "id": 7, "ticketId": 1, "originalFilename": "battery-log.pdf",
  "mimeType": "application/pdf", "sizeBytes": 481232,
  "uploadedAt": "2026-08-26T09:15:00.000Z", "removedAt": null }
```

**Errors**

| Case | Status | Body |
|------|--------|------|
| No `file` part | 400 | `{ "error": "No file supplied" }` |
| Unsupported type | 415 | `{ "error": "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF." }` |
| Larger than 5 MB | 413 | `{ "error": "File exceeds the 5 MB limit." }` |
| Ticket already has five active attachments | 409 | `{ "error": "Maximum of 5 attachments reached." }` |
| Ticket not owned or missing | 404 | `{ "error": "Ticket not found" }` |
| Requester context invalid | 401 | §1.2 |
| Disk write failure | 500 | `{ "error": "Unable to store attachment" }` — no database row is created |

Size and type are rejected **before** the file is written to disk, so a rejected
upload leaves nothing behind.

> **Relationship to ticket creation.** Uploads are a separate request from
> `POST /api/tickets`. If a Ticket is created and a subsequent upload fails, the
> Ticket is kept and the client reports which files failed (BR-48, D-08). A
> Requester who wrote a long Description never loses it because one file failed.

*Traceability:* AC-26, AC-27, AC-28, AC-29 · UNIT-04, UNIT-05, API-20, API-21,
API-22, API-23, UI-20, E2E-03

---

### 2.8 `GET /api/tickets/:id/attachments` — attachment metadata

**Scoped.** The same array embedded in §2.6, available on its own so the
attachment panel can refresh after an upload or removal without refetching the
whole Ticket.

**200**

```json
[ { "id": 5, "originalFilename": "battery-log.pdf", "mimeType": "application/pdf",
    "sizeBytes": 481232, "uploadedAt": "2026-08-26T09:15:00.000Z",
    "removedAt": null, "removalReason": null, "removedBy": null } ]
```

Includes removed attachments. **Never returns the stored filename or any
filesystem path** — those are internal (BR-47, BR-50).

| Case | Status |
|------|--------|
| Success | 200 |
| Ticket not owned or missing | 404 |
| Requester context invalid | 401 |
| Unexpected failure | 500 |

*Traceability:* AC-31 · API-25, UI-18

---

### 2.9 `GET /api/attachments/:id/download` — download

**Scoped.** Returns the file itself, not JSON.

**200**

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="battery-log.pdf"
Content-Length: 481232
```

The body is the stored file, byte-identical to what was uploaded. The
`filename` in `Content-Disposition` is the **original** name, quoted and escaped;
the stored UUID name is never exposed.

**Errors**

| Case | Status | Body |
|------|--------|------|
| Attachment has been removed | 404 | `{ "error": "Attachment not found" }` (BR-08) |
| Attachment belongs to another Requester's Ticket | 404 | Identical |
| Attachment does not exist | 404 | Identical |
| Requester context invalid | 401 | §1.2 |
| File missing from disk | 500 | `{ "error": "Unable to read attachment" }` |

A removed attachment returns the **same 404 as a non-existent one**. Guessing the
id of a removed file reveals nothing about whether it ever existed — this is the
guard behind AC-32, and it is why the client removes the download control from
the DOM rather than disabling it (`ui-spec.md` §9.2).

*Traceability:* AC-30, AC-32, AC-35 · API-24, API-26, API-29, E2E-03

---

### 2.10 `DELETE /api/attachments/:id` — soft removal

**Scoped.** Sets `removedAt`, `removedById`, and `removalReason`. **No row is
ever deleted and no file is erased from disk** (BR-07).

**Request** — `application/json` body is required:

```json
{ "reason": "Uploaded the wrong screenshot" }
```

| Field | Type | Required | Rule | BR |
|-------|------|----------|------|-----|
| `reason` | string | yes | Trimmed, 3–200 characters | BR-53 |

> A body on `DELETE` is unusual but legal, and both `fetch` and Supertest send
> one. The alternative — `POST /api/attachments/:id/removal` — was rejected
> because removal is a state change on the attachment itself, and `DELETE`
> states the intent plainly. The reason is required, so it cannot travel as an
> optional query parameter.

**200**

```json
{ "id": 6, "removedAt": "2026-08-26T10:02:00.000Z",
  "removalReason": "Uploaded the wrong screenshot",
  "removedBy": { "id": 1, "name": "Somchai Prasert" } }
```

After removal the attachment still appears in §2.6 and §2.8 with its reason
(BR-55), is no longer downloadable (BR-08), and no longer counts toward the
five-attachment limit (BR-56).

**Errors**

| Case | Status | Body |
|------|--------|------|
| `reason` missing, blank, or shorter than 3 characters | 400 | `{ "error": "Validation failed", "fields": { "reason": "A removal reason of 3–200 characters is required." } }` |
| `reason` longer than 200 characters | 400 | `fields.reason` |
| Attachment already removed | 409 | `{ "error": "Attachment has already been removed." }` |
| Attachment belongs to another Requester's Ticket | 404 | `{ "error": "Attachment not found" }` |
| Attachment does not exist | 404 | Identical |
| Requester context invalid | 401 | §1.2 |
| Unexpected failure | 500 | `{ "error": "Unable to remove attachment" }` |

Ownership is checked **before** validation, so an attacker probing another
Requester's attachment ids receives 404 rather than a 400 that would confirm the
attachment exists.

*Traceability:* AC-31, AC-33, AC-34, AC-35 · API-25, API-27, API-28, API-29,
UI-18, UI-19, E2E-03

---

## 3. Validation Summary

Every rule below is enforced server-side regardless of what the client checks
first (BR-42). The client validates only to give faster feedback.

| Field | Rule | Failure |
|-------|------|---------|
| `summary` | Trimmed, 5–150 characters | 400 `fields.summary` |
| `description` | Trimmed, 20–5000 characters | 400 `fields.description` |
| `requestedPriority` | `LOW` \| `MEDIUM` \| `HIGH` | 400 `fields.requestedPriority` |
| `categoryId` | Exists and active | 400 `fields.categoryId` |
| `relatedSystemId` | Exists and active | 400 `fields.relatedSystemId` |
| `reason` (removal) | Trimmed, 3–200 characters | 400 `fields.reason` |
| Upload type | JPEG, PNG, WEBP, PDF by detected MIME | 415 |
| Upload size | ≤ 5 MB | 413 |
| Active attachment count | ≤ 5 per Ticket | 409 |
| List query parameters | Invalid values fall back to defaults | never fails |

Trimming happens **before** length checks throughout, so `"    "` fails the
minimum rather than passing as four characters.

---

## 4. Traceability

| Endpoint | Acceptance criteria | Planned tests |
|----------|--------------------|---------------|
| `GET /api/requesters` | AC-02, AC-06 | API-01, UI-01, UI-04 |
| Requester context header | AC-01 | API-02, UI-05 |
| `GET /api/categories`, `/api/related-systems` | AC-10 | API-03, UI-07 |
| `POST /api/tickets` | AC-07, AC-08, AC-09, AC-12 | UNIT-01…03, API-04…09, UI-11, E2E-01 |
| `GET /api/tickets` | AC-15…AC-22 | UNIT-06, API-10…16, UI-12…16, E2E-02 |
| `GET /api/tickets/:id` | AC-23, AC-24, AC-25 | API-17, API-18, API-19, UI-17, E2E-04 |
| `POST /api/tickets/:id/attachments` | AC-26…AC-29 | UNIT-04, UNIT-05, API-20…23, UI-20, E2E-03 |
| `GET /api/tickets/:id/attachments` | AC-31 | API-25, UI-18 |
| `GET /api/attachments/:id/download` | AC-30, AC-32, AC-35 | API-24, API-26, API-29, E2E-03 |
| `DELETE /api/attachments/:id` | AC-31, AC-33, AC-34, AC-35 | API-25, API-27…29, UI-18, UI-19, E2E-03 |

---

## 5. Lab 3 Forward Compatibility

| Lab 2 | Lab 3 |
|-------|-------|
| `X-Requester-Id: 1` | `Authorization: Bearer <token>` |
| Requester resolved from the header | Requester resolved from the verified token |
| Every route already scopes by the resolved requester | Unchanged |
| 401 for an invalid requester context | Unchanged semantics |
| 404 for not-owned | Unchanged; role-based rules layer on top |

Because ownership is already derived from a request header rather than from the
request body, **no route path, request shape, or response shape has to change
when real authentication arrives** — only the middleware that produces the
requester id (D-07, BR-63).
