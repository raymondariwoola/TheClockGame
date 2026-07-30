// Chronos Strike owner control — versioned, one-time browser data resets.
//
// NORMAL DEPLOYMENT: leave the value unchanged.
// FUTURE PERSONAL-STATS RESET: replace personalStatsId with a brand-new unique
// value (for example "2026-12-24-family-reset-2") and deploy the static site.
// Each browser clears only Best Score, Best Combo, and Round Reached once, then
// remembers that ID. An empty value disables the reset mechanism.
window.CHRONOS_LOCAL_RESET = Object.freeze({
  personalStatsId: '2026-07-31-family-reset-1',
});
