# 3. Front-end data flow and naming

Paths are relative to `back-end/src/` or `front-end/src/`.

### Pattern

Six pages each copy the same `getServerSideProps` block, all through one
module-level Apollo client that every request shares, and each copy decides for
itself what to forward and what to do on failure.

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

### Direction

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

### Effect on the project

A logged-out visitor gets a redirect instead of a 500, every page sees the user,
server-resolved auth becomes possible (theme 2), and keeping users apart no
longer rests on one fetch-policy line. The helper touches seven files: itself
and the six pages, four of which change behaviour — that's the point.
`client-preset` is a mechanical change across all 15 hook and `query` calls;
nothing depends on it. Do it before the renames, so the compiler checks them.

### Evidence

- `graphql/apollo.ts:3` — the shared client, `:11` — its `no-cache` default;
  `pages/_app.tsx:14` — also the browser's.
- `getServerSideProps` in six pages; the cookie forwarded at
  `pages/my-activities.tsx:27` and `pages/activities/[id].tsx:28` only.
- `contexts/authContext.tsx:50` — types matched to `GetUser` by hand.
- `services/cities.ts:4` — the front-end `City`; `auth/types/auth.dto.ts:6` —
  `access_token`.
- `pages/activities/[id].tsx:40` — the `<title>`.

### How you'd verify it

#26's test sends two cookies through the shared client and expects two answers;
with the helper, it moves to the helper. A logged-out call returns a redirect
rather than throwing. Test `ActivityForm`, which has no coverage.