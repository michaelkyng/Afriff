# AFRIFF Attendee PWA

The attendee-facing app for the Africa International Film Festival: programme, tickets, checkout and the tickets an attendee already holds.

It runs on one of two API adapters, chosen by `NUXT_PUBLIC_API_MODE`: **`mock`** (the default), entirely in the browser on placeholder data, or **`firebase`**, on Firebase Auth, Firestore and Cloud Functions with Paystack for payment. Pages never know which. See [`docs/ROADMAP-attendee-fe.md`](../../docs/ROADMAP-attendee-fe.md) for the feature plan and the [Firebase backend guide](../../firebase/README.md) for the server side.

## Getting started

Requires Node 22.12+ and Bun 1.3.14 (see the root `.nvmrc` and `package.json`). Install from the repository root so workspace packages are linked.

```bash
bun install
bun run dev:pwa     # http://localhost:3000
```

All commands below run from the repository root:

| Script | What it does |
|---|---|
| `bun run dev:pwa` | Dev server with hot reload (service worker off) |
| `bun run typecheck` | Check the app, shared Vue components and TypeScript packages |
| `bun run generate:pwa` | Static build into `apps/pwa/.output/public` |
| `bun run preview:pwa` | Build, then serve on http://localhost:4173 with the service worker on |

To test offline: run `bun run preview:pwa`, open the app once, then turn on "Offline" in DevTools → Network (or airplane mode on a phone on the same Wi-Fi) and reload.

To run against Firebase locally: start the emulators from the root (`bun run emulators`, then `bun run emulators:seed`), and set the three emulator lines at the end of `.env.example` in `apps/pwa/.env`.

## Stack

Nuxt 4 in SPA mode (`ssr: false`) · Tailwind CSS 4 · TypeScript · Pinia (+ persisted state) · VueUse · `@vite-pwa/nuxt` · `lucide-vue-next` icons · Archivo + Onest from Fontsource (bundled, no Google Fonts request).

## Project layout

```
app/
  app.vue                 theme + head, PWA manifest link
  spa-loading-template.html  splash shown while JS loads
  assets/css/main.css     imports the shared theme; attendee route transitions
  layouts/default.vue     app shell: phone header + tab bar, or desktop sidebar + top bar; offline banner, PWA prompts
  pages/                  index, /programme (+ [slug]), /tickets (Buy and My tickets) + /tickets/[id],
                          /my-festival, /updates, /info, /me, plus /venues/[slug], /cart, /checkout,
                          /orders/[id], /signin, /signup, /forgot-password, /auth/action (links in account
                          emails), /styleguide
  components/
    app/                  shell pieces (AppSidebar, AppTopBar, AppHeader, AppTabBar, AppPageHeader, AppUpdateBanner, AppPwaPrompts, …)
    auth/                 AuthPanel (the frame every account screen shares), AuthDemoNotice, AuthVerifyEmailCard
    film/                 FilmPoster, FilmCard, FilmScreeningRow
    programme/            ProgrammeItemCard, ProgrammeDayPicker, ProgrammeFilterSheet, ProgrammeSectionCard
    home/                 Home sections (HomeHero, HomeNowNext, HomeFeatured, HomeDontMiss, HomeVenues, …)
    pass/                 PassProductCard, PassOptionSheet, CartLineRow, OrderSummary, PaymentMethodsNote,
                          MockCheckoutSheet (mock mode's stand-in for Paystack's checkout)
    ticket/               TicketCard, TicketQrCode, TicketTransferSheet
    plan/                 PlanSaveButton — the bookmark toggle used across the programme
  composables/            useApi, useAuth, usePayment, useFieldErrors, useFestival, useProgramme, useProgrammeFilters, useHomeFeed, useFestivalClock, useMyTickets, useUpdates, useReminders, useTheme, useBreadcrumb
  middleware/auth.ts      sends guests to /signin and back again
  stores/                 Pinia stores (prefs, session, cart, plan, reminders, inbox)
  plugins/api.ts          loads and injects the chosen API adapter (mock or Firebase)
  plugins/auth.client.ts  asks the adapter who is signed in on start-up, and follows later changes
  types/                  declarations for packages that ship none (Paystack InlineJS)
  utils/                  Nuxt auto-import bridges to @afriff/api; attendee navigation
public/                   attendee robots.txt
../../layers/ui-kit/     shared Nuxt layer: UI/brand components, tokens, fonts, icons
../../packages/
  validation/             Zod schemas for shared programme inputs
  api/                    shared models, programme helpers, API contract, mock adapter and seed data, plus
                          the QR encoder (`@afriff/api/qr`), ticket helpers (`@afriff/api/tickets`), the
                          plan logic (`@afriff/api/plan`) and update sorting (`@afriff/api/updates`)
```

## How the API works

- Pages call `useApi()` and get an object that implements `AttendeeApi` (`@afriff/api`). `plugins/api.ts` loads only the adapter `NUXT_PUBLIC_API_MODE` names, and refuses to start on an unknown one rather than quietly falling back to the mock.
- **Mock mode:** `@afriff/api/mock` answers from seed files with simulated latency (`NUXT_PUBLIC_MOCK_LATENCY`, default 450 ms), so loading states are real. What attendees create is written through `mockDb` into `localStorage` under `afriff:mockdb:*`.
- **Firebase mode:** `@afriff/api/firebase` reads Firestore directly (guarded by `firebase/firestore.rules`) and calls Cloud Functions for anything that moves money or stock. Firestore's offline cache and the Auth session live in IndexedDB, so tickets open offline once loaded.
- **Accounts:** an email and a password (at least 8 characters). `/signup` creates the account and sends a link to confirm the email; Me nudges until it is confirmed (`AuthVerifyEmailCard`), but nothing is held back meanwhile. `/forgot-password` sends a reset link that lands on `/auth/action`, which also confirms emails; Firebase's email templates point there. The adapter owns the session: on start-up the app asks `auth.restore()` who is signed in, and `auth.onSessionChange` reports a sign-out in another tab or a session ended by a reset elsewhere. The `session` store is only a copy of the account, for an instant and offline start. In mock mode no email is sent: the reset or confirmation link is offered on screen instead (`devCode`).
- **Buying:** `/tickets` has two tabs, Buy and My tickets (`?view=mine`). The cart lives in the `cart` store on the device until `/checkout`, where `orders.checkout` prices the order on the server, holds the tickets for 30 minutes and returns a `PaymentIntent`. `usePayment` opens Paystack's checkout with it (or, in mock mode, the stand-in sheet, where you choose to pay or decline) and then asks `orders.verify` how it went. It never decides the outcome itself. The order page resumes or retries payment (`orders.pay`) and checks again on return from Paystack's hosted page (`?reference=`). Card details never pass through the app.
- **Tickets (F5):** `tickets.list` and `tickets.get` come denormalised — title, time, venue, room, holder — so `/tickets/[id]` needs nothing else to render. `tickets.transfer` marks the sender's copy `transferred` and issues the recipient a new ticket with its own code; if that email has no account yet, the ticket waits under it and is picked up the first time they sign in. Stored statuses are `valid`, `used`, `transferred` and `void`; `expired` is worked out from the clock by `ticketState`. **Passing a ticket on is parked:** the API and `TicketTransferSheet` are still here, but the "Pass it on" button on `/tickets/[id]` is commented out until we decide to ship it (see [Parked for later](../../docs/ROADMAP-attendee-fe.md#parked-for-later)).
- **My festival (F6):** `saved.list / add / remove / merge` keeps one list per account covering films, screenings and events. The `plan` store mirrors it on the device so saving works signed out; `merge` folds that device list into the account at sign-in, and signing out clears the device copy. `@afriff/api/plan` turns saved items plus tickets into the schedule (`buildPlan`, `groupPlanByDay`) and finds where it cannot be kept (`planWarnings`: a clash, or less than 45 minutes between two venues). Reminders are device-only timers in the `reminders` store and fire only while the app is open.
- **Updates (F7):** `updates.list()` is public and returns every seeded update with the moment it was published; the app shows what the festival clock says has happened, so the dev clock presets on Me simulate the week filling up. `@afriff/api/updates` decides what touches this attendee (`refsFromTickets` + `refsFromSaved` → `touches`), what is unread (`unreadCount`) and what earns the banner (`urgentForAttendee`: urgent, theirs, unread, undismissed). Read state is device-only, in the `inbox` store.
- **Info (F8):** `info.get()` returns the FAQs, policies and contact details in one public call — none of it changes through the week, so it is fetched once and cached like the programme. Venue travel notes and the longer access note live on the `Venue` itself, so `/info#venues` and `/venues/[slug]` say the same thing from the same source.
- **Adding an API area:** add the methods to `AttendeeApi`, implement them in the mock adapter, then use them from pages via `useApi()`. When the backend arrives, an `http` adapter implements the same interface and `NUXT_PUBLIC_API_MODE=http` switches over.

All seed data (films, people, prices, venues, dates) is fictional or a placeholder — replace it with official data before any public use.

## Layout by screen size

| Width | Shell | Notes |
|---|---|---|
| < 768px (phones) | Top bar + bottom tab bar | Large page titles, filters slide up as a bottom sheet |
| 768–1023px (tablets) | Icon-rail sidebar + top bar | One-column pages |
| ≥ 1024px (laptops) | Full sidebar + top bar | Home becomes a dashboard (feed + side rail); filters open as a right-hand drawer |

The desktop top bar shows breadcrumbs (detail pages set theirs with `usePageCrumb()`), a global programme search (press `/`) and "Get tickets" (the cart, once it has something in it). Use `AppPageHeader` for page titles so sizes stay consistent.

## Design system

- **Colours:** defined in `layers/ui-kit/styles/theme.css`; use the semantic tokens, not raw scales: `bg-canvas`, `bg-surface`, `bg-raised`, `bg-hover`, `border-line`, `text-ink`, `text-muted`, `text-subtle`, `bg-accent`/`text-on-accent`, `text-accent-ink` (gold text that passes contrast in both themes), `success`/`danger`/`info` (+ `-soft`). They switch automatically with the theme. Gold is for primary actions, selection and live state, not decoration.
- **Theme:** dark-first, with light. Stored in the `prefs` store (`afriff:prefs`); a tiny script in `nuxt.config.ts` applies it before first paint.
- **Type roles:** use the role, not a raw size. `text-micro` 11 · `text-label` 12 · `text-meta` 13 (secondary lines) · `text-body` 15 (UI copy and card titles, the page default) · `text-prose` 16 (long reading) · `text-h3` 17 · `text-h2` 20 (section titles) · `text-h1` 28 (page titles) · `text-display` 36 / `text-display-lg` 44 (film titles, hero). `font-display` (Archivo) only for page, section and film titles and big numbers; Onest for everything functional. Add `tabular-nums` to times, prices and counts.
- **Surfaces:** `card` (hairline border, surface, resting shadow), `card-interactive` (hover lift on real pointers, press feedback), `row-interactive` (list rows), `pressable` (small controls). Radii: `rounded-card` 16, `rounded-tile` 12, `rounded-thumb` 8, `rounded-tag` 6; buttons, chips and inputs are pills. Shadows: `shadow-card`, `shadow-hover`, `shadow-pop`.
- **Motion:** `ease-out` is a strong custom curve and the default for transitions; `ease-drawer` for sheets. Keep UI transitions at 150 to 250 ms, animate transform and opacity, exit faster than enter.
- **Copy:** no uppercase eyebrow labels above headings (use `UiSectionHeader`'s `meta`), no em or en dashes in visible text, at most one middle dot per line.
- **Forms:** `UiInput` carries the label, hint and error, and `UiStepper` handles quantities. Fields use `rounded-tile`; buttons, chips and the search box stay pills.
- **Components:** start from `layers/ui-kit/components/ui` at the repository root. Browse them all, including the type scale, at `/styleguide` (linked from Me → Developer).
- **Brand:** the logo comes from afriff.com — emblem as an image, wordmark traced to SVG so it follows the text colour. Sources, the rebuild script and caveats are in [`brand/README.md`](../../brand/README.md).

## Programme URLs

Everything on `/programme` is in the query string, so any view can be linked to or bookmarked:

| Param | Example | Meaning |
|---|---|---|
| `view` | `films` | All films (A to Z) instead of the schedule |
| `day` | `2026-11-03` | Schedule day (default: today during the festival, else opening day) |
| `q` | `harmattan` | Search |
| `section`, `venue` | `feature-competition,animation` | Slugs, comma-separated (OR within a group) |
| `genre`, `lang` | `Drama`, `Yoruba` | Values, comma-separated |
| `time` | `morning,evening` | Time of day (Lagos time) |

## Developer tools (Me tab)

- **Festival clock:** pin "now" to a moment in festival week (week before, opening night, day 3, closing night, after) to preview Home's time-based states. Stored in `prefs.devNow`.
- **Reset demo data** (mock mode only): clears the mock DB and all `afriff:*` keys on this device.

## Decisions so far

| Decision | Why |
|---|---|
| SPA mode (`ssr: false`) | Fully local, offline-first; mock data lives in the browser. Revisit prerendering public pages (film detail) for SEO when the backend lands. |
| Typed API contract + adapters | Pages never know whether data is mocked, so the backend swap is contained. |
| Money in kobo (`Money.amount`) | Matches how payment providers expect amounts; avoids float errors. |
| All times shown in Africa/Lagos | Attendees and venues are in Lagos regardless of device timezone. |
| `useProgramme()` loads the whole programme once | Small data set; one cached request feeds Home and Programme. Revisit (paging / per-day queries) with the real API. |
| Generated poster art | Works offline with no image assets; swap for real key art later via an `imageUrl` field. |
| Session held by the API adapter | Firebase keeps and refreshes its own tokens; the app only asks who is signed in, so pages never pass tokens around. |
| Payment outcome decided on the server | The browser's "success" is only a hint to ask; the webhook and `orders.verify` settle the order. |
| Filters in the URL, not a store | Shareable links, Back button and reload all just work; `router.replace` avoids history spam. |
| Film/venue pages read from `useProgramme()` | Instant and offline once the programme has loaded. The contract's `getFilm(slug)` stays for the real API. |
| Only `/` precached for navigation | Every SPA route has the same HTML shell; `navigateFallback` serves it offline. |
