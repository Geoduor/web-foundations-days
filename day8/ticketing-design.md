# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. Most days it is quiet, but when a very popular concert goes on sale, a huge crowd arrives at once and fights for a small number of seats. The design must work well on both kinds of day.

This document follows the six-part framework:

1. Requirements
2. Estimates
3. API
4. Data model (including how double-booking is prevented)
5. Architecture
6. Trade-offs

---

## 1. Requirements

### Functional requirements

- Users can register, log in and log out.
- Users can browse and search events (by name, artist, city, date).
- Users can view the details of an event and see its seat map with the status of each seat (available, held, sold).
- Users can select seats and **hold** them for a short time (5 minutes) while they pay.
- Users can pay for held seats and receive a confirmation.
- Users can view their tickets and past orders.
- Users can release a hold, and holds expire automatically if the user does not pay in time.
- Organizers can create events and set the seats and prices (out of scope for the detailed design).

### Non-functional requirements

| Quality | Requirement | Why it matters |
|---------|-------------|----------------|
| **Correctness** | A seat must never be sold to two people. A payment must never be taken for a seat the user did not get. A user who pays must get exactly one ticket per seat. | This is the most important requirement. Selling a seat twice means angry customers and refunds. |
| **Speed** | Browsing pages load in under 1 second. Seat map loads in under 2 seconds. Holding a seat responds in under 1 second. | Slow pages lose customers, and during a sale, slow responses make users refresh and add more load. |
| **Fairness** | During a big sale, people are served in the order they arrived (first come, first served). Bots and one user opening many tabs must not get an advantage. | Fans must trust that the sale is fair. |
| **Availability** | Browsing stays available even if payments or the database are struggling. Target 99.9% overall. | The company earns nothing when the site is down on sale day. |
| **Scalability** | Handle roughly 500 times the normal load for short bursts (about 10 minutes) without crashing. | The big sale is the hard case. |
| **Durability** | Once an order is confirmed, it is never lost. | Money and tickets are involved. |
| **Security** | Passwords hashed, all traffic over HTTPS, payment card data handled only by a payment provider, rate limits against bots. | Protect users and money. |

Consistency choice: seat holds and purchases need **strong consistency** (always right). Browsing event lists and seat maps can be **eventually consistent** (a few seconds stale is acceptable).

---

## 2. Estimates

### Assumptions

- 1 day = 86,400 seconds.
- "Peak" on a normal day = 5x the average.
- Each page view makes about 3 API calls (page data, images from CDN not counted).
- During the big sale, each person views about 10 pages in the 10 minutes (seat map refreshes, selecting seats, checkout), the same 10 pages per visit as on a normal day, so the two cases can be compared fairly.
- During the big sale, each person makes about 3 seat-hold attempts, because seats are taken before they click.
- A hold lasts 5 minutes.

### Normal day

| Item | Calculation | Result |
|------|-------------|--------|
| Registered users | given | 2,000,000 |
| Daily visitors | given | 50,000 (2.5% of registered users) |
| Page views per day | 50,000 x 10 | 500,000 |
| Page views per second (average) | 500,000 / 86,400 | about 5.8 /s |
| Page views per second (5x peak) | 5.8 x 5 | about 29 /s |
| API calls per second (average / peak) | 5.8 x 3 / 29 x 3 | about 17 /s / about 87 /s |
| Tickets sold per day | given | 5,000 |
| Purchases per second (average) | 5,000 / 86,400 | about 0.06 /s (roughly 1 every 17 seconds) |
| Purchases per second (5x peak) | 0.06 x 5 | about 0.3 /s |

A normal day is easy: a single small database and a couple of app servers could handle it.

### Big sale (one popular concert)

| Item | Calculation | Result |
|------|-------------|--------|
| People trying to buy | given | 200,000 within the first 10 minutes |
| Seats available | given | 20,000 |
| Demand vs supply | 200,000 / 20,000 | 10 people for every seat (90% will not get one) |
| Window | 10 x 60 | 600 seconds |
| Arrivals per second | 200,000 / 600 | about 333 new users /s |
| Page views per second | 200,000 x 10 / 600 | about 3,333 /s |
| API calls per second | 3,333 x 3 | about 10,000 /s |
| Seat-hold attempts per second | 200,000 x 3 / 600 | about 1,000 /s |
| Successful tickets per second | 20,000 / 600 | about 33 /s (if all sell out within the 10 minutes) |
| Seats held at the same time (worst case) | 33 /s x 300 s (5 min hold) | up to about 10,000 seats held at once |
| Peak inside the window | people arrive mostly in the first seconds, assume 5x the average | about 16,700 page views /s and about 5,000 hold attempts /s for the first minute |

### Comparison

| Measure | Normal day (average) | Big sale (average over 10 min) | Ratio |
|---------|----------------------|--------------------------------|-------|
| Page views per second | 5.8 | 3,333 | about 575x |
| Purchases per second | 0.06 | 33 | about 575x |
| Visitors per second | 0.58 | 333 | about 575x |

Key insight: the big sale is about **575 times** busier than a normal day (and about 2,900 times if we compare against the normal-day average and the first-minute spike). It is also **write-heavy on a small hot set of rows**: thousands of people are competing for the same 20,000 seats at the same moment. A cache cannot solve this alone, because the dangerous part is writes to the same rows. Therefore the design must (a) protect the database from the crowd, (b) make the seat-claim step atomic, and (c) keep browsing fast with caching and a CDN.

Storage is small: 5,000 tickets/day x about 1 KB per record is about 5 MB/day, and seat rows are 20,000 per event, so the database is tiny compared with the traffic. Event images go to object storage and the CDN.

---

## 3. API

REST over HTTPS, JSON. All endpoints except browsing require a login token (`Authorization: Bearer <token>`).

| # | Method and path | Purpose |
|---|-----------------|---------|
| 1 | `POST /auth/login` | Log in and receive a token. |
| 2 | `GET /events?city=&date=&q=&page=` | Browse and search events (cacheable). |
| 3 | `GET /events/{event_id}` | View event details (cacheable). |
| 4 | `GET /events/{event_id}/seats?section=` | View the seat map and the status of each seat. |
| 5 | `POST /events/{event_id}/holds` | Hold one or more seats for 5 minutes. |
| 6 | `DELETE /holds/{hold_id}` | Release a hold. |
| 7 | `POST /holds/{hold_id}/checkout` | Pay for the held seats (creates the order). |
| 8 | `POST /payments/webhook` | Payment provider tells us the payment succeeded or failed. |
| 9 | `GET /me/tickets` | View my tickets. |
| 10 | `GET /me/orders/{order_id}` | View one order. |

### Example: view seats

`GET /events/42/seats?section=A`

```json
{
  "event_id": 42,
  "as_of": "2026-10-17T10:00:03Z",
  "seats": [
    { "seat_id": 9001, "row": "A", "number": 1, "price": 5000, "status": "available" },
    { "seat_id": 9002, "row": "A", "number": 2, "price": 5000, "status": "held" },
    { "seat_id": 9003, "row": "A", "number": 3, "price": 5000, "status": "sold" }
  ]
}
```

(The status here can be a few seconds old; the real check happens when holding.)

### Example: hold seats

`POST /events/42/holds`

```json
{ "seat_ids": [9001, 9004], "queue_token": "abc123" }
```

Success `201 Created`:

```json
{ "hold_id": "h_77", "seat_ids": [9001, 9004], "expires_at": "2026-10-17T10:05:00Z", "total": 10000 }
```

Failure `409 Conflict` if any seat is no longer available (nothing is held; it is all-or-nothing):

```json
{ "error": "SEAT_UNAVAILABLE", "unavailable_seat_ids": [9004] }
```

### Example: checkout

`POST /holds/h_77/checkout` with header `Idempotency-Key: 5f1c...`

```json
{ "payment_method_token": "tok_visa_xxx" }
```

Response `202 Accepted` while payment is processed, then `200 OK` / webhook confirms. If the hold has expired: `410 Gone`.

The **Idempotency-Key** means if the user double-clicks "Pay" or the network retries, the user is charged once and gets one order.

Other API rules: pagination on lists, rate limiting per user and per IP (for example 10 hold attempts per minute per user), and versioning (`/v1/...`).

---

## 4. Data Model

Relational database (PostgreSQL), because we need transactions, constraints and relationships between tables.

### Tables

**users**

| Column | Type | Notes |
|--------|------|-------|
| user_id | bigint, PK | |
| email | text, UNIQUE, NOT NULL | |
| password_hash | text, NOT NULL | |
| name | text | |
| created_at | timestamp | |

**venues**

| Column | Type | Notes |
|--------|------|-------|
| venue_id | bigint, PK | |
| name, city, capacity | | |

**events**

| Column | Type | Notes |
|--------|------|-------|
| event_id | bigint, PK | |
| venue_id | FK -> venues | |
| title, artist | text | |
| starts_at | timestamp | |
| sale_starts_at | timestamp | when tickets go on sale |
| status | text | upcoming, on_sale, sold_out, finished |
| image_url | text | image lives in object storage |

**event_seats** (one row per seat per event, so 20,000 rows for the big concert)

| Column | Type | Notes |
|--------|------|-------|
| seat_id | bigint, PK | |
| event_id | FK -> events, NOT NULL | |
| section, row_label, seat_number | text/int | |
| price | int (cents) | |
| status | text | `available`, `held`, `sold` (CHECK constraint on these values) |
| held_by | FK -> users, NULL | who holds it |
| hold_id | text, NULL | |
| hold_expires_at | timestamp, NULL | |
| version | int | increases on every change (for debugging and optional optimistic locking) |
| | | **UNIQUE (event_id, section, row_label, seat_number)** so a physical seat exists only once per event |

**orders**

| Column | Type | Notes |
|--------|------|-------|
| order_id | bigint, PK | |
| user_id | FK -> users | |
| event_id | FK -> events | |
| status | text | `pending`, `paid`, `failed`, `cancelled` |
| total_amount | int | |
| idempotency_key | text, **UNIQUE** | stops duplicate orders from retries |
| created_at | timestamp | |

**tickets** (one row per sold seat)

| Column | Type | Notes |
|--------|------|-------|
| ticket_id | bigint, PK | |
| order_id | FK -> orders | |
| seat_id | FK -> event_seats, **UNIQUE** | **a seat can appear in at most one ticket, ever** |
| user_id | FK -> users | |
| qr_code | text | |
| issued_at | timestamp | |

**payments**

| Column | Type | Notes |
|--------|------|-------|
| payment_id | bigint, PK | |
| order_id | FK -> orders | |
| provider_ref | text, UNIQUE | provider's transaction id |
| amount, status | | |

### Relationships

```
users 1 ---- * orders 1 ---- * tickets * ---- 1 event_seats * ---- 1 events * ---- 1 venues
                  |
                  1
                  |
                  * payments

users 1 ---- * event_seats (held_by, only while a seat is held)
```

- A user has many orders; an order has many tickets and one or more payment attempts.
- An event belongs to one venue and has many event_seats.
- A ticket points to exactly one seat, and a seat has at most one ticket (the UNIQUE constraint).

### Indexes

- `event_seats (event_id, status)` for the seat map and "how many left".
- `event_seats (hold_expires_at) WHERE status = 'held'` to find expired holds quickly.
- `orders (user_id, created_at)` and `tickets (user_id)` for "my tickets".

---

## 4b. How the Design Prevents Two People Buying the Same Seat

The dangerous situation: User A and User B both see seat 9001 as available and click "hold" at the same moment. If the code does "read the seat, see that it's free, then write that it's mine", both can read "free" before either writes, and both think they got it (a **race condition**). The fix is to make "check and claim" one **atomic** step inside the database, and to add constraints as a safety net. We use three layers.

### Layer 1: Atomic conditional update when holding (the main guard)

```sql
BEGIN;

UPDATE event_seats
SET    status = 'held',
       held_by = :user_id,
       hold_id = :hold_id,
       hold_expires_at = now() + interval '5 minutes',
       version = version + 1
WHERE  event_id = :event_id
  AND  seat_id IN (:seat_ids)
  AND  ( status = 'available'
         OR (status = 'held' AND hold_expires_at < now()) );   -- expired holds can be taken

-- check the number of rows updated
-- if rows_updated = number of seats requested: COMMIT  (all seats are ours)
-- otherwise: ROLLBACK (someone else got at least one; tell the user 409)
```

Why it works: the `WHERE status = 'available'` check and the `SET status = 'held'` happen in the same statement. When two transactions update the same row, the database **locks the row**: the second transaction waits until the first commits, then re-checks the `WHERE` condition, sees the status is now `held`, and updates **0 rows**. Exactly one of them wins. No application-level locking is needed. Because it is done in one transaction (all-or-nothing), a user can never end up holding only some of the seats they asked for. Seat ids are always updated in sorted order to avoid **deadlocks** between two users who ask for overlapping seats.

### Layer 2: Re-check inside a transaction when paying

When the payment succeeds (webhook or checkout), we confirm the sale in a single transaction:

```sql
BEGIN;

SELECT seat_id FROM event_seats
WHERE  hold_id = :hold_id AND held_by = :user_id
  AND  status = 'held' AND hold_expires_at > now()
FOR UPDATE;                                -- lock these rows

-- if the number of rows is not the number of seats in the order: ROLLBACK and refund

INSERT INTO tickets (order_id, seat_id, user_id, ...) VALUES ...;   -- one row per seat
UPDATE event_seats SET status = 'sold', version = version + 1 WHERE hold_id = :hold_id;
UPDATE orders SET status = 'paid' WHERE order_id = :order_id;

COMMIT;
```

This guarantees the person who pays is the person who holds, and the hold has not expired or been given to someone else. Order creation and ticket creation succeed or fail together (**atomicity**).

### Layer 3: Constraints as the last line of defence

- `tickets.seat_id` is **UNIQUE**: even if there is a bug in the application code, the database refuses to create a second ticket for the same seat and the transaction fails.
- `event_seats` has a **CHECK** on `status` values and a UNIQUE on `(event_id, section, row_label, seat_number)`.
- `orders.idempotency_key` is **UNIQUE**, so a double-click or retry cannot create two orders or charge twice.

### Extra points

- **Holds expire:** a background worker (and the `OR expired` condition above) frees seats whose `hold_expires_at` has passed, so abandoned carts do not lock seats forever.
- **Payment arrives after the hold expired:** the Layer 2 check fails, the order is marked failed, and the payment is **refunded automatically**. This is rare because the hold lasts longer than the payment normally takes, and the hold can be extended while a payment is in progress.
- **The cache is never the source of truth:** the seat map shown to users may be a few seconds old, so a user may click a seat that was just taken. That is fine, because the database check in Layer 1 rejects it with 409 and the user picks another seat. A stale cache can cause a disappointed click, but never a double sale.
- **Isolation level:** `READ COMMITTED` plus the row locks above is enough, because each claim is a single-row conditional update. We avoid `SERIALIZABLE` for the hot path since it would cause many retries under load.

---

## 5. Architecture

```
                         +----------------------+
                         |       Clients        |
                         |    (web / mobile)    |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |   CDN + WAF / bot    |  caches event pages, images, JS/CSS;
                         |   protection         |  blocks bots, rate-limits per IP
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |    Load Balancer     |
                         +----+------------+----+
                              |            |
                 browse / seat map         | hold / checkout (sale traffic)
                              |            v
                              |   +----------------------+
                              |   |    Waiting Room      |  admits users in arrival order at a
                              |   |  (virtual queue,     |  safe rate (e.g. 500/s), issues a
                              |   |   Redis-backed)      |  queue_token
                              |   +----------+-----------+
                              |              |
                              v              v
                    +--------------------------------+
                    |   App Servers (stateless,      |  auto-scaled, pre-warmed before
                    |   many copies)                 |  the sale
                    +---+------------+-----------+---+
                        |            |           |
        +---------------+     +------+------+    +----------------+
        v                     v             v                     v
  +-----------+   +--------------------+  +-----------------+  +--------------------+
  |   Cache   |   |  Database primary  |  |  Message queue  |  |  Payment provider  |
  |  (Redis)  |   |  (seats, orders,   |  |  (payments,     |  |  (external; holds  |
  | seat map, |   |   tickets)         |  |   emails)       |  |   card data)       |
  | event data|   +---------+----------+  +--------+--------+  +---------+----------+
  +-----------+             |                      |                     |
                            v                      v                     |
                  +--------------------+   +----------------+            |
                  |   Read replicas    |   |    Workers     |<-----------+ webhook
                  |  (browse, my       |   | - confirm pay  |
                  |   tickets)         |   | - expire holds |
                  +--------------------+   | - send emails  |
                                           +----------------+

        +------------------------------+
        |   Object storage             |  event images, QR code images
        |   (served through the CDN)   |
        +------------------------------+
```

### Components, one explanation each

- **CDN:** Serves event pages, images and static files from servers near the user, so most of the 3,333 page views per second never reach our servers.
- **WAF / bot protection and rate limiting:** Blocks bots and limits requests per IP and per account so one person (or script) cannot flood the sale or grab seats unfairly.
- **Load balancer:** Spreads requests across many app servers and removes unhealthy ones, so no single server is overwhelmed or a single point of failure.
- **Waiting room (virtual queue):** Puts the 200,000 arrivals in a first-come first-served line and lets them in at a rate the database can safely handle, which protects the system and makes the sale fair.
- **App servers (stateless):** Run the API logic and can be multiplied quickly because they keep no state themselves, so we add more before the sale.
- **Cache (Redis):** Holds event data and the seat map (refreshed every 1 to 2 seconds) so thousands of "view seats" requests per second do not hit the database.
- **Database primary (PostgreSQL):** The single source of truth for seats, orders and tickets; its transactions and constraints are what guarantee no double-booking.
- **Read replicas:** Serve read-only queries such as event lists and "my tickets" so the primary only does the critical seat writes.
- **Message queue:** Takes slow work (payment confirmation handling, emails, QR generation) off the request path so the user gets a fast response and bursts are smoothed out.
- **Workers:** Process queue jobs: confirm payments from webhooks, expire old holds, send confirmation emails, and retry failures.
- **Payment provider:** An external service that handles card data and charging, so we never store card numbers and our security burden is smaller.
- **Object storage:** Stores event images and ticket QR images cheaply and durably, served through the CDN.

### How the design survives the big sale

1. **Before the sale:** the event page, details and images are cached on the CDN. App servers and cache are scaled up in advance (pre-warmed), because auto-scaling reacts too slowly to a spike that arrives in seconds. The database connection pool is sized for the expected number of hold requests.
2. **Waiting room absorbs the spike:** the 333 arrivals per second wait in a cheap queue (just a page and a counter, not the database). Users are let through at about 500 per second, so the database sees a steady, safe load of about 1,000 hold attempts per second instead of an uncontrolled spike of 5,000.
3. **Seat map from cache:** seat map reads are served from Redis (1 to 2 seconds old), so the 10,000 API calls per second mostly never reach the database.
4. **Only the critical writes reach the database:** only the hold and the purchase touch the primary. Each is a short single-row transaction (a few milliseconds), and the volume is about 1,000 hold writes per second and 33 purchases per second, which a well-indexed PostgreSQL primary can handle. The heavy rows are separate per event, so a hot concert does not slow down other events (and could be moved to its own database if needed).
5. **Fail fast and tell the user:** since 90% of people cannot get a seat, the hold endpoint returns `409` immediately, and once the event is sold out a flag in Redis makes the API answer "sold out" without touching the database at all.
6. **Slow work is asynchronous:** payment confirmation, emails and expiry run in workers via the queue, so a slow email service or payment provider cannot block seat sales.
7. **Graceful degradation:** if the system is overloaded, we stop admitting people from the waiting room, serve a static "high demand" page from the CDN, and keep already-held seats safe. Browsing other events keeps working because it is served by the CDN, cache and replicas.
8. **Monitoring:** dashboards and alerts on request rate, error rate, database CPU and connections, queue length, and seats held vs sold, plus a load test with about 200,000 simulated users before launch.

---

## 6. Trade-offs

1. **Waiting room: fairness and safety vs. user experience.** The virtual queue protects the database and makes the sale fair, but users must wait and may be frustrated or leave. It also adds a component to build and operate. We accept this because without it the site would crash for everyone, which is worse than waiting.

2. **Cached seat map: speed vs. freshness.** A cache that is 1 to 2 seconds old lets us serve thousands of views per second cheaply, but users will sometimes click a seat that is already gone and see an error. We accept this because correctness is protected by the database check at hold time, and a disappointed click is much better than a slow or crashed site.

3. **One strongly consistent primary database vs. sharding or a NoSQL store.** A single primary with transactions and constraints is simple and makes double-booking very easy to prevent, but it is a limit on write throughput. For 1,000 hold writes per second this is enough, and we can partition by `event_id` later if we grow. A distributed store would scale writes further but would make "exactly one winner per seat" much harder to guarantee.

4. **Hold duration: fairness to the buyer vs. availability of seats.** A long hold (for example 10 minutes) gives users time to pay but lets people who abandon their cart block seats from others. A short hold (for example 2 minutes) frees seats faster but may expire while someone is typing card details. We chose 5 minutes, extended while a payment is in progress, as a middle ground.

5. **Database row locks (pessimistic) vs. optimistic locking.** Using the conditional `UPDATE` means one winner is decided immediately with very short locks and no retries needed. Optimistic locking with a version number would avoid locks but cause many failed retries when thousands compete for the same seats. We pick the conditional update because contention is extremely high on sale day.

6. **Asynchronous payment confirmation vs. instant confirmation.** Handling the payment result through a webhook and a queue keeps the site fast and resilient, but the user sees "processing" for a moment and we must handle the rare case of a payment that arrives after the hold expired (by refunding). The complexity is worth the resilience.

---

## Summary

TicketHub is easy on a normal day (about 6 page views and 0.06 purchases per second) but about 575 times busier during a big sale (about 3,300 page views and 33 purchases per second, with 10 people fighting for each seat). The design uses a CDN, a waiting room, stateless app servers, a cache and read replicas to absorb the crowd, and keeps all seat-claiming inside short database transactions. Double-booking is prevented by an atomic conditional update at hold time, a locked re-check at payment time, and UNIQUE constraints as a final safety net.
