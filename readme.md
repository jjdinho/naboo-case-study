# Naboo interview

## Reviewer

This fork holds the case study: a code review and two features, Favoris and
Mode debug. Everything is merged into `master`.

- **Code review:** [docs/code-review.md](docs/code-review.md). What the codebase
  gets right, seven improvement themes ordered by value, and the fixes made
  along the way. Each theme has its own proposal in
  [docs/code-review/](docs/code-review/), written to become a spec once the work
  is picked up.
- **Favoris:** add or remove a favorite from an activity's page, then view and
  reorder favorites on the profile. Spec:
  [docs/specs/favoris.md](docs/specs/favoris.md). PRs [#19](https://github.com/jjdinho/naboo-case-study/pull/19), [#20](https://github.com/jjdinho/naboo-case-study/pull/20), [#21](https://github.com/jjdinho/naboo-case-study/pull/21), [#22](https://github.com/jjdinho/naboo-case-study/pull/22).
- **Mode debug:** admins get a "Mode debug" switch in the bottom-right corner;
  when it's on, activity cards show their creation date. Spec:
  [docs/specs/mode-debug.md](docs/specs/mode-debug.md). PRs [#28](https://github.com/jjdinho/naboo-case-study/pull/28), [#29](https://github.com/jjdinho/naboo-case-study/pull/29), [#31](https://github.com/jjdinho/naboo-case-study/pull/31), [#32](https://github.com/jjdinho/naboo-case-study/pull/32).
- **UX issues:** [docs/ux-issues.md](docs/ux-issues.md), problems a user would
  hit, found by using the app.

## What's used ?

backend

- mongodb
- nestjs
- mongoose
- data mapper pattern
- graphql

frontend

- nextjs (with page router)
- mantine-ui
- axios
- vitest
- graphql
- apollo client

## How to launch project ?

Needs Node 22 and a MongoDB on port 27017.

database

```bash
docker run -d --name naboo-mongo -p 27017:27017 mongo:6
```

backend (http://localhost:3000/graphql)

```bash
cp .env.dist .env

npm i

npm run start:dev # seeds the users below and some activities
```

If npm's `ignore-scripts` is on, bcrypt's native binding isn't built and the
back-end fails to start. Build it with:

```bash
npm rebuild bcrypt --ignore-scripts=false
```

frontend (http://localhost:3001)

```bash
npm i

npm run generate-types # run this first — the GraphQL types aren't committed

npm run dev
```

after graphql modification

```bash
# > frontend
npm run generate-types
```

tests: `npm test` in the backend, `npx vitest run` in the frontend.

## Connection informations

| Email | Password | Role |
|---|---|---|
| user1@test.fr | user1 | user |
| admin@test.fr | admin | admin, for Mode debug |
