# Chronos Strike GameMode owner actions

This is the manual handoff for activating the Cloudflare-only backend. Engineering work and local verification are complete; nothing in these steps requires a paid product. Do not paste secrets into source files, commits, issues, screenshots, or chat.

## 1. What is ready

- Atomic global and Daily leaderboards in a SQLite-backed Durable Object.
- Seven-day “Beat My Time” ghost links containing only a public room code.
- Two-player, ten-round Chrono Clash over hibernating WebSockets.
- Normal/Hardcore rooms, three-step sudden death, reconnect grace, forfeit, and fresh-seed rematches.
- A session-only private cheat menu usable mid-run in every mode, including ghosts and multiplayer.
- Cheat-derived results are accepted normally and are never marked or called out remotely.
- Offline single-player shell caching; APIs and sockets are always network-only.
- Runtime Gist access removed. An optional one-time import consumes only a manually exported JSON file.

The implementation commits are:

| Phase | Commit |
|---|---|
| Baseline and replay safety | `d3b40e6` |
| Shared run/protocol foundation | `3cbe30e` |
| Cloudflare leaderboard and Daily | `b4ce123` |
| All-mode cheat menu | `3c66e42` |
| Cloud ghost challenges | `cb78b73` |
| Live Chrono Clash | `d16068e` |
| Offline/release hardening and this owner handoff | current handoff commit |

There has been no push, production deploy, or Cloudflare account change from this implementation session.

## 2. Confirm the zero-cost boundary first

1. Sign in to Cloudflare and confirm the account is on **Workers Free**.
2. Do not enable a paid Workers plan, paid observability add-on, R2, D1, Stream, Queues, or another product for this GameMode.
3. Review the current official limits before deploying:
   - <https://developers.cloudflare.com/workers/platform/pricing/>
   - <https://developers.cloudflare.com/workers/platform/limits/>
   - <https://developers.cloudflare.com/durable-objects/platform/pricing/>
4. After the controlled phone test, inspect Workers & Pages → your Worker → Metrics. The intended family/friends load should be far below the free allowances, but pricing and limits can change.

Cloudflare Free limits are hard service limits, not an instruction to upgrade. If a limit is reached, leave the affected feature off and keep local single-player available.

## 3. Values you must choose

Prepare these privately:

| Value | Purpose | Where it belongs |
|---|---|---|
| `RUN_SIGNING_SECRET` | Signs short-lived leaderboard run capabilities | Cloudflare Worker secret |
| `ADMIN_CODE` | Authorizes legacy import and precise score removal | Cloudflare Worker secret |
| `CHEAT_CODE` | Unlocks the private menu for your group | Cloudflare Worker secret |
| `ALLOW_ORIGIN` | Exact static-site browser origin | `worker/wrangler.jsonc` non-secret variable |
| Worker base URL | Browser API/WebSocket destination | `leaderboard-config.js` |

Use a long random value for `RUN_SIGNING_SECRET`. `ALLOW_ORIGIN` is an origin only—scheme plus host and optional port, with no path or trailing slash. Examples:

```text
https://example.com
https://username.github.io
```

For more than one legitimate origin, use a comma-separated list. Never use `*` in production because the WebSocket origin gate shares this allowlist.

## 4. Validate the exact commit locally

From `GameMode/worker`:

```powershell
npm ci
npm test
npm run check
```

Create the ignored `GameMode/worker/.dev.vars` file only for local testing:

```text
RUN_SIGNING_SECRET=local-random-value
ADMIN_CODE=local-admin-value
CHEAT_CODE=local-cheat-value
```

Start the Worker:

```powershell
npm run dev -- --port 8787
```

From another terminal in `GameMode/`:

```powershell
npm run verify
npm run test:integration
```

Expected final lines include the engine assertions, service-worker shell test, no-Gist runtime check, Worker test pass, dry-run binding list, and the live Wrangler integration pass.

## 5. Prepare a disabled first production deployment

In `worker/wrangler.jsonc`:

1. Set `ALLOW_ORIGIN` to the exact production static-site origin.
2. Keep the Worker name or change it deliberately before the first deploy.
3. For the first deployment, set these flags to `"false"`:
   - `LEADERBOARD_ENABLED`
   - `DAILY_ENABLED`
   - `GHOSTS_ENABLED`
   - `MULTIPLAYER_ENABLED`
4. Leave `CHEATS_ENABLED` as `"true"` only if you want the cheat passphrase active immediately.

The three Durable Object exports are declarative and additive. Do not rename or remove the classes after they hold data.

Authenticate Wrangler from `GameMode/worker`:

```powershell
npx wrangler login
```

Store secrets interactively. Wrangler prompts for each value; do not place values on the command line:

```powershell
npx wrangler secret put RUN_SIGNING_SECRET
npx wrangler secret put ADMIN_CODE
npx wrangler secret put CHEAT_CODE
```

Deploy the disabled Worker:

```powershell
npm run check
npm run deploy
```

Record the exact `https://...workers.dev` URL printed by Wrangler.

## 6. Verify the disabled Worker

```powershell
$workerUrl = 'https://your-worker.your-subdomain.workers.dev'
Invoke-RestMethod "$workerUrl/v1/health" | ConvertTo-Json -Depth 5
```

Verify that `ok` is `true`, all four disabled feature values are `false`, and the response contains no secret values.

Test the feature gates:

```powershell
Invoke-WebRequest "$workerUrl/v1/ghosts/ABCD-EFGH" -SkipHttpErrorCheck
Invoke-WebRequest "$workerUrl/v1/matches/ABCD-EFGH" -SkipHttpErrorCheck
```

Both should return a controlled `503` while disabled, not a Worker exception.

## 7. Point the static GameMode at the Worker

Edit `GameMode/leaderboard-config.js`:

```js
window.CHRONOS_LB_CONFIG = {
  apiBase: 'https://your-worker.your-subdomain.workers.dev',
};
```

The repository currently contains the intended `chronos-strike-backend.raymondariwoola.workers.dev` address. Change it only if Wrangler produced a different URL.

Deploy or publish the static repository using your existing process. This implementation does not move the static site to Cloudflare Pages and does not require it.

Open the production GameMode once while online so the versioned service worker can cache the single-player shell.

## 8. Enable features in controlled stages

For each stage, change only the named flag to `"true"`, run `npm run check`, deploy, and verify before continuing:

1. `DAILY_ENABLED`
2. `LEADERBOARD_ENABLED`
3. `GHOSTS_ENABLED`
4. `MULTIPLAYER_ENABLED`

After every deploy:

```powershell
Invoke-RestMethod "$workerUrl/v1/health" | ConvertTo-Json -Depth 5
```

This staging keeps local play working if a hosted feature needs to be switched off again.

## 9. Optional one-time legacy leaderboard import

This does not block launch. Skip it if old scores are not important.

1. Manually download/export the old Gist JSON without putting any GitHub credential in this repository.
2. Save the export outside tracked source or in an ignored temporary location.
3. In a local terminal only, set the admin code for that process:

```powershell
$env:CHRONOS_ADMIN_CODE = 'your-admin-code'
node scripts/import-legacy-gist.mjs 'D:\private\leaderboard-export.json' $workerUrl
Remove-Item Env:\CHRONOS_ADMIN_CODE
```

Imported rows are marked internally as `legacy_unverified`; there is still no live Gist request.

## 10. Remove an accidental test score

First obtain the entry ID from the relevant board response, then supply the exact partition:

```powershell
$entryId = 'entry-id-from-board'
$query = 'mode=classic&difficulty=normal&rulesetVersion=1'
$headers = @{ Authorization = 'Bearer your-admin-code' }
Invoke-RestMethod -Method Delete -Headers $headers -Uri "$workerUrl/v1/admin/entries/$entryId`?$query"
```

For a Daily entry also include `scope=daily&dailyDate=YYYY-MM-DD`. The endpoint removes only that ID from that partition.

## 11. Required two-phone acceptance pass

Use two real phones, preferably one on Wi-Fi and one on cellular. Test portrait first, then rotate once during a lobby or result screen.

- Open ordinary Classic, Endless, Zen, and Daily once; confirm each remains playable if airplane mode is enabled after the first online load.
- Submit an ordinary leaderboard score and confirm it appears on the ordinary board.
- Enable a cheat before a run, then enable and disable different cheats mid-run. Confirm the result is accepted normally with no cheat label.
- Create a hidden-score ghost challenge, send it through your normal messaging app, join on phone two, finish, and confirm the score is revealed only at the result.
- Create a Normal Chrono Clash, share the link, join, ready both phones, and confirm the HUD updates by resolved strikes rather than continuously.
- Tap the mobile **YOU** chip, open the private menu, change a cheat, close it, and confirm only that phone paused locally.
- Background one phone for less than 30 seconds and return. Confirm it reconnects.
- Refresh one phone during a match. Confirm it recovers the room and restarts the same seeded Clash.
- Finish, request a rematch on both phones, and confirm the new match begins with a new seed.
- Repeat once in Hardcore.
- Let one player forfeit and confirm the other player wins without a special cheat reason.

The game intentionally does not send animation frames, cheat state, menu state, unlock state, effect names, or capability tokens to the opponent.

## 12. Retire GitHub Gist completely

Do this only after the hosted board and optional import are verified:

1. In GitHub account settings, revoke/delete the old token that had Gist access.
2. Archive or delete the old leaderboard Gist if you no longer need the manual backup.
3. Run:

```powershell
npm run check:no-gist
```

4. In browser developer tools, play and load the board once; confirm the Network panel shows no request to `api.github.com` or a Gist URL.

Do not use Gist as a rollback path.

## 13. Monitoring and zero-cost guardrails

During the first family session, inspect Cloudflare Worker metrics for requests, errors, CPU, Durable Object requests/storage, and WebSocket activity. Rooms and ghost challenges have alarms that delete expired state; idle live sockets use the hibernation API.

If use approaches a Free limit:

1. Set `MULTIPLAYER_ENABLED` to `"false"` first.
2. If necessary set `GHOSTS_ENABLED`, `LEADERBOARD_ENABLED`, or `DAILY_ENABLED` to `"false"`.
3. Run `npm run check` and `npm run deploy`.
4. Verify `/v1/health` reflects the flags.

Do not solve a family-game quota issue by enabling billing without a separate decision.

For bounded live diagnostics:

```powershell
npx wrangler tail
```

The implementation does not intentionally log request bodies, player capabilities, codes, names, full URLs, or cheat selections.

## 14. Troubleshooting

| Symptom | Check |
|---|---|
| Browser reports offline but Worker health works | `ALLOW_ORIGIN` must exactly match the static site origin; redeploy after changing it. |
| WebSocket returns `403 origin_forbidden` | Remove paths/trailing slashes from `ALLOW_ORIGIN`; include the exact HTTPS origin used by the phone. |
| `ghosts_unconfigured` or `multiplayer_unconfigured` | Confirm all three bindings appear in `npm run check` and the deployed Worker uses the current config. |
| `run_signing_not_configured` | Re-run `wrangler secret put RUN_SIGNING_SECRET`. |
| Cheat code always fails | Confirm `CHEATS_ENABLED` is true and reset `CHEAT_CODE` with Wrangler. |
| Invite opens but says expired | Ghosts last seven days; empty live lobbies last two hours; create a fresh code. |
| Phone shows older UI | Close all GameMode tabs, reopen online, and reload. If necessary clear only this site's service-worker/cache data. |
| Normal music has no file request | Expected: Normal uses procedural WebAudio. Audio still requires a user gesture on mobile browsers. |
| Offline leaderboard/ghost/Clash fails | Expected: only single-player is offline. API and WebSocket data are never cached. |

## 15. Rollback

The safest rollback is a feature flag, not a data migration:

1. Disable the affected feature in `worker/wrangler.jsonc` and deploy.
2. Leave Durable Object classes and stored data intact.
3. If the latest static UI is the issue, publish the previous known-good static commit while keeping the Cloudflare Worker compatibility routes.
4. Verify ordinary local play with the Worker unreachable.

Suggested code rollback points are `cb78b73` for leaderboard plus ghosts without live multiplayer, or `b4ce123` for the Cloudflare leaderboard/Daily foundation only. Never restore the Gist runtime or expose a token in the browser.

## 16. Final sign-off

- [ ] Cloudflare account still shows Workers Free and no paid product was enabled.
- [ ] `npm run verify` passes on the commit being published.
- [ ] Local real-Worker `npm run test:integration` passes.
- [ ] Production `/v1/health` matches intended flags.
- [ ] Normal and Hardcore pass on two physical phones.
- [ ] Ghost hidden-score flow passes through the messaging app you actually use.
- [ ] Mid-match cheat toggles work and never appear in remote payloads/results.
- [ ] Background/reconnect, refresh recovery, forfeit, and rematch pass.
- [ ] Old Gist token is revoked and `npm run check:no-gist` passes.
- [ ] Cloudflare metrics remain comfortably inside current Free limits.
