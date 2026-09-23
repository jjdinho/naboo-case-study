# Spec — Favoris

## Problem

Users can browse activities but can't keep the ones they like. The brief asks
for **Favoris**: a logged-in user adds an activity to their favorites, sees them
on their profile, and reorders them.

What the codebase brings to this:

- `User` is one class serving as the Mongoose document, the `getMe` type and
  `Activity.owner`. Any `@Field` on it can be read through every activity's
  owner, and `getActivities` needs no login.
- `ActivityService.findByIds` exists with no callers, and `$in` ignores the
  order of the ids it's given.
- `pages/profil.tsx` declares a `favoriteActivities` prop that nothing fills.
- The e2e test app doesn't install the `ValidationPipe` that `main.ts` does, so
  e2e tests never exercise input validation.
- The front-end runs React 18.

## Solution

Store favorites as an ordered array of activity ids on the User document; array
order is display order. A new `favorite` module exposes four operations, all
login-only. Each mutation returns the updated, ordered list.

| Operation | Behavior |
|---|---|
| `getFavoriteActivities: [Activity!]!` | The current user's favorites, in saved order |
| `addFavoriteActivity(activityId: ID!)` | Appends. Adding twice is a no-op; an unknown activity is not found |
| `removeFavoriteActivity(activityId: ID!)` | Removes; the rest keep their order |
| `reorderFavoriteActivities(activityIds: [ID!]!)` | Saves a new order. Anything but a reordering of the saved list is a `BAD_REQUEST` |

On the front-end:

- The activity detail page shows logged-in users an "Ajouter aux favoris" /
  "Retirer des favoris" toggle.
- The profile lists favorites under "Mes favoris", each with a remove button,
  reorderable by drag-and-drop with the mouse or the keyboard.
- One hook owns the query and the mutations, and writes each returned list into
  the Apollo cache, so both pages stay in sync.

## Decisions

### Do

- **Keep favorites off `User`.** No `@Field`: otherwise
  `getActivities { owner { favoriteActivityIds } }` would list everyone's
  favorites. Read them only through `getFavoriteActivities`.
- **An ordered id array, not a collection.** Favorites are always read for one
  user by id: no join, no new index, no position field to renumber.
- **Atomic updates.** One `updateOne` per change (`$addToSet`, `$pull`, `$set`),
  never load-edit-save. `$addToSet` makes adding idempotent.
- **Check reorders in the update filter.** Reject repeated ids in code; the
  filter then requires the saved array to have the same length and contain every
  id sent. A favorite added concurrently makes the update miss instead of being
  overwritten.
- **Validate ids.** Type them as `ID` and check them with `@IsMongoId`, so a
  malformed id is a `BAD_REQUEST`, not a 500.
- **Guard the whole resolver.** The auth guard goes on the resolver class, so any
  favorites operation added later requires login by default.
- **Return the list from every mutation.** The client replaces its state with the
  server's answer, in one round trip.
- **Toggle on the detail page only.** Activity cards appear on several
  server-rendered pages that don't know who is viewing.
- **Load favorites in the browser.** The profile is already gated by `withAuth`;
  a server-side query would need the cookie forwarded and a logged-out redirect.
- **Drag-and-drop with `@hello-pangea/dnd`**, on a version that supports React 18.
  Reorder optimistically; Apollo rolls back if the mutation fails.

### Don't, for now

- **No cap, no pagination.** The list can't outgrow the catalog. Revisit if lists
  get long.
- **No favorite button on activity cards.** A follow-up.
- **No split of GraphQL types from Mongoose schemas.** It's the real fix for the
  `User` exposure trap, but it's a review recommendation, not Favoris work.
- **No `@CurrentUser()` decorator.** Read the user from the context the way the
  existing resolvers do; the decorator is a separate decision.
- **No changes to other pages' server-side rendering**, even where it's broken.

## Plan

Four PRs, in order. Open one, wait for it to be reviewed and merged, then open
the next. Alternative: stack the PRs, based on the human driver's preferences.

### 1. Run input validation in the e2e tests

Install the `ValidationPipe` in the e2e test app, as `main.ts` does.

Done when a new e2e test shows sign-up rejecting a malformed email with
`BAD_REQUEST`, and that test fails without the pipe.

### 2. Keep `findByIds` results in the requested order

Return activities in the order of the ids passed, and skip ids that match
nothing.

Done when a service test covers order and unknown ids, and fails before the fix.

### 3. Add, remove and view favorites

Back-end: the User field and the `favorite` module with `getFavoriteActivities`,
`addFavoriteActivity` and `removeFavoriteActivity`. Front-end: the detail-page
toggle and the profile list with remove.

Done when:

- Service tests pass: the list starts empty; add appends in order; adding twice
  keeps one entry; an unknown activity is rejected; remove keeps the order of the
  rest.
- E2E tests pass: login is required; `favoriteActivityIds` can't be queried on
  `User`; a malformed id is a `BAD_REQUEST`; an added favorite reads back.
- In the browser: add from the detail page, toggle off and on, remove from the
  profile, reload. Logged out, the toggle doesn't show.

### 4. Reorder favorites

Back-end: `reorderFavoriteActivities`. Front-end: drag-and-drop on the profile
list.

Done when:

- Service tests pass: a new order is saved; missing, extra and repeated ids are
  rejected and leave the list unchanged.
- A unit test covers the helper that moves an item in the list.
- In the browser: reorder with the keyboard, reload, and the order holds.

## Notes

- **Tests first.** Write the tests, confirm they fail, then implement.
- **Before every commit**, run the back-end and front-end test suites, lint,
  typecheck and build. Then start the app (MongoDB, the API on 3000, the UI on
  3001) and exercise the change in a browser, logged in and logged out.
- **PR descriptions are short and precise:** what changed, why, and how it was
  tested. No narrative, and no restating the diff.
- **Scope.** Improve code only where the feature already touches it. Anything
  else you find goes into `docs/suggestions.md` as a recommendation, not a fix.
- **Before opening a PR**, check `master` for recently merged work that
  overlaps; other workspaces run in parallel.
- **Keep generated GraphQL artifacts in sync.** CI fails if `schema.gql` drifts
  from the resolvers; regenerate front-end types with `npm run generate-types`.
