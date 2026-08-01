# Chronos Strike UI cleanup implementation

> **Scope:** `GameMode/` only.
>
> **Budget:** zero monetary cost; static client changes only unless a later protected-boundary review explicitly says otherwise.
>
> **Delivery:** UI-0 through UI-6 are tested and committed independently. Codex does not push or synchronize these commits.
>
> **Design authority:** `FUTURE_ENHANCEMENT.md`, section 13.

## Status

| Phase | Scope | Status |
|---|---|---|
| UI-0 | Characterization and interaction contract | Complete |
| UI-1 | Menu shell and four-destination navigation | Complete |
| UI-2 | Compact Play destination | Not started |
| UI-3 | Compete destination and deep-link routing | Not started |
| UI-4 | Progress and Settings destinations | Not started |
| UI-5 | Responsive visual/PWA polish | Not started |
| UI-6 | Rollout closure and final handoff | Not started |

## Protected behavior

The UI work must not alter:

- engine, scoring, combo, modifiers, powers, bosses, timing, RNG, or run construction;
- cheats, their persistence, their availability in every mode, or their private/unlabelled treatment;
- Daily, Ghost/Rival, Clash, leaderboard, result, publishing, or sharing protocols;
- Worker routes, bindings, Durable Objects, deployed data, secrets, or quotas;
- existing local-storage keys or the versioned one-time personal-stat reset;
- active-run PWA update safety or gameplay-only zoom locking.

## UI-0 — Characterization and interaction contract

### Baseline inventory

The original menu exposes these root actions:

1. player identity;
2. personal best score, combo, and round;
3. Daily Rift play and challenge;
4. legacy Rival Code entry;
5. Normal / Hardcore selection;
6. Classic, Endless, and Zen;
7. Chrono Clash;
8. Hall of Time;
9. achievements;
10. cosmetics;
11. accessibility/display;
12. PWA installation;
13. connection diagnostics;
14. keyboard help;
15. Back to Clock Quest.

At 390 × 844 the menu measured 2,467 px, approximately 2.9 screens. At 320 × 568 it measured 2,617 px, approximately 4.6 screens. There was no horizontal overflow; the defect is hierarchy and prioritization.

### Interaction contract

- Existing action and state IDs remain unique and authoritative.
- The three `.mode-card` controls remain the local-run launch entry points until UI-2 intentionally introduces selection plus Start.
- Difficulty continues to use the current `easy` and `hardcore` values internally.
- Existing overlay modules remain responsible for identity, achievements, cosmetics, accessibility, installation, connection status, Clash, Ghost, and leaderboard flows.
- The menu remains the safe screen for applying a waiting service-worker update.
- All board modes and difficulties remain explicitly selectable without publishing first.

### UI-0 validation

Completed before commit on 1 August 2026:

- the new menu interaction-contract test passed and protects every existing action/state ID, local mode, difficulty, board selector, storage authority, and handler boundary;
- the game load smoke test passed;
- all 1,769 deterministic engine assertions passed;
- the complete client and Worker test suites passed;
- syntax, no-Gist-runtime, and Worker deployment dry-run checks passed;
- `git diff --check` passed.

## UI-1 — Menu shell and navigation foundation

### Implemented

- Added stable Play, Compete, Progress, and Settings destination panels.
- Added a fixed, safe-area-aware navigation bar with icon-and-text labels and 52 px targets.
- Moved the existing menu blocks into their planned destinations without replacing IDs, modules, or event handlers.
- Added a presentation-only `ChronosMenu` controller that exposes exactly one panel, updates `aria-current`, and supports arrow, Home, and End keys.
- Made inactive panels both `hidden` and `inert` so they are absent from visual, keyboard, and assistive-technology navigation.
- Added a reusable real-device-metrics Chrome audit for 320 × 568 and 390 × 844.

### UI-1 validation

Completed before commit on 1 August 2026:

- menu contract, menu shell, and game load tests passed;
- all 1,769 engine assertions and the complete client/Worker suite passed;
- syntax, no-Gist-runtime, and Worker deployment dry-run checks passed;
- device-emulated 320 × 568 and 390 × 844 audits confirmed four visible destinations, minimum 44 px targets, correct exclusive panel state, correct `aria-current`, and no horizontal overflow;
- screenshots were visually inspected at both audited sizes;
- `git diff --check` passed.

## Resume rule

Begin the next incomplete phase only after the current phase status, validation evidence, and local commit are recorded here. If a phase crosses a protected boundary, stop that portion, document the decision needed, and continue only with independent safe work.
