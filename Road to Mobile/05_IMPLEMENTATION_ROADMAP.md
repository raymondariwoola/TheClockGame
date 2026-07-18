# 5. Implementation roadmap

## Planning assumptions

- One experienced full-time engineer is the reference capacity.
- Product/design, device testing, store review, policy/legal review, and asset licensing can add calendar time.
- Estimates are ranges, not commitments. Re-estimate after the Phase 1 technical spike.
- The existing GitHub Pages game and URL remain live throughout repository extraction and mobile migration.
- `chronos-strike` becomes the sole maintained Chronos Strike repository; `TheClockGame` retains Clock Quest and later a compatibility redirect only.
- “Done” means tested on real iOS and Android hardware, not merely implemented in a simulator.

A credible parity-plus-production v1 is approximately **24–36 engineering weeks for one experienced engineer**. A smaller closed beta can arrive around weeks 12–18 by deferring ads, legacy transfer, full social auth, and some progression surfaces. Multiple engineers can shorten calendar time only after shared-core contracts and ownership boundaries are stable.

## Release train overview

| Phase | Outcome | Estimate | Exit gate |
|---|---|---:|---|
| 0. Repository, product, and policy foundation | Standalone repo, preserved web deployment, scope/audience/accounts/rewards agreed | 1–2 weeks | New repo is authoritative; old URL and baseline tests pass |
| 1. Freeze and extract rules | Typed game-core matches ruleset 1 | 3–5 weeks | Golden fixtures pass in legacy and new core |
| 2. Native vertical slice | One polished playable run on iOS/Android | 3–5 weeks | Hardware performance/input/audio gate passes |
| 3. Full local parity | All current modes/features work offline | 5–8 weeks | Parity matrix and regression suite pass |
| 4. Backend, auth, sync | Accounts, cross-device profile, secure data model | 4–6 weeks | RLS/security/sync failure tests pass |
| 5. Verified competition/social | Accepted runs, boards, Daily, rivals, sharing | 3–5 weeks | Server replay parity and abuse tests pass |
| 6. Rewarded ads and compliance | Opt-in revive flow with verified grant | 2–4 weeks | Consent, SSV, lifecycle, policy QA pass |
| 7. Hardening and stores | Beta, accessibility, operations, staged launch | 3–5 weeks plus review | Launch checklist and staged rollout metrics pass |

Some work overlaps after Phase 2, but do not start backend score validation before `game-core` is authoritative.

## Phase 0 — repository separation, product, policy, and architecture lock

### Repository separation

- create the standalone `chronos-strike` repository under the correct owner/organization;
- extract relevant `GameMode/` history from a throwaway clone rather than rewriting the active `TheClockGame` repository;
- move the current web game to `apps/web` without refactoring it in the same commit;
- move the Chronos enhancement roadmap and `Road to Mobile` documents into `docs/`;
- tag the imported web baseline and record the originating `TheClockGame` commit SHA;
- configure standalone CI and a GitHub Pages preview/production deployment;
- verify the new web URL against the existing test suite and manual smoke tests;
- keep the old deployment untouched until the new deployment is proven;
- then replace the old `GameMode/` page with a tested redirect/link and update Clock Quest navigation;
- archive/remove duplicate Chronos source only after rollback and local-progress behavior are confirmed.

### Decisions required

- Target audience: children, mixed audience, or general audience.
- Minimum iOS/Android versions and low-end device floor.
- Guest play and account benefit copy.
- Auth providers and public handle rules.
- Standard/accessibility-assisted/ad-assisted leaderboard separation.
- Whether a rewarded revive resets combo, when it resumes, and how many per run.
- Whether legacy local achievements/cosmetics can transfer as verified or legacy-marked.
- Data retention, deletion grace period, replay retention, and support contact.
- Music/font/art licenses for app-store redistribution.
- Bundle IDs, application IDs, domain, and developer-account ownership.

### Engineering deliverables

- architecture decision records;
- standalone monorepo/workspace bootstrap;
- environment naming and secret ownership;
- initial threat model and data inventory;
- screen map and visual reference captures from the web version;
- instrumentation/performance budget;
- launch v1 and deferred backlog list.

### Exit criteria

- no unresolved question changes the data model or ad/leaderboard trust categories;
- domain/app identifiers are owned by the correct person/organization;
- store accounts and domain access are available;
- privacy/policy owner is identified.
- `chronos-strike` is the only repository accepting new Chronos feature changes;
- the old GitHub Pages route still reaches the game or a verified redirect;
- imported history, tags, issues/document links, and baseline test evidence are recorded.

## Phase 1 — freeze rules and create shared game core

### 1. Fix baseline correctness before freezing

- fix the Visual Beat `prevAngle` initialization issue;
- decide/document the 90 ms duplicate input guard;
- reconcile roadmap text with current implementation/test count;
- add missing end-to-end score reducer tests;
- remove ranked Cheat behavior from the planned production path without altering the current public game until a safe legacy change is agreed.

### 2. Build compatibility fixtures

- fixed seeds for all modes/difficulties;
- Daily UTC boundary seeds;
- every modifier/boss/power;
- event-by-event score/life/combo snapshots;
- long Endless and 40-round Classic simulations;
- achievements/cosmetics;
- replay/Rival serialization malformed and valid cases.

### 3. Port to strict TypeScript

- define branded IDs and enum/schema contracts;
- port RNG byte-for-byte and prove sequences match;
- centralize configuration registries;
- extract complete game reducer and effects;
- implement ruleset registry (`ruleset/1`, future `ruleset/2`);
- remove DOM/time/storage dependencies;
- make replay validator call the same reducer;
- publish internal package exports.

### 4. Test

- run old and new fixtures side-by-side;
- property/fuzz tests for angles, event order, replay decoder, bounds;
- deterministic repeated-run tests;
- serialization compatibility on Node and mobile JS runtimes.

### Exit criteria

- every approved ruleset-1 fixture matches;
- no `Math.random`, wall-clock, DOM, network, or platform import exists in `game-core`;
- full score is derived by the core;
- package is consumable in both an Expo test harness and a Supabase/Node validation harness.

## Phase 2 — native vertical slice

Build one representative Classic sequence rather than every menu screen.

### Deliverables

- Expo TypeScript app and development builds;
- Expo Router shell and theme tokens;
- Skia clock face, hand, one target zone, judgment, particles;
- Reanimated/worklet-driven visual hand;
- native input timestamp path and duplicate event IDs;
- HUD, Strike, pause, countdown, results;
- bundled SFX/music test and audio focus handling;
- haptic adapter;
- app lifecycle auto-pause/checkpoint;
- reduced-motion/flash path;
- local SQLite run record;
- debug performance overlay in non-production builds.

### Device matrix for the spike

- one older supported iPhone at 60 Hz;
- one current iPhone, ideally high refresh;
- one low/mid-range Android at 60 Hz;
- one modern Android at 90/120 Hz;
- phone portrait/landscape and at least one tablet.

### Exit criteria

- core-generated angle/judgment agrees with fixture;
- p95 input-to-feedback and frame targets are measured and acceptable;
- background/resume never advances the hand or duplicates a strike;
- audio does not leak/stack across pause/quit/retry;
- no per-frame React rerender;
- Skia/native path is confirmed before full UI investment.

If this spike fails, evaluate a lower-level native animation/input module or a narrower rendering approach. Do not respond by moving game rules into UI worklets.

## Phase 3 — complete local/offline parity

### Gameplay

- Classic/Endless/Zen state machines;
- Normal/Hardcore curves;
- all modifiers and bosses;
- all powers and expiration/effect presentation;
- combo/Overdrive/streak/act/vignette/taunt behavior;
- Precision Lab controls, metronome, heat map, tendency;
- Daily deterministic local flow;
- ghost and offline Rival Code race;
- pause/restart/quit/retry and interruptions.

### Meta/UI

- onboarding and guest profile;
- home/mode/difficulty;
- result/share card;
- achievements and cosmetics;
- local profile/history/bests partitioned correctly;
- settings/audio/haptics/accessibility/privacy placeholders;
- offline/cached states;
- localization-ready string catalog.

### Persistence

- SQLite schema v1 and migration runner;
- run checkpoints and clean crash recovery policy;
- replay retention limits;
- settings/profile backups;
- deterministic migration tests.

### Exit criteria

- parity checklist in the product document passes;
- a player can install in airplane mode after assets are present and play all local modes;
- process death does not corrupt profile or duplicate progression;
- accessibility audit covers all parity features;
- internal distribution build is usable by non-developers.

## Phase 4 — backend, auth, profile, and sync

### Infrastructure-as-code

- initialize Supabase locally;
- SQL migrations for schema, constraints, indexes, views, triggers;
- RLS policies and policy tests;
- typed generated database definitions;
- environment secrets and rotation procedure;
- scheduled logical backups for Free environments;
- CI migration reset/seed/test.

### Authentication

- Apple, Google, then email fallback/custom SMTP;
- guest-to-account linking;
- secure token storage and refresh/revocation;
- public handle selection/change/cooldown;
- session/device management;
- in-app export/delete plus public deletion webpage.

### Sync

- command queue/idempotency;
- bootstrap/current profile fetch;
- merge rules for guest upgrade and second device;
- optimistic settings/loadout versions;
- retry/backoff/offline UI;
- server-derived progression foundation.

### Exit criteria

- two devices merge without losing achievements/settings/local history;
- replaying the same sync command has no duplicate effect;
- cross-user RLS attempts fail in automated tests;
- service key cannot be found in app bundles/logs;
- delete flow removes required data and revokes sessions;
- Free-plan uptime/backup limitations are accepted for beta or production is upgraded.

## Phase 5 — verified competition, Daily, rivals, and sharing

### Run submission

- bounded versioned replay contract;
- authenticated/idempotent submit function;
- shared-core reconstruction and verified summary;
- rejection/quarantine reasons and operator query path;
- server-derived stats/achievements/inventory;
- accepted-run response and offline retry.

### Leaderboards

- read-only standard boards partitioned by all integrity dimensions;
- Daily boards and entry policy;
- current-player/nearby-rival row;
- pagination/cache;
- legacy Gist import as `legacy_unverified` archive;
- disable direct Gist submissions after cutover.

### Rival/share

- opaque expiring challenge links;
- Universal Links/App Links and fallback website;
- verified category shown on share card;
- offline Rival Code remains unranked.

### Exit criteria

- identical replay yields identical server/client summary;
- forged score, edited replay, duplicate request, unsupported ruleset, impossible timing, wrong Daily seed, and wrong-user replay are rejected/quarantined;
- concurrency test cannot lose accepted scores;
- boards never mix rulesets/categories;
- accepted result appears without client directly writing leaderboard state.

## Phase 6 — rewarded ads and compliance

Do this after the run state machine and server trust model are stable.

### Deliverables

- AdMob accounts/apps/ad units for dev/prod;
- native ad SDK via development builds;
- Google UMP/privacy choices flow;
- audience/child treatment/content rating configuration;
- iOS privacy/tracking flow only if needed;
- server opportunity and SSV endpoints;
- one-revive-per-run ad-assisted state;
- provisional/offline reconciliation policy;
- frequency cap and remote kill switch;
- ad lifecycle/audio/checkpoint recovery;
- analytics and revenue events without PII.

### Test cases

- test ad success;
- user dismisses early;
- no fill/load timeout;
- app backgrounds or is killed during ad;
- reward callback before/after dismissal;
- duplicate client and SSV callback;
- invalid signature/transaction/ad unit/custom data;
- expired/wrong-user opportunity;
- SSV delayed while offline;
- consent denied/unknown/child treatment;
- global kill switch;
- Standard board exclusion after reward.

### Exit criteria

- exact reward granted once;
- refusing/failing ad never blocks normal game completion;
- ad-assisted marker survives process death/sync;
- no Standard/Daily Standard result can contain an ad reward;
- test IDs cannot ship as production config and live IDs cannot run in test automation;
- policy checklist is reviewed against current store/AdMob rules.

## Phase 7 — beta, hardening, and store launch

### Quality

- full unit/integration/E2E/device suite;
- performance soak and battery/thermal tests;
- accessibility audit with VoiceOver/TalkBack and reduced effects;
- localization/pseudolocalization and dynamic text;
- security review, dependency/license scan, secret scan;
- database restore drill and incident exercise;
- offline/poor-network/clock/timezone tests;
- crash/ANR-free beta targets met.

### Store preparation

- icons, splash, screenshots, previews, descriptions, age rating;
- privacy policy, terms, support, account deletion webpage;
- App Privacy and Google Data safety declarations;
- consent/ads disclosure and app-ads.txt/domain setup if applicable;
- Apple review demo account or full demo mode;
- Sign in with Apple/provider review notes;
- TestFlight and Play internal/closed testing;
- production signing/credentials backed up and access controlled.

### Rollout

1. staff/internal build;
2. small closed alpha;
3. 20–50 player closed beta;
4. release candidate with production backend/ad configuration;
5. staged Android rollout and controlled iOS release;
6. monitor crash, rejection, sync, auth, ad reward, and performance dashboards;
7. expand only after a 48–72 hour healthy window.

### Rollback

- remote-disable ads/submissions/experimental content;
- keep gameplay available offline;
- halt staged rollout;
- EAS update only when native runtime compatibility allows and store rules permit;
- database migrations are expand/contract, backward compatible across active app versions;
- never roll back by deleting user data or changing the meaning of an existing ruleset.

## Post-launch backlog

Prioritize from player data rather than assumptions:

### Next likely value

- push opt-in for Daily;
- historical Daily calendar;
- friend/nearby-rival boards;
- additional bosses/modifiers;
- more cosmetic types and noncompetitive progression;
- account/device management UI;
- operator moderation/quarantine UI;
- mobile-to-web progress parity if the web game becomes account-aware.

### Later, only with demand

- weekly leagues;
- custom Rift creator and curated discovery;
- spectator replays;
- ad mediation;
- in-app purchases/subscriptions;
- live multiplayer/matchmaking;
- clans/chat/community feed;
- separate API/validation service.

Live multiplayer is a different product and infrastructure phase. “Cross-platform play” in v1 should mean shared accounts, synced progress, Daily competition, leaderboards, and asynchronous Rival races across iOS and Android.

## Work tracking structure

Create epics aligned to these phases and make every ticket include:

- user outcome;
- ruleset/profile/API versions affected;
- offline behavior;
- accessibility behavior;
- analytics/diagnostic events;
- security/privacy impact;
- unit/integration/E2E acceptance tests;
- rollback/feature-flag behavior;
- iOS and Android verification devices.

No gameplay ticket is complete if it changes RNG/scoring without a ruleset decision and updated golden fixtures.
