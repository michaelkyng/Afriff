# Edge Functions

Create each independently deployable endpoint with:

```sh
bun run supabase functions new <function-name>
```

Use a per-function `deno.json` to pin dependencies; Edge Functions run in Deno,
outside the Bun/Nuxt workspace. Put shared function-only code in `_shared/` when
there is an actual second consumer. Do not import frontend modules or Bun-only
workspace entry points into functions.

Keep handlers small: parse and validate inputs, authenticate the caller,
authorize the operation, then execute domain logic. User-driven queries should
use the caller's JWT so RLS applies. Create elevated clients only inside trusted
operations after authorization; never return or log secret keys or tokens.

Payment webhooks need provider signature verification and idempotency. Ticket
issuance, stock changes and scan redemption need database transactions/RPCs,
not multiple independent browser writes. Configure JWT verification per
function based on its caller; do not disable it globally.

Local secrets belong in an ignored `.env` file. Hosted secrets are configured
with the Supabase secret store. Do not put them in `NUXT_PUBLIC_*` settings.
