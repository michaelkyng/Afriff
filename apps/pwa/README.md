# AFRIFF Attendee PWA

The attendee-facing app for the Africa International Film Festival: programme, passes, checkout and a ticket wallet that works offline.

**Current phase:** frontend only, fully local. There is no backend — all data comes from a typed mock API that stores what attendees create in the browser. See [`docs/ROADMAP-attendee-fe.md`](../../docs/ROADMAP-attendee-fe.md) for the feature plan.

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

## Stack

Nuxt 4 in SPA mode (`ssr: false`) · Tailwind CSS 4 · TypeScript · Pinia (+ persisted state) · VueUse · `@vite-pwa/nuxt` · `lucide-vue-next` icons · Archivo + Onest from Fontsource (bundled, no Google Fonts request).

## Project layout

```
app/
  app.vue                 theme + head, PWA manifest link
  spa-loading-template.html  splash shown while JS loads
  assets/css/main.css     imports the shared theme; attendee route transitions
  layouts/default.vue     app shell: phone header + tab bar, or desktop sidebar + top bar; offline banner, PWA prompts
  pages/                  one folder per tab, plus /programme/[slug] (film), /venues/[slug], /styleguide
  components/
    app/                  shell pieces (AppSidebar, AppTopBar, AppHeader, AppTabBar, AppPageHeader, AppPwaPrompts, …)
    film/                 FilmPoster, FilmCard, FilmScreeningRow
    programme/            ProgrammeItemCard, ProgrammeDayPicker, ProgrammeFilterSheet, ProgrammeSectionCard
    home/                 Home sections (HomeHero, HomeNowNext, HomeFeatured, HomeDontMiss, HomeVenues, …)
  composables/            useApi, useFestival, useProgramme, useProgrammeFilters, useHomeFeed, useFestivalClock, useTheme, useBreadcrumb
  stores/                 Pinia stores (prefs)
  plugins/api.ts          selects and injects the shared API adapter
  utils/                  Nuxt auto-import bridges to @afriff/api; attendee navigation
public/                   attendee robots.txt
../../layers/ui-kit/     shared Nuxt layer: UI/brand components, tokens, fonts, icons
../../packages/
  validation/             Zod schemas for shared programme inputs
  api/                    shared models, programme helpers, API contract, mock adapter and seed data
```

## How the mock API works

- Pages call `useApi()` and get an object that implements `AttendeeApi` (`@afriff/api`).
- In mock mode, `@afriff/api/mock` answers from seed files with simulated latency (`NUXT_PUBLIC_MOCK_LATENCY`, default 450 ms), so loading states are real.
- Anything attendees create (accounts, orders, tickets — from F3 onward) is written through `mockDb` into `localStorage` under `afriff:mockdb:*`.
- **Adding an API area:** add the methods to `AttendeeApi`, implement them in the mock adapter, then use them from pages via `useApi()`. When the backend arrives, an `http` adapter implements the same interface and `NUXT_PUBLIC_API_MODE=http` switches over.

All seed data (films, people, prices, venues, dates) is fictional or a placeholder — replace it with official data before any public use.

## Layout by screen size

| Width | Shell | Notes |
|---|---|---|
| < 768px (phones) | Top bar + bottom tab bar | Large page titles, filters slide up as a bottom sheet |
| 768–1023px (tablets) | Icon-rail sidebar + top bar | One-column pages |
| ≥ 1024px (laptops) | Full sidebar + top bar | Home becomes a dashboard (feed + side rail); filters open as a right-hand drawer |

The desktop top bar shows breadcrumbs (detail pages set theirs with `usePageCrumb()`), a global programme search (press `/`) and "Get passes". Use `AppPageHeader` for page titles so sizes stay consistent.

## Design system

- **Colours:** defined in `layers/ui-kit/styles/theme.css`; use the semantic tokens, not raw scales: `bg-canvas`, `bg-surface`, `bg-raised`, `bg-hover`, `border-line`, `text-ink`, `text-muted`, `text-subtle`, `bg-accent`/`text-on-accent`, `text-accent-ink` (gold text that passes contrast in both themes), `success`/`danger`/`info` (+ `-soft`). They switch automatically with the theme. Gold is for primary actions, selection and live state, not decoration.
- **Theme:** dark-first, with light. Stored in the `prefs` store (`afriff:prefs`); a tiny script in `nuxt.config.ts` applies it before first paint.
- **Type roles:** use the role, not a raw size. `text-micro` 11 · `text-label` 12 · `text-meta` 13 (secondary lines) · `text-body` 15 (UI copy and card titles, the page default) · `text-prose` 16 (long reading) · `text-h3` 17 · `text-h2` 20 (section titles) · `text-h1` 28 (page titles) · `text-display` 36 / `text-display-lg` 44 (film titles, hero). `font-display` (Archivo) only for page, section and film titles and big numbers; Onest for everything functional. Add `tabular-nums` to times, prices and counts.
- **Surfaces:** `card` (hairline border, surface, resting shadow), `card-interactive` (hover lift on real pointers, press feedback), `row-interactive` (list rows), `pressable` (small controls). Radii: `rounded-card` 16, `rounded-tile` 12, `rounded-thumb` 8, `rounded-tag` 6; buttons, chips and inputs are pills. Shadows: `shadow-card`, `shadow-hover`, `shadow-pop`.
- **Motion:** `ease-out` is a strong custom curve and the default for transitions; `ease-drawer` for sheets. Keep UI transitions at 150 to 250 ms, animate transform and opacity, exit faster than enter.
- **Copy:** no uppercase eyebrow labels above headings (use `UiSectionHeader`'s `meta`), no em or en dashes in visible text, at most one middle dot per line.
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
- **Reset demo data:** clears the mock DB and all `afriff:*` keys on this device.

## Decisions so far

| Decision | Why |
|---|---|
| SPA mode (`ssr: false`) | Fully local, offline-first; mock data lives in the browser. Revisit prerendering public pages (film detail) for SEO when the backend lands. |
| Typed API contract + adapters | Pages never know whether data is mocked, so the backend swap is contained. |
| Money in kobo (`Money.amount`) | Matches how payment providers expect amounts; avoids float errors. |
| All times shown in Africa/Lagos | Attendees and venues are in Lagos regardless of device timezone. |
| `useProgramme()` loads the whole programme once | Small data set; one cached request feeds Home and Programme. Revisit (paging / per-day queries) with the real API. |
| Generated poster art | Works offline with no image assets; swap for real key art later via an `imageUrl` field. |
| Filters in the URL, not a store | Shareable links, Back button and reload all just work; `router.replace` avoids history spam. |
| Film/venue pages read from `useProgramme()` | Instant and offline once the programme has loaded. The contract's `getFilm(slug)` stays for the real API. |
| Only `/` precached for navigation | Every SPA route has the same HTML shell; `navigateFallback` serves it offline. |
