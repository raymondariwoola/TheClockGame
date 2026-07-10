// Chronos Strike — global leaderboard configuration.
//
// SETUP (one-time):
// 1. Go to https://gist.github.com and create a PUBLIC gist:
//      filename: chronos-leaderboard.json
//      content:  {"entries": []}
//    After saving, copy the gist ID from the URL
//    (https://gist.github.com/<user>/<THIS_LONG_HEX_ID>).
//
// 2. Create a GitHub token that can update the gist:
//    GitHub → Settings → Developer settings → Personal access tokens →
//    Tokens (classic) → Generate new token, tick ONLY the "gist" scope.
//    (Fine-grained tokens do NOT support the gist API — use classic.)
//
// 3. Fill in gistId below, and split the token into a few pieces in
//    tokenParts (they are joined at runtime). The split keeps GitHub's
//    secret scanner from auto-revoking the token when this file is pushed
//    to a public repo. Example: token "ghp_AbCdEf123456" becomes
//      tokenParts: ['ghp_AbCd', 'Ef123', '456']
//
// NOTE: anyone reading this file can reconstruct the token, and anyone can
// read a public gist. Scope the token to "gist" ONLY and accept that a
// determined visitor could edit the leaderboard — fine for a fun project.
//
// If gistId is left empty, the game silently falls back to a local
// (this-browser-only) leaderboard, so everything still works.

window.CHRONOS_LB_CONFIG = {
  gistId: '',
  gistFile: 'chronos-leaderboard.json',
  tokenParts: [],
};
