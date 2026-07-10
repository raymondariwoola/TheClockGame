# Chronos Strike — Global Leaderboard Setup

The leaderboard works out of the box as a **local (this-browser-only)** board.
To make scores **global**, pick one of the two options below.

| | Cost | Token exposed? | Effort |
|---|---|---|---|
| **A. Cloudflare Worker** (recommended) | Free | ❌ No — stays server-side | ~5 min |
| **B. Direct gist** | Free | ⚠️ Yes — visible in page source | ~2 min |

Both keep your game on free GitHub Pages. GitHub Pages is static, so it can't
hide a secret on its own — you need a tiny free function (Option A) for that.
GitHub Actions secrets don't help here: they only exist at build time and would
still be baked into the shipped files.

---

## Shared step — create the gist (both options need this)

1. Go to <https://gist.github.com>.
2. Filename: `chronos-leaderboard.json`
3. Content:
   ```json
   {"entries": []}
   ```
4. Click **Create public gist**.
5. Copy the **gist ID** from the URL — the long hex string:
   `https://gist.github.com/<you>/`**`3f9a…`** ← that part.

## Shared step — create a token

1. GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. **Generate new token (classic)**, tick **only the `gist` scope**.
   (Fine-grained tokens don't support the gist API — it must be classic.)
3. Copy the token (`ghp_…`). You'll paste it in one place below.

---

## Option A — Cloudflare Worker (token stays private) ✅ recommended

**Cloudflare Workers is free** (100k requests/day, no credit card for the free plan).

1. Sign up / log in at <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Worker**. Name it e.g. `chronos-leaderboard`, **Deploy**.
3. Click **Edit code**. Delete the sample and paste the entire contents of
   [`leaderboard-worker.js`](leaderboard-worker.js). **Deploy** (top right).
4. **Settings → Variables and Secrets → Add**:
   | Name | Type | Value |
   |---|---|---|
   | `GITHUB_TOKEN` | **Secret** | your `ghp_…` token |
   | `GIST_ID` | Text | the gist id |
   | `GIST_FILE` | Text | `chronos-leaderboard.json` *(optional)* |
   | `ALLOW_ORIGIN` | Text | `https://<you>.github.io` *(optional; locks CORS to your site)* |

   Click **Deploy** again so the variables take effect.
5. Copy your worker URL (**Settings → Domains & Routes**), e.g.
   `https://chronos-leaderboard.<you>.workers.dev`.
6. In [`leaderboard-config.js`](leaderboard-config.js):
   ```js
   window.CHRONOS_LB_CONFIG = {
     workerUrl: 'https://chronos-leaderboard.<you>.workers.dev',
     gistId: '',
     gistFile: 'chronos-leaderboard.json',
     tokenParts: [],
   };
   ```
7. Commit & push. Done — the token never touches the browser.

**Quick test:** open the worker URL in a browser tab. You should see
`{"entries":[]}`. If you see `{"error":"worker not configured"}`, the variables
aren't saved / re-deployed yet.

---

## Option B — Direct gist (simplest, token is visible)

Only use this if you're OK with a visitor being able to read the token (scoped
to gists only) and potentially editing the board.

In [`leaderboard-config.js`](leaderboard-config.js), leave `workerUrl` empty and set:
```js
window.CHRONOS_LB_CONFIG = {
  workerUrl: '',
  gistId: '3f9a…',
  gistFile: 'chronos-leaderboard.json',
  // Split the token so GitHub's secret scanner doesn't auto-revoke it on push.
  // Token 'ghp_AbCdEf123456' -> ['ghp_AbCd', 'Ef123', '456']
  tokenParts: ['ghp_AbCd', 'Ef123', '456'],
};
```

---

## Notes

- **Reads never need a token** (public gists are world-readable), so the board
  loads even with no config — it just falls back to a local board for writes.
- **Zen mode is intentionally excluded** from the global board (no lives = an
  unbounded score you could grind forever). Classic and Endless both count.
- The client re-fetches and merges before every write, so two players finishing
  at once won't clobber each other. The Worker also re-validates and sanitizes
  every submitted entry server-side.
