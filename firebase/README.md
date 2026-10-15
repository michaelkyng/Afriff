# Firebase backend

AFRIFF runs on Firebase: **Auth** for accounts (email and password), **Firestore**
for data, **Cloud Functions** (2nd gen) for everything that moves money or stock,
**Paystack** for payment, **Brevo** for email and **Cloud Messaging** for push. Three apps use it: the attendee
PWA (`apps/pwa`), the door scanner (`apps/scanner`) and the Ops Console
(`apps/ops`). Each can still run entirely on the local mock
(`NUXT_PUBLIC_API_MODE=mock`); each talks to one contract (`AttendeeApi`,
`DoorApi`, `OpsApi`) with a mock and a Firebase adapter, so no page knows which
one it is talking to.

```text
firebase.json               emulators, rules, indexes, functions source, hosting
.firebaserc                 project aliases (default: demo-afriff, emulator only)
firebase/
  firestore.rules           who may read and write what
  firestore.indexes.json    the expiry job's composite index, and the push queries' collection-group indexes
  tests/                    rules tests, run against the emulator
apps/functions/             @afriff/functions: the Cloud Functions
  src/orders.ts             checkout, payOrder, verifyOrder, settle
  src/webhook.ts            paystackWebhook
  src/expire.ts             expireOrders (every 10 minutes)
  src/tickets.ts            transferTicket, claimTickets
  src/door.ts               checkIn (staff only)
  src/ops/                  ops: every change the Ops Console makes, with the activity log
  src/mail/                 Brevo client, templates, the outbox trigger
  src/push/                 pushUpdates, pushScheduledUpdates, sendReminders, and the FCM sender
  scripts/seed.ts           loads the catalogue into Firestore
  scripts/staff.ts          gives festival staff a role (until the Ops Console can)
  build.ts                  bundles into dist/ (what deploys)
packages/firebase/          @afriff/firebase: browser SDK set-up, emulator wiring, the push token helper
packages/api/src/firebase/  the AttendeeApi, DoorApi and OpsApi adapters, and the shared Firestore schema
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
Ops → useOps() → Firebase ops adapter ───────┬─ Firestore (ops/admin may read orders, tickets, mail, audit)
                                             └─ ops ─────────────────── every change, checked and logged
                                                 │
Paystack ── webhook ─→ paystackWebhook ──────────┤   (Admin SDK: rules do not apply, so every write is checked here)
                                                 └─→ mail/{id} ─→ sendMail ─→ Brevo

updates/{id} ─→ pushUpdates, pushScheduledUpdates ─┐
screenings, events ─→ sendReminders (every 5 min) ─┴─→ users/*/devices ─→ Cloud Messaging ─→ the app's service worker
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
| `users/{uid}` | the owner; ops | create once (email must match the sign-in, names consistent, server timestamps); update names and phone only |
| `users/{uid}/saved/{kind_refId}` | the owner | create if the film, screening or event exists; delete; never update |
| `users/{uid}/devices/{deviceId}` | the owner | the owner: a token, the three kinds, up to 200 reminders and the server's time; delete |
| `orders/{id}` | the owner, by id or `where userId ==`; ops | functions only |
| `tickets/{id}` | the owner; a **confirmed** email it is waiting for; ops | functions only |
| `doorStats/{sessionKey}` | staff (a `role` claim) | functions only |
| `checkins`, `mail`, `paymentEvents`, `audit`, `staff` | ops | functions only |
| `pushLog` | nobody | functions only |

"Ops" means a `role` claim of `ops` or `admin`. Door staff read only the counts.

Prices, stock, payment outcomes and tickets are decided only on the server. The
app never sees a card number: attendees pay in Paystack's checkout. A Firebase web
config is public by design; what protects the data is the rules and the functions.

`bun run test:rules` runs 34 tests against the emulator, including the attacks that
matter: editing stock, marking an order paid, claiming someone else's waiting
ticket with an unconfirmed address, writing to the mail outbox, a made-up staff
role, staff writing check-ins or reading attendees' tickets directly, and
writing to someone else's devices.

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

## Push with Cloud Messaging

The attendee app turns push on from Me (or with the first reminder bell in My
Festival). It asks the browser for permission, gets a token from Cloud Messaging
through its own service worker, and saves the device under the account in
`users/{uid}/devices/{deviceId}`: the token, the kinds it wants (`changes`,
`reminders`, `festival`) and the plan keys it wants reminders for. Reminder
changes follow it there; signing out removes the device and drops the token.
The rules in `@afriff/api/push` decide what goes and what it says, shared with
the tests.

- **Urgent updates.** `pushUpdates` runs when an update is written;
  `pushScheduledUpdates` (every 5 minutes) catches updates set for later. An
  update about a screening, event, venue or film goes to devices wanting
  `changes` whose owner holds a ticket for it (void tickets of a cancelled
  screening included, finished slots not) or saved it: the same people the app
  marks "Affects you". One about nothing in particular goes to every device
  wanting `festival`. Only within 30 minutes of its publish time, so a reseed
  or a late run never pushes old news. `pushLog/update_<id>` is claimed with
  `create` first, so the trigger and the schedule cannot both send it, and an
  edit does not send it again.
- **Reminders.** `sendReminders` (every 5 minutes) finds the screenings and
  events starting 25 to 35 minutes from now, skips cancelled ones, and pushes to
  the devices that asked for each (`reminders` array-contains the plan key) and
  want `reminders`. Each slot falls in two runs, so a late or skipped run still
  reminds everyone; `pushLog/reminder_<slot>_<uid>_<deviceId>` keeps it to one
  each.
- **Messages are data only** (title, body, path, tag). The app's service worker
  (`apps/pwa/public/push-sw.js`) shows them, replaces one with the same tag, and
  on a tap moves the open window to the path, or opens one. A path off the site
  opens the home page instead. FCM's own service worker is never installed.
- **Dead tokens** (app uninstalled, permission withdrawn) are deleted when FCM
  says so on a send.
- **iPhone and iPad** receive web push only in the app added to the Home Screen,
  on iOS 16.4 or later. Me tells them how.

`PUSH_TRANSPORT=log` writes pushes to the function logs instead of sending them
(for a staging project without a Web Push certificate). The emulators always
log them, since there is no Cloud Messaging emulator. The emulators do not run
scheduled functions either: `pushScheduledUpdates` and `sendReminders` only run
deployed, while `pushUpdates` runs locally too.

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

## The Ops Console

Ops reads straight from Firestore and makes every change through one callable,
`ops`, which validates the request with the shared schemas
(`opsActionSchema`), checks the caller's role (staff changes are admin-only,
and nobody can change their own role), applies it, and writes an entry to
`audit` with who did it. See `apps/ops/README.md` for what each page does.

- **Moving a screening** updates the screening and every ticket for it (tickets
  carry a copy of the time and place). **Cancelling** voids its single tickets
  with a reason the holder sees and sets `refundDue` on their orders. Both
  return a drafted, urgent update about the screening; publishing it can also
  queue an `update_notice` email to each order holding a ticket for it.
- **Staff** live in `staff/{uid}`, kept in step with the claim by the function
  and by `bun run staff`. Inviting someone makes their account if needed and
  emails a set-password link (`staff_invite`); set `OPS_URL` and `DOOR_URL` in
  the functions' parameters so the email says where to sign in.
- **Refunds** are made in the Paystack dashboard, then marked in Ops with a note.

The first admin has to come from the script, since only an admin can make another:

```sh
bun run staff -- --email you@afriff.com --role admin --project <id> --yes
```

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

and `bun run dev:pwa`. For the scanner and the Ops Console, do the same in
`apps/scanner/.env` and `apps/ops/.env`, give yourself accounts
(`bun run staff -- --email door@afriff.test --role door`, and `--role admin` with
`--password` for Ops), and run `bun run dev:scanner` or `bun run dev:ops`. Notes:

- `demo-afriff` is an emulator-only project: nothing reaches Google, and the CLI
  refuses to deploy to it.
- Reset and confirmation links are not emailed by the Auth emulator; they are in
  the Emulator UI under Authentication, and printed by the emulator.
- Paystack cannot reach your machine, so its webhook never arrives locally. The
  app's `verifyOrder` call settles payments anyway. To test the webhook itself,
  expose port 5001 with a tunnel and point a test-mode webhook at it.
- For changes to function code, run `bun run --filter @afriff/functions dev` in
  another terminal; the emulator reloads the rebuilt bundle.
- Push needs a real project: against the emulators the app offers none, and
  the functions log what they would have sent (see above).

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
   `APP_URL`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO`,
   `MAIL_TRANSPORT=brevo` and `PUSH_TRANSPORT=fcm` (see `.env.example`).
   **Push:** under *Project settings > Cloud Messaging*, generate a **Web Push
   certificate** key pair. Put its public key in the PWA's
   `NUXT_PUBLIC_FIREBASE_VAPID_KEY`, and the *Sender ID* in
   `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`. The scheduled functions use
   Cloud Scheduler, which the Blaze plan includes.
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
11. **Staff:** make the first admin with `bun run staff` (above); they add
    everyone else from the Ops Console's Staff page.
12. **Hosting (optional):** `firebase.json` has three targets, `attendee` (the
    PWA), `door` (the scanner) and `ops` (the console), each on its own site.
    Create the extra sites in the console, then map them once per project:
    ```sh
    bun run firebase target:apply hosting attendee <attendee-site-id> --project <id>
    bun run firebase target:apply hosting door <door-site-id> --project <id>
    bun run firebase target:apply hosting ops <ops-site-id> --project <id>
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
| `bun run dev:ops` | The Ops Console on localhost:3002 |
| `bun run deploy:rules` | Deploy rules and indexes |
| `bun run deploy:functions` | Deploy the functions (builds first) |
| `bun run deploy:hosting` | Generate and deploy the PWA, the scanner and the console |
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
| Push devices per install, under the account | A notification belongs to a phone, not a person: each device chooses its kinds and reminders, and leaves with sign-out. |
| Data-only push, shown by the app's own service worker | One service worker for offline and push, one place deciding how a notification looks and where a tap goes. |
| Only urgent updates are pushed, within 30 minutes | Interrupting someone has to be worth it, and old news must never arrive late. |
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
