// Chronos Strike — leaderboard backend configuration.
// Three modes, in order of preference. Fill in ONE.
//
//  1. workerUrl  — Cloudflare Worker proxy. The GitHub token lives on the
//     worker (never in the browser). Recommended. See LEADERBOARD-SETUP.md.
//  2. gistId + tokenParts — talk to the gist directly. Simplest, but the
//     token is visible to anyone who views the page source.
//  3. none set   — local, this-browser-only board (still fully playable).

window.CHRONOS_LB_CONFIG = {
  // Mode 1 (recommended): your deployed worker URL, e.g.
  // 'https://chronos-leaderboard.<you>.workers.dev'
  workerUrl: '',

  // Mode 2 (fallback): direct gist access. Leave tokenParts empty if using a worker.
  gistId: '',
  gistFile: 'chronos-leaderboard.json',
  tokenParts: [],
};
