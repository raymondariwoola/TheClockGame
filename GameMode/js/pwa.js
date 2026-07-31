(function initChronosPWA(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosPWA = api;
  if (root?.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', api.init, { once: true });
    else api.init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPWA(root) {
  'use strict';

  let deferredPrompt = null;
  let initialized = false;
  let registration = null;
  let waitingWorker = null;
  let updateArmed = false;
  let activating = false;
  let lastUpdateCheck = 0;

  function canApplyUpdate(game = root?.ChronosGame) {
    try { return game?.canApplyPwaUpdate?.() === true; } catch { return false; }
  }

  function isIOS(navigatorLike = root?.navigator) {
    const ua = String(navigatorLike?.userAgent || '');
    const platform = String(navigatorLike?.platform || '');
    const touchMac = platform === 'MacIntel' && Number(navigatorLike?.maxTouchPoints || 0) > 1;
    return /iPad|iPhone|iPod/i.test(ua) || touchMac;
  }

  function isStandalone(windowLike = root) {
    try {
      return windowLike?.matchMedia?.('(display-mode: standalone)')?.matches === true ||
        windowLike?.navigator?.standalone === true;
    } catch { return false; }
  }

  function guidance(navigatorLike = root?.navigator) {
    if (isIOS(navigatorLike)) {
      return {
        title: 'ADD TO HOME SCREEN',
        text: 'In Safari, tap the Share button, then choose “Add to Home Screen”. Chronos Strike will still work normally in this tab if you prefer not to install it.',
      };
    }
    return {
      title: 'INSTALL CHRONOS STRIKE',
      text: 'Open your browser menu and choose “Install app” or “Add to Home screen”. Chronos Strike will still work normally in this tab if installation is unavailable.',
    };
  }

  function init() {
    if (initialized || !root?.document) return;
    initialized = true;
    const doc = root.document;
    const button = doc.getElementById('pwaInstallBtn');
    const overlay = doc.getElementById('pwaInstallOverlay');
    const title = doc.getElementById('pwaInstallTitle');
    const text = doc.getElementById('pwaInstallText');
    const action = doc.getElementById('pwaInstallAction');
    const close = doc.getElementById('pwaInstallClose');
    const updateBanner = doc.getElementById('pwaUpdateBanner');
    const updateText = doc.getElementById('pwaUpdateText');
    const updateAction = doc.getElementById('pwaUpdateAction');
    const updateLater = doc.getElementById('pwaUpdateLater');
    if (!button || !overlay || !title || !text || !action || !close || !updateBanner || !updateText || !updateAction || !updateLater) return;

    function announce(message) {
      const live = doc.getElementById('a11yLive');
      if (live) live.textContent = message;
    }

    function hideInstalled() {
      button.hidden = true;
      overlay.hidden = true;
    }

    function showGuidance() {
      const copy = guidance();
      title.textContent = copy.title;
      text.textContent = copy.text;
      action.hidden = true;
      overlay.hidden = false;
      close.focus();
    }

    async function requestInstall() {
      if (!deferredPrompt) { showGuidance(); return; }
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        hideInstalled();
        announce('Chronos Strike installed.');
      } else {
        button.hidden = false;
      }
    }

    if (isStandalone()) { hideInstalled(); return; }
    button.hidden = !isIOS();
    button.addEventListener('click', requestInstall);
    action.addEventListener('click', requestInstall);
    close.addEventListener('click', () => { overlay.hidden = true; button.focus(); });
    overlay.addEventListener('click', (event) => { if (event.target === overlay) { overlay.hidden = true; button.focus(); } });

    root.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      button.hidden = false;
    });
    root.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      hideInstalled();
      announce('Chronos Strike installed.');
    });

    function renderUpdate() {
      if (!waitingWorker || activating) { updateBanner.hidden = true; return; }
      const safe = canApplyUpdate();
      updateBanner.hidden = false;
      if (updateArmed && !safe) {
        updateText.textContent = 'Your run and results are safe. The update will apply when you return to the menu.';
        updateAction.textContent = 'UPDATE ARMED';
        updateAction.disabled = true;
      } else {
        updateText.textContent = safe ? 'Update now for the latest fixes.' : 'Finish this run or result flow first. Nothing will be interrupted.';
        updateAction.textContent = safe ? 'UPDATE NOW' : 'UPDATE AFTER THIS RUN';
        updateAction.disabled = false;
      }
    }

    function offerUpdate(worker) {
      if (!worker) return;
      waitingWorker = worker;
      renderUpdate();
    }

    function activateUpdate() {
      if (!waitingWorker || activating || !canApplyUpdate()) return false;
      activating = true;
      updateText.textContent = 'Applying the update…';
      updateAction.textContent = 'UPDATING';
      updateAction.disabled = true;
      updateLater.hidden = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }

    updateAction.addEventListener('click', () => {
      if (canApplyUpdate()) { activateUpdate(); return; }
      updateArmed = true;
      renderUpdate();
    });
    updateLater.addEventListener('click', () => {
      updateArmed = false;
      updateBanner.hidden = true;
    });
    root.addEventListener('chronos:screenchange', () => {
      if (updateArmed && canApplyUpdate()) activateUpdate();
      else renderUpdate();
    });

    if ('serviceWorker' in root.navigator) {
      root.navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!activating) return;
        root.location.reload();
      });
      const registerWorker = async () => {
        try {
          registration = await root.navigator.serviceWorker.register('sw.js?v=12', { updateViaCache: 'none' });
          if (registration.waiting && root.navigator.serviceWorker.controller) offerUpdate(registration.waiting);
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && root.navigator.serviceWorker.controller) offerUpdate(installing);
            });
          });
        } catch {
          root.dispatchEvent(new CustomEvent('chronos:pwa-registration', { detail: { ok: false } }));
        }
      };
      if (doc.readyState === 'complete') registerWorker();
      else root.addEventListener('load', registerWorker, { once: true });

      root.addEventListener('visibilitychange', () => {
        if (doc.visibilityState !== 'visible' || !registration) return;
        const now = Date.now();
        if (now - lastUpdateCheck < 15 * 60 * 1000) return;
        lastUpdateCheck = now;
        registration.update().catch(() => {});
      });
    }
  }

  return { init, isIOS, isStandalone, guidance, canApplyUpdate };
});
