# Migrations

Create a migration from the repository root:

```sh
bun run db:migration:new create_festival_programme
```

Commit the generated `<timestamp>_<name>.sql` with its database tests and updated
generated types. Applied migrations are immutable; fixes go in a new migration.
SQL migrations are the schema source of truth. Avoid a second declarative schema
tree or untracked Dashboard edits.

Each new exposed table needs explicit grants, enabled row-level security and
policies in the same migration. Test anonymous access, owner access and a second
user's denied access. Index foreign keys and columns used by policies/queries.
Specify constraints, delete behavior and UTC `timestamptz` values explicitly.
Store money as integer minor units with a currency, matching `@afriff/api`.

Do not create application tables until their domain and authorization rules are
defined. This scaffold intentionally has no business schema or production data.
