# AFRIFF

A Bun monorepo with deployable applications, shared Nuxt layers, and plain
TypeScript packages.

```text
apps/
  pwa/                   @afriff/pwa — attendee PWA
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
    src/mock/            local adapter, fixtures and mock storage
    src/index.ts
    package.json
brand/                   source artwork and asset generator
```

Only the attendee PWA is implemented. Admin and scanner can be added under
`apps/` later. The PWA currently uses local mock data; no backend is required.

Supabase infrastructure lives in `supabase/` (local config, migrations, seeds,
Edge Functions and database tests). `packages/supabase/` provides the shared typed
client factory and database types for future API adapters. See the
[Supabase architecture and setup guide](supabase/README.md) for local commands,
security boundaries and the integration workflow. Start the optional local stack
with `bun run db:start` after installing Docker; the app still runs in mock mode.

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
| `bun run dev` / `bun run dev:pwa` | Run the attendee PWA |
| `bun run build` / `bun run build:pwa` | Build with Nitro |
| `bun run generate` / `bun run generate:pwa` | Generate static PWA output |
| `bun run preview:server` | Preview an existing Nitro build |
| `bun run preview:pwa` | Generate and serve the PWA on localhost:4173 |
| `bun run typecheck` | Check the PWA, UI layer, API and validation packages |
| `bun run test` | Run programme, API and validation regression tests |
| `bun run check` | Type checks and tests |
| `bun run brand:assets` | Regenerate assets in `layers/ui-kit` (Python requirements in the brand guide) |

Stop the app's dev server before building: both commands write to `.nuxt`.
For static deployment, run `bun run generate:pwa` from the root and publish
`apps/pwa/.output/public` with an SPA fallback to `index.html`. CI installs using
`bun install --frozen-lockfile`, checks the workspaces, and generates the PWA.
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
`@afriff/api/mock` for mock data. The root API entry does not load mock fixtures.
The PWA's utility files re-export helpers for Nuxt auto-imports; URLs stay in the
app. The mock adapter validates film and screening queries with the shared
schemas and reports invalid input as `ApiError('validation')`.

The mock adapter keeps what attendees create (accounts and sessions today, orders
and tickets later) in `localStorage` through its own `mockDb` module; seed data
stays read-only. Accounts sign in with an email and a six-digit PIN; PINs are
stored salted and hashed, never in the clear.

The PWA requires sign-in before any festival page or app navigation is available.
Only sign-in, account creation and PIN recovery are accessible without a session.
Protected links return to their original destination after authentication; sign-in
uses a masked six-box PIN input with keyboard navigation and paste support.

Local dependencies use `workspace:*`. Plain packages expose TypeScript source
for the consumer's bundler to compile, so no separate package build is needed.
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
