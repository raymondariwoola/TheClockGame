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

  class ConnectivityMonitor {
    constructor({ navigatorLike, fetchImpl, apiBase, timeoutMs = 5000, AbortControllerImpl } = {}) {
      this.navigatorLike = navigatorLike || {};
      this.fetchImpl = fetchImpl;
      this.apiBase = String(apiBase || '').replace(/\/+$/, '');
      this.timeoutMs = timeoutMs;
      this.AbortControllerImpl = AbortControllerImpl;
      this.state = { kind: 'unknown', features: null };
      this.listeners = new Set();
    }

    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    emit(next) {
      const previous = this.state;
      this.state = next;
      for (const listener of this.listeners) { try { listener(next, previous); } catch {} }
      return next;
    }

    async check() {
      if (this.navigatorLike.onLine === false) return this.emit({ kind: 'offline', features: null });
      if (!this.fetchImpl || !this.apiBase) return this.emit({ kind: 'cloud_unavailable', features: null });
      const controller = this.AbortControllerImpl ? new this.AbortControllerImpl() : null;
      const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
      try {
        const response = await this.fetchImpl(`${this.apiBase}/v1/health`, {
          method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller?.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.ok !== true) throw new Error('health_unavailable');
        return this.emit({ kind: 'online', features: data.features || null });
      } catch {
        return this.emit({ kind: this.navigatorLike.onLine === false ? 'offline' : 'cloud_unavailable', features: null });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }

  function connectivityApiBase(windowLike = root) {
    const location = windowLike?.location;
    if (/^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(String(location?.hostname || ''))) return String(location?.origin || '');
    return String(windowLike?.CHRONOS_LB_CONFIG?.apiBase || '').replace(/\/+$/, '');
  }

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
    const connectionButton = doc.getElementById('pwaConnectionBtn');
    const connectionIcon = doc.getElementById('pwaConnectionIcon');
    const connectionLabel = doc.getElementById('pwaConnectionLabel');
    const connectionOverlay = doc.getElementById('pwaConnectionOverlay');
    const connectionCard = connectionOverlay?.querySelector('.pwa-connection-card');
    const connectionGlyph = doc.getElementById('pwaConnectionGlyph');
    const connectionSummary = doc.getElementById('pwaConnectionSummary');
    const cloudText = doc.getElementById('pwaCloudAvailabilityText');
    const connectionRetry = doc.getElementById('pwaConnectionRetry');
    const connectionClose = doc.getElementById('pwaConnectionClose');
    const connectionToast = doc.getElementById('pwaConnectionToast');
    if (!button || !overlay || !title || !text || !action || !close || !updateBanner || !updateText || !updateAction || !updateLater ||
        !connectionButton || !connectionIcon || !connectionLabel || !connectionOverlay || !connectionCard || !connectionGlyph ||
        !connectionSummary || !cloudText || !connectionRetry || !connectionClose || !connectionToast) return;

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
      const modalOpen = Array.from(doc.querySelectorAll('.overlay')).some((item) => !item.hidden);
      if (!waitingWorker || activating || modalOpen) { updateBanner.hidden = true; return; }
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
    if (root.MutationObserver) {
      const modalObserver = new root.MutationObserver((mutations) => {
        const modalChanged = mutations.some((mutation) => {
          if (mutation.type === 'attributes') return mutation.target?.classList?.contains('overlay');
          return Array.from(mutation.addedNodes || []).some((node) =>
            node?.matches?.('.overlay') || node?.querySelector?.('.overlay'));
        });
        if (modalChanged) renderUpdate();
      });
      modalObserver.observe(doc.body, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
    }

    if ('serviceWorker' in root.navigator) {
      root.navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!activating) return;
        root.location.reload();
      });
      const registerWorker = async () => {
        try {
          registration = await root.navigator.serviceWorker.register('sw.js?v=14', { updateViaCache: 'none' });
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

    let toastTimer = null;
    function showConnectionToast(message, kind) {
      if (toastTimer) root.clearTimeout(toastTimer);
      connectionToast.textContent = message;
      connectionToast.className = `pwa-connection-toast ${kind || ''}`.trim();
      connectionToast.hidden = false;
      toastTimer = root.setTimeout(() => { connectionToast.hidden = true; }, 5000);
    }

    function renderConnection(next, previous) {
      const kind = next.kind;
      connectionButton.dataset.state = kind;
      connectionCard.dataset.state = kind;
      connectionRetry.disabled = kind === 'checking';
      connectionRetry.textContent = kind === 'checking' ? 'CHECKING…' : 'TRY AGAIN';
      if (kind === 'online') {
        connectionButton.hidden = true;
        connectionGlyph.textContent = '✓';
        connectionSummary.textContent = 'Cloud play is ready.';
        cloudText.textContent = 'Leaderboard, Daily Rift, Ghost challenges, and Chrono Clash are reachable.';
        connectionRetry.hidden = true;
        if (previous && ['offline', 'cloud_unavailable'].includes(previous.kind)) showConnectionToast('BACK ONLINE · CLOUD PLAY READY', 'online');
      } else if (kind === 'offline') {
        connectionButton.hidden = false;
        connectionIcon.textContent = '×';
        connectionLabel.textContent = 'OFFLINE · LOCAL PLAY READY';
        connectionGlyph.textContent = '×';
        connectionSummary.textContent = 'This device is offline. Your local game remains ready.';
        cloudText.textContent = 'Leaderboard, online Daily identity, cloud Ghost challenges, and Chrono Clash need a connection.';
        connectionRetry.hidden = false;
        if (!previous || previous.kind !== 'offline') showConnectionToast('OFFLINE · LOCAL PLAY STILL READY', 'offline');
      } else if (kind === 'checking') {
        connectionRetry.hidden = false;
        connectionSummary.textContent = 'Checking Cloudflare availability…';
      } else {
        connectionButton.hidden = false;
        connectionIcon.textContent = '!';
        connectionLabel.textContent = 'CLOUD UNAVAILABLE · LOCAL PLAY READY';
        connectionGlyph.textContent = '!';
        connectionSummary.textContent = 'The internet appears available, but Chronos cloud play could not be reached.';
        cloudText.textContent = 'Leaderboard, online Daily identity, cloud Ghost challenges, and Chrono Clash may be temporarily unavailable.';
        connectionRetry.hidden = false;
        if (!previous || previous.kind !== 'cloud_unavailable') showConnectionToast('CLOUD UNAVAILABLE · LOCAL PLAY STILL READY', '');
      }
    }

    const connectivity = new ConnectivityMonitor({
      navigatorLike: root.navigator,
      fetchImpl: root.fetch?.bind(root),
      apiBase: connectivityApiBase(root),
      AbortControllerImpl: root.AbortController,
    });
    connectivity.subscribe(renderConnection);
    connectionButton.addEventListener('click', () => { renderConnection(connectivity.state, connectivity.state); connectionOverlay.hidden = false; connectionClose.focus(); });
    connectionClose.addEventListener('click', () => { connectionOverlay.hidden = true; connectionButton.focus(); });
    connectionOverlay.addEventListener('click', (event) => { if (event.target === connectionOverlay) { connectionOverlay.hidden = true; connectionButton.focus(); } });
    connectionRetry.addEventListener('click', async () => {
      renderConnection({ kind: 'checking', features: null }, connectivity.state);
      await connectivity.check();
    });
    root.addEventListener('offline', () => connectivity.check());
    root.addEventListener('online', () => connectivity.check());
    let lastHealthCheck = 0;
    root.addEventListener('visibilitychange', () => {
      if (doc.visibilityState !== 'visible' || root.navigator.onLine === false) return;
      const now = Date.now();
      if (now - lastHealthCheck < 5 * 60 * 1000) return;
      lastHealthCheck = now;
      connectivity.check();
    });
    connectivity.check();
  }

  return { init, isIOS, isStandalone, guidance, canApplyUpdate, connectivityApiBase, ConnectivityMonitor };
});
