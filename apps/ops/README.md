# AFRIFF Ops

The festival team's console: the programme, updates, orders, products and staff.
It runs on the local mock or on Firebase (`NUXT_PUBLIC_API_MODE`) through one
contract, `OpsApi` in [`@afriff/api/ops`](../../packages/api/src/ops.ts).

```sh
bun run dev:ops        # http://localhost:3002
```

**Mock mode** (the default) signs in as the demo admin (`ops@afriff.test` /
`ops-demo-1`, offered on the sign-in screen) and comes with made-up orders to
work with: paid, waiting, failed, and two needing a refund. Changes stay in the
browser; the attendee app's mock runs on another origin and does not see them.

**Against the emulators:** start them, give yourself an admin account, and set
the emulator lines from `.env.example` in `apps/ops/.env`:

```sh
bun run staff -- --email you@afriff.test --role admin --password <choose one>
```

Changes made here then show in the attendee app pointed at the same emulators.

## What it does

| Page | For |
| --- | --- |
| Overview | Paid orders, takings, tickets issued, payments in progress, refunds due; the orders and changes since |
| Programme | Screenings by day. Move one (new time or screen, keeping its length) or cancel it, then tell the people it affects |
| Updates | What attendees see under Updates: write, schedule, edit and delete. Urgent ones raise a banner for ticket holders |
| Orders | Find an order by reference, ticket code or email. Resend the confirmation, void a ticket or give it a new code, and mark refunds done |
| Products | Price, stock left to sell, and the per-order limit |
| Staff | Who can scan and who can use Ops. Admins invite people and change roles |
| Activity | Every change made in Ops, by whom, and when |

**Moving a screening** brings every ticket for it up to date (time, place and
the line under the title), because tickets carry their own copy so they open
offline. **Cancelling** voids its single tickets with a reason the holder sees,
and lists their orders under Refunds due; passes are untouched. Either way, the
console then offers a drafted, urgent update about that screening. People
holding a ticket for it get a banner in the app, and can also be emailed.

**Refunds** are made in Paystack's dashboard for now, then marked here with a
note. The server lists an order under Refunds due when money lands without
tickets (a payment after the hold lapsed and stock ran out), for a second
payment on a paid order, for a cancelled screening, or when a voided ticket is
refunded.

## How it is built

- **Reads** come straight from Firestore. The rules let `ops` and `admin` staff
  read orders, tickets, profiles, mail, check-ins and the activity log; door
  staff and attendees cannot.
- **Changes** go through one callable function, `ops`, which checks the request
  against the shared schemas and the caller's role, applies it, and writes an
  entry to `audit`. Nothing in the console writes to Firestore directly.
- The rules for moving, the drafted wording and who may do what live in
  `@afriff/api/ops`, shared by the mock and the function.
- Staff management is for admins only, and nobody can change their own role.

Editing films, venues, sections and events is not here yet; the seed script
loads them.
