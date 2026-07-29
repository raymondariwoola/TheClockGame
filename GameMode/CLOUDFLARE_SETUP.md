# Chronos Strike Cloudflare setup

This GameMode now uses a single Cloudflare Worker and SQLite-backed Durable Objects. There is no runtime GitHub Gist dependency and no browser-side service token.

Do not deploy yet unless you intend to activate the backend. The complete owner checklist will be finalized after the multiplayer and ghost phases. For local Phase 2 verification:

1. Open a terminal in `GameMode/worker`.
2. Run `npm install` once.
3. Create an untracked `GameMode/worker/.dev.vars` file with:

   ```text
   RUN_SIGNING_SECRET=use-a-long-random-local-value
   ADMIN_CODE=your-local-admin-code
   CHEAT_CODE=your-local-cheat-code
   ```

4. Run `npm run dev`.
5. Serve `GameMode/` over HTTP on port 8000 and keep `leaderboard-config.js` pointed at the Worker URL used by the browser.

Production activation will require three `wrangler secret put` commands, setting the allowed static-site origin, deploying once, updating `apiBase`, and revoking the old Gist token. No payment service, paid database, or paid Cloudflare product is part of this design.

The Worker configuration deliberately uses SQLite storage. Cloudflare's free Workers plan supports SQLite-backed Durable Objects; usage still has free-tier limits, so the final runbook includes monitoring and feature kill switches.
