# 4. Keep business logic in the service layer

Paths are relative to `back-end/src/` or `front-end/src/`.

### Problem

Business logic sits wherever it happened to be written: resolvers, input DTOs,
a MongoDB index. So it holds on one path and not another.

### Suggestion

Keep business logic in the services (Nest's providers), and enforce it where
every write passes through, using Nest's own tools: a global `ValidationPipe`,
an exception filter, and `@IsMongoId` on every id.

### Impact

This would unlock: business logic that holds for every caller (the seeder, a
script, a future REST route), and status codes clients can act on, such as a
signup race returning 409. It also improves maintainability: each entity's
business logic lives in one service, so there's one place to read it, test it
and change it.

### Current state

`ActivityService` and `UserService` are mostly one-to-three line pass-throughs,
so business logic lands wherever was convenient: query construction in
resolvers (the regex injection, PR #4, was one), value checks only on the
GraphQL input, uniqueness only in a MongoDB index, and errors in whichever
exception was nearest.

- `@Min(1)` on price is only on the GraphQL input
  (`activity/activity.inputs.dto.ts:21`; the schema has `required` only,
  `activity/activity.schema.ts:25`). The seeder calls `create` directly and
  skips it (`seed/seed.service.ts:38`).
- Signup checks `findByEmail`, then creates (`auth/auth.service.ts:50,54`). Two
  simultaneous signups with one email are stopped only by the unique index
  (`user/user.schema.ts:29`), whose duplicate-key error nothing catches, so it
  surfaces as a 500. Read from the code, not observed.
- A duplicate-email signup is a 401 (`UnauthorizedException`,
  `auth/auth.service.ts:52`) where the contract means 409.
- Update queries skip Mongoose validators unless passed `runValidators: true`,
  and skip `pre('save')` hooks; Favoris introduced the first ones
  (`favorite/favorite.service.ts:35-40,45-50,60-68`). `updateToken` is the one
  load-edit-save: two round trips and a read-modify-write window for what could
  be one `$set` (`user/user.service.ts:52-59`).
- `getActivity` takes `id: String!` where the rest of the schema uses `ID`, so
  a malformed id reaches Mongo and fails as a 500
  (`activity/activity.resolver.ts:74`).
- The `ValidationPipe` is installed in `main.ts:11` and copied into the e2e
  setup (`app.e2e.spec.ts:25`); until PR #19, the copy was missing.
- `MeModule` is one one-line resolver, nested a level deeper than every other
  module; `@Resolver('Auth')` / `@Resolver('Me')` pass name strings that do
  nothing in a code-first app (`me/resolver/me.resolver.ts:8,17`,
  `auth/auth.resolver.ts:6`).

### Changes needed

- Services own their entity's business logic: query construction, input
  escaping, not-found semantics. Resolvers only translate GraphQL.
- Validate where every write passes through. The `ValidationPipe` checks the
  GraphQL input; the Mongoose schema repeats value checks (`min: 1`) for writes
  that bypass it, like the seeder. Uniqueness stays in the index.
- An exception filter maps Mongo's duplicate-key error to `ConflictException`,
  in one place for every collection, so signup's pre-check becomes an
  optimisation, not the guarantee. Signup throws `ConflictException`, not
  `UnauthorizedException`, for a taken email.
- Update queries pass `runValidators: true`; single-field writes are atomic
  `$set`s.
- Ids are typed `ID` and checked with `@IsMongoId` everywhere, as Favoris does.
- Register the `ValidationPipe` as a global pipe through `APP_PIPE` in
  `AppModule`, so tests and production get the same setup.
- Fold `MeModule` into the user module; drop the name strings.

### Cost

Each move is a small, independent PR. 401 → 409 changes the contract, but the
front-end shows a generic error either way. A Mongoose `min` rejects existing
bad documents on their next save, so check the data first. If theme 1 is
planned, do it first: it rewrites the same services.

### How you'd verify it

Service test: `create` with price 0 is rejected without the input DTO. E2E: two
concurrent `signUp`s with one email give one user and one 409, a duplicate
signup is a 409, `getActivity(id: "nope")` is a `BAD_REQUEST`, and the PR #19
validation test passes with the copied pipe line removed.
