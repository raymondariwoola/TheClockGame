# 6. Testing, release, operations, and costs

## Quality strategy

Competitive timing games fail in places ordinary screen tests do not cover: RNG draw order, timer source, high-refresh displays, app lifecycle interruptions, audio focus, duplicate touch delivery, replay drift, sync retries, and concurrent submissions.

Testing must prove both:

1. **deterministic correctness** — the same ruleset/events produce the same result everywhere;
2. **device experience** — input, rendering, audio, haptics, accessibility, and lifecycle feel correct on hardware.

## Test pyramid

### 1. Pure domain tests (largest layer)

Run on every change:

- existing angular distance/classification/base score/rank tests;
- full score reducer order and rounding;
- combo, perfect streak, Overdrive, life, completion transitions;
- each modifier, boss, and power;
- RNG sequence and exact draw count;
- ruleset registry and immutable old rules;
- Daily UTC identity and boundaries;
- achievement and cosmetic resolution;
- replay encode/decode/validation;
- pause/background/ad event transitions;
- ad-assisted category propagation;
- idempotent duplicate event IDs.

Use table tests, golden fixtures, property-based generation, fuzzed decoders, and long seeded simulations. Run fixtures against both client and server bundles.

### 2. Contract/schema tests

- mobile request matches function schema;
- old supported client payloads remain accepted during rollout;
- unknown fields and malformed/oversized payloads are rejected;
- enums/version ranges are explicit;
- generated database types do not drift from migrations;
- replay byte/hash format is stable per version;
- error codes are stable and do not leak internals.

### 3. Database and authorization tests

Start a clean local Supabase stack in CI and apply every migration.

Prove:

- anonymous reads only approved public views;
- user A cannot read/write user B private data;
- clients cannot directly insert accepted runs, achievements, inventory, stats, or rewards;
- handle uniqueness works under concurrency;
- accepted-run transaction is atomic;
- duplicate client run/ad transaction/idempotency key has one effect;
- account deletion removes/anonymizes the documented graph;
- indexes support real leaderboard/profile query plans;
- migration up/down strategy is documented (production rollback generally uses forward fixes).

### 4. Function integration tests

- auth required/expired/revoked;
- valid run replay accepted;
- forged summary, seed, Daily date, event order, timing, or category rejected;
- replay retry returns prior result;
- simultaneous qualifying submissions do not overwrite one another;
- rate limit/quarantine behavior;
- sync command merge and retry;
- account export/delete;
- AdMob SSV signature, unique transaction, expiry, wrong user/ad unit, and callback retry;
- feature-flag and provider-outage behavior.

### 5. Mobile component tests

Use React Native Testing Library or equivalent for:

- onboarding/auth states;
- mode/difficulty selection;
- HUD/result/leaderboard/profile rendering;
- loading/offline/error/empty states;
- accessibility labels, roles, actions, focus order;
- settings and category labels;
- ad offer states and decline path;
- account deletion confirmation.

Do not try to prove frame timing with component snapshots.

### 6. End-to-end tests

Run critical flows on iOS and Android emulators in CI/nightly and on hardware before release:

- install -> guest -> tutorial -> run -> result;
- pause/background/resume -> countdown -> finish;
- sign in -> guest merge -> second-device sync;
- offline run -> reconnect -> verified submission;
- Daily -> accepted board entry;
- Rival deep link -> race -> share;
- achievement -> cosmetic equip -> sync;
- rewarded revive success/decline/no-fill/delayed reward;
- privacy choices -> export -> delete;
- update old local schema/app version -> migrate safely.

Choose Maestro or Detox after a spike based on game-canvas interaction reliability; retain a small number of robust flows rather than a brittle screen-coordinate suite.

### 7. Hardware/performance tests

Measure release builds, never development builds alone:

- 60/90/120 Hz;
- low/mid/high devices;
- portrait, landscape, tablets, safe areas/cutouts;
- rapid taps and multi-touch;
- 30+ minute Endless/Precision soak;
- memory growth and particle/audio object cleanup;
- CPU, GPU, thermal throttling, and battery;
- Bluetooth/headphones, music from another app, calls/alarms;
- airplane mode, high latency, packet loss, captive portal;
- lock/background/process death during countdown/run/ad/sync;
- timezone/UTC midnight/device clock changes;
- low storage and SQLite failure paths.

Track p50/p95 frame time, input-to-feedback, cold/warm start, memory, and network timings with a version/device label.

### 8. Accessibility and content testing

- VoiceOver and TalkBack manual passes;
- Switch Control/keyboard Strike;
- large font/display scaling and screen zoom;
- color-blind simulators plus non-color cues;
- Reduce Motion/Flash/Particles/Shake combinations;
- contrast and touch target audit;
- haptics/audio alternatives;
- localization expansion and right-to-left decision;
- taunt/ad/reward copy reviewed for audience and rating.

### 9. Security testing

- static secret/dependency/license scans;
- mobile bundle inspection for service keys and debug endpoints;
- RLS negative tests;
- replay and Rival parser fuzzing;
- API authorization/IDOR tests;
- rate-limit and payload-size abuse;
- rooted/emulated/attestation failure behavior without locking legitimate users out of local play;
- log/analytics PII review;
- admin role/audit and environment separation;
- backup/restore and deletion verification.

## CI/CD pipeline

### Pull request

1. formatting/lint/strict TypeScript;
2. domain/unit/property tests;
3. legacy web `npm test` inside the standalone repository while the web edition remains supported;
4. contract tests;
5. clean database migration + RLS tests;
6. function integration tests;
7. mobile component tests;
8. dependency/license/secret scan;
9. build/type boundaries check;
10. optional preview update/build for approved branches.

### Main branch

- all PR checks;
- generate signed/versioned artifacts;
- deploy database migrations using expand/contract order;
- deploy functions;
- publish preview EAS Update only to compatible runtime channel;
- create internal iOS/Android builds on release tags or controlled cadence;
- attach changelog, fixture/ruleset diff, migration report, and artifact hashes.

### Production promotion

- same tested artifact/config promoted where possible;
- manual approval;
- production migration backup/check;
- staged function/flag activation;
- TestFlight/Play track promotion;
- remote flags default off for new ads/rules;
- smoke tests and monitoring window;
- record release owner and rollback decision point.

Do not auto-publish gameplay rule changes to all users. A ruleset change needs explicit versioning and board partitioning. EAS Update can deliver compatible JavaScript/assets but must not bypass app-store policy or native runtime compatibility.

## Environments and configuration

| Environment | Purpose | Data | Ads | Auth |
|---|---|---|---|---|
| Local | Developer and CI | Seed/fake | Mock/test IDs | Local/test providers |
| Preview | PR/internal builds | Synthetic | Test IDs only | Test accounts/providers |
| Staging | Release candidate/beta | Non-production testers | Test IDs or tightly controlled test config | Full provider sandbox/config |
| Production | Store release | Real | Production IDs | Production providers |

Use distinct bundle/application IDs when practical. Secrets live in provider/EAS/GitHub secret stores and function environment, never committed. Public Supabase URL/publishable key and ad unit IDs are configuration, not secrets; security still relies on RLS/authorization.

Repository environments and secrets belong to `chronos-strike`, not `TheClockGame`. Grant least-privilege access independently so deploying Clock Quest cannot deploy the mobile backend or read its production secrets.

## Observability

### Minimum launch dashboards

- app versions/OS/devices and active users;
- crash-free users/sessions and Android ANRs;
- startup, route-ready, frame, and input latency;
- auth success/failure by provider and error class;
- sync queue age/conflicts/failures;
- run submissions accepted/rejected/quarantined by ruleset/category;
- function latency/error/rate limits;
- database size/connections/slow queries/egress;
- Daily/leaderboard cache freshness;
- ad load/fill/offer/start/earn/confirm failures and SSV lag;
- account deletion/export backlog.

### Alert examples

- crash-free sessions below release threshold;
- accepted-run rate abruptly falls or rejection reason spikes;
- oldest sync queue item exceeds target;
- SSV confirmations stop while impressions continue;
- function 5xx or p95 latency crosses threshold;
- database quota/connection/storage reaches 70/85/95%;
- backup job or restore verification fails;
- auth provider error spike;
- minimum-version/feature-flag config cannot load.

Alerts must point to a runbook and owner.

## Operational runbooks

Prepare before launch:

- Supabase/provider outage;
- leaderboard disabled/read-only mode;
- validator regression by ruleset;
- bad database migration;
- duplicate/missing ad rewards;
- leaked/revoked secret;
- auth provider/Apple key rotation;
- abusive account/handle moderation;
- account export/deletion failure;
- corrupted local SQLite migration;
- bad EAS Update/native incompatibility;
- store rollback/halt rollout;
- database restore and replay object reconciliation.

## Cost model (checked 2026-07-18)

Prices and quotas change. Recheck linked primary sources before launch.

### Unavoidable publishing costs

- Apple Developer Program: **US$99/year** (or local equivalent).
- Google Play Console: **US$25 one-time** registration.
- A domain is strongly recommended for Universal Links/App Links, privacy/support/deletion pages, and ad-related verification; price varies by registrar/TLD.

### Stage A — development and tiny closed beta

| Service | Recommended tier | Expected recurring cost |
|---|---|---:|
| Supabase | Free | $0 |
| Expo EAS | Free, plus local builds where useful | $0 |
| GitHub Actions | Existing allowance/public-repo allowance | $0 within quota |
| Crash/analytics | Free tier or minimal provider | $0 within quota |
| Email | Provider sandbox/very small tier | $0–low |
| AdMob | Test ads | $0 |

Supabase Free currently lists 50,000 MAU, 500 MB database, 5 GB egress, 1 GB file storage, and 500,000 Edge Function invocations. These are far above a 50-player load, but Free projects may pause after low activity and do not provide the production backup posture described for Pro. Use it for development/closed beta with manual logical backups.

Expo's current Free plan lists 15 Android and 15 iOS builds and updates to 1,000 MAU, enough for this expected scale if build cadence is controlled.

### Stage B — small public production (recommended)

| Service | Recommended tier | Expected recurring cost |
|---|---|---:|
| Supabase | Pro | From $25/month |
| Expo EAS | Free initially | $0 |
| Domain | Basic domain | roughly registrar cost/year |
| Email delivery | Low-volume production SMTP | $0–low, provider-dependent |
| Monitoring | Free/entry tier | $0–low |
| AdMob | Production | No hosting subscription; revenue is variable |

Why pay for Supabase Pro before/at public launch even with 50 players:

- Free can pause after low activity;
- Pro currently includes daily backups retained for seven days;
- production support and much larger included quotas;
- a predictable $25/month is cheaper than operating and patching a custom VM/database stack.

With Expo Free and low-volume ancillary providers, the core recurring platform cost can be approximately **$25/month plus domain/email/monitoring choices**, not counting Apple membership and taxes. It is also reasonable to launch a closed beta at $0 recurring and upgrade when public reliability is required.

### Stage C — measured growth

Do not upgrade by player count alone. Upgrade when dashboards show quota, performance, backup, collaboration, or uptime needs:

- Expo Starter is currently $19/month if build queue/credits and higher update MAU improve workflow;
- Supabase compute/disk can scale inside the same project/data model;
- add paid crash/analytics, SMTP, CDN, or job queue only when their free limits or operational requirements are reached;
- keep the spend cap enabled until deliberate overage is approved.

### Cost controls

- one production project, not many paid projects;
- one standalone repository and one CI pipeline for the web/mobile/shared-core/backend product, avoiding cross-repository package publishing on every change;
- preview/staging lifecycle cleanup;
- replay size/retention caps;
- avatar/image size limits and transformations only when justified;
- leaderboard pagination/cache;
- bounded analytics cardinality and event volume;
- database/egress/function quota alerts;
- monthly cost review tied to active players and ad revenue;
- no microservices or always-on compute until metrics require them.

## Release checklist

### Product/game

- parity matrix signed;
- ruleset fixtures pass in mobile/server;
- Standard/assisted/ad/admin categories correct;
- Daily UTC behavior correct;
- no ranked Cheat path;
- offline and lifecycle behavior tested;
- licenses approved.

### Backend/security

- migrations/RLS/security tests pass;
- backup and restore drill pass;
- secrets and admin access reviewed;
- run/ad idempotency proven;
- rate limits/kill switches active;
- deletion/export tested;
- monitoring/alerts/runbooks live.

### Ads/privacy

- audience decision documented;
- consent/privacy choices work;
- child treatment/content rating configured if applicable;
- test IDs in non-prod, production IDs only in prod;
- SSV signature and duplicate tests pass;
- rewards and board separation correct;
- store privacy/data safety declarations match SDK behavior.

### Stores

- signing credentials owned/backed up;
- Apple/Google accounts verified;
- review account/demo mode and notes;
- support/privacy/terms/deletion URLs live;
- metadata/screenshots/age rating complete;
- staged rollout and rollback owner assigned.

## Primary sources

Checked 2026-07-18:

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) — production-grade native customization and why development builds differ from Expo Go.
- [Expo EAS pricing](https://expo.dev/pricing) — current build/update allowances and paid tiers.
- [Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/) — runtime compatibility and update model.
- [React Native Skia installation](https://shopify.github.io/react-native-skia/docs/getting-started/installation/) — Expo template, native requirements, and bundle-size impact.
- [Supabase platform](https://supabase.com/docs/guides/platform) — managed Postgres/Auth/Functions/Storage/Realtime capabilities.
- [Supabase billing and quotas](https://supabase.com/docs/guides/platform/billing-on-supabase) and [pricing](https://supabase.com/pricing) — Free/Pro limits and scale options.
- [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing) — low-activity pause behavior.
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups) — plan backup behavior and Free logical-backup guidance.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — authorization model for exposed tables.
- [Supabase Auth with React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native) and [Apple login](https://supabase.com/docs/guides/auth/social-login/auth-apple) — client and provider integration.
- [Google AdMob rewarded ads](https://developers.google.com/admob/android/rewarded) — rewarded lifecycle and mandatory test ads during development.
- [AdMob server-side verification](https://developers.google.com/admob/android/ssv) — signed reward callback model.
- [AdMob rewarded-ad policy](https://support.google.com/admob/answer/7313578) — opt-in/non-transferable reward requirements.
- [Google UMP privacy setup](https://developers.google.com/admob/android/privacy) — consent refresh and privacy options.
- [AdMob Families compliance](https://support.google.com/admob/answer/6223431) — child-directed treatment and content rating behavior.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — login, guest access where appropriate, security, deletion, and review requirements.
- [Apple account deletion guidance](https://developer.apple.com/design/human-interface-guidelines/managing-accounts) — in-app deletion and token revocation.
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) — in-app path plus public web deletion resource.
- [Apple Developer membership](https://developer.apple.com/programs/whats-included/) and [Google Play Console registration](https://support.google.com/googleplay/android-developer/answer/6112435) — current publishing fees.
