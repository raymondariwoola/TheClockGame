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
| PWA-4 | Full regression validation and owner handoff | Complete locally; owner push pending |

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

## Phase PWA-4 — release validation and handoff

Implemented:

- automated manifest schema, icon presence, install metadata, and maskable-icon checks;
- one cache-revision assertion across the service worker, registration URL, HTML scripts, and styles;
- correct `application/manifest+json` local development content type;
- a load smoke-test requirement for the game’s fail-closed safe-update hook;
- the owner publish, mobile acceptance, troubleshooting, and rollback instructions below;
- no Cloudflare Worker code, binding, secret, database, leaderboard, Ghost room, or Match room change.

### Final local validation

- [x] Complete `npm run verify` suite.
- [x] 1,769 deterministic engine assertions.
- [x] PWA install, connectivity, manifest, cache, and service-worker tests.
- [x] Sixteen Worker regression tests and Worker deployment dry-run.
- [x] Mobile install action inspection at 390 × 844 with no horizontal overflow.
- [x] Previous-shell-to-waiting-worker update discovery.
- [x] Mid-run `UPDATE AFTER THIS RUN` remains on the active game without reload.
- [x] `LATER` dismisses the notice without changing run state.
- [x] Cloud-unavailable menu state and connection detail panel at 390 × 844.
- [x] Update notice yields whenever a modal is open.
- [x] Local page and manifest return HTTP 200; manifest uses `application/manifest+json`.
- [x] Production Worker health is HTTP 200 with leaderboard, Daily, Ghost, multiplayer, and cheat features enabled.
- [x] Runtime scan remains free of GitHub Gist access.

## Owner publish steps

The implementation is committed locally and deliberately not pushed. Publishing requires only the normal Git push from the repository root:

```powershell
git status --short --branch
git log --oneline origin/main..main
git push origin main
```

Do **not** deploy the Cloudflare Worker, change a Worker variable, rotate a secret, clear a leaderboard, or edit `.dev.vars` for this PWA release. GitHub Pages publishes the static `GameMode/` changes from `main` through the repository’s existing process.

After GitHub Pages finishes, open:

<https://raymondariwoola.github.io/TheClockGame/GameMode/>

### Expected first update from the current production shell

1. An online returning browser receives the new page and finishes caching shell revision 14 in the background.
2. `NEW VERSION READY` appears without reloading the page.
3. On the idle menu it offers `UPDATE NOW`.
4. During a run/result/modal it offers `UPDATE AFTER THIS RUN` or temporarily yields to the modal.
5. After safe activation the page reloads once and the notice disappears.
6. Declining with `LATER` keeps the old working shell for that session; the update can be offered again after another page load/check.

### Android acceptance check

1. Open the production URL in Chrome while online.
2. Accept `UPDATE NOW` from the menu if it appears.
3. Confirm `INSTALL CHRONOS STRIKE` appears when Chrome considers the site installable.
4. Install it and launch it from the new home-screen icon.
5. Confirm the app opens inside `GameMode/`, not the repository root.
6. Play one local Classic round, close the installed app, reopen it, and confirm settings/cheats remain as previously configured.
7. Enable airplane mode only after one complete online load, reopen the installed app, and confirm Classic, Endless, Zen, personal ghosts, achievements, cosmetics, and cheats remain available.
8. Confirm leaderboard, cloud Ghost, and Clash actions explain that connectivity is required rather than claiming success.
9. Restore connectivity and use `TRY AGAIN`; the warning should disappear and `BACK ONLINE · CLOUD PLAY READY` should appear briefly.

### iPhone/iPad acceptance check

1. Open the production URL in Safari while online.
2. Tap `INSTALL CHRONOS STRIKE`.
3. Follow Share → Add to Home Screen.
4. Launch the saved icon and repeat the online/offline checks above.
5. Confirm safe areas, scrolling, and connection/update notices do not cover required controls in portrait orientation.

### Desktop/ordinary-tab acceptance check

- The game remains fully playable without installation.
- Chrome/Edge may offer the native install prompt; unsupported browsers show browser-menu guidance.
- Installed/standalone detection hides the install action after installation.

## Troubleshooting

### Install action does not appear

- Confirm the production page has loaded successfully over HTTPS.
- Reload once after GitHub Pages deployment completes.
- Some browsers place installation only in their own menu; iOS uses Share → Add to Home Screen.
- An already installed/standalone app correctly hides the install action.
- Installation is optional; ordinary browser play is never blocked.

### Old interface remains

- Finish or exit the current run and return to the menu.
- Reopen the production page online and choose `UPDATE NOW`.
- If `LATER` was selected, close all GameMode tabs and open the URL again.
- Do not clear site data first: doing so would also remove local scores, settings, achievements, cosmetics, ghosts, and persistent cheat preferences.

### Cloud unavailable but the internet works

- Open Connection Status and select `TRY AGAIN`.
- Verify the Worker health URL separately: <https://chronos-leaderboard.raymondariwoola.workers.dev/v1/health>.
- Local play remains available while the Worker or network path is unavailable.
- A disabled Worker feature can still report a healthy connection; the relevant feature flow will explain its own disabled state.

## Rollback

Do not redeploy an old service-worker revision unchanged. Browsers compare and cache worker scripts independently, so rollback must be a **new forward commit**:

1. Revert the faulty player-facing change in source.
2. Increase `CACHE_VERSION` and every matching `?v=` reference to a brand-new number higher than 14.
3. Keep the safe waiting-worker lifecycle intact unless it is itself the defect.
4. Run `npm run verify`.
5. Commit and push the forward fix.

This preserves a coherent cache upgrade path and avoids stranding returning phones between incompatible asset revisions.

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
