# Supabase foundation

This directory owns the backend infrastructure for all AFRIFF apps. The attendee
PWA still uses its mock API. No hosted project is linked, no business tables have
been created, and no live authentication or Supabase adapter is enabled.

```text
supabase/
  config.toml                local Supabase services and auth configuration
  migrations/                ordered SQL schema, grants, RLS, storage and RPC changes
  seed.sql                   deterministic local fixtures, after migrations
  functions/                 Deno Edge Functions, one directory per endpoint
  tests/database/            pgTAP constraints and authorization tests
packages/supabase/
  src/index.ts               typed browser client factory
  src/database.types.ts      database types; bootstrap until first generation
scripts/
  generate-database-types.mjs local generation with atomic file replacement
```

## Dependency boundaries

The intended request path is:

```text
PWA pages/stores → useApi() → AttendeeApi adapter → @afriff/supabase → Supabase
```

- `supabase/` owns database authorization and trusted server operations.
- `@afriff/supabase` owns SDK initialization and generated database types. It
  does not import Nuxt, Vue, domain models or application environment settings.
- `@afriff/api` owns the public domain contract. When implemented, its explicit
  `/supabase` entry should contain feature repositories, database-to-domain
  mappers and error translation to `ApiError`. Add the workspace dependency then;
  keep SDK imports out of the root contract entry and the mock adapter.
- Apps own configuration, client lifecycle, session integration and adapter
  injection. Components continue to use `useApi()` rather than table queries.

Create one browser client in a client-only Nuxt plugin when implementing the
adapter. Pass `runtimeConfig.public.supabaseUrl` and
`runtimeConfig.public.supabasePublishableKey` to `createBrowserClient`. The
factory accepts modern `sb_publishable_` keys and rejects other key types. Keep
secret/service-role clients inside trusted server code, never in this package's
browser exports. SSR, if introduced, needs separate request-scoped clients and
cookie handling.

The package is available in the workspace but is deliberately not an app
dependency yet. The reserved PWA environment settings do not enable an adapter.
Only add an `apiMode: 'supabase'` branch when the complete contract is implemented.

## Local development

Install Docker Desktop (or a compatible running Docker daemon), then from the
repository root:

```sh
bun install
bun run db:start
bun run db:status
```

Studio is at `http://127.0.0.1:54323`, the API at `http://127.0.0.1:54321`, and
local email at `http://127.0.0.1:54324`. Copy the local publishable key reported
by the CLI into `apps/pwa/.env` when wiring the adapter. Never commit credentials.
The existing app can run with `bun run dev:pwa` without Docker or Supabase.

| Command | Purpose |
| --- | --- |
| `bun run db:start` | Start the local stack |
| `bun run db:stop` | Stop the local stack |
| `bun run db:status` | Show local service status and connection details |
| `bun run db:migration:new <name>` | Create an ordered SQL migration |
| `bun run db:reset` | Recreate the **local** database, replay migrations and seed |
| `bun run db:lint` | Lint the local database |
| `bun run db:test` | Run local pgTAP tests |
| `bun run db:types` | Generate public-schema types from the local database |
| `bun run functions:serve` | Serve local Edge Functions |
| `bun run supabase <command>` | Access the pinned CLI |

`db:reset` deletes local database data. It is never part of app startup or normal
frontend CI. Type generation preserves the previous file if the CLI fails.

## Adding a feature

1. Define the feature's domain contract and shared validation.
2. Add a SQL migration containing constraints, indexes, explicit grants and RLS
   policies together. Keep internal tables in an unexposed schema. Add storage
   buckets/policies through migrations if the feature needs uploads.
3. Add deterministic local fixtures and pgTAP tests, including access denied to
   another attendee. Use transactions for inventory, orders and redemption.
4. Run `db:reset`, `db:lint`, `db:test`, then `db:types`. Commit the migration,
   tests and regenerated types together.
5. Implement repository queries and map database rows to existing domain models
   in the API adapter. Test the adapter contract and run `bun run check`.

Do not use generated database rows as UI models. Database snake_case, nullable
columns and joined records must be mapped to the existing camelCase contracts.
Frontend CI currently checks the client package but does not start Docker;
add a database CI job with migrations and pgTAP when the first schema lands.

## Authentication integration

The mock auth flow uses emailed codes, verification tickets and a reusable
six-digit PIN. This is not a drop-in Supabase Auth contract. Decide whether to
adopt Supabase email OTP/password authentication or implement the PIN flow as a
trusted service with rate limits and a reviewed credential/session design.
Do not copy mock credential storage or implement PIN checking in the browser.

Supabase must become the authority for access and refresh tokens when connected.
Adapt the app's persisted session and `setAuthToken` lifecycle to token refresh,
sign-out and expiry; do not keep a second independent mock session. PKCE auth
also needs an implemented callback route and exact redirect allow-list entries.
The local config currently lists only existing app entry URLs.

## Hosted environments

Use separate Supabase projects for staging and production. After choosing a
target explicitly, use `bun run supabase login`, `bun run supabase link
--project-ref <ref>`, and review pending SQL with `bun run supabase db push
--dry-run` before applying `bun run supabase db push`. For an existing database,
first capture its schema with `db pull` and reconcile migration history locally.
Do not reset a linked database or seed production with development fixtures.

Set hosted Auth URLs, mail delivery, provider settings and function secrets for
each environment. Local `config.toml` alone does not configure a hosted project.
Static PWA public settings are baked into generated output, so rebuild on changes.

References: [local development](https://supabase.com/docs/guides/local-development),
[migrations](https://supabase.com/docs/guides/deployment/database-migrations),
[database types](https://supabase.com/docs/guides/api/rest/generating-types),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
