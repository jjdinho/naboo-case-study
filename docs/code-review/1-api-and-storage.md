# 1. Separate the API from storage

Paths are relative to `back-end/src/` or `front-end/src/`.

### Pattern

`User` and `Activity` are each one class that is both the Mongoose document and
the GraphQL type, so a stored field stays private only if nobody adds `@Field`
to it. That is how the password hash reached the schema (#2). It is also why
`role` (Mode debug) and favorites can't be fields on `User`: `User` is also
`Activity.owner`, and `getActivities` needs no login, so `getActivities { owner
{ role } }` would list the admins. And resolvers receive full Mongoose
documents, so `owner` calls `populate` once per activity (N+1) and no read uses
`.lean()`.

### Direction

- Give the GraphQL types their own classes; the Mongoose schema stays internal
  to its module. Services return plain objects, resolvers map them.
- `Activity.owner` becomes a public `Owner` type (names only). `getMe` already
  returns its own `Me` type, added for `role` (Mode debug); favorites can live
  there too.
- Resolve `owner` through a DataLoader: one `$in` query per request instead of
  one per activity.

### Effect on the project

A new stored field is private until someone writes an output type for it, and a
list of activities costs two queries at any length. It's the largest theme:
every resolver and service in `activity`, `user`, `me` and `favorite` changes,
plus a mapping per type. There is no data migration, and the public schema
shouldn't change at all. Do it before adding anything else user-specific to
`User`; it also unlocks lean reads (theme 5).

### Evidence

- `user/user.schema.ts:12-14`, `activity/activity.schema.ts:6-8` — one class,
  both roles.
- `user/user.schema.ts:18,29,32,35` — `role`, `email`, `password`, `token` kept
  private by omission; `:38-44` — favorites kept off for the same reason.
- `activity/activity.resolver.ts:34-38` — `populate('owner')` per activity.

### How you'd verify it

The CI schema diff (#16) should show no change. Replace the "not exposed" e2e
tests (`email`, `password`, `favoriteActivityIds`, `role` on `owner`) with one
that lists each public type's fields against an allowlist, so an unintended
field fails CI. A resolver test counts queries for `getActivities { owner { id }
}`: two, whatever the list length.