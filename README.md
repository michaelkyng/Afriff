# AFRIFF

A Bun monorepo with deployable applications, shared Nuxt layers, and plain
TypeScript packages, on a Firebase backend with Paystack payments and Brevo email.

```text
apps/
  pwa/                   @afriff/pwa — attendee PWA
  scanner/               @afriff/scanner — AFRIFF Door, the ticket scanner for festival staff
  ops/                   @afriff/ops — AFRIFF Ops, the festival team's console
  functions/             @afriff/functions — Cloud Functions: checkout, Paystack, tickets, Brevo email
layers/
  ui-kit/                @afriff/ui-kit — shared Nuxt design-system layer
    components/          Ui* controls and Brand* artwork
    styles/theme.css     design tokens, shared utilities and base styles
    public/              shared logos, favicons and PWA icons
    nuxt.config.ts       component registration, local fonts and Tailwind
    package.json
packages/
  validation/            @afriff/validation — shared Zod input schemas
    src/index.ts
    package.json
  api/                   @afriff/api — shared types, programme logic and adapters
    src/types.ts
    src/contract.ts
    src/orders.ts        order rules shared by the mock and the Cloud Functions
    src/door.ts          door rules and the DoorApi contract, shared the same way
    src/ops.ts           Ops rules and the OpsApi contract, shared the same way
    src/mock/            local adapter, fixtures and mock storage
    src/firebase/        Firebase adapter and the shared Firestore schema
    src/index.ts
    package.json
  firebase/              @afriff/firebase — browser SDK set-up and emulator wiring
firebase/                Firestore rules, indexes and rules tests
firebase.json            Firebase CLI: emulators, rules, functions, hosting
brand/                   source artwork and asset generator
```

Three apps are built: the attendee PWA, the door scanner
([`apps/scanner`](apps/scanner/README.md)) and the Ops Console
([`apps/ops`](apps/ops/README.md)).

All three run in one of two modes, chosen by `NUXT_PUBLIC_API_MODE`:

- **`mock`** (the default): everything runs in the browser on placeholder data,
  with a stand-in for Paystack's checkout, a demo door with tickets of every
  kind to scan, and a demo console with orders to work with. No backend, no network.
- **`firebase`**: Firebase Auth (email and password), Firestore, and Cloud
  Functions for checkout, Paystack payments, tickets and Brevo email. Run it
  locally against the Emulator Suite with `bun run emulators`.

See the [Firebase backend guide](firebase/README.md) for the security model, the
payment flow, local development and setting up a project.

## Getting started

Use Node **22.12+** (`nvm use` selects Node 22) and Bun **1.3.14**. From the
repository root:

```sh
bun install
bun run dev:pwa          # http://localhost:3000
```

Optional environment settings go in `apps/pwa/.env`; see its `.env.example`.
Install at the root and keep a single `bun.lock` for all three workspace groups:
`apps/*`, `layers/*`, and `packages/*`.

| Command | Purpose |
| --- | --- |
| `bun run dev` / `bun run dev:pwa` | Run the attendee PWA (localhost:3000) |
| `bun run dev:scanner` | Run the door scanner (localhost:3001) |
| `bun run dev:ops` | Run the Ops Console (localhost:3002) |
| `bun run build` / `bun run build:pwa` | Build with Nitro |
| `bun run generate` / `bun run generate:pwa` | Generate static PWA output |
| `bun run preview:server` | Preview an existing Nitro build |
| `bun run preview:pwa` | Generate and serve the PWA on localhost:4173 |
| `bun run typecheck` | Check the PWA, UI layer, API and validation packages |
| `bun run test` | Run programme, API and validation regression tests |
| `bun run check` | Type checks and tests |
| `bun run emulators` / `emulators:seed` | Firebase emulators, and the placeholder catalogue loaded into them |
| `bun run test:rules` | Firestore rules tests against the emulator (Java 21+) |
| `bun run build:functions` | Bundle the Cloud Functions for the emulators or deploy |
| `bun run staff -- --email … --role door` | Give festival staff a role for the scanner |
| `bun run brand:assets` | Regenerate assets in `layers/ui-kit` (Python requirements in the brand guide) |

Stop the app's dev server before building: both commands write to `.nuxt`.
For static deployment, run `bun run generate:pwa` from the root and publish
`apps/pwa/.output/public` with an SPA fallback to `index.html` (`firebase.json`
does this for Firebase Hosting). CI installs using `bun install --frozen-lockfile`,
checks the workspaces, bundles the Cloud Functions and generates all three apps;
a second job runs the Firestore rules tests on the emulator.
The [GitHub Actions workflow](.github/workflows/check.yml) runs on pushes, pull
requests, and manual dispatch. It reads Node from `.nvmrc` and Bun from the root
`packageManager` field, reports type checks, tests and generation as separate
steps, and verifies the static shell, service worker, shared branding, and bundled
Archivo/Onest font files. New runs cancel older runs for the same event and ref.

## Boundaries

- **Apps** own routes, navigation, preferences, adapter injection, environment
  settings, rendering mode and PWA manifests.
- **Layers** contain Nuxt-aware frontend code. `@afriff/ui-kit` provides the
  Tailwind plugin, bundled fonts, auto-imported `Ui*`/`Brand*` components and
  public assets. Each app sets `data-theme="dark"` or `data-theme="light"` on
  `<html>` and manages its own theme preference.
- **Packages** contain framework-independent code. `@afriff/validation` defines
  Zod schemas and inferred query types. `@afriff/api` re-exports those types with
  the other shared models, provides the API contract and mock adapter, and owns
  money/date formatting and programme helpers. It depends on validation; neither
  package depends on Nuxt, Vue, apps or layers. Only the explicit mock DB entry
  point uses browser storage.

Import contracts/errors from `@afriff/api`, shared models from `@afriff/api/types`,
helpers from `@afriff/api/format`, `/programme` or `/filters`, and opt into
`@afriff/api/mock` or `@afriff/api/firebase` for an adapter. The root API entry
loads neither. `@afriff/api/orders` holds the order rules both adapters share.
The PWA's utility files re-export helpers for Nuxt auto-imports; URLs stay in the
app. The mock adapter validates film and screening queries with the shared
schemas and reports invalid input as `ApiError('validation')`.

The mock adapter keeps what attendees create (accounts, orders, tickets,
payments) in `localStorage` through its own `mockDb` module; seed data stays
read-only. The Firebase adapter keeps nothing itself: Firestore's offline cache and
Firebase Auth's session live in IndexedDB. In both, accounts sign in with an email
and a password, and the adapter owns the session.

The PWA requires sign-in before any festival page or app navigation is available.
Only sign-in, account creation, password recovery and the handler for links in
account emails (`/auth/action`) are accessible without a session. Protected links
return to their original destination after authentication.

Local dependencies use `workspace:*`. Plain packages expose TypeScript source
for the consumer's bundler to compile, so no separate package build is needed.
The Cloud Functions are the exception: `apps/functions/build.ts` bundles them,
because Firebase installs dependencies with npm, which cannot resolve workspaces.
The Nuxt app checks the UI layer; API and validation have independent type checks.

## Reusing the UI layer

A Nuxt app declares `"@afriff/ui-kit": "workspace:*"`, `tailwindcss`, and the
Nuxt/Vue/Vue Router versions required by the layer's peer dependencies. Its config:

```ts
export default defineNuxtConfig({
  extends: ['@afriff/ui-kit'],
  components: [{ path: '~/components', pathPrefix: false, extensions: ['vue'] }],
  css: ['~/assets/css/main.css'],
})
```

The workspace dependency resolves `@afriff/ui-kit` to `layers/ui-kit`. In the
app's `app/assets/css/main.css`:

```css
@import "tailwindcss" source(none);
@import "@afriff/ui-kit/styles/theme.css";
@source "../..";
```

The layer stylesheet registers its shared component sources; the app registers
its own source tree. Tokens and Tailwind share one CSS entry.

New apps get their own private package name and `dev`, `build`, `typecheck`,
`postinstall`, and optional `generate` scripts. Add a root `dev:<app>` shortcut
with a distinct port. The workspace-wide commands discover new apps automatically.

See the [PWA guide](apps/pwa/README.md), [brand guide](brand/README.md), and
[frontend roadmap](docs/ROADMAP-attendee-fe.md).
