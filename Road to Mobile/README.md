# Chronos Strike: Road to Mobile

This folder is the implementation blueprint for rebuilding the current `GameMode/` web game as a polished iOS and Android application without breaking its existing rules.

The recommendation is:

- **Repository:** create a standalone `chronos-strike` repository containing the existing web game, mobile app, shared packages, backend infrastructure, and product/architecture documents. Keep `TheClockGame` focused on Clock Quest after a controlled redirect/cutover.
- **Mobile:** Expo + React Native + TypeScript, using a development build (not Expo Go) and React Native Skia for the clock/game surface.
- **Shared game core:** a pure, deterministic TypeScript package consumed by the mobile app, tests, replay validator, and backend functions.
- **Backend:** Supabase managed Postgres, Auth, Edge Functions, Storage, and optional Realtime. Start on Free during development/closed beta; move the production project to Pro when reliable uptime and managed backups become release requirements.
- **Monetization:** Google AdMob rewarded ads only at first. A player explicitly chooses the reward. Ad-assisted runs are never mixed into the standard competitive leaderboard.
- **Delivery:** preserve the existing GitHub Pages URL during migration, move Chronos Strike into its standalone repository with history, create compatibility fixtures from ruleset 1, release the native app in vertical slices, and redirect the old path only after the new web deployment is verified.

This is a modular monolith, not a microservice system. At the expected scale (fewer than 50 players in year one), one mobile codebase, one Postgres database, and a small set of server functions are simpler, safer, and cheaper. The boundaries in the code make later scaling possible without prematurely paying the operational cost of distributed services.

## Documents

1. [Current-state audit](01_CURRENT_STATE_AUDIT.md) — what exists, what must remain compatible, and the risks in the web implementation.
2. [Target architecture](02_TARGET_ARCHITECTURE.md) — mobile modules, shared packages, runtime flows, and key technical decisions.
3. [Backend, data, security, and sync](03_BACKEND_DATA_SECURITY_SYNC.md) — schema, APIs, auth, offline behavior, validation, privacy, and scale path.
4. [Mobile product, UX, and rewarded ads](04_MOBILE_PRODUCT_UX_ADS.md) — screen plan, input/rendering/audio, ad reward rules, accessibility, and analytics.
5. [Implementation roadmap](05_IMPLEMENTATION_ROADMAP.md) — start-to-finish phases, deliverables, gates, estimates, and migration order.
6. [Testing, release, operations, and costs](06_TESTING_RELEASE_OPERATIONS_COSTS.md) — test pyramid, CI/CD, store release, monitoring, backup, and cost tiers.
7. [Repository separation plan](07_REPOSITORY_SEPARATION_PLAN.md) — why to separate, target repository layout, history-preserving extraction, GitHub Pages continuity, and cutover/rollback.

## The non-negotiables

The following are compatibility contracts:

- Ruleset 1 seeded generation must remain reproducible.
- `perfect`, `great`, `good`, and `miss` boundaries and base scores remain unchanged unless a new `rulesetVersion` is intentionally published.
- Classic remains 40 rounds and 3 lives; Endless remains one-life and unbounded; Zen remains unranked practice.
- Normal/Hardcore difficulty curves, modifier selection order, deterministic boss cycle, power-drop RNG order, combos, Overdrive, and multipliers must be covered by golden tests before being ported.
- Daily identities remain `daily|{rulesetVersion}|{UTC-date}`.
- Old leaderboard data remains archived and labeled by ruleset; it is not silently merged with newly verified scores.
- Cosmetics remain visual only.
- Admin/demo, rival, practice, ad-assisted, and standard competitive runs remain visibly distinct.

## Recommended release scope

The first store release should include:

- guest play with local persistence;
- optional Apple/Google/email sign-in and cross-device profile sync;
- Classic, Endless, Zen/Precision Lab, Normal, and Hardcore;
- current modifiers, four bosses, powers, achievements, cosmetics, Daily Rift, ghost/rival play, sharing, audio, haptics, and accessibility;
- verified standard and Daily leaderboards;
- one rewarded-life placement in an explicitly ad-assisted run category;
- account export/delete, privacy controls, offline play, crash reporting, and store-compliant consent flows.

Defer live multiplayer, chat, clans, weekly leagues, custom-rift discovery, subscriptions, mediation, and a separate admin portal until real usage justifies them.

## Decision summary

| Decision | Choice | Reason |
|---|---|---|
| Repository ownership | Standalone `chronos-strike` monorepo | Chronos Strike now has its own product lifecycle, mobile/backend infrastructure, release cadence, secrets, and issue backlog; keeping it inside the Clock Quest repository would couple unrelated releases. |
| Cross-platform framework | Expo/React Native/TypeScript | Reuses JavaScript domain knowledge while delivering native controls, app-store distribution, and native SDK access. |
| Game renderer | React Native Skia | A single native canvas is a better fit for a constantly animated clock, zones, trails, particles, and responsive scaling than hundreds of React views. |
| Backend | Supabase | Auth + Postgres + RLS + functions + storage in one service, with a free start and a scale-up path that does not require replacing the data model. |
| Architecture style | Modular monolith | Lowest operational cost at this scale; package and schema boundaries retain future options. |
| Offline model | Local-first profile/settings + queued server commands | Gameplay stays instant and available offline while authoritative competitive writes remain server controlled. |
| Leaderboard trust | Server-validated replay submission | The current client-reported score can be forged. Competitive score is derived or verified server-side. |
| Ads | AdMob rewarded ads, opt-in | Matches the desired non-intrusive model. Server-side verification protects durable rewards. |
| Ad/competition rule | Separate assisted runs | A paid-ad life or score boost cannot compete with an unassisted run. |

## Definition of success

The mobile rebuild is successful when:

- the same compatibility fixture produces the same generated rounds and final score on web, iOS, Android, and the backend validator;
- input-to-visual feedback is stable at 60 fps on the agreed low-end device floor and remains correct on 90/120 Hz displays;
- a player can play offline, later sign in, and sync without losing either device's earned progress;
- no client can directly insert a leaderboard result, grant an ad reward, unlock a server achievement, or edit another profile;
- an account can be created, exported, and deleted from the app;
- failed submissions and ad callbacks are idempotent and safe to retry;
- a release can be rolled out gradually and rolled back without corrupting profile or ruleset data;
- the standalone repository is the only maintained source of Chronos Strike code, while the old `TheClockGame/GameMode` URL redirects safely;
- the first-year infrastructure bill can remain at free/near-free beta cost or one predictable production backend subscription, excluding unavoidable store membership fees.

## Source date

Service limits, pricing, and store policies in these documents were checked on **2026-07-18**. Treat them as planning inputs and recheck them before purchase or submission.
