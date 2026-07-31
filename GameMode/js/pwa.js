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
    if (!button || !overlay || !title || !text || !action || !close) return;

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
  }

  return { init, isIOS, isStandalone, guidance };
});
