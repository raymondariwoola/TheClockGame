# Chronos Strike production status and owner runbook

Last verified: **30 July 2026**

## Production is live

There is no deployment step left for you to complete.

| Component | Production location | Status |
|---|---|---|
| GameMode | <https://raymondariwoola.github.io/TheClockGame/GameMode/> | Live |
| Cloudflare Worker | <https://chronos-leaderboard.raymondariwoola.workers.dev> | Live |
| Health check | <https://chronos-leaderboard.raymondariwoola.workers.dev/v1/health> | Healthy |
| Static source | GitHub `main` branch | Published |
| Worker storage | Three SQLite-backed Durable Objects | Active |

The production Worker is the existing **`chronos-leaderboard`** Worker shown in the Cloudflare screenshot. Its old Gist-backed code has been replaced.

## What has already been completed

- Deployed atomic normal, Hardcore, and Daily leaderboards to Cloudflare storage.
- Completely cleared Cloudflare leaderboard storage: 23 entries across three stored partitions were removed.
- Verified fresh Ruleset 2 normal and Hardcore boards both return zero entries.
- Deployed seven-day cloud ghost challenges and hidden-score races.
- Deployed two-player Chrono Clash with Normal, Hardcore, reconnect, forfeit, sudden death, and rematch support.
- Deployed the private cheat menu in every mode, including ghosts and multiplayer.
- Cheats may be enabled or disabled during a run. Scores are accepted normally and no cheat label is stored or shown.
- Removed `GIST_ID`, `CHEAT_MULT`, and `CHEAT_UNLIMITED` from the Worker configuration.
- Removed the old `GITHUB_TOKEN` secret from the Worker.
- Deleted the retired GitHub Gist; both its public page and API now return HTTP 404.
- Added `RUN_SIGNING_SECRET`, replaced `ADMIN_CODE`, and replaced `CHEAT_CODE` with strong temporary values.
- Pointed the hosted GameMode at the production Worker.
- Published all implementation commits to GitHub `main`.
- Fixed the hidden ghost score so neither the API replay nor the in-game HUD reveals it before the result.
- Versioned the offline shell so returning mobile devices receive the current files.
- Upgraded every first-party mobile shell asset to cache revision 4, preventing an old unversioned leaderboard script from surviving on returning phones.
- Deployed Ruleset 2 scoring: ordinary combo scoring caps at ×12, Endless caps at ×3, one ordinary hit caps at 2,000 points, and overlapping Double/Triple/Star effects use the strongest value rather than multiplying together.
- Kept every private cheat available. Cheat score multiplication, cheat-preserved combo growth, Always Overdrive, and Infinite Powers stacking are applied outside the ordinary scoring guards.

## Current temporary codes

The current deployed values are stored only in the ignored local file:

`GameMode/worker/.dev.vars`

Cloudflare has the same values. The file is not tracked by Git and was not pushed to GitHub. Do not send it to anyone or put it in a screenshot.

- Share only the `CHEAT_CODE` value with family or friends who should access the private menu.
- Keep `ADMIN_CODE` private. It is only for maintenance.
- Keep `RUN_SIGNING_SECRET` private. Players never need it.

You may use the temporary values as they are. Changing them is optional.

## If you want to change a code later

Open PowerShell in `GameMode/worker` and run the command for the value you want to replace:

```powershell
npx wrangler secret put CHEAT_CODE --name chronos-leaderboard
npx wrangler secret put ADMIN_CODE --name chronos-leaderboard
npx wrangler secret put RUN_SIGNING_SECRET --name chronos-leaderboard
```

Wrangler asks for the new value privately. Run only the command you need. Afterwards, put the same value beside the matching name in `.dev.vars` so local testing continues to match production.

Changing `CHEAT_CODE` does not affect scores or saved games. Changing `RUN_SIGNING_SECRET` invalidates unfinished leaderboard runs, so rotate it between play sessions.

## Zero-cost boundary

This deployment uses only:

- one Cloudflare Worker;
- SQLite-backed Durable Objects;
- GitHub Pages for the static GameMode.

No paid Cloudflare product, database, storage bucket, queue, analytics add-on, or custom domain was enabled during deployment. Cloudflare documents both Workers and SQLite-backed Durable Objects as available on the Workers Free plan. Free-plan limits fail requests when exhausted rather than automatically upgrading the account.

Cloudflare account billing status cannot be changed or inferred by source code. If you have never manually subscribed this account to Workers Paid, this deployment remains inside the zero-cost model. You can confirm at Cloudflare Dashboard → **Billing** → **Subscriptions**; do not enable Workers Paid for this game.

## Verified production behavior

The following checks passed against the deployed Worker and hosted mobile site:

- 1,761 deterministic engine assertions and the complete automated verification suite.
- Worker unit, syntax, no-Gist-runtime, binding, and deployment checks.
- Live ghost creation, hidden replay, join, result, and expiry behavior.
- Live two-WebSocket match, synchronized progress, rematch, and forfeit behavior.
- Signed leaderboard submission, read-back, and precise removal of the smoke-test score.
- Cheat-code verification and mid-match toggle on/off.
- No cheat/menu state appeared to the other multiplayer tab.
- 390 × 844 mobile viewport: leaderboard, lobby creation, invite join, match start, cheat menu, and ghost start.
- Fresh Ruleset 2 normal and Hardcore leaderboard reads both return zero entries.
- The production Daily endpoint issues Ruleset 2 identities.
- Production CORS accepts the GitHub Pages origin.
- Runtime source scan contains no GitHub Gist API access.

The leaderboard backup is kept locally at:

`GameMode/worker/.local-migration/legacy-leaderboard-20260730.json`

It is ignored by Git. Its SHA-256 is:

`2bc7a03f37d120e8ece61f51b889901ee5e2b9de30b4a693bd6c8c517edadb09`

The final 20-row Gist snapshot is also kept locally at:

`GameMode/worker/.local-migration/retired-gist-chronos-leaderboard-20260730.json`

Its SHA-256 is:

`fc067fe31301125ea170fc1a3007f8e1535650d95b8111db98df01a56fd6ab2e`

Both backup files are ignored by Git. Do not add `GITHUB_TOKEN`, `GIST_ID`, or a Gist import path back to the Worker.

## Quick health check

```powershell
$workerUrl = 'https://chronos-leaderboard.raymondariwoola.workers.dev'
Invoke-RestMethod "$workerUrl/v1/health" | ConvertTo-Json -Depth 5
```

Expected feature values are all `true`: leaderboard, Daily, ghosts, multiplayer, and cheats.

## If a hosted feature ever needs to be stopped

Single-player remains local and offline-capable. To disable a hosted feature, change its value to `"false"` in `GameMode/worker/wrangler.jsonc`, then run:

```powershell
cd GameMode/worker
npm run check
npm run deploy
```

Available flags are `LEADERBOARD_ENABLED`, `DAILY_ENABLED`, `GHOSTS_ENABLED`, `MULTIPLAYER_ENABLED`, and `CHEATS_ENABLED`. Do not remove or rename the Durable Object classes after they contain data.

## Normal maintenance

- Check Cloudflare Worker metrics after a large family session.
- If a phone shows an old screen, close all GameMode tabs and reopen the production URL online once.
- Cloud features require a connection; ordinary single-player remains available from the cached shell.
- Never commit `.dev.vars` or the `.local-migration` directory.
