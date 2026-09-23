# Code review — suggestions

This is a living document which gets updated as work gets done.
Contained defects are fixed and merged (table below). The rest is grouped into
seven themes, ordered by value: the pattern behind a set of findings, what would
change, and what it would cost.

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

Paths below are relative to `back-end/src/` or `front-end/src/`.

---

## 1. Separate the API from storage

**The pattern.** `User` and `Activity` are each one class that is both the
Mongoose document and the GraphQL type, so a stored field stays private only if
nobody adds `@Field` to it. That is how the password hash reached the schema
(#2). It is also why `role` (Mode debug) and favorites can't be fields on
`User`: `User` is also `Activity.owner`, and `getActivities` needs no login, so
`getActivities { owner { role } }` would list the admins. And resolvers receive
full Mongoose documents, so `owner` calls `populate` once per activity (N+1) and
no read uses `.lean()`.

**The direction.**

- Give the GraphQL types their own classes; the Mongoose schema stays internal
  to its module. Services return plain objects, resolvers map them.
- `Activity.owner` becomes a public `Owner` type (names only). `getMe` already
  returns its own `Me` type, added for `role` (Mode debug); favorites can live
  there too.
- Resolve `owner` through a DataLoader: one `$in` query per request instead of
  one per activity.

**Effect on the project.** A new stored field is private until someone writes
an output type for it, and a list of activities costs two queries at any
length. It's the largest theme: every resolver and service in `activity`,
`user`, `me` and `favorite` changes, plus a mapping per type. There is no data
migration, and the public schema shouldn't change at all. Do it before adding
anything else user-specific to `User`; it also unlocks lean reads (theme 5).

**Evidence.**

- `user/user.schema.ts:12-14`, `activity/activity.schema.ts:6-8` — one class,
  both roles.
- `user/user.schema.ts:18,29,32,35` — `role`, `email`, `password`, `token` kept
  private by omission; `:38-44` — favorites kept off for the same reason.
- `activity/activity.resolver.ts:34-38` — `populate('owner')` per activity.

**How you'd verify it.** The CI schema diff (#16) should show no change. Replace
the "not exposed" e2e tests (`email`, `password`, `favoriteActivityIds`, `role`
on `owner`) with one that lists each public type's fields against an allowlist,
so an unintended field fails CI. A resolver test counts queries for
`getActivities { owner { id } }`: two, whatever the list length.

## 2. One owner for identity

**The pattern.** The token lives in four places: an httpOnly cookie, a `jwt`
header, localStorage, and `user.token`, which every login writes and nothing
reads. Three layers share checking it: the GraphQL context factory verifies
it, the guard only checks a payload exists, and resolvers read
`context.jwtPayload.id` by hand — typed non-null, though anonymous requests
carry `null`. So there's no single answer to "is this user logged in". The
localStorage copy is XSS-readable and outlives the cookie, and the stale-cookie
outage (#9) came from the same split. Guards are opt-in, so a new operation is
public until someone remembers the decorator. Tokens last ~31 years with no
revocation.

**The direction.**

- The cookie is the only transport. Drop the `jwt` header, the localStorage
  token, `user.token` and `updateToken`. `login` returns the `User`, not
  `access_token`, and `AuthProvider` calls `getMe` on mount: user-or-`null` *is*
  the auth state.
- The guard owns verification. The context factory shrinks to `{ req, res }`,
  and `app.module.ts` no longer needs `JwtService`.
- Closed by default: a global `APP_GUARD`, with `@Public()` on the public
  queries. Favoris's class-level guard (#21) is the local version of this.
- A `@CurrentUser()` parameter decorator would replace the seven hand-written
  reads and the mistyped context. Recommended, not yet decided; it would be its
  own PR.
- Tokens expire in ~7 days, with `SameSite=Lax` and `secure` in production.
- Login gives one answer for an unknown email and a wrong password. Today they
  differ, so anyone can check whether an address has an account; #30 stopped
  emails being listed, not checked. Signup leaks the same way, and only email
  verification closes that.
- Once theme 3's fetch helper resolves `me` on the server and redirects there,
  the `withAuth`/`withoutAuth` HOCs can go. Until then, merge the two mirror
  images into one.

**Effect on the project.** One source of truth for login state, a token XSS
can't read, a forgotten decorator that fails closed, and a stolen token that
expires in a week. It touches login and logout on both sides and every guarded
resolver. Hard navigations show a loading state, since auth costs a round trip,
until the server resolves `me`. Shortening token lifetime logs everyone out
once. Settle the transport before moving verification into the guard, or the
same code moves twice; `@Public()` is independent and the cheapest step.

**Evidence.**

- `app.module.ts:37` — the header branch; `contexts/authContext.tsx:54,70,96`
  — localStorage; `user/user.schema.ts:36` and `auth/auth.service.ts:29` —
  `user.token`.
- `app.module.ts:35-56` — verification in the context factory;
  `auth/auth.guard.ts:15` — the guard's null check.
- `auth/types/context.ts:4` — typed non-null; `app.module.ts:39` — `null` when
  anonymous.
- `@UseGuards` at four sites: `activity/activity.resolver.ts:51,79`,
  `me/resolver/me.resolver.ts:13`, `favorite/favorite.resolver.ts:13`.
- `context.jwtPayload.id` read by hand: `activity.resolver.ts:55,84`,
  `me.resolver.ts:17`, `favorite.resolver.ts:21,29,37,45`.
- `JWT_EXPIRATION_TIME=999999999` in `back-end/.env.dist`.
- `auth/auth.service.ts:21` — an unknown email throws "User not found";
  `:25` — "Wrong credentials provided"; `:52` — a taken email is a 401.

**How you'd verify it.** Back-end e2e tests for the failure paths, where a
regression is silent: wrong password, expired token, no cookie on each
protected operation. One e2e test lists every query and mutation from the
schema and asserts which are public, so a new operation fails until someone
classifies it. On the front-end, test `authContext.tsx` (user-or-`null` after
mount, login and logout) and the HOCs.

## 3. Front-end data flow and naming

**The pattern.** Six pages each copy the same `getServerSideProps` block, all
through one module-level Apollo client that every request shares, and each copy
decides for itself what to forward and what to do on failure.

- Until #26, that client answered from its cache: `/my-activities` showed a
  second user the first user's activities, and server-rendered lists stayed
  stale until restart. A `no-cache` default fixed it; the client is still
  shared.
- `/my-activities` returns HTTP 500 when logged out: its query throws before
  `withAuth` can redirect in the browser.
- Only `my-activities` and `activities/[id]` forward the cookie, so a page that
  forgets renders logged-out for a logged-in user.

Around the data, one concept has several names across layers, and each hook is
matched with its document's types by hand.

**The direction.**

- One server-side fetch helper: a new client per request, the cookie always
  forwarded, and an unauthenticated error turned into a redirect to `/signin`.
  A client per request makes #26's isolation structural instead of a setting,
  and brings back caching within a request, which `no-cache` gives up:
  repeated queries are answered once, and the server's results can pre-fill
  the browser's cache.
- Documents carry their types. CI already fails when the schema or generated
  types drift (#16); what it can't see is a hook given the wrong document's
  types. graphql-codegen's `client-preset` generates `TypedDocumentNode`s, so
  `useQuery(GetMeDocument)` infers its types and a mismatched pair can't
  compile.
- One concept, one name:

  | Concept | Names in use |
  |---|---|
  | List a user's activities | `getActivitiesByUser` (GraphQL) · `GetUserActivities` (front-end doc) · `findByUser` (service) |
  | Authenticate | `login`/`register` · `signIn`/`signUp` · `Signin` |
  | Current user | `getMe` (back-end) · `GetUser` (front-end doc, selects `getMe` inside) |

  Rename the front-end document to `GetMe`. "City" is a plain string on
  `Activity` and a `{nom, departement}` record from geo.api.gouv.fr on the
  front-end: rename one, or share a type. `SignInDto.access_token`, the
  schema's only snake_case field, goes away with theme 2. Document the `get*`
  throws / `find*` returns `null` convention.
- `<title>{activity.name} | CDTR</title>` renders an array of children and
  triggers a React warning; use one template string.

If the two apps ever deploy separately, build-time checks stop being enough: a
browser running yesterday's bundle talks to today's server. Then a schema
registry (Apollo GraphOS, GraphQL Hive), persisted queries and expand-contract
changes (add, deprecate, migrate, drain, remove) earn their keep. Not worth it
with one repo and one deploy.

**Effect on the project.** A logged-out visitor gets a redirect instead of a
500, every page sees the user, server-resolved auth becomes possible (theme 2),
and keeping users apart no longer rests on one fetch-policy line. The helper
touches seven files: itself and the six pages, four of which change behaviour —
that's the point. `client-preset`
is a mechanical change across all 15 hook and `query` calls; nothing depends on
it. Do it before the renames, so the compiler checks them.

**Evidence.**

- `graphql/apollo.ts:3` — the shared client, `:11` — its `no-cache` default;
  `pages/_app.tsx:14` — also the browser's.
- `getServerSideProps` in six pages; the cookie forwarded at
  `pages/my-activities.tsx:27` and `pages/activities/[id].tsx:28` only.
- `contexts/authContext.tsx:48` — types matched to `GetUser` by hand.
- `services/cities.ts:4` — the front-end `City`; `auth/types/auth.dto.ts:6` —
  `access_token`.
- `pages/activities/[id].tsx:40` — the `<title>`.

**How you'd verify it.** #26's test sends two cookies through the shared client
and expects two answers; with the helper, it moves to the helper. A logged-out
call returns a redirect rather than throwing. Test `ActivityForm`, which has no
coverage.

## 4. Put each rule in the layer that owns it

**The pattern.** `ActivityService` and `UserService` are mostly one-to-three
line pass-throughs, so rules land wherever was convenient: query construction
in resolvers (the regex injection, #4, was one), value checks only on the
GraphQL input, uniqueness only in a MongoDB index, and errors in whichever
exception was nearest. Each rule then holds on one path and not another.

- `@Min(1)` on price is only on the GraphQL input; the seeder calls `create`
  directly and skips it.
- Signup checks `findByEmail`, then creates. Two simultaneous signups with one
  email are stopped only by the unique index, whose duplicate-key error nothing
  catches, so it surfaces as a 500. Read from the code, not observed.
- A duplicate-email signup is a 401 (`UnauthorizedException`) where the
  contract means 409.
- Update queries skip Mongoose validators unless passed `runValidators: true`,
  and skip `pre('save')` hooks; Favoris introduced the first ones.
  `updateToken` is the one load-edit-save: two round trips and a
  read-modify-write window for what could be one `$set`.
- `getActivity` takes `id: String!` where the rest of the schema uses `ID`, so
  a malformed id reaches Mongo and fails as a 500.
- The `ValidationPipe` is installed in `main.ts` and copied into the e2e setup;
  until #19, the copy was missing.
- `MeModule` is one one-line resolver, nested a level deeper than every other
  module; `@Resolver('Auth')` / `@Resolver('Me')` pass name strings that do
  nothing in a code-first app.

**The direction.**

- Services are the module of record for their entity: query construction,
  input escaping, not-found semantics, business rules. Resolvers only translate
  GraphQL.
- Put each rule where every write passes through it. Value rules go on the
  Mongoose schema (`min: 1`) as well as the input. Uniqueness stays in the
  index, and the service maps the duplicate-key error to `ConflictException`,
  so the pre-check becomes an optimisation, not the guarantee.
- Update queries pass `runValidators: true`; single-field writes are atomic
  `$set`s.
- Ids are typed `ID` and checked with `@IsMongoId` everywhere, as Favoris does.
- Register the `ValidationPipe` as `APP_PIPE` in the module, so tests and
  production get the same setup.
- Fold `MeModule` into the user module; drop the name strings.

**Effect on the project.** A rule holds whoever calls: the seeder, a script, a
future REST route. A signup race returns 409, and clients can branch on status
codes. Each move is a small, independent PR. 401 → 409 changes the contract,
but the front-end shows a generic error either way. A Mongoose `min` rejects
existing bad documents on their next save, so check the data first. If theme 1
is planned, do it first: it rewrites the same services.

**Evidence.**

- `activity/activity.inputs.dto.ts:21` — `@Min(1)`; `seed/seed.service.ts:31`
  — the seeder's direct `create`; `activity/activity.schema.ts:25` — `required`
  only.
- `auth/auth.service.ts:50,54` — check, then create; `:52` — the 401;
  `user/user.schema.ts:29` — the unique index.
- `favorite/favorite.service.ts:35-40,45-50,60-68` — update queries;
  `user/user.service.ts:45-52` — `updateToken`.
- `activity/activity.resolver.ts:74` — `id: String`.
- `main.ts:11`, `app.e2e.spec.ts:22` — the two pipes.
- `me/resolver/me.resolver.ts:8,17`, `auth/auth.resolver.ts:6`.

**How you'd verify it.** Service tests: `create` with price 0 is rejected
without the input DTO; two concurrent `signUp`s with one email give one user
and one `ConflictException`. E2E: `getActivity(id: "nope")` is a
`BAD_REQUEST`, a duplicate signup is a 409, and the #19 validation test passes
with the copied pipe line removed.

## 5. Use MongoDB deliberately

**The pattern.** The only index besides `_id` is the unique `email`, and no
list is paginated. At seed size that's invisible; as the catalog grows, every
list query scans the whole collection and returns all of it.

| Query | Filter and sort | Index it needs |
|---|---|---|
| `findByUser` | `owner`, newest first | `{ owner: 1, createdAt: -1 }` |
| `findAll`, `findLatest` | newest first | `{ createdAt: -1 }` |
| `findByCity` | `city`, optional `price` | `{ city: 1, price: 1 }` |
| `findCities` | `distinct('city')` | the same `city` index |

`findByCity`'s case-insensitive `name` regex can't use an index; the `city`
match narrows it first. Favorites are the counter-example: always read for one
user by `_id`, so they need no index.

Mongoose also builds every declared index when the app starts. In production,
a new index on a large collection builds during the deploy, competing with live
traffic, and a new unique index that existing data violates fails to build.

**The direction.**

- Declare the indexes above on the schemas.
- Paginate lists with a cursor on `createdAt` and `_id`, which the
  `createdAt` index serves.
- Build indexes before deploy, not at boot: `autoIndex: false` in production
  and a release step that runs `syncIndexes`.
- Read with `.lean()` once theme 1 stops handing documents to resolvers.

**Effect on the project.** List latency and memory stay flat as the catalog
grows. Indexes are cheap now: a little write overhead, and seed-sized builds
are instant. Pagination is the expensive part — it changes the `getActivities`
contract and every list page. Add the indexes first, since they change no
contract. Paginate alongside theme 3's helper, which touches the same pages.

**Evidence.**

- `user/user.schema.ts:29` — the only index.
- `activity/activity.service.ts:17,21,25,55,59` — the queries above;
  `:17` — `findAll` returns the whole collection.

**How you'd verify it.** Run each list query's `explain()` against the
in-memory Mongo and assert an index scan, not a collection scan. Page through
N+1 activities with a page size of N and see each once, in order.

## 6. Config and environments

**The pattern.** Config is read three ways and validated nowhere. The back-end
mixes `ConfigService` with raw `process.env`, and the front-end hard-codes its
URLs, so it can only ever point at one environment. With no validation schema,
a missing variable fails at first use: a missing `JWT_SECRET` only shows up
when someone logs in. Development settings ship to production: the GraphQL
playground is always on. The tooling drifts the same way. The database scripts
call `docker-compose`, but the repo has no compose file. The back-end enforces
Prettier in CI; the front-end has neither the dependency nor a config. A fresh
install under npm's `ignore-scripts` fails on bcrypt (theme 7).

**The direction.**

- One config module per side. The back-end reads everything through
  `ConfigService`, with a validation schema that fails at boot and names what's
  missing. The front-end reads its API URL from the environment.
- Environment-dependent settings come from config: the playground only outside
  production.
- A clean clone works: add the compose file the scripts expect, and pin
  Prettier on the front-end with the back-end's config, checked in CI.

**Effect on the project.** A misconfigured deploy fails at boot with a clear
message instead of at the first login, and the front-end can target staging.
It's all small; `.env.dist` already lists every variable the schema needs.
Formatting the front-end once is a large, mechanical diff, so it gets its own
PR. The validation schema is the cheapest first step.

**Evidence.**

- `app.module.ts:77` (`MONGO_URI`), `main.ts:10` (`FRONTEND_URL`),
  `auth/auth.resolver.ts:18,35` (`FRONTEND_DOMAIN`) — raw `process.env`.
- `graphql/apollo.ts:6`, `services/axios.ts:3` — hard-coded URLs.
- `app.module.ts:20` — `ConfigModule.forRoot` without validation; `:33` —
  `playground: true`.
- `back-end/package.json:16-18` — `docker-compose` scripts; `back-end/.prettierrc`
  is the only Prettier config.

**How you'd verify it.** A test boots the config module without `JWT_SECRET`
and expects it to throw. CI runs `prettier --check` on the front-end.

## 7. Keep dependencies current

**The pattern.** `npm audit --omit=dev`, 2026-09-23: 48 vulnerable packages on
the back-end (9 critical, 25 high) and 8 on the front-end (2 critical), one of
them Next with 35 advisories. Nothing updates dependencies or reports new
advisories, so the backlog only grows. Three back-end dependencies are imported
nowhere: `@apollo/gateway`, `ts-morph`, `class-transformer-validator`.

**The direction**, ranked by risk. Each tier's after-count was simulated on
scratch copies of the lockfiles.

1. **Within current ranges.** Drop the three unused dependencies, run
   `npm update` on the back-end (down to 19: 1 critical, 6 high) and
   `npm audit fix` on the front-end (down to 3). One small PR, but the lockfile
   diff is large, so the test suite is what vouches for it.
2. **Back-end majors.** The remaining critical is `tar`, via bcrypt 5's
   `node-pre-gyp`. bcrypt 6 ships prebuilt binaries, so it also installs under
   npm's `ignore-scripts`, where bcrypt 5 fails. The multer, lodash and ws highs
   sit under the Nest 10 packages, and Nest 10 → 12 moves every `@nestjs/*`
   package together.
3. **Next 13.** 13.5.11, the last 13.x, still carries 31 of the 35. About
   two-thirds need features this app doesn't use (App Router, Server Actions,
   middleware), so the exposure is smaller than the count. The only real fix is
   a current major: a project, not a PR.
4. **Mantine.** Three majors behind but with no advisories, and v7 replaces
   Emotion with CSS modules, so every styled component changes. Leave it until
   something forces it.

To stop it recurring: Dependabot security updates for the backlog, and
`actions/dependency-review-action` on PRs, which fails only when the PR itself
adds a vulnerable dependency. A plain `npm audit` gate would go red on
advisories published overnight, against PRs that didn't touch dependencies.

**Effect on the project.** Tier 1 clears 8 of the 9 back-end criticals for one
small PR. Tier 2 is a framework upgrade with a real blast radius; tier 3 is a
project. Prevention is a Dependabot config and one CI step. Do tier 1 first; it
also shrinks the diff tier 2 has to review.

**Evidence.**

- `back-end/package.json:27,39,46` — the three unused dependencies; `:37` —
  bcrypt 5.
- `front-end/package.json:27` — Next 13.4.10; `:19` — Mantine 6.

**How you'd verify it.** The full test suites, build and a browser pass after
each tier; `npm audit --omit=dev` matches the simulated after-count.

---

## Improved while building the features

| Change | Why it belonged with the feature | PR |
|---|---|---|
| The e2e test app installs the `ValidationPipe` | Favoris's e2e tests check id validation, which only runs with the pipe | #19 |
| `findByIds` returns results in the order asked | Favorites are an ordered id array read through it, and `$in` ignores order | #20 |
| New id arguments are typed `ID` and checked with `@IsMongoId` | Every favorites operation takes an activity id; a malformed one is a `BAD_REQUEST`, not a 500 | #21 |
| Favorites are written with single atomic updates, the codebase's first update queries | No read-modify-write window, and `$addToSet` makes adding idempotent | #21, #22 |
| The auth guard sits on the whole favorites resolver class | Every operation is per-user, so a new one requires login by default | #21 |
