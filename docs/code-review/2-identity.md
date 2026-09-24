# 2. One owner for identity

Paths are relative to `back-end/src/` or `front-end/src/`.

### Pattern

The token lives in four places: an httpOnly cookie, a `jwt` header,
localStorage, and `user.token`, which every login writes and nothing reads.
Three layers share checking it: the GraphQL context factory verifies it, the
guard only checks a payload exists, and resolvers read `context.jwtPayload.id`
by hand — typed non-null, though anonymous requests carry `null`. So there's no
single answer to "is this user logged in". The localStorage copy is XSS-readable
and outlives the cookie, and the stale-cookie outage (#9) came from the same
split. Guards are opt-in, so a new operation is public until someone remembers
the decorator. Tokens last ~31 years with no revocation.

### Direction

- The cookie is the only transport. Drop the `jwt` header, the localStorage
  token, `user.token` and `updateToken`. `login` returns the `User`, not
  `access_token`, and `AuthProvider` calls `getMe` on mount: user-or-`null` *is*
  the auth state.
- The guard owns verification. The context factory shrinks to `{ req, res }`,
  and `app.module.ts` no longer needs `JwtService`.
- Closed by default: a global `APP_GUARD`, with `@Public()` on the public
  queries. Favoris's class-level guard (#21) is the local version of this.
- A `@CurrentUser()` parameter decorator would replace the seven hand-written
  reads and the mistyped context. Recommended, not yet decided; it would be its
  own PR.
- Tokens expire in ~7 days, with `SameSite=Lax` and `secure` in production.
- Login gives one answer for an unknown email and a wrong password. Today they
  differ, so anyone can check whether an address has an account; #30 stopped
  emails being listed, not checked. Signup leaks the same way, and only email
  verification closes that.
- Once theme 3's fetch helper resolves `me` on the server and redirects there,
  the `withAuth`/`withoutAuth` HOCs can go. Until then, merge the two mirror
  images into one.

### Effect on the project

One source of truth for login state, a token XSS can't read, a forgotten
decorator that fails closed, and a stolen token that expires in a week. It
touches login and logout on both sides and every guarded resolver. Hard
navigations show a loading state, since auth costs a round trip, until the
server resolves `me`. Shortening token lifetime logs everyone out once. Settle
the transport before moving verification into the guard, or the same code moves
twice; `@Public()` is independent and the cheapest step.

### Evidence

- `app.module.ts:37` — the header branch; `contexts/authContext.tsx:58,74,100`
  — localStorage; `user/user.schema.ts:36` and `auth/auth.service.ts:29` —
  `user.token`.
- `app.module.ts:35-56` — verification in the context factory;
  `auth/auth.guard.ts:15` — the guard's null check.
- `auth/types/context.ts:4` — typed non-null; `app.module.ts:39` — `null` when
  anonymous.
- `@UseGuards` at four sites: `activity/activity.resolver.ts:51,79`,
  `me/resolver/me.resolver.ts:13`, `favorite/favorite.resolver.ts:13`.
- `context.jwtPayload.id` read by hand: `activity.resolver.ts:55,84`,
  `me.resolver.ts:17`, `favorite.resolver.ts:21,29,37,45`.
- `JWT_EXPIRATION_TIME=999999999` in `back-end/.env.dist`.
- `auth/auth.service.ts:21` — an unknown email throws "User not found";
  `:25` — "Wrong credentials provided"; `:52` — a taken email is a 401.

### How you'd verify it

Back-end e2e tests for the failure paths, where a regression is silent: wrong
password, expired token, no cookie on each protected operation. One e2e test
lists every query and mutation from the schema and asserts which are public, so
a new operation fails until someone classifies it. On the front-end, #33 tests
login and logout in `authContext.tsx`; add user-or-`null` after mount, and the
HOCs.