# 7. Repository separation plan

## Recommendation

Yes: move Chronos Strike into its own standalone repository.

The new repository should own **all** Chronos Strike work:

- the existing GitHub Pages web game;
- the mobile applications;
- the shared deterministic game core;
- backend database migrations and functions;
- tests and compatibility fixtures;
- product/architecture documentation;
- release workflows, store metadata, and operational runbooks.

Do not create a mobile-only repository while continuing to maintain the web rules in `TheClockGame/GameMode/`. That would create two product repositories and make ruleset drift likely.

## Why separation is now appropriate

Chronos Strike and Clock Quest share history, but no longer share a product lifecycle.

Chronos Strike needs:

- iOS and Android build/release workflows;
- native dependencies and signing configuration;
- Supabase migrations/functions and environment secrets;
- AdMob configuration and privacy/compliance work;
- competitive ruleset and replay validation;
- independent issues, releases, tags, milestones, and incident handling;
- a release cadence that should not be coupled to Clock Quest changes.

A standalone repository improves ownership, CI speed/scope, permissions, release notes, dependency management, and contributor orientation. It also makes the repository name match the product presented in app stores.

The tradeoff is a one-time extraction and deployment transition. That cost is small compared with years of maintaining unrelated web-learning and competitive-mobile products together.

## Recommended repository identity

- Repository name: `chronos-strike`.
- Description: “Chronos Strike — cross-platform reflex timing game for iOS, Android, and web.”
- Visibility: private during early mobile/backend development if preferred; visibility is not a security control and no production secret may be committed either way.
- Ownership: create it under the account/organization that will own the Apple, Google Play, Supabase, AdMob, domain, and release credentials.
- Default branch protection: required CI, pull requests, no force pushes, and restricted production environment approvals.

## Target layout

```text
chronos-strike/
├── apps/
│   ├── web/                         # current GameMode moved intact first
│   └── mobile/                      # Expo/React Native app
├── packages/
│   ├── game-core/                   # authoritative pure rulesets
│   ├── contracts/                   # API/replay/persistence schemas
│   ├── test-fixtures/               # cross-runtime compatibility packs
│   └── config/                      # shared lint/TypeScript/test configuration
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── tests/
│   └── seed.sql
├── docs/
│   ├── road-to-mobile/
│   ├── architecture-decisions/
│   ├── operations/
│   └── legacy-roadmap/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

`TheClockGame` remains the Clock Quest repository. After cutover, its Chronos navigation points to the standalone deployment/app landing page.

## Source-of-truth rules

1. After the migration freeze date, all Chronos changes are made in `chronos-strike`.
2. `packages/game-core` becomes authoritative for rules after compatibility extraction.
3. `apps/web` and `apps/mobile` consume `game-core`; backend validators consume the same package.
4. The old repository does not receive hand-copied engine updates.
5. Database schema is authoritative in `supabase/migrations`, not dashboard-only edits.
6. Architecture decisions and version changes are recorded in the standalone repository.
7. Existing Gist leaderboard data is external legacy data, imported/archive-labeled during backend migration.

## History-preserving extraction

Perform the move in a throwaway/local clone so the active `TheClockGame` history is not rewritten.

Recommended sequence:

1. Announce a short Chronos change freeze.
2. Record the current commit SHA and create a baseline tag such as `chronos-web-v1.1.0-source`.
3. Clone `TheClockGame` into a temporary working directory.
4. Use a history-filtering tool or subtree extraction to retain commits affecting `GameMode/`.
5. Push the extracted history to the empty `chronos-strike` repository.
6. In a separate, easy-to-review commit, move extracted root files under `apps/web/`.
7. Copy the Chronos enhancement roadmap and `Road to Mobile` documents, recording their original commit SHA. If preserving their cross-directory history is important, include them in the history filter rather than copying.
8. Add workspace configuration without refactoring game behavior.
9. Tag the imported state, for example `web-baseline-1.1.0`.
10. Run existing tests and compare the deployed web build before any core extraction.

Do not combine history extraction, directory restructuring, engine refactoring, dependency upgrades, and formatting into one commit. Separate commits make parity review and rollback possible.

## What moves from this repository

Move:

- `GameMode/` contents, excluding operating-system artifacts such as `.DS_Store`;
- `docs/CHRONOS_STRIKE_ENHANCEMENT_ROADMAP.md`;
- `Road to Mobile/` documents;
- Chronos-specific package scripts/tests;
- relevant Chronos issues/project notes where useful;
- asset license/provenance records.

Review before moving:

- root `package.json`: split Chronos scripts from Clock Quest scripts;
- root README/CLAUDE guidance: keep Clock Quest material in `TheClockGame`, recreate Chronos-specific contributor guidance in the new repo;
- shared assets: copy only with confirmed license and record provenance;
- GitHub Actions/secrets: recreate with least privilege; do not copy secret values into files.

Leave:

- Clock Quest `index.html`, `styles.css`, `js/`, documentation, and unrelated brainstorm material;
- Clock Quest deployment and issue history;
- a transitional Chronos link/redirect after cutover.

## GitHub Pages and URL continuity

The current public URL must not break during the move.

### Safe deployment sequence

1. Keep `TheClockGame/GameMode/` deployed unchanged.
2. Deploy `chronos-strike/apps/web` to a preview URL.
3. Run automated and manual parity checks.
4. Choose the long-term public URL, preferably a custom product domain/subdomain. A repository GitHub Pages URL is acceptable initially.
5. Update share-card and deep-link configuration to use the canonical URL.
6. Deploy the standalone production web page.
7. Change the Clock Quest “Chronos Strike” link to the canonical URL.
8. Replace the old `GameMode/index.html` with a lightweight redirect page only after verification.
9. Keep the redirect indefinitely or for a clearly documented deprecation period.

If both repositories use project pages under the same `username.github.io` origin, browser `localStorage` is origin-scoped rather than path-scoped, which may allow existing data to remain available at the new project path. Do not assume this: test the actual production origins, custom domains, browser privacy behavior, and service-worker scopes. If the origin changes, use the transfer-code flow described in the backend/sync plan.

The old service worker scope must not interfere with the new deployment. Unregister/version it deliberately during testing.

### Redirect requirements

- preserve query/hash parameters used by challenge links where safe;
- avoid redirect loops;
- provide a clickable fallback link if automatic navigation is blocked;
- use the canonical destination in metadata;
- test desktop/mobile browsers and installed PWA remnants;
- retain no production secret or duplicate game logic in the redirect.

## Shared core migration after repository move

The initial moved `apps/web` can continue using its existing scripts. Then:

1. create ruleset-1 fixtures from the imported web baseline;
2. port `engine.js` and the full scoring reducer to `packages/game-core`;
3. build browser-compatible output for `apps/web`;
4. run old and new engines against the same fixtures;
5. switch the web app to the shared package only after exact parity;
6. delete the duplicate old engine implementation in a separate commit;
7. make mobile and server validator use the same package.

This preserves behavior while ending with one rules engine.

## CI/CD separation

The standalone repository should have path-aware workflows:

- `packages/game-core` change: test core, web, mobile, and validator;
- `apps/web` change: test and preview/deploy web;
- `apps/mobile` or native config change: test and create appropriate preview/native build;
- `supabase` change: reset database, apply migrations, run RLS/function tests, deploy only with environment approval;
- documentation-only change: markdown/link checks without expensive native builds.

Production environments should require approval and expose secrets only to the deployment job that needs them. Clock Quest workflows must have no access to Chronos production credentials.

## Issues, releases, and project management

- migrate only actionable Chronos issues; link back to original issue numbers for history;
- create milestones matching the phases in the implementation roadmap;
- use repository releases/tags for web, mobile, ruleset, and backend milestones;
- maintain a changelog that distinguishes app version from ruleset version;
- add CODEOWNERS for game core, backend/security, and release configuration when the team grows;
- update both repository READMEs with the separation and canonical links.

## Cutover acceptance checklist

- relevant history is visible in `chronos-strike`;
- source commit and imported baseline tag are recorded;
- all current tests pass from the new layout;
- web UI/audio/share/leaderboard smoke tests match the prior deployment;
- asset licenses and large files are present and valid;
- standalone Pages/landing URL works over HTTPS;
- old URL redirects without losing supported challenge parameters;
- local-progress behavior is tested for actual origins;
- service worker cache/scope behavior is safe;
- no Chronos production secret remains in or is accessible from Clock Quest CI;
- new issues/releases/docs point to the standalone repo;
- contributors know where the change freeze ended and new ownership began;
- rollback to the unchanged old deployment remains possible until the observation window passes.

## Rollback

Before the old source is reduced to a redirect:

- keep the previous GitHub Pages artifact/tag;
- do not delete the old `GameMode/` source during the initial observation window;
- if the new deployment fails, restore the old Clock Quest link/path and disable the redirect;
- fix forward in `chronos-strike`, then repeat parity validation;
- never create parallel fixes in both game copies.

After the cutover is stable, remove the duplicate source from `TheClockGame` in a normal commit so Git history still retains it. Keep the redirect and documentation pointer.

## When not to separate

Separation would be unnecessary if Chronos Strike remained a small static subpage with the same release process and no independent backend/mobile roadmap. That is no longer the case. The planned native apps, accounts, secure competition, ads, backend, and store operations make the standalone boundary the lower-maintenance choice.
