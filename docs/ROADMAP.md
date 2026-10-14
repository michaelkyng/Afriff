# AFRIFF Roadmap

What is built, what is in progress, and the order for the rest. Marked against the code on **14 October 2026**: commit `adf95c8`, plus the Firebase backend and the scanner in the working tree, which have not been committed yet.

The attendee PWA's screen-by-screen log is in [ROADMAP-attendee-fe.md](ROADMAP-attendee-fe.md).

**Status key:** ✅ Done · 🟡 In progress · ⬜ Not started

---

## The platform

| Part | What it does | Where |
|---|---|---|
| Attendee PWA | Programme, tickets, checkout, My Festival, updates and info for festival-goers | `apps/pwa` |
| Scanner | Door staff check tickets in | `apps/scanner` |
| Ops Console | The festival team runs the programme, orders, tickets and updates | `apps/ops` (planned) |
| Backend | Firebase Auth, Firestore and Cloud Functions | `apps/functions` and `firebase/`. The browser side is in `packages/api/src/firebase` and `packages/firebase` |
| Shared | Types, API contract, mock adapter, order and ticket rules, validation, UI kit | `packages/api`, `packages/validation`, `layers/ui-kit` |

**Third-party services**

- **Firebase:** accounts, data and server functions. Firebase Auth also sends the account emails (confirm your address, reset your password).
- **Paystack:** payments.
- **Brevo:** order and ticket emails.

---

## What changed from the original plan

| Original plan | Now |
|---|---|
| Supabase (Postgres, RLS, Edge Functions) | Firebase (Firestore, security rules, Cloud Functions). Supabase has been removed |
| Attendee sign-in an open question, later a six-digit PIN | Email and password, with a link to confirm the email and a link to reset the password |
| Passes issued to attendees, one pass card each | Attendees buy passes and tickets, and each ticket has its own QR code |
| Sessions | Screenings and events |
| Tabs: Today, Schedule, Pass, Alerts | Tabs: Home, Programme, Tickets, Me. Updates, My Festival and Info open from Me |
| Paid sessions in phase 2 | Buying is the PWA's main flow, so Paystack is needed for launch |
| 15-minute payment hold | 30-minute hold, and at most 3 unpaid orders per attendee |
| One app with `/`, `/scan` and `/ops` | Separate apps under `apps/`, sharing the UI kit and the API package |

---

## Summary

| Phase | Status |
|---|---|
| 1. Attendee PWA on mock data | ✅ |
| 2. Shared layer on Firebase and Paystack | 🟡 Passing, waiting to be committed |
| 3. PWA on the new contract | ✅ |
| 4. Firebase backend | 🟡 Built and verified on the emulators. A run against Paystack's real test mode needs the test keys (phase 5) |
| 5. Attendees live | ⬜ Needs the Firebase projects, the Paystack and Brevo accounts, and real content |
| 6. Scanner | ✅ Built and verified on the emulators. Not yet tried on the door phones |
| 7. Ops Console | ⬜ |
| 8. Push notifications | ⬜ |
| 9. Live ops and offline scanning | ⬜ |
| 10. Hardening and launch | ⬜ |
| Alongside: PWA polish (F9) | ⬜ |

---

## Next up

1. **Commit** phases 2 to 4 and 6, which are in the working tree.
2. **Phase 5 set-up**, which needs the festival's accounts: staging and production Firebase projects, the Paystack test and live keys, a Brevo sender domain, then the checklist in [firebase/README.md](../firebase/README.md#setting-up-a-project). A run on staging with a Paystack test card closes phase 4.
3. **Try the scanner on the door phones**, over HTTPS, in the venues' light.
4. **Settle the open questions** below before phase 5 goes live.
5. **Phase 7, the Ops Console**, is the next build. Until it exists, staff roles are given with `bun run staff` and the programme is changed with the seed script.

## Open questions

- **Festival dates and real content.** The seed uses placeholder dates of 1 to 7 November 2026, and every film, venue and price is fictional.
- **Accreditation passes.** Will industry, press and jury passes be issued as well as tickets sold? The data model has none.
- **Ticket transfer ("Pass it on").** It is built in the app and in the Firebase contract (`transferTicket`, `claimTickets`), but switched off in the app. Ship it or drop it?
- **Hosting the PWA.** Firebase Hosting fits. The static build also works on any host with an SPA fallback.
- **Refunds.** The server flags orders that need one (money taken but no tickets issued, or paid twice). Are they refunded by hand in Paystack's dashboard at first, or only once the Ops Console exists?

---

## Phases

### 1. Attendee PWA on mock data ✅

Built and reviewed feature by feature (F0 to F8). Details are in the [feature log](ROADMAP-attendee-fe.md).

- ✅ **App shell:** phone tab bar (Home, Programme, Tickets, Me), sidebar on tablets and laptops, offline banner, install and update prompts, manifest and service worker.
- ✅ **Home:** countdown before the festival, "Day N of 7" during, wrap-up after. Happening now and Up next, featured films, Don't miss events, venues.
- ✅ **Programme:** schedule by day and All films A to Z, search, filters (section, venue, time of day, genre, language), film and venue pages.
- ✅ **Tickets:** catalogue (Festival Pass, Day Pass, Single Screening, Masterclass, two galas), options sheet, cart, checkout, orders, My tickets, and a ticket page with a QR drawn on the device and Add to calendar.
- ✅ **My Festival:** saved films, screenings and events, clash and tight-gap warnings, reminders while the app is open.
- ✅ **Updates:** inbox released by the festival clock, "Affects you" mark, unread badge, urgent banner.
- ✅ **Info:** venues and getting there, FAQs, policies, contact.
- ✅ **Accounts:** PIN-based at first; replaced by email and password in phase 3.
- ✅ **Dev tools** on Me: festival clock presets, Reset demo data, `/styleguide`.
- Parked: ticket transfer ("Pass it on") is built but switched off.

### 2. Shared layer on Firebase and Paystack 🟡

The API contract the PWA talks to has been reshaped for Firebase and Paystack. Both adapters, mock and Firebase, implement it.

- ✅ Supabase removed: `supabase/`, `packages/supabase` and the type generation script.
- ✅ **Accounts in the contract:** email and password, with `restore`, `onSessionChange`, `signUp`, `requestPasswordReset`, `checkPasswordReset`, `resetPassword`, `sendEmailVerification` and `verifyEmail`. The app no longer handles session tokens.
- ✅ **Buying in the contract:** `orders.checkout` and `orders.pay` return a payment to open in Paystack's checkout, and `orders.verify` settles the order. Paystack's webhook settles it too, so closing the app mid-payment is safe.
- ✅ **Order rules** in `@afriff/api/orders`, shared by the mock and the future Cloud Functions: checking a cart, pricing, stock, 30-minute holds, at most 3 unpaid orders, ticket codes and issuing.
- ✅ **Mock adapter** rewritten to match, with a Paystack stand-in (`mock/payments.ts`) and Firebase-shaped accounts. Confirm and reset links are shown on screen in mock mode.
- ✅ **Firebase adapter** (`@afriff/api/firebase`): reads the catalogue, orders, tickets and saved items from Firestore, calls Cloud Functions for checkout, payment, verification, transfer and claiming, and turns Firebase errors into the app's messages.
- ✅ **Firestore layout and callable contract** (`firebase/schema.ts`), shared with the future functions and seed script.
- ✅ **`@afriff/firebase`:** creates the client, checks its settings, connects to the emulators, and keeps the session and Firestore cache in IndexedDB so tickets open offline.
- ✅ **Installed and tested:** `bun run check` passes across every workspace. The mock suites were rewritten for passwords and Paystack-style checkout, with tests for the shared order rules and the Firebase error mapping.
- **Done when** `bun run check` passes (✅) and the work is committed (not yet).

### 3. PWA on the new contract ✅

- ✅ **Accounts:** sign in and sign up with a password, "Forgot password" sends a link, a page that opens reset and confirm-email links, a "Confirm your email" prompt on Me, and `useAuth` rebuilt on `restore` and `onSessionChange`. Retire the PIN pieces (`AuthPinStep`, `AuthCodeStep`, `usePinSetup`, `/reset-pin`).
- ✅ **Checkout:** replace the card and transfer fields with Paystack's checkout, opened with the payment's access code. In mock mode, a stand-in checkout sheet with Pay and Fail.
- ✅ **Order page:** hold countdown, "Pay now" for an unpaid order, verify on return from Paystack, and the message for an expired hold.
- ✅ **Firebase wiring:** a client-only plugin that creates the Firebase client and adapter, an `apiMode` of `firebase`, and the `NUXT_PUBLIC_FIREBASE_*` settings in `.env.example`.
- ✅ **Docs:** the app README and the feature log describe passwords and Paystack.
- **Done when** every flow works in mock mode and the PWA typechecks. ✅ Every flow was also driven in a browser, in mock mode and against the emulators.

### 4. Firebase backend 🟡

- ✅ `firebase.json` and `.firebaserc`, with the emulators on the ports the client expects: Auth 9099, Firestore 8080, Functions 5001.
- ✅ **Security rules** (`firebase/firestore.rules`) and indexes. The catalogue is public to read. Attendees write only their own profile and saved list. Orders and tickets are readable by their owner and written only by functions. Rules tests run in the emulator.
- ✅ **Callable functions** in `apps/functions`: `checkout`, `payOrder`, `verifyOrder`, `transferTicket`, `claimTickets`.
- ✅ **Paystack webhook:** signature check, amount check and duplicate protection, recorded in `paymentEvents`.
- ✅ **Scheduled job** that releases expired holds.
- ✅ **Mail outbox** trigger that sends through Brevo (`order_paid`, `ticket_received`).
- ✅ **Seed script** that loads the catalogue with the Admin SDK: festival, venues, sections, films, screenings, events, products, info and updates.
- 🟡 **CI:** the rules tests run against the emulator, and the functions' unit tests run with the rest. The end-to-end runs against the emulators (70 checks for buying, 18 for the door) were scripted for this work but are not in CI yet.
- **Done when** the PWA runs end to end against the emulators: sign up, confirm the email, buy in Paystack test mode, and open the tickets offline. 🟡 All of it works against the emulators with a stand-in for Paystack's API; Paystack's own test mode needs the keys.

### 5. Attendees live ⬜

- ⬜ Staging and production Firebase projects, with authorised domains and the Auth email templates and sender.
- ⬜ Secrets for each environment: the Paystack secret key and the Brevo key, plus the Paystack webhook URL.
- ⬜ Hosting for the PWA, with an SPA fallback.
- ⬜ Real programme, prices and info, loaded through the seed script.
- ⬜ Basic error monitoring and Firestore backups. Fuller hardening is phase 10.
- Until the Ops Console exists, the programme is changed by re-running the seed script, and support and refunds go through the Firebase and Paystack dashboards.
- **Done when** a real attendee can buy a ticket on production.

### 6. Scanner ✅

`apps/scanner` ("AFRIFF Door"). Details are in [its README](../apps/scanner/README.md).

- ✅ Staff sign-in, with roles (Admin, Ops, Door) set as Firebase custom claims by `bun run staff` until the Ops Console exists.
- ✅ Pick the screening or event being checked in, by day, venue and search, with "Doors open" first.
- ✅ Camera scanning (jsQR, then the browser's own detector once warm), with typing the printed code as a fallback. Torch, sound and vibration, and the screen kept awake.
- ✅ A `checkIn` function that checks every rule in one transaction and allows one check-in per ticket per screening. The same rules run in the mock, which has demo tickets of every kind.
- ✅ **Result screens:**
  - Admitted
  - Already checked in, and when
  - Not for this screening or day
  - Passed on, void or unknown
  - Ended
  - Screening full (a pass doesn't reserve a seat)
- ✅ Running count, e.g. "42 / 60", live across every phone at the same session.
- ✅ A rehearsal clock for practising festival week, offered only in the mock and the emulators.
- On a phone, camera access needs HTTPS. Use a tunnel when testing locally.
- **Done when** scanning gives the right result for every rule and the attendee's ticket turns to Used. ✅ Verified against the emulators, including two doors scanning one ticket at once; the attendee's ticket page now says when it was scanned in.
- Still to do: try it on the door phones, in the venues' light.

### 7. Ops Console ⬜

A new app at `apps/ops`.

- ⬜ **Programme:** festival details, venues, sections, films, screenings and events. Move or cancel a screening.
- ⬜ **Products:** prices, stock and per-order limits.
- ⬜ **Updates composer:** kind, urgent or normal, what it is about (screening, event, venue or film), and when it publishes. Offered automatically when a screening moves or is cancelled.
- ⬜ **Orders and tickets:** find by email or order reference, resend the email, void and reissue a ticket.
- ⬜ **Refunds:** orders the server flagged, and refunds when a paid screening is cancelled.
- ⬜ **Sales view:** orders and payment status.
- ⬜ **Staff:** invite, set role, switch off.
- ⬜ **Audit log:** who changed what, and when.
- **Done when** a screening moved in Ops shows up in the PWA, with an update reaching the attendees it affects.

### 8. Push notifications ⬜

Today, updates appear only inside the app, read state is kept on the device, and My Festival reminders fire only while the app is open.

- ⬜ Web push through Firebase Cloud Messaging, with device tokens stored against the attendee.
- ⬜ Push an urgent update to the attendees it touches, through their tickets and saved items.
- ⬜ Reminders 30 minutes before a saved screening, sent by the server so they arrive with the app closed.
- ⬜ Turn notifications off by kind.
- ⬜ A daily digest (optional).
- On iPhones, web push works only after the app is added to the Home Screen (iOS 16.4 and later).

### 9. Live ops and offline scanning ⬜

- ⬜ **Ops:** live check-in counts per screening.
- ⬜ **Scanner:** download the screening's ticket list before doors open, scan offline, queue check-ins, sync on reconnect, and flag duplicates (earliest scan wins).

### 10. Hardening and launch ⬜

- ⬜ Load testing for ticket sales and festival-day check-ins.
- ⬜ Error monitoring, Firestore backups and Firebase App Check.
- ⬜ A final accessibility check across all three apps.
- ⬜ A festival-day runbook for staff.

### Alongside: PWA polish (F9) ⬜

This can happen at any point.

- ⬜ iOS "Add to Home Screen" guide. The install prompt only appears in Chrome and Edge.
- ⬜ Offline states on every screen.
- ⬜ Accessibility pass: keyboard, screen reader, contrast, reduced motion.
- ⬜ Performance pass (Lighthouse 90 or more) and bundle review.
- ⬜ A linter and formatter.
- ⬜ The official vector logo, when supplied.
- ⬜ An "Owned" mark on programme cards for screenings the attendee has a ticket for.
