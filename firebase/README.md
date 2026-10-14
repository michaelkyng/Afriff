# Firebase backend

AFRIFF runs on Firebase: **Auth** for accounts (email and password), **Firestore**
for data, **Cloud Functions** (2nd gen) for everything that moves money or stock,
**Paystack** for payment and **Brevo** for email. Two apps use it: the attendee
PWA (`apps/pwa`) and the door scanner (`apps/scanner`). Both can still run
entirely on the local mock (`NUXT_PUBLIC_API_MODE=mock`); each talks to one
contract (`AttendeeApi`, `DoorApi`) with a mock and a Firebase adapter, so no page
knows which one it is talking to.

```text
firebase.json               emulators, rules, indexes, functions source, hosting
.firebaserc                 project aliases (default: demo-afriff, emulator only)
firebase/
  firestore.rules           who may read and write what
  firestore.indexes.json    the composite index the expiry job needs
  tests/                    rules tests, run against the emulator
apps/functions/             @afriff/functions: the Cloud Functions
  src/orders.ts             checkout, payOrder, verifyOrder, settle
  src/webhook.ts            paystackWebhook
  src/expire.ts             expireOrders (every 10 minutes)
  src/tickets.ts            transferTicket, claimTickets
  src/door.ts               checkIn (staff only)
  src/mail/                 Brevo client, templates, the outbox trigger
  scripts/seed.ts           loads the catalogue into Firestore
  scripts/staff.ts          gives festival staff a role (until the Ops Console can)
  build.ts                  bundles into dist/ (what deploys)
packages/firebase/          @afriff/firebase: browser SDK set-up and emulator wiring
packages/api/src/firebase/  the AttendeeApi and DoorApi adapters, and the shared Firestore schema
```

## How a request travels

```text
PWA page → useApi() → Firebase adapter ─┬─ Firebase Auth             accounts, sessions, reset and confirm links
                                        ├─ Firestore (rules apply)   catalogue, profile, saved list, own orders and tickets
                                        └─ callable functions ─────── checkout, payOrder, verifyOrder, transferTicket, claimTickets
                                                 │
Scanner → useDoor() → Firebase door adapter ─┬─ Auth (staff `role` claim)
                                             ├─ Firestore doorStats ─── live count
                                             └─ checkIn ─────────────── judges each scan
                                                 │
Paystack ── webhook ─→ paystackWebhook ──────────┤   (Admin SDK: rules do not apply, so every write is checked here)
                                                 └─→ mail/{id} ─→ sendMail ─→ Brevo
```

`packages/api/src/firebase/schema.ts` is the single description of collections,
document shapes and callable signatures. The adapter, the functions, the seed
script and `firestore.rules` all follow it; change them together.

## Security model

The browser talks to Firestore directly, so the rules are the security boundary.
They allow exactly this, and deny everything else:

| Collection | Read | Write |
| --- | --- | --- |
| `festival`, `venues`, `sections`, `films`, `screenings`, `events`, `products`, `info`, `updates` | anyone | Admin SDK only (seed script; functions for stock) |
| `users/{uid}` | the owner | create once (email must match the sign-in, names consistent, server timestamps); update names and phone only |
| `users/{uid}/saved/{kind_refId}` | the owner | create if the film, screening or event exists; delete; never update |
| `orders/{id}` | the owner, by id or `where userId ==` | functions only |
| `tickets/{id}` | the owner; or a **confirmed** email it is waiting for | functions only |
| `doorStats/{sessionKey}` | staff (a `role` claim) | functions only |
| `checkins`, `mail`, `paymentEvents` | nobody | functions only |

Prices, stock, payment outcomes and tickets are decided only on the server. The
app never sees a card number: attendees pay in Paystack's checkout. A Firebase web
config is public by design; what protects the data is the rules and the functions.

`bun run test:rules` runs 27 tests against the emulator, including the attacks that
matter: editing stock, marking an order paid, claiming someone else's waiting
ticket with an unconfirmed address, writing to the mail outbox, a made-up staff
role, and staff writing check-ins or reading attendees' tickets directly.

## Payments with Paystack

1. **Checkout** (`checkout` callable). The server prices the cart from the
   catalogue, checks the per-order limits and live stock, and takes the stock in
   one transaction. It then opens a Paystack transaction (reference `AF-XXXXX-1`)
   and returns its access code. Tickets are held for 30 minutes
   (`ORDER_HOLD_MINUTES`); an attendee can have at most 3 unpaid orders.
2. **Pay.** The app opens Paystack's inline checkout with the access code
   (`@paystack/inline-js`, `resumeTransaction`). If it cannot load, the app sends
   the attendee to Paystack's hosted page instead, which returns them to
   `/orders/<id>?reference=…`.
3. **Settle.** Two independent paths apply the outcome through one idempotent
   function, `settle`:
   - Paystack's **webhook** (`charge.success`, signature checked with HMAC-SHA512);
   - the app calling **`verifyOrder`** when the checkout closes, which asks Paystack.

   A successful payment issues one ticket per seat and queues the confirmation
   email in the same transaction. A failed one gives the stock back.
4. **Expiry.** `expireOrders` checks unpaid orders past their hold with Paystack
   first, so a lost webhook is settled rather than expired, then releases the stock.

Edge cases are flagged rather than guessed at: a payment that arrives after its
hold lapsed and the stock sold out, an amount that does not match the order, or a
second payment on a paid order sets `refundDue` on the order and logs an error.
Refunds are made by the team in the Paystack dashboard for now.

## Email with Brevo

- **Transactional email** (order confirmation, a ticket passed on) is written to
  the `mail` collection inside the transaction that caused it, and `sendMail`
  delivers it through Brevo's API, retrying temporary failures. Templates live in
  `apps/functions/src/mail/templates.ts`, so they are reviewed and tested with the
  code. `MAIL_TRANSPORT=log` writes them to the logs instead.
- **Account email** (password reset, email confirmation) is sent by Firebase Auth
  itself, which rate-limits it. Route it through Brevo with Firebase's SMTP
  setting (below), so all festival email comes from one sender and one reputation.

## The door

The scanner signs staff in with Firebase Auth. What makes someone staff is a
`role` custom claim (`door`, `ops` or `admin`), set with:

```sh
bun run staff -- --email door1@afriff.com --role door --name "Landmark door 1" --project <id> --yes
bun run staff -- --email door1@afriff.com --remove --project <id> --yes
```

A new account gets a random password, and the script prints a link for them to
choose their own. In the emulators it gets `--password`, or `door-demo-1`.

Each scan goes to `checkIn`, which reads the ticket, its check-in for the
session and the running count in one transaction, and judges it with the
shared rules in `@afriff/api/door` (the same ones the mock uses; see
`apps/scanner/README.md`). It writes `checkins/{sessionKey}_{ticketId}`,
increments `doorStats/{sessionKey}`, and marks a single-admission ticket `used`
with the time, which the attendee's app shows.

Taking a role away also ends the person's sessions, so a fresh sign-in is
refused at once. A phone already signed in keeps its current ID token, which
Firebase issues for an hour, so it can go on scanning until that token
expires. If that window matters, `checkIn` can check revocation on each scan
(`verifyIdToken(token, true)`) for the cost of one more call per scan.

In the emulators only, `checkIn` honours the scanner's rehearsal clock (`at`),
so festival week can be practised before it happens. A deployed function always
uses its own clock.

## Local development

Needs Java 21+ for the Firestore emulator (`java -version`).

```sh
cp apps/functions/.env.example apps/functions/.env
cp apps/functions/.secret.local.example apps/functions/.secret.local
# In .env: MAIL_TRANSPORT=log. In .secret.local: a Paystack TEST key (sk_test_…).

bun run emulators          # builds the functions, starts Auth, Firestore, Functions and the UI (localhost:4000)
bun run emulators:seed     # in another terminal: loads the placeholder catalogue
```

Then point the app at the emulators in `apps/pwa/.env` (see its `.env.example`):

```sh
NUXT_PUBLIC_API_MODE=firebase
NUXT_PUBLIC_FIREBASE_PROJECT_ID=demo-afriff
NUXT_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1
```

and `bun run dev:pwa`. For the scanner, do the same in `apps/scanner/.env`, give
yourself a door account (`bun run staff -- --email door@afriff.test --role door`)
and run `bun run dev:scanner`. Notes:

- `demo-afriff` is an emulator-only project: nothing reaches Google, and the CLI
  refuses to deploy to it.
- Reset and confirmation links are not emailed by the Auth emulator; they are in
  the Emulator UI under Authentication, and printed by the emulator.
- Paystack cannot reach your machine, so its webhook never arrives locally. The
  app's `verifyOrder` call settles payments anyway. To test the webhook itself,
  expose port 5001 with a tunnel and point a test-mode webhook at it.
- For changes to function code, run `bun run --filter @afriff/functions dev` in
  another terminal; the emulator reloads the rebuilt bundle.

## Setting up a project

Do this once per environment (staging, production). Cloud Functions with
outbound calls need the Blaze plan.

1. **Create the project** and add a **Web app**; copy its config into the PWA's
   environment (`NUXT_PUBLIC_FIREBASE_*`). Add an alias: `bun run firebase use --add`.
2. **Firestore:** create the database in a location near Lagos users; the
   functions run in `europe-west1`, so `eur3` or `europe-west1` keeps them close.
3. **Authentication:** enable **Email/Password**. Keep **email enumeration
   protection** on (the default). Under *Settings > Authorized domains* add the
   app's domain. If the project uses Identity Platform, set a password policy with
   a minimum of 8 characters to match the app.
4. **Auth email through Brevo:** *Authentication > Templates > SMTP settings*:
   host `smtp-relay.brevo.com`, port `587`, STARTTLS, your Brevo SMTP login and
   SMTP key, and a sender on a domain verified in Brevo.
5. **Links back into the app:** in each Auth email template, *Customize action
   URL* to `https://<app domain>/auth/action`, so resets and confirmations finish
   in the app (`apps/pwa/app/pages/auth/action.vue`).
6. **Function parameters:** create `apps/functions/.env.<project-id>` with
   `APP_URL`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO` and
   `MAIL_TRANSPORT=brevo` (see `.env.example`).
7. **Secrets:**
   ```sh
   bun run firebase functions:secrets:set PAYSTACK_SECRET_KEY --project <id>   # sk_test_… on staging, sk_live_… in production
   bun run firebase functions:secrets:set BREVO_API_KEY --project <id>
   ```
8. **Deploy:** `bun run firebase deploy --only firestore,functions --project <id>`.
9. **Paystack webhook:** in the Paystack dashboard (*Settings > API Keys &
   Webhooks*, test or live as appropriate) set the webhook URL to
   `https://europe-west1-<project-id>.cloudfunctions.net/paystackWebhook`.
10. **Catalogue:** on staging, `bun run emulators:seed -- --project <id> --yes`
    loads the placeholder data. Production gets the real edition the same way,
    from its own data. Seeding resets stock, so it refuses a project with orders
    unless `--force` is added.
11. **Staff:** give each door team member a role with `bun run staff` (above).
12. **Hosting (optional):** `firebase.json` has two targets, `attendee` (the PWA)
    and `door` (the scanner), on separate sites. Create a second site in the
    console, then map them once per project:
    ```sh
    bun run firebase target:apply hosting attendee <attendee-site-id> --project <id>
    bun run firebase target:apply hosting door <door-site-id> --project <id>
    ```
    Set each app's environment, then `bun run firebase deploy --only hosting --project <id>`.
    The builds bake the environment in, so build once per project.

`.firebaserc` defaults to `demo-afriff`, so a deploy without `--project` (or an
alias) fails instead of reaching the wrong project.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run emulators` | Build the functions and start the emulators |
| `bun run emulators:seed` | Load the placeholder catalogue (emulator by default) |
| `bun run build:functions` | Bundle the functions into `apps/functions/dist` |
| `bun run test:rules` | Firestore rules tests against the emulator (needs Java) |
| `bun run staff -- --email … --role door` | Give someone a staff role (emulator by default) |
| `bun run dev:scanner` | The door scanner on localhost:3001 |
| `bun run deploy:rules` | Deploy rules and indexes |
| `bun run deploy:functions` | Deploy the functions (builds first) |
| `bun run deploy:hosting` | Generate and deploy the PWA and the scanner |
| `bun run firebase <command>` | The pinned Firebase CLI |

Pass `--project <id>` (or use an alias) to every deploy.

## Decisions and follow-ups

| Decision | Why |
| --- | --- |
| Functions bundled with Bun into `dist/` | Firebase installs dependencies with npm in the cloud, which cannot resolve `workspace:*`. Only the Firebase SDKs stay external. |
| Order rules shared with the mock (`@afriff/api/orders`) | The demo and the server price, validate and issue tickets with the same code. |
| Webhook and `verifyOrder` both settle, idempotently | Neither alone is reliable: webhooks get lost, browsers get closed. |
| Holds expire after 30 minutes, max 3 unpaid orders | Abandoned checkouts must not keep tickets off sale. |
| Mail outbox in Firestore | An order is never paid without its email being queued, and Brevo outages retry. |
| Firestore offline cache on the device | Tickets open with no connection. It persists after sign-out, as Firebase's default does; clear it on sign-out if shared devices become a concern. |

Worth doing before launch:

- **App Check** (reCAPTCHA Enterprise) on the callables, to make abuse of
  `checkout` from scripts harder.
- **Signed ticket QR codes** for the scanner (the payload is shaped for it, but
  unsigned).
- **Refund handling**: act on `refundDue` (a dashboard query today) and on
  Paystack's `refund.processed` webhooks.
- **Account deletion** (NDPR): a function that deletes the profile, saved list
  and Auth user, keeping orders the law requires.
- A cap on saved items is enforced by the adapter, not by the rules; a counter
  document would make it hard.
