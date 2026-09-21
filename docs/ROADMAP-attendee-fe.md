# AFRIFF Attendee PWA — Frontend-only roadmap

**Scope:** the attendee-facing Progressive Web App, built fully local. No backend, no payments, no email/SMS. Every "server" call goes through a typed mock API that stores its state in the browser, so the real backend can replace it later without touching pages or components.

**Stack:** Nuxt 4 (SPA mode) · Tailwind CSS 4 · TypeScript · Pinia · VueUse · @vite-pwa/nuxt · lucide icons · self-hosted fonts (Fraunces + Inter).

**How we work:** one feature at a time. Each feature ends in a working, clickable state and gets reviewed before the next one starts.

Status key: ✅ done · 🟡 in progress · ⬜ not started

---

## F0 — Foundation ✅

The base every later feature builds on.

- Nuxt 4 app in `apps/pwa`, SPA mode (`ssr: false`) so everything runs offline from the browser
- Design tokens in Tailwind 4 (deep navy + gold, dark-first, with a light theme), Fraunces display + Inter UI fonts, bundled locally
- App shell: phones get a top bar + bottom tab bar (Home · Programme · Passes · Wallet · Me); tablets and laptops get a web-app shell — sidebar (icon rail on tablets, full on laptops) with festival status, theme and account, plus a top bar with breadcrumbs, global search (press `/`) and "Get passes" *(desktop shell added after F2 review)*; offline banner, "update available" and "install app" prompts
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

- `/programme` has two views: **Schedule** (by day) and **Films A–Z**
- Schedule: sticky day picker with per-day counts (respecting filters), listings grouped by start time, "Now showing" and finished states; on today's schedule, finished listings are tucked behind "Show N finished"
- Search across titles, directors, cast, countries, languages and event hosts (accent-insensitive, all words must match)
- Filter sheet (native `<dialog>`): section, venue, time of day, genre, language — applied live, removable chips, "Clear all"
- All view/filter state lives in the URL (`?view=films&day=2026-11-03&venue=terra-kulture&genre=Drama&q=…`), so links are shareable and Back works
- Empty states suggest other days that do match; loading skeletons and error/retry throughout
- Film detail `/programme/[slug]`: poster, section/premiere/competition badges, runtime, rating, countries, logline, synopsis, credits, every screening with availability and a ticket action (Tickets / Gala tickets / Sold out / Screened / Now showing), share (native share sheet or copy link), "More from this section"
- Venue detail `/venues/[slug]`: address, directions, screens and seats, accessibility, what's on by day
- Unknown films or venues show the app's 404 page

**Done when:** an attendee can find any film by day, venue or search and see where and when it plays. ✔︎

## F3 — Account (mock auth) ⬜

- Sign up / sign in with email + one-time code (code is shown on screen in mock mode)
- Profile: name, phone, email, avatar initials
- Guest browsing; sign-in required only for checkout and wallet
- Route guard middleware, session persisted locally, sign out

**Done when:** a new attendee can create an account, leave, come back and still be signed in.

## F4 — Passes & checkout ⬜

- Catalogue: Festival Pass, Day Pass, Single Screening, Masterclass, Opening Night, Globe Awards Night
- Single screening flow: pick screening → quantity → seat category (if applicable)
- Cart with quantity limits, per-product rules and sold-out states
- Mock checkout: attendee details, order summary, simulated card/transfer payment (success, failure, pending)
- Order confirmation screen; order history in Me

**Done when:** an attendee can buy any product type and see it arrive in the wallet, and a failed payment is handled cleanly.

## F5 — Wallet & tickets ⬜

- My tickets grouped by upcoming / past
- Ticket detail with QR code (payload shaped like the future signed token), brightness hint, ticket status (valid, used, expired, transferred)
- Works fully offline once loaded
- Add to calendar (.ics download)
- Transfer a ticket to another email (mock)

**Done when:** tickets open with airplane mode on, and QR codes render crisply at full brightness.

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
