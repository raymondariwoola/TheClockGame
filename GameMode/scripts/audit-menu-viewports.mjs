import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const chromePath = process.env.CHRONOS_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const gameUrl = process.env.CHRONOS_AUDIT_URL || 'http://127.0.0.1:8000/';
const port = 9300 + (process.pid % 500);
const profile = join(tmpdir(), `chronos-menu-audit-${process.pid}`);
const outputDir = join(tmpdir(), 'chronos-menu-audit');

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
    } catch (error) { lastError = error; }
    await wait(100);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

let socket;
let sequence = 0;
const pending = new Map();

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Runtime evaluation failed');
  return response.result?.result?.value;
}

async function waitForGame() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = await evaluate("document.readyState === 'complete' && !!window.ChronosMenu && !!document.querySelector('.menu-nav')");
    if (ready) return;
    await wait(100);
  }
  throw new Error('Chronos menu did not become ready');
}

async function auditViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: true,
    screenWidth: width, screenHeight: height,
  });
  await send('Page.navigate', { url: `${gameUrl}?ui-audit=${width}x${height}` });
  await waitForGame();
  await wait(1450); // allow the optional entrance animation to settle before visual capture

  const snapshot = await evaluate(`(() => {
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      nav: rect(document.querySelector('.menu-nav')),
      start: rect(document.querySelector('#menuStartBtn')),
      buttons: [...document.querySelectorAll('[data-menu-nav]')].map((button) => ({
        name: button.dataset.menuNav, current: button.getAttribute('aria-current'), ...rect(button),
      })),
      panels: [...document.querySelectorAll('[data-menu-destination]')].map((panel) => ({
        name: panel.dataset.menuDestination, hidden: panel.hidden, inert: panel.inert,
      })),
      active: window.ChronosMenu.active(),
    };
  })()`);

  assert.deepEqual(snapshot.viewport, { width, height }, `${width}x${height} emulation must use the requested CSS viewport`);
  assert.equal(snapshot.overflowX, false, `${width}x${height} must not overflow horizontally`);
  assert.equal(snapshot.buttons.length, 4, 'all four destinations must remain visible');
  assert.ok(snapshot.nav.left >= 0 && snapshot.nav.right <= width, 'navigation stays inside the viewport');
  for (const button of snapshot.buttons) {
    assert.ok(button.left >= 0 && button.right <= width, `${button.name} stays inside the viewport`);
    assert.ok(button.height >= 44, `${button.name} keeps a 44px touch target`);
  }
  if (height >= width) {
    assert.ok(snapshot.start.top >= 0 && snapshot.start.bottom <= snapshot.nav.top,
      `${width}x${height} keeps the complete Start action above the fixed navigation`);
  }
  assert.equal(snapshot.active, 'play');
  assert.equal(snapshot.panels.filter((panel) => !panel.hidden && !panel.inert).length, 1, 'one destination is exposed initially');

  for (const name of ['compete', 'progress', 'settings', 'play']) {
    const state = await evaluate(`(() => {
      document.querySelector('[data-menu-nav="${name}"]').click();
      return {
        active: window.ChronosMenu.active(),
        visible: [...document.querySelectorAll('[data-menu-destination]')]
          .filter((panel) => !panel.hidden && !panel.inert).map((panel) => panel.dataset.menuDestination),
        current: [...document.querySelectorAll('[data-menu-nav][aria-current="page"]')]
          .map((button) => button.dataset.menuNav),
      };
    })()`);
    assert.equal(state.active, name, `${name} becomes active`);
    assert.deepEqual(state.visible, [name], `${name} is the only exposed panel`);
    assert.deepEqual(state.current, [name], `${name} is the only current navigation item`);
    if (width === 390 && name !== 'play') {
      await wait(220);
      const destinationImage = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const destinationOutput = join(outputDir, `menu-${width}x${height}-${name}.png`);
      await writeFile(destinationOutput, Buffer.from(destinationImage.result.data, 'base64'));
      snapshot[`${name}Screenshot`] = destinationOutput;
    }
  }

  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const output = join(outputDir, `menu-${width}x${height}.png`);
  await writeFile(output, Buffer.from(image.result.data, 'base64'));
  return { ...snapshot, screenshot: output };
}

async function navigateForTask(task) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    screenWidth: 390, screenHeight: 844,
  });
  await send('Page.navigate', { url: `${gameUrl}?ui-task=${task}` });
  await waitForGame();
  await wait(180);
}

async function auditCriticalTasks() {
  await navigateForTask('start-normal');
  await evaluate(`(() => {
    document.querySelector('[data-menu-nav="play"]').click();
    document.querySelector('.mode-card[data-mode="classic"]').click();
    document.querySelector('.diff-opt[data-diff="easy"]').click();
    document.querySelector('#menuStartBtn').click();
  })()`);
  await wait(420);
  const started = await evaluate(`(() => ({
    gameVisible: document.querySelector('#screen-game').classList.contains('active'),
    run: window.ChronosGame.getRunInfo(),
    objectives: document.querySelectorAll('#objectiveHud .objective-card').length,
    objectiveBounds: (() => { const r = document.querySelector('#objectiveHud').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })(),
  }))()`);
  assert.equal(started.gameVisible, true, 'a player can start a game from Play');
  assert.equal(started.run.mode, 'classic', 'the task starts Classic');
  assert.equal(started.run.hardcore, false, 'the task starts Normal difficulty');
  assert.equal(started.objectives, 2, 'a run starts with exactly two optional Objective Cards');
  assert.ok(started.objectiveBounds.left >= 0 && started.objectiveBounds.right <= 390 && started.objectiveBounds.top >= 0 && started.objectiveBounds.bottom <= 844,
    'Objective Cards stay inside the mobile gameplay viewport');
  const clashControls = await evaluate(`(() => {
    const dock = document.querySelector('#clashActionDock'); const reaction = document.querySelector('#clashReactionDock');
    const sabotage = document.querySelector('#clashSabotageDock'); dock.hidden = false; reaction.hidden = false; sabotage.hidden = false;
    const strike = document.querySelector('#strikeBtn').getBoundingClientRect(); const actions = dock.getBoundingClientRect();
    return { strikeBottom: strike.bottom, actionsTop: actions.top, actionsLeft: actions.left, actionsRight: actions.right, viewportWidth: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth };
  })()`);
  assert.ok(clashControls.actionsTop >= clashControls.strikeBottom, 'Clash controls are in flow below STRIKE and cannot cover it');
  assert.ok(clashControls.actionsLeft >= 0 && clashControls.actionsRight <= clashControls.viewportWidth, 'Clash controls remain inside the mobile viewport');
  assert.ok(clashControls.overflow <= 1, 'Clash controls create no horizontal page overflow');
  const objectiveImage = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const objectiveScreenshot = join(outputDir, 'objective-cards-390x844.png');
  await writeFile(objectiveScreenshot, Buffer.from(objectiveImage.result.data, 'base64'));

  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true, screenWidth: 320, screenHeight: 568 });
  await send('Page.navigate', { url: `${gameUrl}?ui-task=clash-controls-small` }); await waitForGame(); await wait(180);
  await evaluate(`(() => { document.querySelector('[data-menu-nav="play"]').click(); document.querySelector('.mode-card[data-mode="classic"]').click(); document.querySelector('#menuStartBtn').click(); })()`);
  await wait(420);
  const smallControls = await evaluate(`(() => {
    const dock = document.querySelector('#clashActionDock'); dock.hidden = false; document.querySelector('#clashReactionDock').hidden = false; document.querySelector('#clashSabotageDock').hidden = false;
    const strike = document.querySelector('#strikeBtn').getBoundingClientRect(); const actions = dock.getBoundingClientRect();
    return { strikeBottom: strike.bottom, actionsTop: actions.top, actionsLeft: actions.left, actionsRight: actions.right, viewportWidth: innerWidth, viewportHeight: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth };
  })()`);
  assert.ok(smallControls.actionsTop >= smallControls.strikeBottom, 'Clash controls stay below STRIKE at 320 × 568');
  assert.ok(smallControls.actionsLeft >= 0 && smallControls.actionsRight <= smallControls.viewportWidth && smallControls.actionsTop < smallControls.viewportHeight,
    'Clash controls remain visible inside a small mobile viewport');
  assert.ok(smallControls.overflow <= 1, 'small Clash controls create no horizontal page overflow');
  const smallImage = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const smallControlsScreenshot = join(outputDir, 'clash-controls-320x568.png');
  await writeFile(smallControlsScreenshot, Buffer.from(smallImage.result.data, 'base64'));

  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true, screenWidth: 844, screenHeight: 390 });
  await send('Page.navigate', { url: `${gameUrl}?ui-task=clash-controls-landscape` }); await waitForGame(); await wait(180);
  await evaluate(`(() => { document.querySelector('[data-menu-nav="play"]').click(); document.querySelector('.mode-card[data-mode="classic"]').click(); document.querySelector('#menuStartBtn').click(); })()`);
  await wait(420);
  const landscapeControls = await evaluate(`(() => {
    const dock = document.querySelector('#clashActionDock'); dock.hidden = false; document.querySelector('#clashReactionDock').hidden = false; document.querySelector('#clashSabotageDock').hidden = false;
    const strike = document.querySelector('#strikeBtn').getBoundingClientRect(); const actions = dock.getBoundingClientRect(); const stack = document.querySelector('.clash-strike-stack').getBoundingClientRect();
    return { strikeBottom: strike.bottom, actionsTop: actions.top, actionsRight: actions.right, stackRight: stack.right, viewportWidth: innerWidth, viewportHeight: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth };
  })()`);
  assert.ok(landscapeControls.actionsTop >= landscapeControls.strikeBottom, 'landscape keeps Clash controls below STRIKE inside one stack');
  assert.ok(landscapeControls.actionsRight <= landscapeControls.viewportWidth && landscapeControls.stackRight <= landscapeControls.viewportWidth && landscapeControls.actionsTop < landscapeControls.viewportHeight,
    'landscape Clash controls remain visible inside the viewport');
  assert.ok(landscapeControls.overflow <= 1, 'landscape Clash controls create no horizontal page overflow');
  const landscapeImage = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const landscapeControlsScreenshot = join(outputDir, 'clash-controls-844x390.png');
  await writeFile(landscapeControlsScreenshot, Buffer.from(landscapeImage.result.data, 'base64'));

  await navigateForTask('find-clash');
  const clash = await evaluate(`(() => {
    document.querySelector('[data-menu-nav="compete"]').click();
    document.querySelector('#clashOpenBtn').click();
    const dialog = document.querySelector('.clash-overlay [role="dialog"]');
    return {
      destination: window.ChronosMenu.active(),
      dialog: !!dialog,
      heading: dialog?.querySelector('h2')?.textContent || '',
      inputs: dialog?.querySelectorAll('input, select').length || 0,
      handicaps: dialog?.querySelectorAll('.clash-handicap-select option').length || 0,
    };
  })()`);
  assert.deepEqual(clash, { destination: 'compete', dialog: true, heading: 'CHRONO CLASH', inputs: 4, handicaps: 4 },
    'Clash is discoverable from Compete without creating a room');

  await navigateForTask('view-hall');
  const hall = await evaluate(`(async () => {
    document.querySelector('[data-menu-nav="compete"]').click();
    document.querySelector('#menuBoardBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return {
      boardVisible: document.querySelector('#screen-board').classList.contains('active'),
      playlists: document.querySelectorAll('[data-board-mode]').length,
      difficulties: document.querySelectorAll('[data-board-difficulty]').length,
      context: document.querySelector('#boardContext').textContent.trim(),
    };
  })()`);
  assert.equal(hall.boardVisible, true, 'Hall opens without publishing a score');
  assert.equal(hall.playlists, 3, 'Hall exposes Classic, Endless, and Daily');
  assert.equal(hall.difficulties, 2, 'Hall exposes Normal and Hardcore');
  assert.match(hall.context, /CLASSIC.*NORMAL/, 'Hall states the selected board explicitly');

  await navigateForTask('accessibility-and-app');
  const settings = await evaluate(`(() => {
    document.querySelector('[data-menu-nav="settings"]').click();
    const app = document.querySelector('[aria-labelledby="settingsAppTitle"]');
    document.querySelector('#menuA11yBtn').click();
    return {
      destination: window.ChronosMenu.active(),
      accessibilityOpen: document.querySelector('#a11yOverlay').hidden === false,
      accessibilityOptions: document.querySelectorAll('#a11yRows .a11y-row').length,
      appDiscoverable: !!app && app.textContent.includes('Install') && app.textContent.includes('update'),
      installControl: !!document.querySelector('#pwaInstallBtn'),
      updateControl: !!document.querySelector('#pwaUpdateAction'),
      updateSafety: window.ChronosGame.canApplyPwaUpdate() === false,
    };
  })()`);
  assert.equal(settings.destination, 'settings', 'Settings is reachable from the stable navigation');
  assert.equal(settings.accessibilityOpen, true, 'accessibility settings open from Settings');
  assert.ok(settings.accessibilityOptions >= 6, 'accessibility options are populated');
  assert.equal(settings.appDiscoverable, true, 'installation and update guidance has a labelled home');
  assert.equal(settings.installControl, true, 'the conditional install control remains wired');
  assert.equal(settings.updateControl, true, 'the safe update action remains wired');
  assert.equal(settings.updateSafety, true, 'an open modal prevents a service-worker reload');

  return {
    tasks: ['start Normal Classic', 'find Clash', 'view Hall boards', 'open accessibility', 'locate install/update'],
    objectiveScreenshot, smallControlsScreenshot, landscapeControlsScreenshot,
  };
}

try {
  await mkdir(outputDir, { recursive: true });
  const page = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(gameUrl)}`, { method: 'PUT' });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*://*.workers.dev/*'] });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: "try { localStorage.setItem('cs_identity_prompted', '1'); } catch {}",
  });
  const results = [];
  for (const viewport of [[320, 568], [390, 844], [844, 390], [1280, 800]]) results.push(await auditViewport(...viewport));
  const taskAudit = await auditCriticalTasks();
  console.log('✓ menu viewport audit passed');
  for (const result of results) {
    console.log(`  ${result.viewport.width}x${result.viewport.height}: four destinations, no horizontal overflow, screenshot ${result.screenshot}`);
    for (const name of ['compete', 'progress', 'settings']) {
      if (result[`${name}Screenshot`]) console.log(`  ${name} screenshot: ${result[`${name}Screenshot`]}`);
    }
  }
  console.log(`  objective cards screenshot: ${taskAudit.objectiveScreenshot}`);
  console.log(`  small Clash controls screenshot: ${taskAudit.smallControlsScreenshot}`);
  console.log(`  landscape Clash controls screenshot: ${taskAudit.landscapeControlsScreenshot}`);
  console.log(`✓ menu task audit passed: ${taskAudit.tasks.join('; ')}`);
} finally {
  try { if (socket?.readyState === WebSocket.OPEN) await send('Browser.close'); } catch {}
  try { socket?.close(); } catch {}
  if (!chrome.killed) chrome.kill();
}
