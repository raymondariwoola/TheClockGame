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
| PWA-2 | Run-safe service-worker update discovery and activation | Complete locally |
| PWA-3 | Offline/cloud status, recovery actions, and relevant messaging | Complete locally |
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

Validation completed before commit:

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

## Phase PWA-2 — run-safe updates

Implemented:

- removed unconditional `skipWaiting()` from service-worker installation;
- a new worker becomes available only after its complete shell cache succeeds;
- a non-modal update notice distinguishes `UPDATE NOW` from `UPDATE AFTER THIS RUN`;
- update activation is allowed only on the main menu with no modal or countdown open;
- results, sharing, leaderboard, Ghost, Clash, game, pause, and identity flows are reload-unsafe;
- an armed mid-run update waits until the player returns to the safe menu;
- controller change reloads only after the page initiated safe activation;
- returning to a visible tab checks for updates at most once every 15 minutes;
- failed registration or update checks leave the current game untouched.

Validation completed before commit:

- service-worker tests prove install no longer calls `skipWaiting()`;
- update activation requires the page’s explicit `SKIP_WAITING` message;
- safe-state helper tests fail closed;
- an old controlled page discovers the new waiting worker;
- update notice is readable and touch-friendly at mobile widths;
- choosing `LATER` never reloads;
- the complete GameMode verification suite passes.

## Phase PWA-3 — offline and cloud status

Implemented:

- separate `offline`, `cloud_unavailable`, `checking`, and `online` states;
- a bounded `/v1/health` check on initial load, browser reconnect, manual retry, and return to a visible tab after five minutes;
- known browser-offline state never wastes a health request;
- a persistent menu status appears only when offline or Cloudflare is unavailable;
- a short non-blocking status notice keeps active gameplay readable;
- the detail panel explicitly lists local features that remain available and cloud features that need connectivity;
- a manual `TRY AGAIN` action recovers without reloading the page;
- online recovery hides the warning and briefly confirms that cloud play is ready;
- local development uses the existing same-origin `/v1` proxy while production uses the configured Cloudflare Worker;
- health responses and connectivity state remain transient and store no player data.

Validation completed before commit:

- monitor tests cover browser offline, healthy Cloudflare, failed fetch, and unhealthy response;
- health requests use `no-store` and never run when `navigator.onLine` is false;
- local and production health base URLs resolve correctly;
- offline/cloud controls remain usable at narrow mobile widths;
- status does not obscure the strike control or interrupt a run;
- update notices yield to open dialogs, and the modal observer ignores its own banner changes;
- the complete GameMode verification suite passes.
