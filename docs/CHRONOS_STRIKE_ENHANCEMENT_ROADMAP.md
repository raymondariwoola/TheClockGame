# Chronos Strike — Enhancement & Feature Roadmap

> Code-informed product ideas for the arcade reflex game.  
> Reviewed against the repository in July 2026.

## The short version

Chronos Strike already has enough mechanical depth to feel like a real arcade game: Classic, Endless, and Zen modes; Normal and Hardcore difficulty; modifiers; boss rounds; combos; Overdrive; powers; ranks; leaderboards; audio controls; and shareable score cards.

The highest-value next step is to make mastery more replayable and competition more meaningful:

1. Launch a deterministic **Daily Time Rift** that gives everyone the same fair challenge.
2. Turn Zen into a true **Precision Lab** with analytics and ghost replays.
3. Replace repeated dual-zone boss rounds with **distinct, multi-phase encounters**.
4. Add **achievements, run builds, creator tools, stronger leaderboards, accessibility, and reliable validation**.

## Current experience audit

### What is already excellent

- Classic, Endless, and Zen modes with an optional Hardcore ruleset.
- Scaling hand speed and target size, rotating direction, random modifiers, dual-zone boss rounds, lives, accuracy, ranks, and campaign acts.
- A rewarding score stack: hit quality, combo, perfect streak, Overdrive, boss/modifier multipliers, Hardcore multiplier, and Endless survival multiplier.
- Eight power-up types, including shield, time freeze, deadeye, combo lock, frenzy, and star power.
- Global and local leaderboard support, pause, separate music/SFX controls, score-card sharing, and soundtrack caching.
- Strong game feel: particles, screen shake, score popups, audio cues, neon styling, taunts, and countdowns.

### Friction and maintenance items to fix first

| Status | Finding | Why it matters | Fix applied |
|---|---|---|---|
| ✅ **Done** | Menu copy says Classic has **25 rounds**, while `CLASSIC_ROUNDS` is **40** | Players receive the wrong time commitment | Added a single `CONFIG` block in `game.js`; menu copy renders from `CONFIG.classicRounds` via `applyMenuCopy()` — can't drift again |
| ✅ **Done** | `soundtrack/Normal.mp3` is referenced but absent | Normal music silently fails | New `ProceduralMusic` WebAudio bed; `Music` detects a missing/unplayable track and falls back to the synth (per-mood, fully offline) |
| ✅ **Done** | Anime.js and Google Fonts are remote dependencies | Offline startup and visual consistency are not guaranteed | Vendored `vendor/anime.min.js` + self-hosted fonts in `vendor/fonts/`; index.html has zero remote refs |
| ✅ **Done** | Random runs cannot be reproduced | Bug reports, competition, and score validation are harder | Added versioned seeded RNG (`engine.js` xmur3+mulberry32); all gameplay generation draws from one deterministic stream keyed by run identity |
| ✅ **Done** | Leaderboards do not encode every ruleset variable | Scores can become incomparable after balance changes | Submissions now carry `gameVersion`, `rulesetVersion`, `seed`, `assists`, `cheat`; worker sanitises + persists them |
| ✅ **Done** | Boss rounds reuse one core dual-zone pattern | Campaign milestones become predictable | Boss roster with 4 distinct, telegraphed encounters (Twins / Chronophage / Pulse Engine / Orbit Warden) on a fixed learnable cycle (`ChronosEngine.bossTypeIndex`); each has its own colour, sound, mechanic, and time-based `tick()` |
| ✅ **Done** | There is no automated test suite | Scoring and multiplier changes can silently invalidate competition | `engine.test.mjs` (1646 assertions): scoring, classification, rank boundaries, RNG determinism/distribution, and a 1000-round seeded generation simulation. Run with `npm test` |

## Priority roadmap

| Priority | Feature | Impact | Effort |
|---|---|---|---|
| P0 | Baseline fixes, configuration cleanup, and tests | High | Small–Medium |
| P1 | Daily Time Rift — ✅ MVP (global board pending) | Very high | Medium |
| P1 | Precision Lab ✅ + ghost replay ✅ (Daily) | High | Medium |
| P1 | Versioned seeded runs and leaderboard payloads | Very high | Medium |
| P2 | True multi-phase bosses — ✅ first 4 shipped (3 more + phase bars to do) | High | Medium–Large |
| P2 | Hall of Time achievements ✅ (cosmetics to do) | High | Medium |
| P2 | Act-break run upgrades | High | Medium |
| P2 | Accessibility & control customization ✅ (remap/gamepad to do) | High | Medium |
| P3 | Rival Codes ✅ · Custom Rift creator (to do) | Medium–High | Large |
| P3 | Weekly leagues and spectator replays | Medium–High | Large |

## Signature features

### 1. Daily Time Rift — ✅ MVP shipped

**Shipped:** menu card with a deterministic daily rift name ("Savage Gravity Friday"), a truthful preview line (opening direction, modifier count, boss count — computed from the real seeded run via `ChronosEngine.riftPreview`), live countdown to the next UTC rift, and local Daily best/attempts/cleared tracking. A Daily run is fixed to Classic + Normal and seeded by `daily|{rulesetVersion}|{UTC-date}` (independent of gameVersion, so a patch never forks the day). Daily runs stay off the global Classic board for now; RETRY replays the same day. **Still to do:** global Daily leaderboard (pending submission validation), seed-aware share card, friends-code comparison, best-of-three.

Create one deterministic, globally comparable challenge per calendar day.

Everyone receives the same seeded sequence of hand speeds, directions, zones, modifiers, bosses, and power drops. Runs can be attempted freely, but only the first valid score—or best of three—counts on the Daily board.

**Why it works:** the existing random systems and leaderboard provide most of the required building blocks. A daily seed gives the community something specific to discuss and makes competition feel fair.

**Daily presentation:**

- A menu card with the day's rift name, such as **“Reverse Gravity Friday.”**
- Daily leaderboard, personal best, friends-code comparison, and countdown to the next rift.
- A compact modifier preview: “Reverse hand · narrow zones · boss every 4 waves.”
- A share card containing the date, seed name, rank, accuracy, and a “Can you beat me?” challenge.

**Fairness requirements:** store and submit the seed ID, game version, input timestamps, score components, and enabled accessibility assists. Assisted runs should remain playable and celebrated, but an assist that materially changes timing should place the run in a clearly labeled board category.

### 2. Precision Lab and ghost replay

**Precision Lab ✅ shipped** (ghost replay still to do). Zen now opens a training lab: live controls for **speed, zone width, and direction**, **slow-motion** and a **metronome** that ticks as the hand crosses the target, quick **presets** (Slow / Fast / Reverse / Tight / Boss, persisted per device), a per-strike **angular + timing error** readout ("1.8° early · 14 ms early" — math in `ChronosEngine.strikeError`), a clock-face **heat-map** of the last 100 strikes, and a **tendency summary** ("Avg: 18 ms early · 62% perfect"). Remaining: ghost replay + Rival Codes.

Turn Zen from “no lives” into a genuine training environment.

**Precision Lab features:**

- Choose fixed speed, direction, zone width, and specific modifiers.
- Enable slow motion and an optional visual or audio metronome.
- Show angular and timing error after each strike: `1.8° early`, `0.6° late`, or `14 ms early`.
- Build a clock-face heat map from the last 25–100 strikes.
- Summarize tendencies: “You strike about 18 ms early at high speed.”
- Save presets for boss, Hardcore, reverse, and high-speed practice.

**Ghost replay ✅ shipped (Daily Rift):** each Daily run records a compact per-round strike stream (round, angle, kind, time-into-round, cumulative score). Because the Daily seed is fixed, round N is identical between runs, so the ghost's strike angle is a directly comparable target. On the next attempt the best run's ghost appears as translucent per-round markers that pulse at the exact moment the ghost struck (`ChronosEngine.indexReplay` builds the per-round index), plus a live **👻 you-vs-ghost** score-delta HUD and a ghost line on the menu card. Remaining: extend beyond Daily (fixed-seed rematch for Classic) and export as **Rival Codes**.

Original design note: save a compact event stream for the best run—seed, round starts, strike timestamps, pause events, settings, and game version. On retry, a translucent marker shows where the previous run struck. This creates a personal rival without requiring live multiplayer.

**Rival Codes ✅ shipped.** A ghost is packed into a paste-safe base64url token (`ChronosEngine.encodeRival` / `decodeRival`, portable browser+Node, unit-tested round-trip + tamper-safety) that carries the run's RNG identity — so the recipient reproduces the exact challenge. Share from the Daily card or the game-over "🏁 Challenge a friend" button; paste into the menu's Rival Code box to race. A rival race shows the opponent's ghost + a live you-vs-rival delta HUD, reports the head-to-head result, and never touches the global board. Remaining: shorter codes (compression) and curated community sharing.

### 3. Real boss encounters — ✅ first wave shipped

**Shipped:** a boss roster on a fixed, learnable cycle (`ChronosEngine.bossTypeIndex` — deterministic, unit-tested), each with a unique name, palette, sound, telegraphed mechanic hint, and a time-based `tick()`:
- **⚔ The Twins** — two opposite targets, strike both (the classic boss, kept as the intro).
- **🕳 Chronophage** — the safe zone shrinks while the hand accelerates.
- **💓 Pulse Engine** — the zone opens and closes rhythmically; strike when wide.
- **🛸 Orbit Warden** — the target drifts around the face; track it.

Each boss still pays 2× and draws exactly one RNG value at setup, so seeded determinism is preserved. **Still to do:** Mirror Warden, The Twelve, Final Paradox; per-boss phase/stability bar; best-clear records; Precision Lab boss presets.

The original design notes below remain the backlog for the next wave:

Current boss rounds use two opposite zones and a score multiplier. Keep that as the introductory boss, then add readable, learnable patterns every five rounds:

1. **The Twins** — two opposite targets; alternate between them.
2. **Chronophage** — the safe zone shrinks while the hand accelerates.
3. **Mirror Warden** — the visible hand and scoring hand mirror one another after a clear warning.
4. **Pulse Engine** — the target opens and closes to the beat.
5. **The Twelve** — strike a short sequence of numbered positions in order.
6. **Final Paradox** — two phases combining reverse direction, moving targets, and a telegraphed freeze fake-out.

Bosses should be deterministic, telegraphed, and practiceable. Difficulty should come from mastery rather than unreadable visual noise. Give each boss:

- A unique intro title, palette, sound motif, and icon.
- A phase or stability bar.
- Dedicated Normal and Hardcore parameters.
- A best rank and fastest/perfect clear record.
- A Precision Lab practice preset after the first encounter.

### 4. Hall of Time achievements and cosmetics — ✅ achievements shipped

**Shipped:** a 15-achievement roster (data-driven in `ChronosEngine.ACHIEVEMENTS`, pure `evaluateAchievements` — unit-tested) covering per-run feats (Hairline, Combo Master, Overclocked, Against the Current, Untouchable, Unbroken, No Crutches, Time Lord, Century) and lifetime milestones (Boss Slayer, Perfectionist, Veteran, Daily Devotee). A lifetime **profile** (`cs_profile_v1`) + unlocked store (`cs_achievements_v1`) persist locally; runs are evaluated at game-over (GOD/cheat runs excluded so unlocks stay earned), with a staggered **unlock toast** and a **Hall of Time gallery** (menu → 🏅 Achievements) showing locked/unlocked state, unlock dates, and a progress bar. **Still to do:** cosmetic rewards (reticles, hand trails, clock skins, hit sounds, score-card frames) — the intended unlock payoff.

Give long-term progress a visible destination without compromising competitive integrity.

Achievement examples:

- **Hairline** — 10 perfect strikes in one run.
- **Unbroken** — finish an act without losing a life.
- **Against the Current** — land a perfect hit during Reverse.
- **Untouchable** — clear a boss in Hardcore.
- **Century** — survive 100 Endless waves.
- **Overclocked** — hold Overdrive through an entire act.
- **No Crutches** — complete Classic without activating a power.

Rewards can unlock reticles, hand trails, clock skins, hit sounds, menu themes, score-card frames, and judgment typography. Cosmetics should never alter hitboxes, timing, score, or leaderboard visibility.

### 5. Stronger run decisions

At Act breaks, offer one of three temporary upgrades for the rest of the run:

- **Glass Cannon:** narrower perfect band, larger perfect score.
- **Second Wind:** regain one life, but hand speed increases.
- **Combo Reactor:** combo grows faster, but a miss costs more.
- **Zone Scanner:** targets appear earlier, while base score drops slightly.
- **Paradox Shield:** block one boss miss only.
- **Momentum Drive:** reverse rounds grant extra multiplier, normal rounds grant less.

This gives repeat Classic runs distinct builds while keeping timing skill central. Every selection must be visible in replay data and leaderboard metadata.

### 6. New modifiers

- **Orbit:** the scoring zone travels slowly around the clock.
- **Echo:** the last successful target reappears briefly as a decoy.
- **Stutter Time:** hand speed changes only on a clearly signaled beat.
- **Blackout:** numbers fade while ticks and targets remain readable.
- **Split Second:** two hands rotate at different speeds; the round announces which hand to strike.
- **Chain:** hit three small targets in a displayed order without missing.
- **Tidal Pull:** the hand gently accelerates toward the target and slows after passing it.
- **Phase Shift:** the target alternates between two positions on a predictable pulse.

Every modifier needs an icon, a one-line pre-round explanation, a Precision Lab toggle, reduced-motion behavior, and automated scoring/reachability tests.

### 7. Competitive depth without pay-to-win

- Separate boards by mode, difficulty, daily seed, game version, and assisted/unassisted category.
- Show personal percentile and “next rival” rather than only a global top 20.
- Add weekly leagues that reset while permanent personal bests remain.
- Accept verified replay payloads for top scores and enforce server-side sanity limits.
- Offer opt-in friends and country boards without exposing real names by default.
- Allow spectator playback of leading Daily runs.
- Retire old-version boards when balance changes while keeping them viewable as archives.

### 8. Custom Rift creator

Let players choose:

- Speed curve and rotation direction.
- Round count and lives.
- Zone sizes and target patterns.
- Allowed modifiers and powers.
- Boss order and Hardcore parameters.
- Soundtrack, palette, and rift name.

Export a versioned seed code and generate a themed challenge card. Custom runs should live in their own leaderboard category so they never pollute standard records.

Curated weekly community rifts could eventually promote excellent player-made challenges without requiring a full public content browser at launch.

### 9. Fully installable and offline

Chronos already registers a service worker for soundtrack caching, but the whole experience should work reliably after installation:

- Add an app manifest, icons, theme colors, standalone display, and a Chronos shortcut.
- Cache HTML, JavaScript, CSS, local fonts, Anime.js, and soundtrack assets as a versioned shell.
- Add a friendly offline leaderboard state and queue eligible submissions for retry.
- Show an update-ready prompt rather than combining code and cached assets from different versions.
- Put the install action in Settings, not in an intrusive startup banner.
- Ensure local leaderboards, replays, Precision Lab, and custom rifts remain usable offline.

### 10. Accessibility and control customization — ✅ first wave shipped

**Shipped** (menu → ♿ Accessibility & Display, saved per device): separate **reduce motion / shake / particles / flashes** toggles (reduce-motion also honours the OS `prefers-reduced-motion` on first run), **high contrast**, **large HUD text**, **left-handed layout**, **colour-blind markers** (redundant ◆/✕ shapes on targets/traps), and a **visual-beat assist** that pulses the strike ring at the ideal moment — recorded in run metadata (`assists.visualBeat`) so assisted runs are categorised fairly. Plus a screen-reader **live region** announcing round/boss/lives/pause/result, **visible focus** styles for keyboard users, and **Space/Enter** to strike. **Still to do:** full remappable controls + gamepad, alternative Strike-button placement, per-assist leaderboard categories.

Add first-class controls for:

- Color-blind-safe target palettes with shapes or patterns as redundant indicators.
- Separate reduced motion, reduced shake, reduced particles, and flash-intensity controls.
- High contrast and scalable HUD modes.
- Full keyboard navigation and visible focus states outside active gameplay.
- One-button play with remappable keyboard, mouse, touch, and gamepad controls.
- Left-handed HUD and alternative Strike button placement.
- Live announcements for round, lives, combo, pause, and judgment when using assistive technology.
- A visual beat option for players who cannot use audio cues.

Accessibility assists that affect timing should be recorded in run metadata and placed in an appropriate competitive category—not treated as cheating or hidden from the player.

## Architecture improvements

### One source of truth for game configuration

Move round count, mode descriptions, difficulty multipliers, rank thresholds, modifiers, bosses, powers, and soundtrack paths into validated configuration objects. Render menu copy from those objects to prevent mismatches such as the current 25/40-round discrepancy.

### Versioned deterministic runs

Introduce a seeded pseudo-random generator and make a run identity contain at least:

```text
game version + ruleset version + mode + difficulty + seed + assists
```

All round generation, modifiers, bosses, and power drops should consume the same deterministic stream. Input timing remains player-controlled, but rerunning a seed must reproduce the challenge exactly.

Benefits include fair Daily runs, reproducible bugs, stable simulations, custom codes, ghost playback, and meaningful score validation.

### Replay and leaderboard payloads

Store compact events instead of frame-by-frame data:

- Run start and seed metadata.
- Round start timestamps and resolved parameters.
- Strike input timestamps and outcomes.
- Power activation, pause, assist, and focus-loss events.
- Final score breakdown, accuracy, combo, perfects, and rank.

The server should recompute or sanity-check high-value score components. Admin/GOD runs must stay unmistakably separate, and verified cheat-mode rules should remain explicit in submitted metadata.

### Versioned local progress

Formalize migrations before adding achievements and replays:

```text
chronosProfile
├── settings and accessibility preferences
├── personal bests by ruleset
├── achievements and cosmetics
├── daily and weekly history
├── replay metadata
└── custom rifts
```

Keep leaderboard configuration, credentials, and admin verification completely separate from player progress.

### Testing strategy

1. **Unit tests:** angular distance, hit classification, score multipliers, combo/Overdrive transitions, power expiration, rank boundaries, and Hardcore scaling.
2. **Seeded simulations:** generate at least 1,000 rounds and assert reachable targets, valid modifiers, deterministic boss order, and bounded score behavior.
3. **Replay tests:** replay the same event stream and assert identical judgments and final score.
4. **Browser smoke tests:** menu → countdown → strike → pause → game over → leaderboard/share → retry.
5. **Accessibility checks:** keyboard/gamepad control, visible focus, flash settings, color-safe palettes, and reduced-motion screenshots.
6. **Device matrix:** touch phones and tablets, desktop high-refresh displays, standard 60 Hz screens, and background/resume behavior.

## Suggested release sequence

### Release 1 — Trust the strike ✅ (shipped)

- ✅ Fix Classic round copy and the missing Normal soundtrack (procedural fallback).
- ✅ Centralize mode and scoring configuration (`CONFIG` + `engine.js`).
- ✅ Add seeded randomness, scoring tests, and round-generation simulations (`engine.test.mjs`).
- ✅ Version leaderboard submissions (gameVersion/rulesetVersion/seed/assists). ⬜ Versioned local-progress migrations still to formalise (see Architecture → Versioned local progress).

### Release 2 — Train with purpose ✅ (shipped)

- ✅ Upgrade Zen into Precision Lab.
- ✅ Add angular/timing error feedback and heat maps.
- ✅ Record local replays and race a personal-best ghost (Daily Rift).
- ✅ Add control and visual accessibility settings.

### Release 3 — One challenge for everyone

- ✅ Launch Daily Time Rift (Daily leaderboards still pending validation).
- ⬜ Add seed-aware share cards and next-rival comparison.
- ✅ Ship the first true bosses (4 distinct encounters shipped, more to come).
- ✅ Add the initial Hall of Time achievements (15-achievement roster + gallery).

### Release 4 — Every run has a build

- Add Act-break upgrade choices.
- Ship the expanded modifier set and remaining bosses.
- Add cosmetics and versioned ruleset boards.
- Make the complete game reliably installable and offline.

### Release 5 — Create, rival, spectate

- ✅ Rival Codes shipped. ⬜ Launch Custom Rift creation.
- Add weekly leagues and friends boards.
- Verify and expose spectator replays for top runs.
- Expand achievement, cosmetic, and community challenge content.

## Recommended first implementation slice

Start with **versioned seeded runs**, then use them to launch a small Daily Time Rift MVP.

1. Centralize every random call behind a seeded generator.
2. Define a run identity containing game version, ruleset, mode, difficulty, seed, and assists.
3. Confirm that the same seed produces identical rounds, modifiers, bosses, and power drops.
4. Add tests for score classification and deterministic generation.
5. Add one Daily menu card and generate the seed from a UTC date plus ruleset version.
6. Save a separate local Daily best and include seed metadata in share cards.
7. Add a Daily leaderboard only after submission validation is ready.

This foundation unlocks fair competition, reproducible balancing, ghost replays, Rival Codes, Custom Rifts, and credible score verification with one coherent technical investment.
