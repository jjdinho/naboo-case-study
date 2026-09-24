# Code review — suggestions

This is a living document which gets updated as work gets done.
Contained defects are fixed and merged (table below). The rest is grouped into
seven themes, ordered by value. Each has a summary here and its own doc with the
detail: the pattern behind a set of findings, what would change, what it would
cost, and how you'd verify it.

---

## What the codebase gets right

- **Clean module boundaries.** Nest modules map one-to-one onto domains — so
  Favoris landed as one new module.
- **Code-first GraphQL.** `schema.gql` is generated from the resolvers rather
  than hand-written, so drift is mechanically detectable.
- **Generated front-end types.** `codegen.yml` derives TS from that schema, so a
  back-end rename surfaces as a front-end compile error.
- **A convention for failure.** `getById`/`getByEmail` throw, `findByEmail`
  returns `null`. Undocumented, but followed everywhere.
- **In-memory Mongo already wired** — the expensive part of testing Mongoose is
  done.

## Fixed (merged)

Paths are relative to `back-end/src/` or `front-end/src/`.

| Defect | Where | PR |
|---|---|---|
| Password hash exposed in GraphQL schema | `user/user.schema.ts` | #2 |
| Broken `City` import — `next build` failed | `services/cities.ts` | #3 |
| Regex injection in city search | `activity.service.ts` | #4 |
| Seeder created known-password accounts in every env | `app.service.ts` | #5 |
| Dead code and dead module wiring | several | #6 |
| Activity fragment re-listed instead of reused | `createActivity.ts` | #7 |
| No CI | `.github/workflows/ci.yml` | #8 |
| Stale cookie broke *public* queries site-wide | `app.module.ts` | #9 |
| Schema and front-end types could drift from the resolvers unnoticed | `.github/workflows/ci.yml` | #16 |
| Server-rendered pages shared cached query results across users | `graphql/apollo.ts` | #26 |
| `createUser` stored a `role` passed in its input; it now never sets one | `user/user.service.ts` | #28 |
| Every activity owner's email was public through `Activity.owner` | `user/user.schema.ts` | #30 |
| Signing in after a logout showed the previous user, from the browser's cache | `contexts/authContext.tsx` | #33 |
| Logging out sent a request on every render of the `/logout` page; it's now a menu action | `routes.ts`, `components/Topbar/MenuItem.tsx` | #34 |
| Signing in landed on `/`, not `/profil`: the sign-in page redirected mid-navigation | `contexts/authContext.tsx` | #35 |

---

## 1. Separate the API from storage

Any stored field is one `@Field` away from being public (that's how the password
hash reached the schema, #2), and every activity's owner costs its own database
query. Give the API its own output classes: services return plain objects,
resolvers map them, and a DataLoader fetches every owner in one query. A new
field stays private until someone chooses to expose it, a list costs two queries
at any length, and user-specific data can be added without leaking through
`Activity.owner`.

[Details](code-review/1-api-and-storage.md)

## 2. One owner for identity

Nothing gives one answer to "is this user logged in": the token lives in four
places (one readable by any XSS), three layers each check part of it, a new
operation is public unless someone remembers the guard, and tokens last ~31
years. Make the cookie the only transport and the guard the only verifier, close
every operation by default with `@Public()` opt-outs, and expire tokens after a
week. Login state gets one source of truth, a stolen token stops working within
a week, and a forgotten decorator fails closed instead of open.

[Details](code-review/2-identity.md)

## 3. Front-end data flow and naming

Six pages copy the same server-side fetch block and each decides what to forward
and how to fail. That's how one user's activities were shown to another (#26),
why `/my-activities` returns a 500 when logged out, and why a page that forgets
the cookie renders logged-out. One fetch helper with a client per request, the
cookie always forwarded and unauthenticated errors turned into redirects, plus
typed documents and one name per concept. Users are kept apart by design rather
than by one setting, logged-out visitors get a redirect instead of a 500, and
the server can resolve the user, which lets theme 2 retire the
`withAuth`/`withoutAuth` redirects.

[Details](code-review/3-front-end-data-flow.md)

## 4. Put each rule in the layer that owns it

Rules land wherever was convenient, so each one holds on one path and not
another: the seeder skips price validation, a signup race surfaces as a 500, and
a malformed id reaches Mongo. Services own their entity's rules and every write
passes through them: duplicate keys become a 409, updates run validators, and
ids are checked everywhere. A rule holds whoever calls (the seeder, a script, a
future REST route), and clients get status codes they can act on.

[Details](code-review/4-rule-ownership.md)

## 5. Use MongoDB deliberately

The only index besides `_id` is on email and no list is paginated, so every list
query scans and returns the whole collection: invisible at seed size, slow as
the catalog grows. Declare the four indexes the queries need, paginate with a
cursor, build indexes in a release step instead of at boot, and read with
`.lean()`. List latency and memory stay flat as the catalog grows, and a deploy
no longer competes with its own index builds.

[Details](code-review/5-mongodb.md)

## 6. Config and environments

Config is read three ways and validated nowhere, so a missing `JWT_SECRET` only
shows up at the first login, the GraphQL playground ships to production, and the
front-end can only point at one environment. One validated config module per
side, environment-dependent settings read from it, and a clean clone that works
(the compose file the scripts expect, Prettier on the front-end). A
misconfigured deploy fails at boot with a clear message, and the front-end can
target staging.

[Details](code-review/6-config.md)

## 7. Keep dependencies current

48 vulnerable back-end packages (9 critical) and 8 on the front-end (2
critical), with nothing updating them or reporting new ones, so the backlog only
grows. Four tiers ranked by risk, starting with one small in-range PR, plus
Dependabot and a dependency-review check on pull requests. Tier 1 alone clears 8
of the 9 back-end criticals, and a new vulnerable dependency is caught in the PR
that adds it.

[Details](code-review/7-dependencies.md)

---

## Improved while building the features

| Change | Why it belonged with the feature | PR |
|---|---|---|
| The e2e test app installs the `ValidationPipe` | Favoris's e2e tests check id validation, which only runs with the pipe | #19 |
| `findByIds` returns results in the order asked | Favorites are an ordered id array read through it, and `$in` ignores order | #20 |
| New id arguments are typed `ID` and checked with `@IsMongoId` | Every favorites operation takes an activity id; a malformed one is a `BAD_REQUEST`, not a 500 | #21 |
| Favorites are written with single atomic updates, the codebase's first update queries | No read-modify-write window, and `$addToSet` makes adding idempotent | #21, #22 |
| The auth guard sits on the whole favorites resolver class | Every operation is per-user, so a new one requires login by default | #21 |
| Codegen types `DateTime` as `string`, not `any` | The Mode debug card formats `createdAt`, the first date the front-end reads | #31 |
| Front-end tests resolve the `@/` import alias | The card's test is the first to render a component that imports through it | #31 |
