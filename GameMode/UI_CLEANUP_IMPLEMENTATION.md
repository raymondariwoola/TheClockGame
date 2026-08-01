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
| UI-2 | Compact Play destination | Complete |
| UI-3 | Compete destination and deep-link routing | Complete |
| UI-4 | Progress and Settings destinations | Complete |
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
- The three `.mode-card` controls are now UI-only selectors; one explicit Start control delegates to the unchanged `startMode` entry point.
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

## UI-2 — Compact Play destination

### Implemented

- Converted Classic, Endless, and Zen from three expanded launch cards into a compact, announced selector.
- Added one prominent Start action that clears special-run context and delegates to the existing `startMode` function.
- Persisted only the last local menu selection under `cs_menu_mode_v1`; run state and run construction remain authoritative in the existing game module.
- Kept Normal / Hardcore persistence and added correct `aria-pressed` state.
- Added a single contextual mode description instead of three permanently expanded descriptions.
- Added a compact Daily preview on Play. Its Play action shares the same `Daily.play` launcher as the full Compete card, and Details changes only the active destination.
- Compacted the menu brand/header and Play spacing enough to keep the full Start control above the fixed navigation at both audited phone sizes.

### UI-2 validation

Completed before commit on 1 August 2026:

- menu contract, shell, compact-Play, run-context, Daily, leaderboard, Ghost, multiplayer, cheat, PWA, and service-worker tests passed;
- static tests prove that mode taps only select and the explicit Start action calls the unchanged `startMode(selected)` path;
- full and compact Daily controls share one launcher;
- all 1,769 engine assertions and the full client/Worker validation passed;
- 320 × 568 and 390 × 844 device-emulated audits confirmed no horizontal overflow, four visible destinations, and the complete Start action above fixed navigation;
- settled-state screenshots were visually inspected at both sizes;
- `git diff --check` passed.

## UI-3 — Compete destination

### Implemented

- Kept the complete Daily Rift card as the first Compete system.
- Added contextual feature cards for Chrono Clash, Ghost/Rival races, and Hall of Time while retaining their original control IDs and modules.
- Moved legacy Rival Code entry out of Daily into its own labelled Ghost/Rival panel.
- Added a programmatic Rival Code label and announced error region.
- Kept cloud Ghost creation on completed-run results, where a replay exists; Compete explains this instead of creating a duplicate/incomplete flow.
- Added URL-to-destination presentation routing: `ghost` and `duel` query parameters select Compete behind the existing protocol-owned overlay.
- Kept all Classic, Endless, Daily, Normal, and Hardcore boards available through the unchanged Hall client.

### UI-3 validation

Completed before commit on 1 August 2026:

- the Compete contract test confirms that Daily, Clash, Ghost/Rival, and Hall controls live in the correct destination;
- static deep-link tests confirm that the shell changes presentation while Ghost and Clash clients remain URL/capability authorities;
- existing Ghost, multiplayer, leaderboard navigation, result-publishing, and share-card suites passed;
- all 1,769 engine assertions and full client/Worker validation passed;
- viewport audits confirmed exclusive destination state, no horizontal overflow, and fixed navigation at 320 × 568 and 390 × 844;
- the 390 × 844 Compete screenshot was visually inspected, including the scroll boundary above the fixed navigation;
- `git diff --check` passed.

## UI-4 — Progress and Settings destinations

### Implemented

- Kept best score, best combo, and round reached together at the top of Progress.
- Added achievement and cosmetic summary cards that derive from the existing achievement roster and cosmetic resolver.
- Showed the next locked achievement, current unlock count, and equipped cosmetic names without introducing new persistence.
- Grouped Settings into Profile, Comfort & Display, App & Connection, and Controls & About.
- Added a Settings profile action that opens the same identity overlay as the header control and mirrors the same stored name.
- Retained the original accessibility, PWA install, connection, keyboard-help, and Clock Quest actions and their IDs.
- Kept conditional PWA buttons conditional; the App group explains offline/cloud behavior even when no installation action is currently offered.

### UI-4 validation

Completed before commit on 1 August 2026:

- the Progress/Settings contract test confirms every control is in its intended destination and retains its original module;
- achievement and cosmetic summaries are proven to read the existing roster/resolver rather than duplicate storage;
- identity, accessibility, cosmetic, PWA install/connectivity, stat reset, and cheat persistence tests passed;
- all 1,769 engine assertions and full client/Worker validation passed;
- device-emulated audits passed at 320 × 568 and 390 × 844 with no overflow or navigation obstruction;
- separate 390 × 844 Progress and Settings screenshots were visually inspected, including conditional installation/connectivity controls and scrollable About content;
- `git diff --check` passed.

## Resume rule

Begin the next incomplete phase only after the current phase status, validation evidence, and local commit are recorded here. If a phase crosses a protected boundary, stop that portion, document the decision needed, and continue only with independent safe work.
