# 3. Front-end data flow and naming

Paths are relative to `back-end/src/` or `front-end/src/`.

### Problem

Every server-rendered page fetches its data its own way, each hook is matched
with its document's types by hand, and one concept has several names across
layers.

### Suggestion

Fetch server-side data through one helper, generate typed documents, and give
each concept one name.

### Impact

This would unlock: users kept apart by design, a redirect instead of a 500 for
logged-out visitors, every page seeing the user, and the server-side user theme
2 needs. Typed documents let the compiler catch a hook given the wrong types,
and check the renames.

### Current state

Six pages each copy the same `getServerSideProps` block, all through one
module-level Apollo client that every request shares (`graphql/apollo.ts:3`,
also the browser's at `pages/_app.tsx:14`), and each copy decides for itself
what to forward and what to do on failure.

- Until PR #26, that client answered from its cache: `/my-activities` showed a
  second user the first user's activities, and server-rendered lists stayed
  stale until restart. A `no-cache` default fixed it (`graphql/apollo.ts:11`);
  the client is still shared.
- `/my-activities` returns HTTP 500 when logged out: its query throws before
  `withAuth` can redirect in the browser.
- Only `my-activities` and `activities/[id]` forward the cookie
  (`pages/my-activities.tsx:27`, `pages/activities/[id].tsx:28`), so a page
  that forgets renders logged-out for a logged-in user.

Around the data, each hook is matched with its document's types by hand
(`contexts/authContext.tsx:50`), and one concept has several names across
layers:

| Concept | Names in use |
|---|---|
| List a user's activities | `getActivitiesByUser` (GraphQL) · `GetUserActivities` (front-end doc) · `findByUser` (service) |
| Authenticate | `login`/`register` · `signIn`/`signUp` · `Signin` |
| Current user | `getMe` (back-end) · `GetUser` (front-end doc, selects `getMe` inside) |

"City" is a plain string on `Activity` and a `{nom, departement}` record from
geo.api.gouv.fr on the front-end (`services/cities.ts:4`).
`SignInDto.access_token` is the schema's only snake_case field
(`auth/types/auth.dto.ts:6`). `<title>{activity.name} | CDTR</title>` renders
an array of children and triggers a React warning
(`pages/activities/[id].tsx:40`).

### Changes needed

- One server-side fetch helper: a new client per request, the cookie always
  forwarded, and an unauthenticated error turned into a redirect to `/signin`.
  A client per request makes PR #26's isolation structural instead of a
  setting, and brings back caching within a request, which `no-cache` gives
  up: repeated queries are answered once, and the server's results can pre-fill
  the browser's cache.
- Documents carry their types. CI already fails when the schema or generated
  types drift (PR #16); what it can't see is a hook given the wrong document's
  types. graphql-codegen's `client-preset` generates `TypedDocumentNode`s, so
  `useQuery(GetMeDocument)` infers its types and a mismatched pair can't
  compile.
- One concept, one name: rename the front-end document to `GetMe`, rename one
  `City` or share a type, and let `access_token` go with theme 2. Document the
  `get*` throws / `find*` returns `null` convention.
- Render the `<title>` from one template string.

If the two apps ever deploy separately, build-time checks stop being enough: a
browser running yesterday's bundle talks to today's server. Then a schema
registry (Apollo GraphOS, GraphQL Hive), persisted queries and expand-contract
changes (add, deprecate, migrate, drain, remove) earn their keep. Not worth it
with one repo and one deploy.

### Cost

The helper touches seven files: itself and the six pages, four of which change
behaviour — that's the point. `client-preset` is a mechanical change across all
15 hook and `query` calls; nothing depends on it. Do it before the renames, so
the compiler checks them.

### How you'd verify it

PR #26's test sends two cookies through the shared client and expects two
answers; with the helper, it moves to the helper. A logged-out call returns a
redirect rather than throwing. Test `ActivityForm`, which has no coverage.
