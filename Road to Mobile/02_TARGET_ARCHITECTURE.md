# 2. Target architecture

## Architecture objective

Build a responsive native client whose moment-to-moment play does not depend on the network, while making identity, durable progress, ad rewards, and competitive results secure server concerns.

The target is a **local-first modular monolith**:

```text
iOS / Android app
├── native presentation and device services
├── application/use-case layer
├── deterministic game-core package
├── local SQLite persistence + secure session storage
└── sync/API client
          │ HTTPS + JWT
          ▼
Supabase project
├── Auth
├── Postgres + Row Level Security
├── Edge Functions (trusted commands/validation)
├── Storage (avatars and optional replay blobs)
└── Realtime (optional leaderboard/profile invalidation)
```

No always-on custom game server is needed for the first release. Gameplay is local; functions run only for authenticated commands such as score submission, sync reconciliation, handle changes, account deletion, and ad verification.

## Why Expo/React Native rather than wrapping the website

### Chosen: Expo + React Native + TypeScript

Benefits:

- preserves JavaScript/TypeScript domain logic and RNG semantics;
- one application codebase for iOS and Android;
- native navigation, accessibility, haptics, audio, secure storage, share sheet, deep links, app lifecycle, and ad SDK integration;
- development builds allow native modules while keeping Expo's build/update workflow;
- the game core can also run in Supabase Edge Functions and Node-based tests.

### Not chosen as the production foundation: Capacitor/WebView

A WebView wrapper would reuse more CSS/DOM code and could produce a prototype quickly, but it would retain the current monolithic browser shell, browser audio/timer variability, DOM/canvas accessibility limitations, and weaker native lifecycle integration. It is a valid one- or two-week feasibility shell, not the best foundation for the requested polished, advanced app.

### Not chosen: Flutter

Flutter is capable of excellent game rendering, but it would require translating the deterministic JavaScript engine into Dart and separately maintaining a TypeScript/JavaScript backend validator or another shared representation. React Native minimizes that compatibility risk.

## Proposed standalone repository

Create a new standalone repository named `chronos-strike`. Move the existing web game into it rather than leaving an actively maintained copy under `TheClockGame/GameMode/`:

```text
chronos-strike/
├── apps/
│   ├── web/                       # moved current GameMode; legacy/parity web build
│   └── mobile/
│       ├── app/                    # Expo Router routes
│       ├── src/
│       │   ├── features/
│       │   ├── game/
│       │   ├── components/
│       │   ├── services/
│       │   ├── state/
│       │   └── theme/
│       ├── assets/
│       ├── app.config.ts
│       └── eas.json
├── packages/
│   ├── game-core/                  # pure TypeScript, no React/native imports
│   ├── contracts/                  # schemas and API/event types
│   ├── test-fixtures/              # ruleset compatibility packs
│   └── config/                     # lint/TypeScript/test presets
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   ├── tests/
│   └── functions/
│       ├── submit-run/
│       ├── claim-ad-reward/
│       ├── change-handle/
│       ├── sync-profile/
│       └── delete-account/
├── docs/
│   ├── road-to-mobile/             # these planning documents
│   ├── architecture-decisions/
│   └── legacy-roadmap/
├── .github/workflows/
└── README.md
```

Use `pnpm` workspaces (or npm workspaces if preferred), strict TypeScript, schema validation at every persistence/network boundary, and a single lock file.

`chronos-strike` becomes the only maintained source for Chronos Strike. The original `TheClockGame` repository continues to own Clock Quest. During cutover it keeps the old `GameMode/` deployment working; afterward it contains a small redirect/link at that path, not a second game engine.

The web app should initially move with minimal code change so its behavior remains identical. After `game-core` passes compatibility fixtures, `apps/web` can consume a browser bundle generated from the shared package. Do not manually maintain separate web and mobile scoring engines.

See [Repository separation plan](07_REPOSITORY_SEPARATION_PLAN.md) for extraction and GitHub Pages continuity.

## Layer responsibilities

### 1. `game-core`: pure domain

This package must import no React, React Native, Expo, browser DOM, clock, storage, network, or analytics APIs.

It owns:

- semantic versions and ruleset registry;
- RNG and sub-stream rules;
- run identity and seed normalization;
- mode/difficulty/rank configuration;
- round generation and boss/modifier definitions;
- `GameState` and pure `reduce(state, event) -> state + effects`;
- strike classification and complete score calculation;
- power grant/expiry/use state;
- life, combo, streak, Overdrive, act, and completion transitions;
- achievement evaluation and cosmetic unlock rules;
- replay encoding/decoding and validation;
- run summary derivation;
- deterministic clock math.

Suggested domain events:

```text
RUN_STARTED
ROUND_STARTED
FRAME_ADVANCED
STRIKE_REQUESTED
STRIKE_RESOLVED
POWER_GRANTED
POWER_EXPIRED
PAUSED
RESUMED
APP_BACKGROUNDed
APP_FOREGROUNDED
RUN_FINISHED
```

`FRAME_ADVANCED` may update local presentation/game state, but competitive replay should record compact semantic events and monotonic timestamps, not every frame.

The reducer returns effects such as `PLAY_SFX`, `HAPTIC`, `SHOW_JUDGMENT`, `ROUND_COMPLETED`, or `PERSIST_CHECKPOINT`. The native shell performs those effects. This keeps game rules testable and platform-independent.

### 2. Application/use-case layer

This layer coordinates domain and infrastructure:

- `StartRun`, `Strike`, `PauseRun`, `ResumeRun`, `FinishRun`;
- `LoadProfile`, `SaveSettings`, `EquipCosmetic`;
- `SignIn`, `UpgradeGuest`, `SignOutEverywhere`, `DeleteAccount`;
- `SubmitRun`, `FetchLeaderboard`, `FetchDailyRift`;
- `RequestAdOpportunity`, `ClaimAdReward`;
- `SyncProgress`, `ResolveSyncConflict`;
- `CreateShareCard`, `ImportRivalChallenge`.

Use cases depend on interfaces (`ProfileRepository`, `RunRepository`, `AuthGateway`, `LeaderboardGateway`, `AdsGateway`) rather than Supabase or Expo types.

### 3. Infrastructure adapters

Adapters implement interfaces:

- Supabase Auth/API/Realtime adapter;
- SQLite repositories and migration runner;
- SecureStore session/token adapter;
- AdMob rewarded-ad adapter;
- native audio/haptic/share/deep-link adapters;
- network reachability and sync queue;
- crash/analytics adapter;
- app lifecycle and monotonic clock adapter.

This separation makes providers replaceable without rewriting the game.

### 4. Presentation

Use Expo Router routes and feature-owned components. UI state should be narrowly scoped; do not mirror the whole domain object into a global reactive store every frame.

Recommended split:

- normal UI/profile/settings data: TanStack Query for server state and a small app store (for example Zustand) for session/UI state;
- game session: a dedicated `GameSessionController` wrapping the reducer;
- frame animation: Skia/Reanimated shared values/worklets, updating the visual hand without causing React tree renders every frame;
- finalized strike: sample the authoritative local monotonic angle/time and dispatch one semantic domain event back to JavaScript/domain state.

## Mobile rendering plan

### Game surface

Render the clock, zones, hands, markers, trails, heat map, and particles inside one React Native Skia `Canvas`.

Advantages:

- a coherent coordinate system matching the existing 600x600 SVG model;
- fewer bridge/layout operations;
- GPU-friendly arcs, paths, gradients, glows, and particles;
- straightforward scaling to phone/tablet and portrait/landscape;
- easier 60/90/120 Hz visual animation.

Keep HUD, buttons, dialogs, settings, and leaderboards as regular React Native components for native accessibility and layout.

### Time source and frame behavior

- Use a monotonic clock, never `Date.now()`, for in-run elapsed time.
- Clamp anomalous frame deltas for rendering.
- On app background, interruption, incoming call, lock, or ad display: dispatch Pause and persist a checkpoint.
- Never let background wall-clock time advance the hand.
- On resume, require a short ready/countdown state for competitive runs.
- Capture input timestamp as close to the native/UI thread as possible.
- Store device refresh rate and timing diagnostics for QA, not as scoring modifiers.

### Input

Support:

- large Strike button and tap-on-arena;
- left/right-handed button placement;
- external keyboard Space/Enter;
- haptic feedback with independent enable toggle;
- later: gamepad binding behind an adapter.

Debounce at the input adapter and also make the reducer idempotent for a duplicated native event ID. The current 90 ms browser guard becomes a documented rule or an adapter detail; decide before fixtures are frozen.

### Audio

- Use `expo-audio` or the current supported native Expo audio package.
- Bundle short SFX and the essential music bed for zero-network play.
- Preload latency-sensitive strike/judgment sounds.
- Respect OS audio focus, silent-mode product choice, Bluetooth/headphone changes, calls, and background transitions.
- Use procedural audio only if parity and device performance are proven; otherwise render it to licensed loop assets.
- Separate music, SFX, and haptic settings.

## Navigation and feature boundaries

Suggested routes:

```text
/(onboarding)
  welcome
  audience-consent
  auth
/(tabs)
  home
  play
  daily
  leaderboard
  profile
/game/[runId]
/results/[runId]
/precision-lab
/rival/[challengeId]
/settings
/settings/accessibility
/settings/privacy
/profile/achievements
/profile/cosmetics
```

The active game route should block accidental back navigation and use an explicit quit confirmation. Ads must only appear from stable pause/result/revive states, never over an active clock.

## Versioning model

Maintain four different versions:

| Version | Purpose | Change example |
|---|---|---|
| `appVersion` | Store-facing product version | UI, onboarding, non-rule bug fix. |
| `nativeRuntimeVersion` | EAS update/native binary compatibility | Adding/changing a native SDK. |
| `rulesetVersion` | Competitive generation/scoring contract | Score formula, RNG draw order, boss behavior. |
| `profileSchemaVersion` | Local/server progress migration | New inventory/progression shape. |

Ruleset data should be immutable after release. A new balance change creates a new ruleset module and new leaderboard partitions. Never reinterpret an old replay under new rules.

## Run state machine

Use an explicit state machine rather than screen flags:

```text
idle
  -> preparing
  -> countdown
  -> active <-> paused
  -> revive_offer -> ad_showing -> active
  -> finishing
  -> locally_saved
  -> queued_for_validation
  -> validated | rejected | unranked
```

Transitions carry reason codes. `ad_showing`, `backgrounded`, `interrupted`, and `user_paused` are distinct in replay metadata.

## Dependency rules

- `game-core` depends on nothing platform-specific.
- mobile features may depend on `game-core` and `contracts`.
- infrastructure may implement application interfaces but must not own game rules.
- Edge Functions depend on `game-core` and `contracts`, never import mobile code.
- presentation never writes Supabase tables directly for privileged actions.
- database migrations are the source of truth for server schema and RLS.

Enforce these rules with TypeScript project references, package export maps, lint boundaries, and CI.

## Performance budgets

Set budgets before visual polish:

- stable 60 fps on the agreed lowest supported devices; exploit high refresh rates when available;
- no React component rerender on each game frame;
- p95 Strike input-to-local feedback below 50 ms on target devices;
- cold start to interactive menu below 2.5 seconds on mid-range devices;
- game route ready from menu below 1 second after assets are warm;
- no network dependency to start a normal/Zen run;
- bounded replay size (target under 32 KB for a 40-round run before compression);
- bounded memory for particles/heat map/audio pools;
- Android App Bundle and iOS download size tracked in CI.

These are acceptance targets to validate on hardware, not guarantees inferred from simulators.

## Feature flags and kill switches

Server-managed, cached flags should control:

- rewarded ads globally and per placement/platform/version;
- leaderboard submissions per ruleset;
- Daily board availability;
- minimum supported app/ruleset version;
- suspicious-run quarantine thresholds;
- experimental boss/modifier availability only in non-ranked modes.

Defaults must be safe offline. If flag fetch fails, gameplay continues, ads stay off if consent/config is uncertain, and competitive submissions queue rather than bypass validation.

## Scalability without redesign

At first, Postgres handles reads/writes and Edge Functions validate commands. Scale in this order:

1. add/verify indexes and query pagination;
2. use cached/materialized leaderboard views and short client cache TTLs;
3. move replay payloads from rows to Storage if they become large;
4. increase Supabase compute/disk and connection pool settings;
5. add a job queue for asynchronous validation only when synchronous function duration becomes a constraint;
6. add a CDN/cache for public leaderboards;
7. extract validation or matchmaking into a separate service only when measured load or runtime limitations require it.

The shared `game-core` and API contracts make step 7 possible without changing the mobile domain model.
