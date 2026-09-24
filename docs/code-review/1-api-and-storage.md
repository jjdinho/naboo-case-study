# 1. Separate the API from storage

Paths are relative to `back-end/src/` or `front-end/src/`.

### Pattern

The problem is that the stored class is also the published one, which makes it hard
to control what the API exposes, and hard to benefit from batched fetches to avoid
N+1 issues (i.e. using a DataLoader). Separating the stored class from the published
one would unlock: private-by-default fields, per-user data on `User`, and every activity's owner
fetched in one batched query.

`User` and `Activity` each use one class for two jobs: it defines what MongoDB
stores and what the API returns. So every stored field is one `@Field` away from
being public. That is how the password hash reached the schema (PR #2).

It also blocks new fields. Every activity returns its owner as a `User`, and
`getActivities` needs no login. Put `role` on `User` and anyone could run
`getActivities { owner { role } }` to list the admins. Favorites have the same
problem.

Currently, resolvers get full Mongoose documents, not plain objects. So `owner`
runs one `populate` per activity (N+1), and no read uses `.lean()`.

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
list of activities costs two queries at any length. It's the largest code review theme:
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
