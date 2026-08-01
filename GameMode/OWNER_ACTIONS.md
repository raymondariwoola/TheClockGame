# Chronos Strike production status and owner runbook

Last verified: **2 August 2026**

## Current pending release: full-length, reconnect-safe Chrono Clash

The repository base includes the revision-25 mid-game Private Menu correction. The current local follow-up fixes the two reported Clash-ending problems: new rooms now run the full 40 rounds, and live rooms no longer silently fail after a short network interruption or fixed 20-minute wall clock.

This correction advances the coherent PWA shell to revision 26 and changes the existing Match Durable Object. It requires a **static GitHub Pages publication and one deployment of the existing `chronos-leaderboard` Worker**. It requires no new binding, secret, Durable Object class, migration, leaderboard reset, paid service, or `.dev.vars` change. Analytics remains a documented proposal and is not enabled. See `CLASH_RELIABILITY_AND_ANALYTICS.md` for the diagnosis, acceptance gates, and data-retention decision.

### Cloudflare deployment screenshot review

The attached terminal output is a successful deployment. Wrangler uploaded `chronos-leaderboard`, retained the three expected Durable Object bindings and feature flags, deployed the `workers.dev` trigger, and reported current version `74815113-0d2b-496a-9cd3-22fd830cf6bb`. There is no error or warning requiring a Worker fix.

Wrangler 4.118.0 being available is informational. The repository intentionally pins 4.115.0, which completed the deployment, so do not update it as part of this UI release. The Cloudflare-skills installation message concerns local coding assistants; it does not change the Worker runtime, bindings, storage, leaderboard, or billing.

### Your publication steps

Run the checks, publish the static revision first, wait for GitHub Pages to finish, then update the existing Worker:

```powershell
cd D:\GitHub\TheClockGame\GameMode
npm run verify
npm run audit:menu

cd ..
git status --short --branch
git log --oneline origin/main..main
git push origin main

cd GameMode
npm --prefix worker run deploy
```

`npm run verify`, `npm run audit:menu`, `git status`, and `git log` are checks. `git push` publishes the revision-26 client through the existing GitHub Pages workflow. Deploy only the existing Worker after the static workflow succeeds; do not create a second Worker or any analytics resource. This order lets refreshed clients negotiate 40 rounds before the Worker starts creating full-length rooms.

After GitHub Pages finishes updating, open <https://raymondariwoola.github.io/TheClockGame/GameMode/> online once on each test phone. Close any older GameMode tabs first and accept the update so service-worker revision 26 can install cleanly. Then perform the Worker deployment and the Clash checks below.

### Required physical acceptance

Use at least one ordinary Android phone and, if available, one iPhone:

- Play: Classic + Normal is visible and starts; also spot-check Endless, Zen, and Hardcore.
- Compete: Daily opens, Clash opens its create/join panel, Rival Code remains visible, and Hall opens without first publishing.
- Hall: switch Classic/Endless/Daily and Normal/Hardcore; the chosen board name stays explicit.
- Progress: achievements and cosmetics open and saved choices survive a reload.
- Settings: change one accessibility preference, reopen Settings, and confirm it persisted.
- PWA: install if offered; when an update is offered during a run, confirm it waits until returning safely to the menu.
- Mobile layout: rotate once, scroll each destination to its final action, and confirm the navigation never covers that action permanently.
- Zoom/accessibility: gameplay remains fixed against pinch/double-tap zoom, while Settings, Hall, and Results still allow browser zoom; spot-check 200% text scaling.
- Family/friend check: without coaching, ask one person to start Normal Classic, find Clash, view the Hall, change accessibility, and find install/update guidance.
- Objective Cards: start a local run and confirm exactly two cards fit without covering the clock; complete one if practical, finish the run, and confirm its result plus the Progress mastery summary survive a reload.
- Clash setup: create a room on one phone, join on the other, select different voluntary handicaps, and confirm both labels are visible before each player accepts and readies.
- Clash room code: confirm the lobby shows a large eight-character code grouped four-and-four; read it aloud to the second player and confirm `COPY CODE` copies only those eight characters.
- Clash play: send preset reactions in both directions; the sender must see `Sent to rival` and the recipient must see the named reaction. Then mute incoming reactions on one phone, earn a shard with three consecutive Perfects, and confirm a sabotage is announced before it affects the rival's next round.
- Clash length: create a new room after both phones report revision 26, confirm the lobby says `40 ROUNDS`, and play beyond round 10. A rematch must also use 40 rounds; an exact tie may still enter a one-round sudden death.
- Clash reconnect: temporarily disable one phone's network for 60-90 seconds while continuing its run. The HUD must say the run continues with a two-minute grace. Restore the network and confirm buffered progress reaches the rival without an early result.
- Clash buffered finish: finish a test run while briefly disconnected, restore the network inside two minutes, and confirm the final result is submitted. In a separate disposable room, exceed two minutes and confirm the result explicitly names the missed reconnect window.
- Clash lifetime: for a slow test, keep both phones connected beyond the old 20-minute boundary and confirm the room remains active. Heartbeats now maintain a rolling 45-minute inactivity window.
- Clash mobile layout: the reaction/shard dock must remain below STRIKE in normal page flow at portrait and landscape sizes; horizontally scroll its reaction row on a narrow phone and confirm STRIKE remains fully visible and tappable. The three sabotage choices must remain absent until a player with a shard opens them.
- Gameplay header: on the affected iPhone browser and at 200% text if practical, confirm score, combo, lives, audio, pause, round, both Clash score chips, and both Objective Cards are simultaneously readable with no overlap. Activate a power and confirm its timer stays below the HUD.
- Clock scale: on the affected iPhone browser, confirm the Objective Cards sit immediately below the HUD and the clock face again fills roughly 80% of the portrait viewport width. At very short heights, confirm it still shrinks enough to keep STRIKE tappable.
- Clash exit URL: open an expired or cancelled `?duel=...` link, press `CLOSE`, and confirm the address bar no longer contains `duel`. Repeat with `LEAVE`, `DONE`, and the in-game quit-to-menu action when practical.
- Mid-game Private Menu: start a run, pause it, press `❖ PRIVATE MENU`, and enter the existing private code if prompted. Enable Auto-Perfect or change Time Scale, close the Private Menu, then resume and confirm the change affects that same run. Reopen it from Pause, disable the selection, and confirm normal behavior returns without restarting.
- Clash result: confirm the compact margin/lead-change story appears beside Rematch and the local Objective Cards result remains visible while waiting.

If all checks pass, no further production action is required.

### Forward-only rollback

Do not delete or reset Cloudflare or leaderboard data. Revert only the smallest responsible client/Match Worker change, advance every shell-version reference together from 26 to a new revision, run `npm run verify` and `npm run audit:menu`, and publish that forward revision. If the server behavior is responsible, deploy the preceding reviewed Worker commit to the same existing Worker; do not create a replacement service.

## Current production remains live

The existing deployed version remains live until revision 26 and its matching Worker are published. Confirm the live shell revision and Worker version during the publication steps rather than assuming the repository commit has already reached both platforms.

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
- Verified fresh Ruleset 3 normal and Hardcore boards both return zero entries.
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
- Upgraded every first-party mobile shell asset to cache revision 10, preventing an old gameplay, leaderboard, sharing, cheat-state, or local-reset script from surviving on returning phones.
- Deployed Ruleset 3 scoring: ordinary combo scoring caps at ×12, Endless caps at ×3, one ordinary hit caps at 2,000 points, and overlapping Double/Triple/Star effects use the strongest value rather than multiplying together.
- Fixed the ordinary accuracy-power exploit: Deadeye and Star only upgrade valid in-zone hits. Star protects a life on a miss but still records the miss and resets the ordinary combo, so rapid random tapping cannot score or preserve its streak.
- Removed the reported 60,475-point Ruleset 2 exploit result and cleared its now-empty stored partition; the complete production leaderboard export is again zero boards and zero entries before Ruleset 3 play begins.
- Fixed the completed-run publishing flow: leaderboard publication now confirms the final rank in place, leaving Share and Beat My Time available. Opening the Hall from Results is optional, and its back button returns to the same completed-run screen.
- Kept every private cheat available. Cheat score multiplication, cheat-preserved combo growth, Always Overdrive, and Infinite Powers stacking are applied outside the ordinary scoring guards.
- Added 1080 × 1350 mobile share cards for Ghost/Daily invitations, Ghost results, Chrono Clash invitations, and Clash results. The existing finished-run score card remains available.
- Added 1200 × 630 Cloudflare link-preview cards for Ghost/Daily and live Clash invitations. Copied invite links now use `/s/ghost/:code` or `/s/clash/:code`, show sanitized Open Graph metadata, and redirect players into the existing GameMode.
- Kept hidden targets private in the attached card, link metadata, and public Worker state. Only a host capability may upload an invite preview image; it is deleted automatically with the expiring challenge or room.
- Reworked the Hall of Time so Classic, Endless, and today's Daily Rift are directly selectable, with Normal and Hardcore controls always visible. Daily correctly remains Normal-only.
- Replaced every misleading `GLOBAL #` rank with the exact board identity, including result notices, name entry, generated score cards, and copied share text.
- Enforced Ruleset 3 on public board reads, run issuance, run completion, and the retired compatibility submission route so stale cached clients cannot create hidden historical boards.
- Archived and removed the final two Ruleset 2 records. Production now contains only the current Ruleset 3 Classic Normal, Classic Hardcore, and dated Daily partitions.
- Activated one-time local personal-stat reset `2026-07-31-family-reset-1`. On each browser's next updated GameMode load, only Best Score, Best Combo, and Round Reached are cleared; the same reset ID never clears them again.
- Made the private cheat unlock, Cheats Active master switch, individual toggles, and selector values persistent in that browser across reloads, tab closures, retries, rematches, and every supported game mode.
- Kept cheat persistence local-only: the passphrase is never stored, and cheat state is never sent to Cloudflare, opponents, leaderboards, ghosts, results, or share cards. Turning Cheats Active off preserves favorite selections; Disable All persistently clears them.

## How the Hall of Time now works

The Hall never silently means one undifferentiated global score list. Classic and Endless have different scoring and run lengths, so combining them would be misleading. Current competitive boards are therefore:

- Classic · Normal;
- Classic · Hardcore;
- Endless · Normal;
- Endless · Hardcore;
- today's Daily Rift · Normal.

Players can switch among these from the Hall without first playing or publishing in that category. A position is always written with its board—for example, `CLASSIC NORMAL #1`—so two people can no longer both receive an unexplained `GLOBAL #1` screenshot. Daily Rift is date-scoped and automatically shows the current UTC day.

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

- 1,769 deterministic engine assertions and the complete automated verification suite.
- Worker unit, syntax, no-Gist-runtime, binding, and deployment checks.
- Live ghost creation, hidden replay, join, result, and expiry behavior.
- Live two-WebSocket match, synchronized progress, rematch, and forfeit behavior.
- Signed leaderboard submission, read-back, and precise removal of the smoke-test score.
- Cheat-code verification and mid-match toggle on/off.
- No cheat/menu state appeared to the other multiplayer tab.
- 390 × 844 mobile viewport: leaderboard, lobby creation, invite join, match start, cheat menu, and ghost start.
- Production Ruleset 3 reads return the expected current entries: 2 Classic Normal, 10 Classic Hardcore, 0 Endless Normal, and 1 Daily entry for 30 July at the time of verification.
- Obsolete Ruleset 2 public reads return HTTP 409 `unsupported_ruleset`; the old stored partition was archived and removed.
- Mobile Hall pass at 390 × 844 and 320 × 568: playlist/difficulty switching, persisted selection, explicit board context, 46 px touch controls, and no horizontal overflow.
- The production Daily endpoint issues Ruleset 3 identities.
- Production CORS accepts the GitHub Pages origin.
- Runtime source scan contains no GitHub Gist API access.
- Production Ghost preview upload, Open Graph page, PNG response, game redirect, capability check, and hidden-target protection.
- Mobile visual pass at 390 × 844: four 1080 × 1350 attached-card layouts and four 1200 × 630 link-preview layouts. Preview PNGs measured 670–697 KB against a 1.5 MB server ceiling.

The leaderboard backup is kept locally at:

`GameMode/worker/.local-migration/legacy-leaderboard-20260730.json`

It is ignored by Git. Its SHA-256 is:

`2bc7a03f37d120e8ece61f51b889901ee5e2b9de30b4a693bd6c8c517edadb09`

The final 20-row Gist snapshot is also kept locally at:

`GameMode/worker/.local-migration/retired-gist-chronos-leaderboard-20260730.json`

Its SHA-256 is:

`fc067fe31301125ea170fc1a3007f8e1535650d95b8111db98df01a56fd6ab2e`

Both backup files are ignored by Git. Do not add `GITHUB_TOKEN`, `GIST_ID`, or a Gist import path back to the Worker.

The two final post-reset Ruleset 2 records were separately archived before removal at:

`GameMode/worker/.local-migration/obsolete-ruleset2-leaderboard-20260731.json`

This file is also ignored by Git and can be used for a manual recovery if ever required.

## How to reset local personal statistics again

The owner control is deliberately isolated in:

`GameMode/local-reset-config.js`

For a future reset, change only `personalStatsId` to a brand-new value that has never been deployed before. A date plus sequence is easy to recognize, for example:

```js
window.CHRONOS_LOCAL_RESET = Object.freeze({
  personalStatsId: '2026-12-24-family-reset-2',
});
```

Then run `npm run verify` from `GameMode`, commit, and publish the static site normally. No Cloudflare Worker deployment, secret, dashboard setting, or database operation is needed.

How it behaves:

- the first load carrying the new ID removes only `cs_best_score`, `cs_best_combo`, and `cs_best_round`;
- that browser records the ID in `cs_local_stats_reset_applied` after the removal;
- every later load with the same ID is a no-op, so newly earned statistics remain;
- changing to another new ID initiates exactly one new reset per browser;
- using an empty `personalStatsId` disables resets, but normally the deployed ID should simply be left unchanged;
- the reset occurs when each person next opens the updated GameMode online; a site cannot reach a device that never loads it;
- browser profiles, devices, private browsing, and different origins have separate local storage and therefore apply the reset independently;
- names, Daily records, ghosts, achievements, cosmetics, settings, cheat state, leaderboard preferences, and every Cloudflare leaderboard score are untouched.

Do not reuse an older ID: because it differs from a browser's latest marker, it would intentionally count as another reset cycle.

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
