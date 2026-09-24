# 1. Separate the API from storage

Paths are relative to `back-end/src/` or `front-end/src/`.

### Problem

The stored class is also the published one, which makes it hard to control what
the API exposes, and hard to batch fetches (e.g. with a DataLoader) to avoid N+1
queries.

### Suggestion

Separate the stored class from the published one.

### Impact

This would unlock: private-by-default fields, per-user data on `User`, every
activity's owner fetched in one batched query, and lean reads (theme 5).

### Current state

`User` and `Activity` each use one class for two jobs: it defines what MongoDB
stores and what the API returns (`user/user.schema.ts:12-14`,
`activity/activity.schema.ts:6-8`). So every stored field is one `@Field` away
from being public: `role`, `email`, `password` and `token` are private only by
omission (`user/user.schema.ts:18,29,32,35`). That is how the password hash
reached the schema (PR #2).

It also blocks new fields. Every activity returns its owner as a `User`, and
`getActivities` needs no login. Put `role` on `User` and anyone could run
`getActivities { owner { role } }` to list the admins. Favorites have the same
problem, which is why they're kept off `User` (`user/user.schema.ts:38-44`).

Currently, resolvers get full Mongoose documents, not plain objects. So `owner`
runs one `populate` per activity (N+1, `activity/activity.resolver.ts:34-38`),
and no read uses `.lean()`.

### Changes needed

- Give the GraphQL types their own classes; the Mongoose schema stays internal
  to its module. Services return plain objects, resolvers map them.
- `Activity.owner` becomes a public `Owner` type (names only), replacing
  `User` in the schema. `register` only needs the new user's id (the Signup
  document selects `id`), so it returns `ID!`. `getMe` already returns its own
  `Me` type, added for `role` (Mode debug); favorites can live there too.
- Resolve `owner` through a DataLoader: one `$in` query per request instead of
  one per activity.

### Cost

It's the largest code review theme: every resolver and service in `activity`,
`user`, `me` and `favorite` changes, plus a mapping per type. There is no data
migration. The public schema changes in two places: `Activity.owner` is typed
`Owner`, and `register` returns `ID!`. No client selects more than names and
ids, so the front-end only regenerates its types and retargets the `Owner`
fragment (`graphql/fragments/owner.ts:4`). That's affordable now because the
app has no users yet and the front-end and back-end are meant to deploy
together, so no old client queries the new schema. Once either changes, a
rename needs theme 3's expand-contract steps. Do it before adding anything else
user-specific to `User`.

### How you'd verify it

The CI schema diff (PR #16) should show only those two changes. Replace the "not exposed"
e2e tests (`email`, `password`, `favoriteActivityIds`, `role` on `owner`) with
one that lists each public type's fields against an allowlist, so an unintended
field fails CI. A resolver test counts queries for
`getActivities { owner { id } }`: two, whatever the list length.
