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

---

## Suggested codebase Improvements

Below are 7 codebase improvements that can be introduced to this project. They are more architectural and would touch many files, thus they were out of scope while implementing the Favoris and Mode Debug features. Each is its own initiative.

### 1. Separate the API from storage

Separate the GraphQL classes from the MongoDB classes, so the API only shows
what we choose to expose and can benefit from batched fetching. Today it's hard
to add a private field to `User` or `Activity`, because each one class is both
what's stored and what's published: one `@Field` makes a stored field public
(that's how the password hash leaked, PR #2). With the split, resolvers work
with plain objects, and a DataLoader fetches every activity's owner in one query
instead of one per activity, so a list costs two queries at any length.

[Read more: code-review/1-api-and-storage.md](code-review/1-api-and-storage.md)

### 2. One owner for identity

Give login one owner, the cookie for transport and the guard for verification,
so there's one answer to "is this user logged in" and a stolen token stops
working within a week. Today it's hard to say who is logged in, because the
token lives in four places (one readable by any XSS), three layers each check
part of it, and tokens last ~31 years. With one owner, every operation is closed
by default with `@Public()` opt-outs, so a forgotten decorator fails closed
instead of leaving an operation public.

[Read more: code-review/2-identity.md](code-review/2-identity.md)

### 3. Front-end data flow and naming

Fetch server-side data through one helper, so every page keeps users apart, sees
the logged-in user and fails the same way. Today it's hard to trust a
server-rendered page, because six pages each copy the same fetch block through
one client that every request shares, and each copy decides for itself what to
forward and how to fail: the shared client is how one user's activities were
shown to another (PR #26), and a copy that throws is why `/my-activities`
returns a 500 when logged out. With the helper, each request gets its own
client, the cookie is always forwarded and a logged-out visitor is redirected;
alongside it, typed documents let the compiler catch a hook given the wrong
types, and each concept gets one name.

[Read more: code-review/3-front-end-data-flow.md](code-review/3-front-end-data-flow.md)

### 4. Put each rule in the layer that owns it

Put each rule in the layer that owns it, so it holds whoever calls (the seeder,
a script, a future REST route) and clients get status codes they can act on.
Today it's hard to know whether a rule holds, because rules land wherever was
convenient: the seeder skips price validation, a signup race surfaces as a 500,
and a malformed id reaches Mongo. With services owning their entity's rules,
every write passes through them, so duplicate keys become a 409 and updates run
validators; at the API boundary, ids are typed and checked everywhere.

[Read more: code-review/4-rule-ownership.md](code-review/4-rule-ownership.md)

### 5. Use MongoDB deliberately

Index and paginate the queries the app actually runs, so list latency and memory
stay flat as the catalog grows. Today it's hard to grow the catalog, because
every list query scans and returns the whole collection: the only index besides
`_id` is on email, and no list is paginated. With the four indexes the queries
need, cursor pagination and, once theme 1 lands, `.lean()` reads, a page costs
the same at any catalog size, and building indexes in a release step keeps
deploys from competing with their own index builds.

[Read more: code-review/5-mongodb.md](code-review/5-mongodb.md)

### 6. Config and environments

Read config through one validated module per side, so a misconfigured deploy
fails at boot with a clear message and the front-end can target staging. Today
it's hard to trust an environment, because config is read three ways and
validated nowhere: a missing `JWT_SECRET` only shows up at the first login, the
GraphQL playground ships to production, and the front-end hard-codes its URLs.
With one module, environment-dependent settings come from config, and a clean
clone works too: the compose file the scripts expect, and Prettier on the
front-end.

[Read more: code-review/6-config.md](code-review/6-config.md)

### 7. Keep dependencies current

Update dependencies in four tiers ranked by risk and automate what comes next,
so known vulnerabilities get cleared and new ones are caught in the PR that adds
them. Today it's hard to keep up, because nothing updates dependencies or
reports new advisories: 48 vulnerable back-end packages (9 critical) and 8 on
the front-end (2 critical), and the backlog only grows. With tier 1, one small
in-range PR clears 8 of the 9 back-end criticals, and Dependabot plus a
dependency-review check on pull requests stop the backlog from rebuilding.

[Read more: code-review/7-dependencies.md](code-review/7-dependencies.md)

---

## Work done along the way

### Fixes (merged)

These are fixes that were deemed critical enough to go ahead and implement within the scope of the case study.

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


### Improved while building the features (merged)

These are surgical improvements that I was able to implement without growing scope or blast radius during the case study.

| Change | Why it belonged with the feature | PR |
|---|---|---|
| The e2e test app installs the `ValidationPipe` | Favoris's e2e tests check id validation, which only runs with the pipe | #19 |
| `findByIds` returns results in the order asked | Favorites are an ordered id array read through it, and `$in` ignores order | #20 |
| New id arguments are typed `ID` and checked with `@IsMongoId` | Every favorites operation takes an activity id; a malformed one is a `BAD_REQUEST`, not a 500 | #21 |
| Favorites are written with single atomic updates, the codebase's first update queries | No read-modify-write window, and `$addToSet` makes adding idempotent | #21, #22 |
| The auth guard sits on the whole favorites resolver class | Every operation is per-user, so a new one requires login by default | #21 |
| Codegen types `DateTime` as `string`, not `any` | The Mode debug card formats `createdAt`, the first date the front-end reads | #31 |
| Front-end tests resolve the `@/` import alias | The card's test is the first to render a component that imports through it | #31 |
