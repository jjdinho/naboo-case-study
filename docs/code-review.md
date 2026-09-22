# Code review — cleanup TODOs

Review of the existing codebase (2026-09-21). Grouped by urgency; each item names the files involved.

## Urgent defects

- [ ] **Password hash exposed in GraphQL.** `back-end/src/user/user.schema.ts` puts `@Field()` on `password`, so `schema.gql` exposes `User.password: String!` — any client can query the bcrypt hash. Remove the decorator (see also the DTO-split item below).
- [ ] **Stale cookie breaks the whole site.** The GraphQL context factory inlined in `back-end/src/app.module.ts` throws `UnauthorizedException` when a present token fails to verify, so an expired `jwt` cookie makes even public queries (`getActivities`, `getCities`) fail. Only reject in the guard, for protected operations.
- [x] **Broken import.** `front-end/src/services/cities.ts` imports `City` from `@/utils`, but no `City` type exists anywhere in the repo — `tsc --noEmit` (and therefore `next build`) fails on it. Planned fix (verified locally on 2026-09-21, then reverted to keep this branch review-only): define and export `City` in `services/cities.ts` with the geo.api.gouv.fr shape (`nom`, `code`, `departement?: { code, nom }` — `ActivityForm` only uses `nom`) and drop the `@/utils` import; typecheck then passes. Note: the other front-end typecheck error (`EmptyData.tsx` svg import) is a fresh-checkout artifact — gitignored `next-env.d.ts` doesn't exist until the first `next dev`/`next build`, not a real defect.
- [ ] **Regex injection.** `ActivityService.findByCity` passes the raw client string into `$regex` (ReDoS / unexpected matching). Escape the input.
- [ ] **Seeder runs on every boot in every environment.** `back-end/src/app.service.ts` (`onApplicationBootstrap`) creates accounts with known passwords, including in prod. Gate it to dev.

## Architecture

- [ ] **One auth module of record.** Auth is spread across ~15 files with three token transports (httpOnly cookie, localStorage `token`, `jwt` header) that are never reconciled. **Decided: the cookie is the single transport; the client derives "logged in" from `getMe` (delete, don't build).**
  - [ ] Back-end: move token extract/verify out of the `app.module.ts` context factory into the auth module, behind the guard (also fixes the stale-cookie site-wide failure above).
  - [ ] Back-end: `login` returns the `User`, not `access_token` — nothing consumes a token in the body anymore.
  - [ ] Back-end: drop the write-only `user.token` column and `updateToken` (written, never read).
  - [ ] Back-end: shorten `JWT_EXPIRATION_TIME` — it's ~31 years today, and with no revocation the expiry is the only bound on a stolen token. Set `SameSite=Lax` (+ `secure` in prod) on the cookie in `auth.resolver.ts`.
  - [ ] Front-end: `AuthProvider` runs `getMe` on mount; `user`-or-`null` is the whole auth state. Delete the localStorage token logic in `contexts/authContext.tsx` (a stored JWT is an XSS-readable credential).
  - Defense: one source of truth — the httpOnly cookie is what the API checks, and the client can't read it (httpOnly), so ask the API. Known tradeoff: brief loading state on hard navigations. Documented next step (out of scope): SSR-resolved auth — resolve `me` in the shared `getServerSideProps` helper and redirect server-side, replacing the HOCs.
- [ ] **Split GraphQL types from Mongoose schemas.** `Activity`/`User` are simultaneously the Mongoose `Document` and the GraphQL `@ObjectType`, so stored fields are exposed by default (root cause of the password leak). Separate output types from persistence schemas. Prerequisite for Mode debug: `role` must be exposed on the current-user (`Me`) type only, never on the shared `User`/owner type — otherwise `getActivities { owner { role } }` reveals who the admins are.
- [ ] **Deepen the entity services.** `ActivityService`/`UserService` are 1–3-line pass-throughs onto the Mongoose models. Make them the module of record for Activity/User rules: query construction, regex escaping, not-found semantics. Move `activity.populate('owner')` out of `back-end/src/activity/activity.resolver.ts:36` into the service behind a DataLoader (current shape is N+1: one owner lookup per activity).
- [ ] **One SSR fetch helper.** Six pages copy-paste the same `getServerSideProps` block (`index`, `discover`, `my-activities`, `activities/[id]`, `explorer/index`, `explorer/[city]`) and only two forward the auth cookie. Extract a helper that always forwards cookies.
- [ ] **Single config seam per side.** Back-end mixes `ConfigService` with raw `process.env` (`MONGO_URI` in `app.module.ts`, `FRONTEND_DOMAIN` ×2 in `auth.resolver.ts`, `FRONTEND_URL` in `main.ts`). Front-end hard-codes URLs in `graphql/apollo.ts`, `services/axios.ts`, `services/cities.ts`. Route everything through one config module / env vars.

## Upcoming features (design notes)

**Favoris** — add an activity to favorites, view them on the profile, reorder them.

- Model: an ordered `favoriteActivityIds: ObjectId[]` on the User document — array order *is* display order; reordering = one mutation that replaces the array. No join collection, no position field.
- `ActivityService.findByIds` is the fetch path (kept off the dead-code list for this). Caveat: `$in` does not preserve order — re-sort results to match the stored id array.
- `pages/profil.tsx` already declares a `favoriteActivities` prop — that's the landing spot.
- Mutations: `addFavorite(activityId)` / `removeFavorite(activityId)` / `reorderFavorites(activityIds)`; validate that the reorder ids are a permutation of the stored list.

**Mode debug** — show `createdAt` on activity cards when the logged-in user is an admin.

- `Activity.createdAt` is already stored (`timestamps: true`) and exposed in GraphQL (nullable `DateTime`) — nothing to add server-side for the date itself.
- Missing piece: expose `role` on the current-user (`Me`) type only — see the DTO-split item above.
- Front-end: add `createdAt` to the activity fragment; gate display with `me.role === 'admin'` in the card. The client check is a rendering hint — the date isn't confidential; if a field ever is, guard it server-side instead.
- [ ] `role` must never come from client input: `UserService.createUser` accepts `SignUpInput & { role?: ... }` today (mass-assignment shape) — tighten it while implementing this.

## Cleanup / dead code

- [ ] Fold `MeModule`/`MeResolver` (one line: `userService.getById(jwtPayload.id)`) into the user module.
- [ ] Merge the mirror HOCs `hocs/withAuth.tsx` / `hocs/withoutAuth.tsx` into one.
- [ ] Delete dead code: `countDocuments` (both services) and `UserService.setDebugMode`/`debugModeEnabled` — zero callers, and its update is silently dropped because `debugModeEnabled` is not in the Mongoose schema (strict mode drops unknown paths). It stays dead even after the Mode debug task, which conditions on role, not a persisted toggle. Removal verified to compile on 2026-09-21, then reverted — kept here as a note. Reclassified 2026-09-21: `ActivityService.findByIds` and the `favoriteActivities` prop in `pages/profil.tsx` are scaffolding for the Favoris task (see Upcoming features) — keep them.
- [ ] Remove dead module wiring: `Activity` model registered in `user.module.ts` but never injected; `seed.module.ts` provides `UserService`/`ActivityService` while also importing the modules that export them.
- [ ] Reuse `graphql/fragments/activity.ts` in the `createActivity` mutation instead of re-listing the selection set.
- [ ] Harden the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); return 409/400 instead of `UnauthorizedException` (401) for duplicate-email signup.

## Naming / domain language

- [ ] One name per concept across layers: `getActivitiesByUser` (GraphQL) vs `GetUserActivities` (front-end doc) vs `findByUser` (service); `login`/`register` vs `signIn`/`signUp` vs `Signin`; `SignInDto.access_token` is the only snake_case field in the schema.
- [ ] The current-user query wears two names: the back-end exposes `getMe`, but the front-end document is named `GetUser` (`graphql/queries/auth/getUser.ts` — it selects `getMe` inside). Rename the document/file to `GetMe`/`getMe.ts`: "me" is the right word for the cookie-derived current user, and it stays distinct from any future get-user-by-id. Matters more now that `getMe` is the client's auth source of truth.
- [ ] "City" means two things: a distinct string on Activity (back-end) vs a `{nom, departement}` record from geo.api.gouv.fr (front-end). Name one differently or define a shared type.
- [ ] Document the repo convention: `getByEmail`/`getById` throw, `findByEmail` returns null.

## Test surface

- [ ] Replace the `toBeDefined()`-only specs (`activity/activity.service.spec.ts`, `user/user.service.spec.ts`) with behavior tests through the service interface — in-memory Mongo is already wired.
- [ ] Cover auth failure paths (wrong password, duplicate signup, expired token) and the `findByCity` `$and`/`$regex` filter logic.
- [ ] Front-end: test `contexts/authContext.tsx`, the HOCs, and `ActivityForm` (currently untested).
