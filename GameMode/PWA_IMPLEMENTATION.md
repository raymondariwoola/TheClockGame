# Chronos Strike PWA implementation

> Scope: `GameMode/` only.
>
> Budget: zero cost.
>
> Deployment: local commits only; the owner will push manually.

## Objective

Make Chronos Strike reliably installable, safely updateable, and clear about offline/cloud availability on mobile without interrupting active runs or weakening existing gameplay and online flows.

## Phases

| Phase | Scope | Status |
|---|---|---|
| PWA-1 | Installability foundation, icon set, manifest, and install guidance | Complete locally |
| PWA-2 | Run-safe service-worker update discovery and activation | Pending |
| PWA-3 | Offline/cloud status, recovery actions, and relevant messaging | Pending |
| PWA-4 | Full regression validation and owner handoff | Pending |

## Phase PWA-1 — installability foundation

Implemented:

- a standards-based web app manifest scoped to `GameMode/`;
- 180 px, 192 px, and 512 px locally generated PNG icons with a maskable-safe design;
- reproducible dependency-free icon generation;
- theme, mobile-app, Apple touch icon, and manifest metadata;
- a menu-level install action that appears when the browser offers installation;
- iPhone/iPad Safari guidance using Share → Add to Home Screen;
- standalone detection so installed players are not prompted again;
- ordinary tab play remains available when installation is declined or unsupported.

Validation required before commit:

- manifest parses and references existing icons;
- generated PNG signatures and dimensions are correct;
- install-platform helpers pass automated tests;
- the complete GameMode verification suite passes;
- install UI remains usable at narrow mobile widths.

## Non-negotiable safety rules for the remaining phases

1. Never reload or activate a new shell while a run, live Clash, ghost race, countdown, or result-sharing flow is active.
2. API, leaderboard, Ghost, and multiplayer traffic remains network-only.
3. Offline mode never pretends that a public submission or live room succeeded.
4. A failed update leaves the current working shell intact.
5. Installed and ordinary-tab play remain functionally equivalent.
6. Every phase updates this file and `FUTURE_ENHANCEMENT.md`, then passes tests before commit.
