# 1. Current-state audit

## Executive assessment

Chronos Strike already contains a strong mobile game, but it does not yet contain a mobile application architecture.

It has also outgrown its current repository boundary. `TheClockGame` primarily describes Clock Quest, while Chronos Strike now has an independent ruleset, competitive data, backend, mobile release process, ads, accounts, privacy obligations, and product roadmap. A standalone repository is therefore recommended. The separation must move the web game as well as the mobile work so there is one maintained Chronos Strike source of truth.

The durable part is the deterministic game model in [`GameMode/engine.js`](../GameMode/engine.js). The risky part is the browser shell in [`GameMode/game.js`](../GameMode/game.js), which currently combines configuration, animation timing, DOM rendering, audio, persistence, achievements, cosmetics, Daily Rift, replay recording, admin modes, accessibility, and navigation in one 3,299-line file.

The right migration is not a visual rewrite from memory. It is:

1. freeze and characterize current rules;
2. extract/port the pure rules into a shared typed package;
3. build native adapters and screens around that package;
4. add server-authoritative identity, sync, reward, and leaderboard services;
5. compare the native build against versioned compatibility fixtures until parity is proven.

Repository extraction is an enabling step around this sequence, not a rewrite: preserve the relevant Git history, tag the baseline, move `GameMode/` into `apps/web`, move the Chronos roadmap and these documents, verify identical web behavior, and only then replace the old path with a redirect.

## Repository inventory

| File | Role today | Mobile disposition |
|---|---|---|
| `index.html` | Four main screens plus overlays, SVG clock, controls, accessibility elements | Use as a product/screen inventory; rebuild as native screens/components. |
| `style.css` | 2,093 lines of responsive presentation, safe-area handling, mobile/landscape layouts, motion and accessibility variants | Convert design tokens and behavior intentionally; do not mechanically translate CSS. |
| `game.js` | Browser game shell and most features | Split across domain, application, infrastructure, and presentation modules. |
| `engine.js` | Pure deterministic helpers, generation, achievements/cosmetics registries, replay codec | Port first to a shared TypeScript package and keep compatibility fixtures. |
| `engine.test.mjs` | 1,746 passing engine assertions | Preserve, migrate to typed tests, and expand to full scoring/replay validation. |
| `game.loadtest.cjs` | Mock-browser load smoke test | Retain for the legacy web build; replace mobile coverage with component/E2E tests. |
| `leaderboard.js` | Gist/Worker/local leaderboard client and name form | Replace remote writes with authenticated function calls and query-only board reads. |
| `leaderboard-worker.js` | Cloudflare Worker that sanitizes and rewrites a Gist | Retire after data import; it is not an authoritative score validator or transactional database. |
| `leaderboard-config.js` | Public backend endpoint/config | Replace with environment-specific public config; no secrets in the app. |
| `share.js` | Canvas PNG share card and Web Share API | Recreate with a native/offscreen image renderer and native share sheet. |
| `sw.js` | Range-aware cache for soundtrack files only | Not used by native. Bundle essential audio assets and use native cache/download APIs for optional packs. |
| `soundtrack/Hardcore.mp3` | 3.5 MB hardcore soundtrack | License-check, normalize, compress if useful, and bundle/download through the mobile asset pipeline. |
| `vendor/` | Anime.js and self-hosted fonts | Replace Anime.js with native animation primitives; preserve licensed fonts through app assets. |
| `LEADERBOARD-SETUP.md` | Existing Gist/Worker operations | Keep as legacy history; superseded by the backend document in this folder. |

The complete `GameMode/` payload is roughly 4 MB, mostly the soundtrack. `Normal.mp3` is referenced but absent; the browser intentionally falls back to procedural audio.

## Current feature map

### Game modes and difficulty

- **Classic:** 40 rounds, three lives, bosses every fifth round, act presentation every ten rounds.
- **Endless:** one life, no end, uncapped speed growth, increasing survival multiplier.
- **Zen / Precision Lab:** no ranked score, player-selected speed/zone/direction, slow motion, metronome, heat map, and timing tendency summary.
- **Normal and Hardcore:** Hardcore uses a faster/tighter curve, extra distractions, and a 2x score multiplier; Zen ignores it.

### Core strike and score rules

- Angular distance uses the shortest wrap-around distance.
- The perfect band is `min(3 degrees, zoneHalf * 0.25)`.
- Great extends to `zoneHalf * 0.55`; Good extends to the zone edge; outside is Miss.
- Base score is 100/60/30/0 for Perfect/Great/Good/Miss.
- A combo level rises after each three-hit streak.
- Overdrive begins at combo 4 and adds a 1.5x multiplier.
- Consecutive perfects add an escalating flat bonus.
- Modifier, boss, Hardcore, Endless survival, cheat, Overdrive, and active power multipliers stack in the current order and the total is rounded.
- Decoy traps subtract up to 100 points and process a miss.

That **order of operations** is a competitive rule and needs explicit golden tests. The current pure engine owns base scoring, but the full score reducer still lives inside `game.js`; it must be extracted before the mobile UI is trusted.

### Determinism and challenge identity

- RNG is `xmur3` seed hashing plus `mulberry32` generation.
- Normal identity is `gameVersion|rulesetVersion|mode|difficulty|seed`.
- Daily identity is `daily|rulesetVersion|UTC-date`.
- Round generation, modifier selection, boss placement, and power drops draw from one seeded stream.
- Quantum uses a labeled sub-stream so player dwell time does not change future generation.
- Boss type is a fixed cycle rather than a random selection.

Important qualification: `engine.simulateRun()` mirrors the setup draw order, but several gameplay mutations and the complete scoring state machine remain in the UI shell. The future server validator must execute the same reducer, not merely call `simulateRun()`.

### Modifiers, bosses, and powers

Current modifiers:

- Hyper Speed, Precision, Inverted, Double Hands, Phantom, Multi-Strike, Quantum, Decoys, and Pulse.

Current bosses:

- The Twins, Chronophage, Pulse Engine, and Orbit Warden.

Current powers:

- Time Stop, Bullet Time, Double, Triple, Zone Magnet, Deadeye, Score Frenzy, Combo Lock, Shield, Star Power, Extra Life, Full Heal, Jackpot, Overcharge, and Wildcard.

The definitions are split: generation IDs and some pure rules are in `engine.js`, while behavior closures and tunable values are in `game.js`. They must become validated data plus pure reducers so mobile, tests, and server validation cannot drift.

### Progression and social features

- 15 local achievements and achievement-gated cosmetic choices.
- Local lifetime profile and best score/combo/round.
- Daily local best, attempts, completion, and countdown.
- Per-round ghost replay for Daily and Rival races.
- Base64url Rival Codes containing identity and strike records.
- Canvas-generated score card, native browser share, download, and copy fallbacks.
- Global top 20 through a Worker/Gist path; local/cached fallback when offline.

### Accessibility and comfort

- Reduce motion, shake, particles, and flashes.
- High contrast, large HUD, left-handed layout, and color-blind markers.
- Visual-beat timing assist, recorded in run assists.
- Screen-reader live region and visible focus styles.
- Touch, click, Space, Enter, pause, and Escape controls.
- Safe-area CSS, dynamic viewport units, narrow-phone layouts, and landscape layout.

These are product requirements, not optional polish. They belong in the mobile parity checklist.

## Current storage map

All durable player state is device-local and unversioned beyond key suffixes:

| Key | Data |
|---|---|
| `cs_best_score`, `cs_best_combo`, `cs_best_round` | Global local bests, not partitioned by ruleset/mode/difficulty. |
| `cs_a11y_v1` | Accessibility and display settings. |
| `cs_mute_sfx`, `cs_mute_music` | Audio preferences. |
| `cs_hardcore` | Last difficulty choice. |
| `cs_lab_v1` | Precision Lab configuration. |
| `cs_player_name`, `cs_identity_prompted` | Local identity/name prompt state. |
| `cs_profile_v1` | Lifetime totals. |
| `cs_achievements_v1` | Achievement unlock timestamps. |
| `cs_cosmetics_v1` | Equipped cosmetics. |
| `cs_daily_v1` | Only the current UTC day's local record. |
| `cs_ghost_daily_v1` | Only one stored Daily ghost. |
| `cs_local_board`, `cs_board_cache` | Local board and last remote cache. |

There is no user account, device registry, conflict strategy, migration ledger, audit log, deletion workflow, or backup guarantee.

## Security and integrity findings

### Critical before credible competition

1. **The server trusts the client score.** The Worker validates types/ranges and sanitizes text, but it does not replay the run or derive the score. Anyone can POST a plausible score.
2. **There is no player authentication.** Names are arbitrary and scores are not tied to durable users or devices.
3. **Cheat runs are intentionally ranked.** This must be removed from public production competition. If retained for internal QA, it must be server-role gated and hard-separated from production boards.
4. **Gist writes are not transactional.** Concurrent read/merge/PATCH operations can still overwrite one another. A database unique constraint and transaction/upsert are required.
5. **No effective abuse controls.** There is no per-user/device/IP submission rate limit, replay nonce, idempotency key, or suspicious-run quarantine.
6. **Rival Codes are encoded, not signed.** Invalid input is handled safely, but a knowledgeable user can create a syntactically valid modified code. This is acceptable for unranked friend races, not for authoritative results.
7. **Public client config cannot hold a secret.** The existing Worker correctly hides the Gist token, but the mobile architecture must continue to treat every bundled value and publishable key as public.

### Reliability and correctness findings

1. With Visual Beat enabled, the frame loop checks `prevAngle` before its `const` initialization. This can throw at runtime. Fix and regression-test it before capturing final compatibility fixtures.
2. Full scoring, power state, boss mutation, and life transitions are not pure, so current tests do not prove end-to-end score reproducibility.
3. App background/resume is browser-dependent. A mobile app needs an explicit lifecycle policy; elapsed wall time must never create a giant hand jump.
4. Local bests are not partitioned by mode, difficulty, ruleset, or assist category.
5. The Daily completion check uses round reach and does not store historical days.
6. Timers and intervals are distributed through closures. Cleanup depends on screen flow and is difficult to prove.
7. The smoke test catches load-time exceptions but not interactive or device behavior.

### Privacy and store-readiness findings

- The current name is not a verified identity and should not become a public legal-name field. Use a unique public handle and keep email/provider identifiers private.
- There is no privacy policy, consent record, account deletion, data export, ad-consent flow, age/audience decision, or store data disclosure.
- Account-based mobile apps must implement deletion paths, and ad SDK data collection must be disclosed and consented where required.
- The repository began as a children's learning game. Before ads or analytics ship, decide whether Chronos Strike targets children, a mixed audience, or a general audience. That decision changes ad treatment, tracking, content rating, and onboarding.

## What should be reused

Reuse semantically:

- RNG algorithms and seed identity formats;
- strike classification and base score rules;
- current difficulty curves and generation draw order;
- modifier/boss/power behavior after extraction into pure reducers;
- achievement and cosmetic IDs;
- replay event concepts and Daily/Rival rules;
- neon-cosmic design tokens, information hierarchy, sound identity, and accessibility choices;
- existing engine fixtures and the 1,746 passing assertions.

Do not reuse as architecture:

- the global mutable `State` object;
- direct DOM mutation;
- anonymous Gist submissions;
- unpartitioned localStorage records;
- ranked cheat mode;
- browser timers as the source of competitive truth;
- copy-pasted client/server score formulas;
- large HTML overlays built from strings;
- the assumption that CORS is an authorization boundary.

## Baseline work before mobile implementation

Create a `ruleset-1` compatibility pack containing:

- at least 100 fixed identities covering Classic/Endless/Zen and Normal/Hardcore;
- generated parameters for rounds 1–40 and representative Endless rounds;
- all boss and modifier cases;
- scripted strike/power/miss events with expected score after every event;
- achievements/cosmetics results;
- Daily seed fixtures around UTC day/year boundaries;
- replay and Rival Code fixtures, including malformed input;
- serialization snapshots for leaderboard payloads.

Commit these fixtures before refactoring. They become the migration contract shared by the legacy browser engine, new TypeScript core, iOS/Android clients, and server validator.

See the [repository separation plan](07_REPOSITORY_SEPARATION_PLAN.md) for the history-preserving move and deployment cutover.
