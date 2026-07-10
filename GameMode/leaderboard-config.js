// Chronos Strike — leaderboard backend configuration.

window.CHRONOS_LB_CONFIG = {
  // Mode 1 (recommended): your deployed worker URL, e.g.
  workerUrl: 'https://chronos-leaderboard.raymondariwoola.workers.dev',

  // Mode 2 (fallback): direct gist access. Leave tokenParts empty if using a worker.
  gistId: '',
  gistFile: 'chronos-leaderboard.json',
  tokenParts: [],
};
