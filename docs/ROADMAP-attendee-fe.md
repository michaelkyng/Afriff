# AFRIFF Attendee PWA — Frontend-only roadmap

**Scope:** the attendee-facing Progressive Web App, built fully local. No backend, no payments, no email/SMS. Every "server" call goes through a typed mock API that stores its state in the browser, so the real backend can replace it later without touching pages or components.

**Stack:** Nuxt 4 (SPA mode) · Tailwind CSS 4 · TypeScript · Pinia · VueUse · @vite-pwa/nuxt · lucide icons · self-hosted fonts (Archivo + Onest).

**How we work:** one feature at a time. Each feature ends in a working, clickable state and gets reviewed before the next one starts.

Status key: ✅ done · 🟡 in progress · ⬜ not started

---

## F0 — Foundation ✅

The base every later feature builds on.

- Nuxt 4 app in `apps/pwa`, SPA mode (`ssr: false`) so everything runs offline from the browser
- Design tokens in Tailwind 4 (deep navy + gold, dark-first, with a light theme), Archivo display + Onest UI fonts, bundled locally
- App shell: phones get a top bar + bottom tab bar (Home · Programme · Tickets · Me); tablets and laptops get a web-app shell — sidebar (icon rail on tablets, full on laptops) with festival status, theme and account, plus a top bar with breadcrumbs, global search (press `/`) and "Get passes" *(desktop shell added after F2 review)*; offline banner, "update available" and "install app" prompts
- PWA: manifest, icons (placeholder mark — replaced with the official logo in F1), service worker with offline app shell
- Mock API layer: typed contract (`packages/api/src/contract.ts`), mock adapter with simulated latency, localStorage-backed mock DB with reset
- Seed data (all fictional): festival edition, venues, programme sections, films, screenings, ticket products
- Base UI kit (`Ui*` components) and a `/styleguide` page for design review
- Theme preference (system / dark / light), persisted

**Done when:** `bun run dev:pwa` shows the shell with all five tabs, theme switching works, `bun run preview:pwa` installs as an app and reloads offline.

## F1 — Home / Discover ✅

- Official AFRIFF logo from afriff.com: emblem, traced wordmark and festival name (theme-aware), PWA icons, favicons and splash; navy re-based on the logo's `#0A1042` (see `brand/README.md`)
- Hero for the current edition with countdown (before), "Day N of 7" with today's count (during), and wrap-up (after)
- "Happening now" with live progress and "Up next today" / "Tomorrow" / "Opening day", driven by the festival clock
- Featured films carousel, "Don't miss" events (galas, awards, panels, grouped masterclasses), sections to explore, venues with directions
- Quick links (Programme, Passes from lowest price, My tickets, Venues) and an About band with the stacked logo
- Section cards deep-link to the programme (`/programme?section=…`), which now filters by section
- Dev clock presets on the Me tab (week before, opening night, day 3, closing night, after)

**Done when:** the home screen looks right before, during and after the festival using the clock override. ✔︎

## F2 — Programme & film detail ✅

- `/programme` has two views: **Schedule** (by day) and **All films** (A to Z)
- Schedule: sticky day picker with per-day counts (respecting filters), listings grouped by start time, "Now showing" and finished states; on today's schedule, finished listings are tucked behind "Show N finished"
- Search across titles, directors, cast, countries, languages and event hosts (accent-insensitive, all words must match)
- Filter sheet (native `<dialog>`): section, venue, time of day, genre, language — applied live, removable chips, "Clear all"
- All view/filter state lives in the URL (`?view=films&day=2026-11-03&venue=terra-kulture&genre=Drama&q=…`), so links are shareable and Back works
- Empty states suggest other days that do match; loading skeletons and error/retry throughout
- Film detail `/programme/[slug]`: poster, section/premiere/competition badges, runtime, rating, countries, logline, synopsis, credits, every screening with availability and a ticket action (Tickets / Gala tickets / Sold out / Screened / Now showing), share (native share sheet or copy link), "More from this section"
- Venue detail `/venues/[slug]`: address, directions, screens and seats, accessibility, what's on by day
- Unknown films or venues show the app's 404 page

**Done when:** an attendee can find any film by day, venue or search and see where and when it plays. ✔︎

## Design pass: cards and type ✅ *(after F2 review)*

A refinement of the existing look for a sleeker, more professional app feel. Rules applied from the taste, Impeccable and Emil Kowalski design guides.

- **Type roles** in `layers/ui-kit/styles/theme.css`: `text-micro` 11, `text-label` 12, `text-meta` 13, `text-body` 15 (UI default), `text-prose` 16, `text-h3` 17, `text-h2` 20, `text-h1` 28, `text-display` 36, `text-display-lg` 44. Fixed rem steps of about 1.15. Archivo only for page, section and film titles; everything else is Onest. Tabular numerals for times, prices and counts.
- **Cards:** one radius system (cards 16, tiles 12, thumbs 8, tags 6; controls stay pills), hairline borders, navy-tinted offset shadows, and shared `card`, `card-interactive`, `row-interactive` and `pressable` utilities. Hover only on real pointers; press scales to 0.985 (cards) or 0.97 (buttons).
- **Programme cards** show start time and duration, one status on the right (Sold out, N left, price, Included, Ended) and quiet tags. On tablets and laptops the schedule has a time gutter.
- **Removed:** uppercase eyebrow labels above headings (section headers take an inline `meta` instead), decorative glass and glows, coloured top bars, em and en dashes in visible text (ranges use hyphens or "to"), and stacked middle dots.
- **Motion:** custom ease-out and drawer curves, 150 to 250 ms for UI, sheets slide fully in on the drawer curve, exits faster than entrances, reduced motion respected.
- Fixed: "Explore by section" was empty after the monorepo move because `ProgrammeSectionCard` no longer resolved (the file is now `ProgrammeSectionCard.vue`).

## F3 — Account (mock auth) ✅

- `/signin`: email plus the six-digit PIN the attendee chose. "Forgot your PIN?" goes to `/reset-pin`.
- `/signup`: email → six-digit code → name and a new PIN. `/reset-pin` is the same code-then-PIN flow without the name, and both share `usePinSetup` with the `AuthCodeStep` / `AuthPinStep` components, so they differ only in wording.
- No mail integration yet, so **any six-digit code is accepted** (`ACCEPT_ANY_CODE` in `packages/api/src/mock/auth.ts`). Mock mode still shows the code it would have sent, with a "Fill it in" button, so the flow reads like the real one offline. Codes expire after 10 minutes, the ticket they produce is single-use, and "Send again" has a 30-second cooldown.
- PINs are stored salted and hashed, refused when they are an obvious guess (repeated or sequential digits), and five wrong ones lock an account for five minutes. A reset clears the lockout and ends the account's other sessions.
- Accounts, PINs, codes and sessions live in the shared API (`packages/api/src/mock/auth.ts`): `auth.signIn`, `requestCode`, `verifyCode`, `setPin`, `me`, `updateProfile`, `signOut`, plus `setAuthToken` on the adapter, all on the same contract an http adapter will implement
- Profile on the Me tab: initials avatar, name, email, optional Nigerian phone, inline edit with field-level errors, sign out
- Guest browsing everywhere; the `auth` middleware guards checkout and returns you to where you were heading after signing in. My tickets asks for a sign-in in place, rather than redirecting, sign-up or a reset
- Session persisted under `afriff:session`; on start-up the app checks the token still works and signs out quietly if the mock data was reset
- New `UiInput` in the UI kit (label, hint, error, code style, show/hide toggle for PINs) for this and the F4 checkout forms

**Done when:** a new attendee can create an account, leave, come back and sign in with their PIN. ✔︎

## F4 — Passes & checkout ✅

- Catalogue at `/passes`: Festival Pass, Day Pass, Single Screening, Masterclass, Opening Night Gala, Globe Awards Night, with live remaining stock
- Options sheet per product: which day, which screening (searchable, sold-out ones hidden, seats-left shown), which masterclass, then how many. `/passes?screening=<id>` from a film page opens it on that screening
- Cart (`/cart`, kept on the device under `afriff:cart`): quantity steppers capped by the per-order limit, remaining stock and seats left; the count shows on the Passes tab and in the desktop top bar
- Checkout (`/checkout`, sign-in required): contact details prefilled from the account, card or transfer, order summary, field-level errors from the shared schemas
- Simulated payments, deterministic so every branch can be shown: a card ending **0000** is declined, one ending **0001** stays pending, any other card is paid at once, and a transfer is pending until it is confirmed
- Order page (`/orders/[id]`): status, what happens next, transfer details with a reference, retry with another card, and the order summary. Order history on Me
- Tickets are issued when money lands, one per seat, and show up under **My tickets** with their entry code. A failed payment issues none and gives the stock back
- Shared API: `orders.checkout / list / get / pay / confirmTransfer` and `tickets.list` on the contract, `packages/api/src/mock/orders.ts` behind it, checkout and payment schemas in `@afriff/validation`. Limits and stock are checked per order, not per line, so splitting a product across lines cannot get past the cap

**Done when:** an attendee can buy any product type and see it arrive under My tickets, and a failed payment is handled cleanly. ✔︎

## F5 — Ticket detail ✅

*The wallet is scrapped. Tickets live on the **My tickets** tab of `/tickets`, next to the Buy tab. Payment moves to a real provider later, which will change how a ticket is issued but not what one is.*

- Ticket page at `/tickets/[id]`: the QR filling the card, the printed code under it in full, a brightness hint, and one line saying where the ticket stands
- The QR is drawn by an encoder that ships with the app (`@afriff/api/qr`) — byte mode, versions 1 to 40, level Q, no dependency and no network. It is checked against a reference implementation in `packages/api/tests/qr.test.js`, and the rendered symbol was read back with an independent scanner
- The payload is shaped like the signed token the backend will issue: `AF1|<ticket>|<code>|<starts at>`. Nothing in it proves anything on its own; the scanner checks it against the festival's records
- Status without a round trip: `valid`, `used`, `transferred`, `void` are stored, and `expired` is worked out from the clock, so a ticket never has to be rewritten to go stale
- Everything on the page comes from the ticket itself — what it admits to, when, where, the holder — so it holds up in airplane mode once the app shell is cached
- Add to calendar: an .ics built on the device, with the times in UTC and an alarm an hour before
- Pass a ticket on to another email: the sender keeps a record of where it went and their copy stops admitting anyone, the recipient gets a new ticket with its own code, and one sent to somebody without an account is waiting the first time they sign in
- Shared API: `tickets.get` and `tickets.transfer` on the contract, `ticketPayload` / `ticketState` / `ticketAdmits` / `ticketIcs` in `@afriff/api/tickets`, transfer schema in `@afriff/validation`

**Done when:** tickets open with airplane mode on, and the entry code renders crisply at full brightness. ✔︎

## F6 — My Festival ⬜

- Save films to a watchlist
- Personal schedule built from saved screenings and purchased tickets
- Clash detection (overlapping screenings) with warnings
- Reminder toggles (local notifications where the browser allows it)

**Done when:** an attendee can plan their week and see clashes before they buy.

## F7 — Updates & notifications ⬜

- In-app inbox: schedule changes, venue changes, announcements (seeded + simulated)
- Unread badge on the Me tab; mark as read
- Banner for urgent changes affecting a ticket the attendee holds

## F8 — Info & help ⬜

- Venues & getting there, FAQs, festival policies, contact/support
- Accessibility information per venue

## F9 — PWA polish & quality pass ⬜

- Install flows (Android prompt, iOS "Add to Home Screen" guide)
- Offline states on every screen, update toast behaviour; swap traced logo for official vector artwork when supplied
- Accessibility pass (keyboard, screen reader, contrast, reduced motion)
- Performance pass (Lighthouse PWA/perf ≥ 90), bundle review

---

## Backend seams (for later)

Everything the mock layer does maps to a future API call. When the backend exists we add an `http` adapter that implements the same contract and flip `NUXT_PUBLIC_API_MODE=http`.

| Contract area | Mock today | Real later |
|---|---|---|
| `festival`, `programme` | Seed files | CMS / programme service |
| `catalog` | Seed ticket products | Inventory + pricing service |
| `auth` | Local users + on-screen OTP | Email/SMS OTP, JWT sessions |
| `orders` | Local orders, simulated payment | Payment provider (e.g. Paystack) + webhooks |
| `tickets` | Local tickets, unsigned QR payload | Signed ticket tokens, scanner validation, transfer |
| `inbox` | Seeded messages | Push notifications |

## Out of scope for this phase

Ops Console, ticket scanner app, real payments, emails/SMS, analytics, CMS.
