# 7. Keep dependencies current

Paths are relative to `back-end/src/` or `front-end/src/`.

### Pattern

The problem is that nothing keeps dependencies current, so known vulnerabilities
pile up unnoticed. Updating in ranked tiers and automating the rest would unlock: a
cleared backlog (tier 1 alone clears 8 of the 9 back-end criticals) and new
vulnerable dependencies caught in the PR that adds them.

`npm audit --omit=dev`, 2026-09-23: 48 vulnerable packages on the back-end (9
critical, 25 high) and 8 on the front-end (2 critical), one of them Next with 35
advisories. Nothing updates dependencies or reports new advisories, so the
backlog only grows. Three back-end dependencies are imported nowhere:
`@apollo/gateway`, `ts-morph`, `class-transformer-validator`.

### Direction

Ranked by risk. Each tier's after-count was simulated on scratch copies of the
lockfiles.

1. **Within current ranges.** Drop the three unused dependencies, run
   `npm update` on the back-end (down to 19: 1 critical, 6 high) and
   `npm audit fix` on the front-end (down to 3). One small PR, but the lockfile
   diff is large, so the test suite is what vouches for it.
2. **Back-end majors.** The remaining critical is `tar`, via bcrypt 5's
   `node-pre-gyp`. bcrypt 6 ships prebuilt binaries, so it also installs under
   npm's `ignore-scripts`, where bcrypt 5 fails. The multer, lodash and ws highs
   sit under the Nest 10 packages, and Nest 10 → 12 moves every `@nestjs/*`
   package together.
3. **Next 13.** 13.5.11, the last 13.x, still carries 31 of the 35. About
   two-thirds need features this app doesn't use (App Router, Server Actions,
   middleware), so the exposure is smaller than the count. The only real fix is
   a current major: a project, not a PR.
4. **Mantine.** Three majors behind but with no advisories, and v7 replaces
   Emotion with CSS modules, so every styled component changes. Leave it until
   something forces it.

To stop it recurring: Dependabot security updates for the backlog, and
`actions/dependency-review-action` on PRs, which fails only when the PR itself
adds a vulnerable dependency. A plain `npm audit` gate would go red on
advisories published overnight, against PRs that didn't touch dependencies.

### Effect on the project

Tier 1 clears 8 of the 9 back-end criticals for one small PR. Tier 2 is a
framework upgrade with a real blast radius; tier 3 is a project. Prevention is a
Dependabot config and one CI step. Do tier 1 first; it also shrinks the diff
tier 2 has to review.

### Evidence

- `back-end/package.json:27,39,46` — the three unused dependencies; `:37` —
  bcrypt 5.
- `front-end/package.json:27` — Next 13.4.10; `:19` — Mantine 6.

### How you'd verify it

The full test suites, build and a browser pass after each tier; `npm audit
--omit=dev` matches the simulated after-count.
