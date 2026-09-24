# 5. Use MongoDB deliberately

Paths are relative to `back-end/src/` or `front-end/src/`.

### Problem

No list query has a matching index or a page size, so each one costs more as
the catalog grows. Indexes are also built at boot, against live traffic.

### Suggestion

Index and paginate every list query, and build indexes before deploy.

### Impact

This would unlock: list latency and memory that stay flat as the catalog grows,
and deploys that don't build indexes against live traffic.

### Current state

The only index besides `_id` is the unique `email` (`user/user.schema.ts:29`),
and no list is paginated: `findAll` returns the whole collection
(`activity/activity.service.ts:17`). At seed size that's invisible; as the
catalog grows, every list query scans the whole collection and returns all of
it. The list queries (`activity/activity.service.ts:17,21,25,55,59`) and the
indexes they'd need:

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

### Changes needed

- Declare the indexes above on the schemas.
- Paginate lists with a cursor on `createdAt` and `_id`, which the
  `createdAt` index serves.
- Build indexes before deploy, not at boot: `autoIndex: false` in production
  and a release step that runs `syncIndexes`.
- Read with `.lean()` once theme 1 stops handing documents to resolvers.

### Cost

Indexes are cheap now: a little write overhead, and seed-sized builds are
instant. Pagination is the expensive part — it changes the `getActivities`
contract and every list page. Add the indexes first, since they change no
contract. Paginate alongside theme 3's helper, which touches the same pages.

### How you'd verify it

Run each list query's `explain()` against the in-memory Mongo and assert an
index scan, not a collection scan. Page through N+1 activities with a page size
of N and see each once, in order.
