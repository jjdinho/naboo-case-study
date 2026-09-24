# 6. Config and environments

Paths are relative to `back-end/src/` or `front-end/src/`.

### Pattern

The problem is that a config mistake only surfaces when the code that reads it
runs, and the front-end is tied to one environment. One validated config per
side unlocks deploys that fail at boot with a clear message, a front-end that
can target staging, and a clean clone that works.

Config is read three ways and validated nowhere. The back-end mixes
`ConfigService` with raw `process.env`, and the front-end hard-codes its URLs,
so it can only ever point at one environment. With no validation schema, a
missing variable fails at first use: a missing `JWT_SECRET` only shows up when
someone logs in. Development settings ship to production: the GraphQL playground
is always on. The tooling drifts the same way. The database scripts call
`docker-compose`, but the repo has no compose file. The back-end enforces
Prettier in CI; the front-end has neither the dependency nor a config. A fresh
install under npm's `ignore-scripts` fails on bcrypt (theme 7).

### Direction

- One config module per side. The back-end reads everything through
  `ConfigService`, with a validation schema that fails at boot and names what's
  missing. The front-end reads its API URL from the environment.
- Environment-dependent settings come from config: the playground only outside
  production.
- A clean clone works: add the compose file the scripts expect, and pin
  Prettier on the front-end with the back-end's config, checked in CI.

### Effect on the project

A misconfigured deploy fails at boot with a clear message instead of at the
first login, and the front-end can target staging. It's all small; `.env.dist`
already lists every variable the schema needs. Formatting the front-end once is
a large, mechanical diff, so it gets its own PR. The validation schema is the
cheapest first step.

### Evidence

- `app.module.ts:77` (`MONGO_URI`), `main.ts:10` (`FRONTEND_URL`),
  `auth/auth.resolver.ts:18,35` (`FRONTEND_DOMAIN`) — raw `process.env`.
- `graphql/apollo.ts:6`, `services/axios.ts:3` — hard-coded URLs.
- `app.module.ts:20` — `ConfigModule.forRoot` without validation; `:33` —
  `playground: true`.
- `back-end/package.json:16-18` — `docker-compose` scripts; `back-end/.prettierrc`
  is the only Prettier config.

### How you'd verify it

A test boots the config module without `JWT_SECRET` and expects it to throw. CI
runs `prettier --check` on the front-end.