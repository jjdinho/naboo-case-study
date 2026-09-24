# 6. Config and environments

Paths are relative to `back-end/src/` or `front-end/src/`.

### Problem

A config mistake only surfaces when the code that reads it runs, and the
front-end is tied to one environment.

### Suggestion

Read all config through one validated module per side, and fix the tooling a
fresh clone trips on.

### Impact

This would unlock: deploys that fail at boot with a clear message, a front-end
that can target staging, and a clean clone that works.

### Current state

Config is read three ways and validated nowhere. The back-end mixes
`ConfigService` with raw `process.env` (`app.module.ts:77` for `MONGO_URI`,
`main.ts:10` for `FRONTEND_URL`, `auth/auth.resolver.ts:18,35` for
`FRONTEND_DOMAIN`), and the front-end hard-codes its URLs
(`graphql/apollo.ts:6`, `services/axios.ts:3`), so it can only ever point at
one environment. With no validation schema (`app.module.ts:20`), a missing
variable fails at first use: a missing `JWT_SECRET` only shows up when someone
logs in. Development settings ship to production: the GraphQL playground is
always on (`app.module.ts:33`).

The tooling drifts the same way. The database scripts call `docker-compose`
(`back-end/package.json:16-18`), but the repo has no compose file. The back-end
enforces Prettier in CI; the front-end has neither the dependency nor a config
(`back-end/.prettierrc` is the only one). A fresh install under npm's
`ignore-scripts` fails on bcrypt (theme 7).

### Changes needed

- One config module per side. The back-end reads everything through
  `ConfigService`, with a validation schema that fails at boot and names what's
  missing. The front-end reads its API URL from the environment.
- Environment-dependent settings come from config: the playground only outside
  production.
- A clean clone works: add the compose file the scripts expect, and pin
  Prettier on the front-end with the back-end's config, checked in CI.

### Cost

It's all small; `.env.dist` already lists every variable the schema needs.
Formatting the front-end once is a large, mechanical diff, so it gets its own
PR. The validation schema is the cheapest first step.

### How you'd verify it

A test boots the config module without `JWT_SECRET` and expects it to throw. CI
runs `prettier --check` on the front-end.
