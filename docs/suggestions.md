# Code review — suggestions

Review of `naboo-case-study` as of 2026-09-22.

Scope: I fixed the contained defects (each its own PR, listed below) and left
everything structural as a recommendation. Where a change would have meant
rewriting a subsystem, it belongs here as a proposal, not in the diff.

Each item states the problem, why it matters, and the smallest change that
resolves it. Ordered by value, not by effort.

---

## What the codebase gets right

Worth saying, because these are what make the rest cheap to fix.

- **Clean module boundaries.** Nest modules map one-to-one onto domains
  (`activity`, `user`, `auth`, `me`). Adding Favoris meant touching one module.
- **Code-first GraphQL.** Decorators on the source of truth, `schema.gql`
  generated — the schema can't drift from the resolvers.
- **Generated front-end types.** `codegen.yml` derives TS types from the same
  schema, so a back-end rename surfaces as a front-end compile error.
- **Consistent naming convention for failure.** `getById`/`getByEmail` throw,
  `findByEmail` returns `null`. Undocumented, but followed everywhere.
- **In-memory Mongo already wired** for tests — the expensive part of testing a
  Mongoose codebase is done.

---

## Fixed (merged)

| Defect | Where | PR |
|---|---|---|
| Password hash exposed in GraphQL schema | `user/user.schema.ts` | #2 |
| Broken `City` import — `next build` failed | `services/cities.ts` | #3 |
| Regex injection in city search | `activity.service.ts` | #4 |
| Seeder created known-password accounts in every env | `app.service.ts` | #5 |
| Dead code and dead module wiring | several | #6 |
| Activity fragment re-listed instead of reused | `createActivity.ts` | #7 |
| Stale cookie broke *public* queries site-wide | `app.module.ts` | #9 |
| No CI | `.github/workflows/ci.yml` | #8 |

---

## 1. Auth: one token transport

**Problem.** Three transports coexist and are never reconciled: an httpOnly
cookie, a `jwt` request header (`app.module.ts:36`), and a `token` in
localStorage (`contexts/authContext.tsx:54,70,96`). A fourth copy is persisted
to `user.token` (`user.schema.ts:30`) by `updateToken` — written, never read.

**Why it matters.** No single answer to "is this user logged in", so the three
can disagree. The localStorage copy is the worst of them: a JWT in localStorage
is readable by any XSS on the page, and it outlives the cookie.

**Suggestion.** Make the httpOnly cookie the only transport.

- Drop the `jwt` header branch and the localStorage token.
- `AuthProvider` calls `getMe` on mount; `user`-or-`null` *is* the auth state.
  The client can't read an httpOnly cookie, so it asks the API. Delete, don't
  build.
- `login` returns the `User`, not `access_token` — nothing consumes a body
  token once the cookie is set.
- Drop `user.token` and `updateToken`.

**Also.** `JWT_EXPIRATION_TIME=999999999` is ~31 years. With no revocation
path, expiry is the only bound on a stolen token — shorten it (7 days is
reasonable here) and set `SameSite=Lax`, plus `secure` in production.

**Tradeoff.** A brief loading state on hard navigations, because auth resolves
in a round-trip. The fix is SSR-resolved auth: resolve `me` in the shared
`getServerSideProps` helper (§4) and redirect server-side, which also retires
the `withAuth`/`withoutAuth` HOCs.

> I implemented this, then reverted it (PR #13). It was the right diagnosis and
> the wrong scope for a review — 33 file-touches on a subsystem nobody asked me
> to change. Recorded here as the recommendation it should have been.

---

## 2. Follow NestJS conventions

**Problem.** Nest already has a designated place for several things this
codebase hand-rolls. The result isn't just unidiomatic — one of them is
fail-open.

**Why it matters.** Framework seams are where a Nest developer looks first.
Work placed somewhere else is invisible to them, and to the framework's own
wiring.

| Convention | Today |
|---|---|
| The guard owns token extraction and verification | ~35 lines of auth logic inlined in the GraphQL context factory in `app.module.ts:20-55` — the root module does auth |
| Global `APP_GUARD` + `@Public()` opt-out | `@UseGuards(AuthGuard)` repeated at three call sites (`activity.resolver.ts:51,79`, `me.resolver.ts:13`) |
| `@CurrentUser()` param decorator | Resolvers reach into the context by hand: `context.jwtPayload.id` (`activity.resolver.ts:55,84`, `me.resolver.ts:17`) |
| One flat file layout per module | `me/resolver/me.resolver.ts` is nested; every other module is flat (`activity/activity.resolver.ts`) |
| Built-in HTTP exception types | Duplicate-email signup throws `UnauthorizedException` (`auth.service.ts:52`) where Nest ships `ConflictException` |

**The one that isn't cosmetic:** guards are opt-in today, so a new protected
resolver is unguarded until someone remembers the decorator. Registering
`AuthGuard` as a global `APP_GUARD` and marking public operations `@Public()`
inverts that — the default becomes closed, and the exceptions are declared
where you can see them.

**Suggestion.** Take the rows in order; each is independent and small. Moving
token handling into the guard (row 1) also removes the reason `app.module.ts`
imports `JwtService` at all.

**Sequencing.** Row 1 overlaps §1 — settle which transports exist before moving
the code that reads them, or you will move it twice.

---

## 3. Split GraphQL types from Mongoose schemas

**Problem.** `Activity` and `User` are simultaneously the Mongoose `Document`
and the GraphQL `@ObjectType`. Persistence fields are exposed by default —
opt-out, not opt-in.

**Why it matters.** This is the root cause of the password leak (#2), not a
sibling of it. The same shape will leak the next sensitive field added to the
schema, silently.

**Suggestion.** Separate output types from persistence schemas. One GraphQL
type per read model; the Mongoose schema stays internal.

**Concretely, for Mode debug:** `role` must live on the current-user type
(`Me`) only, never on the shared `User`/owner type — otherwise
`getActivities { owner { role } }` enumerates the admins.

**Related.** `UserService.createUser` takes `SignUpInput & { role?: ... }`
(`user.service.ts:35-41`) and spreads it straight into the model. `role` must
never be reachable from client input.

---

## 4. One SSR fetch helper

**Problem.** Six pages copy the same `getServerSideProps` block — `index`,
`discover`, `my-activities`, `activities/[id]`, `explorer/index`,
`explorer/[city]`. Only two of them (`my-activities`, `activities/[id]`)
forward the auth cookie.

**Why it matters.** The inconsistency *is* the bug: a page that forgets the
cookie renders logged-out for a logged-in user, and the next copy-paste
inherits whichever version was nearest.

**Suggestion.** Extract one helper that always forwards cookies. Four pages
change behaviour; that's the point.

---

## 5. Deepen the entity services

**Problem.** `ActivityService` and `UserService` are mostly 1–3 line
pass-throughs onto the Mongoose models, so query construction leaks into
resolvers.

**Why it matters.** Rules that live in resolvers get re-implemented per
resolver. The regex injection (#4) was exactly this: query building in a place
with no ownership of it.

**Suggestion.** Make the services the module of record for their entity —
query construction, input escaping, not-found semantics.

**Specifically:** move `activity.populate('owner')` out of
`activity.resolver.ts:36` into the service, behind a DataLoader. The current
shape is N+1 — one owner lookup per activity in the list.

---

## 6. Single config seam per side

**Problem.** The back-end mixes `ConfigService` with raw `process.env`
(`MONGO_URI` in `app.module.ts`, `FRONTEND_URL` in `main.ts`). The front-end
hard-codes URLs in `graphql/apollo.ts`, `services/axios.ts`,
`services/cities.ts`.

**Why it matters.** No single place to answer "what does this need to run?",
and hard-coded URLs mean the front-end can only ever point at one environment.

**Suggestion.** One config module per side; everything reads through it.

---

## 7. Validation and error semantics

- Harden the global `ValidationPipe` (`main.ts:11`) with `whitelist`,
  `forbidNonWhitelisted`, `transform`. Unknown fields are currently accepted
  and passed along — the same permissiveness behind the `role` issue in §3.
- Duplicate-email signup returns 401 where it means 409 — a conflict, not an
  auth failure. Listed as a convention row in §2; the semantic point is that
  the status code is part of the API contract, not just an exception class.

---

## 8. Naming

One concept, one name, across layers.

| Concept | Names in use |
|---|---|
| List a user's activities | `getActivitiesByUser` (GraphQL) · `GetUserActivities` (front-end doc) · `findByUser` (service) |
| Authenticate | `login`/`register` · `signIn`/`signUp` · `Signin` |
| Current user | `getMe` (back-end) · `GetUser` (front-end doc, selects `getMe` inside) |

Two specifics:

- Rename the front-end document to `GetMe`/`getMe.ts`. "Me" is the right word
  for the cookie-derived current user, and it stays distinct from a future
  get-user-by-id.
- **"City" means two different things:** a plain string on `Activity`
  (back-end) and a `{nom, departement}` record from geo.api.gouv.fr
  (front-end). Give one of them a different name, or define a shared type.
- `SignInDto.access_token` is the schema's only snake_case field.

Worth documenting the `get*` throws / `find*` returns null convention — it's
consistently followed and currently only discoverable by reading the bodies.

---

## 9. Test surface

The service specs started as `toBeDefined()` only. Two now carry real
coverage — `findByCity` (added with the regex fix, #4) and a create/get
round-trip on `UserService` — so the pattern is established and the remaining
gaps are just unwritten.

- **Back-end, uncovered:** auth failure paths — wrong password, duplicate
  signup, expired token. These are the branches where a regression is silent
  and expensive.
- **Front-end, uncovered:** `contexts/authContext.tsx`, the `withAuth`/
  `withoutAuth` HOCs, and `ActivityForm`. The auth context is the highest value
  of the three, especially if §1 makes it the single source of auth state.
- In-memory Mongo (`mongodb-memory-server`) is already wired, so back-end
  service tests cost nothing to add.

---

## 10. Smaller items

- Fold `MeModule`/`MeResolver` (one line: `userService.getById(...)`) into the
  user module.
- Merge the mirror HOCs `hocs/withAuth.tsx` and `hocs/withoutAuth.tsx` into one
  — or retire both, if §1's SSR-resolved auth lands.
