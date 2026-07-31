(function initChronosGameplayGestures(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosGameplayGestures = api;
  if (root?.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', api.init, { once: true });
    else api.init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGameplayGestures(root) {
  'use strict';

  let initialized = false;

  function gameIsActive(gameElement) {
    try { return gameElement?.classList?.contains('active') === true; } catch { return false; }
  }

  function blockGameZoom(event, gameElement) {
    if (!gameIsActive(gameElement) || event?.cancelable === false) return false;
    try { event.preventDefault(); return true; } catch { return false; }
  }

  function init() {
    if (initialized || !root?.document) return;
    initialized = true;
    const game = root.document.getElementById('screen-game');
    if (!game) return;

    // `touch-action: none` is the primary standards-based control. These
    // narrowly scoped listeners cover Safari's non-standard pinch gesture
    // events and double-click default behavior without affecting menu/result
    // scrolling or zoom.
    const guard = (event) => blockGameZoom(event, game);
    for (const type of ['gesturestart', 'gesturechange']) {
      game.addEventListener(type, guard, { passive: false });
    }
    game.addEventListener('dblclick', guard, { passive: false });
  }

  return { init, gameIsActive, blockGameZoom };
});
