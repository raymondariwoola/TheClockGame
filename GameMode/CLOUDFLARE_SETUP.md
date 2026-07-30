# Chronos Strike Cloudflare development setup

The GameMode uses one Cloudflare Worker plus three SQLite-backed Durable Object classes:

- `LeaderboardRoom` for atomic partitioned boards;
- `GhostChallengeRoom` for seven-day asynchronous challenges;
- `MatchRoom` for two-seat hibernating-WebSocket Chrono Clash rooms.

Ghost/Daily and Clash invitations also store one bounded 1200 × 630 PNG inside their existing room object. The Worker serves capability-free `/s/ghost/:code` and `/s/clash/:code` Open Graph pages, while `PUBLIC_GAME_URL` controls the safe redirect back to GameMode. No R2 bucket, image service, KV namespace, or paid add-on is used.

There is no runtime GitHub Gist dependency and no browser-side secret. For the complete production activation, phone acceptance, monitoring, rollback, and Gist-retirement checklist, follow [OWNER_ACTIONS.md](OWNER_ACTIONS.md).

## Local setup

From `GameMode/worker`:

```powershell
npm ci
```

Create the ignored file `GameMode/worker/.dev.vars`:

```text
RUN_SIGNING_SECRET=replace-with-a-long-random-local-value
ADMIN_CODE=replace-with-a-local-admin-code
CHEAT_CODE=replace-with-the-local-family-cheat-code
```

Never commit that file. Start the Worker:

```powershell
npm run dev -- --port 8787
```

In a second terminal, from `GameMode/`:

```powershell
npm run dev
```

The static development server is at `http://127.0.0.1:8000` and proxies HTTP API requests to `http://127.0.0.1:8787`. For direct browser WebSocket testing, temporarily point `leaderboard-config.js` to `http://127.0.0.1:8787` and set `ALLOW_ORIGIN` in `worker/wrangler.jsonc` to the exact development origin. Revert both temporary edits before committing.

## Verification

```powershell
npm run verify
npm run test:integration
git diff --check
```

`test:integration` expects the local Worker to already be running. It completes a real ghost lifecycle and a two-WebSocket live match, including rematch and forfeit.

Share-card tests verify PNG type/size limits, host-only uploads, expiry cleanup, HTML escaping, 1200 × 630 metadata, and hidden-target privacy. `PUBLIC_GAME_URL` is a plaintext deployment setting in `wrangler.jsonc`; it is not a secret.

The missing `soundtrack/Normal.mp3` is deliberate: Normal mode uses the offline procedural WebAudio track. `Hardcore.mp3` remains range-cached.
