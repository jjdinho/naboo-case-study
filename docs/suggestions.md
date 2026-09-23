# Code review — suggestions

Review of `naboo-case-study`, 2026-09-22. Contained defects are fixed and
merged (table below); anything structural is left as a recommendation here.
Ordered by value.

---

## What the codebase gets right

- **Clean module boundaries.** Nest modules map one-to-one onto domains — so
  Favoris lands in one module.
- **Code-first GraphQL.** `schema.gql` is generated from the resolvers rather
  than hand-written, so drift is at least mechanically detectable (§10).
- **Generated front-end types.** `codegen.yml` derives TS from that schema, so a
  back-end rename can surface as a front-end compile error — once the
  generators actually run (§10).
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

---

## 1. Auth: one token transport

Four copies of the token, never reconciled — an httpOnly cookie, a `jwt` header
(`app.module.ts:36`), localStorage (`authContext.tsx:54,70,96`), and
`user.token` (`user.schema.ts:30`), written by `updateToken` and never read.
So there's no single answer to "is this user logged in", and the localStorage
copy is XSS-readable and outlives the cookie.

Make the cookie the only transport:

- Drop the `jwt` header branch and the localStorage token.
- `AuthProvider` calls `getMe` on mount; `user`-or-`null` *is* the auth state.
- `login` returns the `User`, not `access_token`.
- Drop `user.token` and `updateToken`.
- `JWT_EXPIRATION_TIME=999999999` is ~31 years. With no revocation, expiry is
  the only bound on a stolen token — shorten to ~7 days, add `SameSite=Lax` and
  `secure` in prod.

Tradeoff: a loading state on hard navigations, since auth costs a round-trip.
SSR-resolved auth removes it later — resolve `me` in the §4 helper and redirect
server-side, which also retires the `withAuth`/`withoutAuth` HOCs.

## 2. Follow NestJS conventions

Nest has a designated place for several things this codebase hand-rolls, and
one of them is fail-open.

| Convention | Today |
|---|---|
| Guard owns token extraction | ~35 lines of auth in the GraphQL context factory (`app.module.ts:20-55`) |
| Global `APP_GUARD` + `@Public()` | `@UseGuards(AuthGuard)` at three sites (`activity.resolver.ts:51,79`, `me.resolver.ts:13`) |
| `@CurrentUser()` param decorator | Resolvers read `context.jwtPayload.id` by hand (`activity.resolver.ts:55,84`, `me.resolver.ts:17`) |
| Flat layout per module | `me/resolver/me.resolver.ts` is nested; every other module is flat |
| Built-in HTTP exceptions | Duplicate-email signup throws `UnauthorizedException` (`auth.service.ts:52`), not `ConflictException` |

Row 2 is the one that isn't cosmetic: guards are opt-in, so a new protected
resolver is unguarded until someone remembers the decorator. A global
`APP_GUARD` plus `@Public()` inverts the default to closed.

Rows are independent and small. Row 1 also removes `app.module.ts`'s only
reason to import `JwtService` — but it overlaps §1, so settle the transports
first or you'll move the same code twice.

## 3. Split GraphQL types from Mongoose schemas

`Activity` and `User` are simultaneously the Mongoose `Document` and the
GraphQL `@ObjectType`, so stored fields are exposed opt-out. That's the root
cause of the password leak (#2), not a sibling of it — the same shape will
leak the next sensitive field silently.

Separate output types from persistence schemas; the Mongoose schema stays
internal.

For Mode debug specifically: `role` belongs on the current-user type (`Me`)
only, never the shared owner type — `getActivities { owner { role } }` would
enumerate the admins. Related: `createUser` takes `SignUpInput & { role?: ... }`
(`user.service.ts:35-41`) and spreads it into the model, so `role` is reachable
from client input.

## 4. One SSR fetch helper

Six pages copy the same `getServerSideProps` block; only `my-activities` and
`activities/[id]` forward the auth cookie. The inconsistency *is* the bug — a
page that forgets renders logged-out for a logged-in user, and the next
copy-paste inherits whichever version was nearest.

Extract one helper that always forwards cookies. Four pages change behaviour;
that's the point.

## 5. Deepen the entity services

`ActivityService` and `UserService` are mostly 1–3 line pass-throughs, so query
construction leaks into resolvers and gets re-implemented per resolver — the
regex injection (#4) was exactly that. Make the services the module of record
for their entity: query construction, input escaping, not-found semantics.

Specifically, move `activity.populate('owner')` out of
`activity.resolver.ts:36` into the service behind a DataLoader. It's N+1 today
— one owner lookup per activity.

## 6. Single config seam per side

The back-end mixes `ConfigService` with raw `process.env` (`MONGO_URI` in
`app.module.ts`, `FRONTEND_URL` in `main.ts`); the front-end hard-codes URLs in
`graphql/apollo.ts`, `services/axios.ts`, `services/cities.ts` — so it can only
ever point at one environment. One config module per side.

## 7. Validation and error semantics

- Harden the global `ValidationPipe` (`main.ts:11`) with `whitelist`,
  `forbidNonWhitelisted`, `transform`. Unknown fields pass through today — the
  same permissiveness behind the `role` issue in §3.
- Duplicate-email signup returns 401 where it means 409. Beyond the exception
  class (§2), the status code is part of the API contract.

## 8. Naming

One concept, one name, across layers.

| Concept | Names in use |
|---|---|
| List a user's activities | `getActivitiesByUser` (GraphQL) · `GetUserActivities` (front-end doc) · `findByUser` (service) |
| Authenticate | `login`/`register` · `signIn`/`signUp` · `Signin` |
| Current user | `getMe` (back-end) · `GetUser` (front-end doc, selects `getMe` inside) |

- Rename the front-end document to `GetMe`/`getMe.ts` — and keep it distinct
  from any future get-user-by-id.
- **"City" means two things:** a plain string on `Activity` (back-end) and a
  `{nom, departement}` record from geo.api.gouv.fr (front-end). Rename one, or
  define a shared type.
- `SignInDto.access_token` is the schema's only snake_case field.
- Document the `get*` throws / `find*` returns null convention — it's followed
  everywhere and discoverable only by reading the bodies.

## 9. Test surface

Two specs now carry real coverage — `findByCity` (added with #4) and a
create/get round-trip on `UserService` — so the pattern is set and the gaps are
just unwritten. In-memory Mongo is already wired, so back-end service tests
cost nothing to add.

- **Back-end:** auth failure paths — wrong password, duplicate signup, expired
  token. These are where a regression is silent.
- **Front-end:** `contexts/authContext.tsx`, the HOCs, `ActivityForm`. The auth
  context is the highest value, especially if §1 makes it the single source of
  auth state.

## 10. Schema drift

Three artifacts derive from the Nest resolvers, each by a manual step:

```
@ObjectType / @Query decorators
  └─ autoSchemaFile, at server boot ─▶ back-end/schema.gql
       └─ cp, in `generate-types` ───▶ front-end/src/graphql/schema.gql
            └─ graphql-codegen ──────▶ front-end/src/graphql/generated/types.ts
                 └─ imported by 14 components and pages
```

Nothing enforced any hop. `schema.gql` only regenerates when someone boots the
server, and codegen only runs when someone remembers — so a resolver change can
ship with a stale schema, and a committed `generated/types.ts` typechecks the
front-end green against types the server no longer serves. The stale artifact
actively vouches for code that is now wrong.

**Now enforced.** The back-end e2e spec boots the GraphQL module, so `npm test`
already rewrites `schema.gql` via `autoSchemaFile` as a side effect — CI just
diffs the result. Adding a query to a resolver leaves all 13 tests passing and
fails on that diff alone, which is the point: the tests cannot see schema drift.

The front-end's `schema.gql` and `generated/types.ts` are no longer committed,
so they cannot be stale. The schema stays committed on the back-end, where it
is the reviewable contract — a reviewer should feel something when it changes.

Cost: a fresh clone must run `generate-types` before `dev` or `build`, which
the readme now says. Automating that is less trivial than it looks — npm's
`pre*` hooks are the idiomatic place, but they are silently skipped under
`ignore-scripts`, so it would have to be chained inside each script instead.

### Still hand-matched: documents and their types

Type arguments are paired with their documents by hand:

```ts
useLazyQuery<GetUserQuery, GetUserQueryVariables>(GetUser)  // authContext.tsx:48
```

Nothing stops `useQuery<GetActivitiesQuery, GetActivitiesQueryVariables>(GetCities)` —
TypeScript accepts it and you get a fully-typed lie. No schema check catches
this; it is drift entirely inside the front-end.

graphql-codegen's `client-preset` fixes this with `TypedDocumentNode`: the
generated document carries its own types, so `useQuery(GetUserDocument)` infers
everything and the mismatch becomes unrepresentable. This is where most
TypeScript GraphQL codebases have landed since ~2023.

Left undone — it is a real refactor across all 14 call sites, and nothing above
depends on it.

### If the two apps ever deploy separately

Everything above is build-time, and it works only because `back-end/` and
`front-end/` share a repo: a schema change and its client updates land in one
atomic commit, so there is never a window where the two disagree.

Deploying them apart removes that guarantee, and no amount of codegen replaces
it — there is always a period where a browser running yesterday's JS talks to
today's server. That is the point at which a **schema registry** (Apollo
GraphOS, GraphQL Hive, WunderGraph Cosmo) starts to earn its keep:

- the server publishes its schema on deploy, and CI diffs a proposed schema
  against the deployed one, classifying every change breaking or non-breaking;
- the registry ingests **real client traffic**, so "is dropping this field
  safe?" stops being a guess and becomes a data question — *nothing has
  requested it in 90 days* versus *0.3% of yesterday's traffic still does*.
  That information is not in the repository; it is in the traffic.

**Persisted queries** are the client-side half: clients register their
operations at build time and send a hash instead of a document, so the server
holds a manifest of every operation any deployed client can issue and can
validate the entire fleet against a schema change before shipping it.

The discipline that makes either usable costs nothing and should be adopted the
day the split happens — **expand-contract**: add the new field and deploy; mark
the old one `@deprecated` and migrate the client; wait for old clients to drain;
only then remove it. Never remove-and-replace in a single deploy.

None of this is worth adopting today — one repo, one deploy, no third-party
clients, and no traffic to mine.

## 11. Dependencies

`npm audit --omit=dev`, 2026-09-23: 48 advisories on the back-end (9 critical,
25 high), 8 on the front-end (2 critical). Most of the back-end goes away
without a major bump; the front-end is almost all Next.

- **Within current ranges.** Three back-end dependencies are imported nowhere:
  `@apollo/gateway`, `ts-morph`, `class-transformer-validator`. Dropping them
  and running `npm update` takes the back-end to 19 (1 critical, 6 high);
  `npm audit fix` takes the front-end to 3. One small PR. The lockfile diff is
  large, so the test suite is what vouches for it.
- **Back-end majors.** The critical left is `tar`, via bcrypt 5's
  `node-pre-gyp`. bcrypt 6 ships prebuilt binaries instead, so it also loads
  under npm's `ignore-scripts`, where bcrypt 5 fails to. The other highs
  are multer, lodash and ws under the Nest 10 packages; Nest 10 → 12 moves
  every `@nestjs/*` package together.
- **Next 13.** 35 advisories, and staying on 13 doesn't fix them: 13.5.11, the
  last 13.x, still carries 31. About two-thirds need a feature this app doesn't
  use (App Router, Server Actions, middleware), so the exposure is smaller than
  the count. But the only real fix is a current major, and that is a project,
  not a PR.
- **Not everything behind is a problem.** Mantine is three majors behind with no
  advisories, and 7 replaced Emotion with CSS modules, so every styled
  component changes. Leave it until something forces it.

To keep this from recurring: Dependabot security updates for the backlog, and
`actions/dependency-review-action` on PRs, which fails only when the PR itself
adds a vulnerable dependency. A plain `npm audit` gate would go red on
advisories published overnight, against PRs that didn't touch dependencies.

## 12. Smaller items

- Fold `MeModule`/`MeResolver` (one line: `userService.getById(...)`) into the
  user module.
- Merge the mirror HOCs `withAuth.tsx` / `withoutAuth.tsx` into one — or retire
  both, if §1's SSR-resolved auth lands.
