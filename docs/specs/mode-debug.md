# Spec — Mode debug

## Problem

The brief asks for a **Mode debug**: when the logged-in user is an admin,
activity cards show when each activity was created. Admins turn it on and off
with a small floating toggle.

What the codebase brings to this:

- `Activity.createdAt` is already stored (`timestamps: true`) and exposed as a
  nullable `DateTime`. The activity fragment doesn't select it.
- `User.role` is stored (`'user' | 'admin'`) but not exposed. `User` is one
  class serving as the Mongoose document, the `getMe` type and `Activity.owner`,
  so a `@Field` on `role` would let the public
  `getActivities { owner { role } }` list the admins.
- `UserService.createUser` accepts `SignUpInput & { role? }` and spreads it into
  the model. Signup is safe today only because `AuthService.signUp` passes four
  named fields.
- The front-end learns who is logged in from `getMe`, in the browser, after
  mount. Cards render on server-rendered pages that don't know the viewer.
- The e2e tests proving `password` and `favoriteActivityIds` stay private query
  them through `getMe`.
- Codegen maps the `DateTime` scalar to `any`.
- Mantine 6 ships `Affix` for fixed positioning and `useLocalStorage`, which
  keeps every component reading the same key in sync.

## Solution

Expose the current user's role on a new `Me` type returned by `getMe`. Debug
mode is on when the user is an admin and has switched the toggle on; it then
shows the creation date on activity cards.

Back-end:

- A `Role` GraphQL enum (`user`, `admin`), backed by a TypeScript enum. The User
  document stores it as before.
- `getMe: Me!`. `Me` has the fields `getMe` returns today (`id`, `firstName`,
  `lastName`, `email`) plus `role: Role!`. `User`, still `Activity.owner`, gains
  no field.
- `createUser` never sets the role, so every new user is a `user`. Admins are
  promoted by hand in the database; the dev seeder does the same for its admin.

Front-end:

- `GetUser` selects `role`; the activity fragment selects `createdAt`.
- `useDebugMode()` owns the rule: admin, and the toggle on.
- Admins get a floating switch in the bottom-right corner of every page, with a
  bug icon and the label "Mode debug". It's off until they switch it on, and
  this browser remembers it.
- In debug mode, the `Activity` card (home, discover, my-activities) shows a
  dimmed line under the description: `Créée le 23/09/2026 14:32:05` (fr-FR, to
  the second, in the viewer's timezone).

## Decisions

### Do

- **`role` on `Me` only.** A new output type, returned only by `getMe`; the
  shared `User` type gets nothing. It's a first, local step of splitting API
  types from storage, taken only where this feature needs it.
- **A `Role` enum, not a string or an `isAdmin` flag.** The role is the stored
  concept; the front-end decides what admin unlocks. Codegen emits the enum, so
  the card compares against `Role.Admin`, not a string literal.
- **No code path creates an admin.** `createUser` builds the document from the
  four signup fields instead of spreading its input, and has no `role`
  argument. A stray `role` reaching it can't grant admin, and no caller can
  ask for one. Promoting a user is a manual database update, documented in the
  readme.
- **The admin check is a display rule.** `createdAt` is already public in the
  API; hiding it is presentation, not access control. Non-admins still receive
  it. A genuinely sensitive field would need a server-side check.
- **The role is the gate; the toggle is a preference.** Debug mode needs both.
  Setting the flag by hand in localStorage does nothing for a non-admin.
- **Off by default.** Admins see the normal UI until they ask for debug
  information.
- **Remember the toggle in localStorage**, with Mantine's `useLocalStorage`.
  It survives reloads and keeps the switch and every card in sync, with no
  provider and no back-end change. The flag belongs to the browser, not the
  user.
- **One hook owns the rule.** Cards and the switch read `useDebugMode()`. It
  arrives with the date as the role check alone, so the toggle changes the hook,
  not the card.
- **Resolve debug mode in the browser.** The pages don't know the viewer on the
  server, so the date appears once `getMe` resolves. The server render and the
  first client render are both without it, so there is no hydration mismatch.
- **Show seconds.** The seeder creates every activity in one batch; minutes
  alone would print the same time on every card.
- **Keep the exposure tests honest.** Once `getMe` returns `Me`,
  `getMe { password }` no longer tests `User`. Query `password`,
  `favoriteActivityIds` and `role` through `getActivities { owner { … } }`.
- **Type `DateTime` as `string` in codegen**, so the card formats a typed value
  instead of `any`.

### Don't, for now

- **No date on list rows or the detail page.** `ActivityListItem` (explorer,
  profile favorites) and `activities/[id]` aren't cards. A follow-up if admins
  want it there.
- **No server-side toggle.** It's out of scope, and undesirable from a product
  perspective at this point. Following an admin across devices would need a
  stored field, a mutation and a field on `Me`.
- **No server-side gate on `createdAt`.** It's already public.
- **No full split of GraphQL types from Mongoose schemas.** `Me` is the only new
  type; the rest is a review recommendation.
- **No `GetUser` → `GetMe` rename.** It's a review recommendation, due after
  typed documents so the compiler checks it.
- **No way to manage admins in the app.** There are few admins and they change
  rarely. An admin-only, audited mutation is a follow-up if that changes.

## Plan

Four PRs, in order. Open one, wait for it to be reviewed and merged, then open
the next. Alternative: stack the PRs, based on the human driver's preferences.

### 1. Take `role` out of `createUser`'s input

`createUser(input)` picks the four signup fields from `input` and never sets
the role. The seeder promotes its admin directly in the database. The readme
shows how to promote a user by hand.

Done when:

- A service test shows a `role` smuggled into the input is ignored, and fails
  before the fix.
- A service test shows `createUser` can't be asked for an admin, at compile
  time and at runtime.
- A seeder test shows it stores the admin with role `admin` and the user with
  role `user`.

### 2. Expose the current user's role

Back-end: the `Role` enum, the `Me` type, `getMe: Me!`.

Done when:

- E2E tests pass: `getMe { role }` is `user` after signup and `admin` for an
  admin; `role`, `password` and `favoriteActivityIds` on `owner` are each a
  `GRAPHQL_VALIDATION_FAILED`.
- The front-end builds against the regenerated schema, unchanged.

### 3. Show the creation date to admins

Front-end: `role` in `GetUser`, `createdAt` in the activity fragment, the
`DateTime` codegen mapping, `useDebugMode()` as the admin check, the dimmed line
on the `Activity` card.

Done when:

- A component test renders the card: an admin sees `Créée le` and the formatted
  date; a regular user and a logged-out visitor don't.
- In the browser, as the seeded admin: home and discover show a date on every
  card. Create an activity: it comes first on discover and on my-activities,
  with the current time. As the seeded user, and logged out, no dates show.

### 4. Add the debug mode toggle

Front-end: `useDebugMode()` adds the localStorage flag, off by default. The
floating switch goes in `_app.tsx`.

Done when:

- Component tests pass: only admins see the switch; switching it on and off
  shows and hides the card's date; a non-admin with the flag set sees neither
  the switch nor the date.
- In the browser, as the seeded admin: no dates at first. Switch on: dates show
  on home and discover, and stay after navigating and reloading. Switch off:
  they're gone. As the seeded user, and logged out, no switch shows.

## Notes

- **Tests first.** Write the tests, confirm they fail, then implement.
- **Before every commit**, run the back-end and front-end test suites, lint,
  typecheck and build. Then start the app (MongoDB, the API on 3000, the UI on
  3001) and exercise the change in a browser as the seeded admin
  (`admin@test.fr`), the seeded user (`user1@test.fr`) and logged out.
- **PR descriptions are short and precise:** what changed, why, and how it was
  tested. No narrative, and no restating the diff.
- **Scope.** Improve code only where the feature already touches it. Anything
  else you find goes into `docs/suggestions.md` as a recommendation, not a fix.
- **Before opening a PR**, check `master` for recently merged work that
  overlaps; other workspaces run in parallel.
- **Keep generated GraphQL artifacts in sync.** CI fails if `schema.gql` drifts
  from the resolvers; regenerate front-end types with `npm run generate-types`.
