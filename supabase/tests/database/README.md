# Database tests

Put transactional pgTAP tests in `*.test.sql` here. Run with `bun run db:test`
after starting the local stack and applying migrations.

For each feature cover constraints, grants, RLS for anonymous and authenticated
roles, access across two users, and privileged RPC boundaries. Use `begin`, a
test plan, assertions, `finish()` and `rollback` so fixtures cannot escape a test.
Include storage policies when adding buckets. Keep these tests next to schema
work; TypeScript adapter tests cannot prove database authorization.

No SQL test suite exists yet because no application tables have been added.
