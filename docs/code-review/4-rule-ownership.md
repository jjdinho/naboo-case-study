# 4. Put each rule in the layer that owns it

Paths are relative to `back-end/src/` or `front-end/src/`.

### Pattern

`ActivityService` and `UserService` are mostly one-to-three line pass-throughs,
so rules land wherever was convenient: query construction in resolvers (the
regex injection, #4, was one), value checks only on the GraphQL input,
uniqueness only in a MongoDB index, and errors in whichever exception was
nearest. Each rule then holds on one path and not another.

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

### Direction

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

### Effect on the project

A rule holds whoever calls: the seeder, a script, a future REST route. A signup
race returns 409, and clients can branch on status codes. Each move is a small,
independent PR. 401 → 409 changes the contract, but the front-end shows a
generic error either way. A Mongoose `min` rejects existing bad documents on
their next save, so check the data first. If theme 1 is planned, do it first: it
rewrites the same services.

### Evidence

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

### How you'd verify it

Service tests: `create` with price 0 is rejected without the input DTO; two
concurrent `signUp`s with one email give one user and one `ConflictException`.
E2E: `getActivity(id: "nope")` is a `BAD_REQUEST`, a duplicate signup is a 409,
and the #19 validation test passes with the copied pipe line removed.