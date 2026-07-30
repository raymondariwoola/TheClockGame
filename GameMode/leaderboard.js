// Chronos Strike — Cloudflare-backed Top-20 leaderboard ("Hall of Time").
// Durable Objects own remote writes; local storage is an offline fallback only.

(() => {
  'use strict';

  const MAX_ENTRIES = 20;
  const cfg = window.CHRONOS_LB_CONFIG || {};
  const API_BASE = (cfg.apiBase || '').trim().replace(/\/+$/, '');
  const REMOTE = !!API_BASE;
  const LOCAL_KEY = 'cs_local_board';
  const CACHE_KEY = 'cs_board_cache';
  const NAME_KEY = 'cs_player_name';  // remembers first/last on this device

  const $ = (id) => document.getElementById(id);
  const elStatus = $('boardStatus');
  const elPodium = $('podium');
  const elList = $('boardList');
  const elLbCheck = $('lbCheck');
  const elOverlay = $('nameOverlay');
  const elNameForm = $('nameForm');
  const elNameError = $('nameError');
  const elNameSubmit = $('nameSubmit');

  let pendingStats = null;   // stats of the run awaiting name entry
  let lastSubmittedId = null; // highlight "YOU" on the board
  const CURRENT_RULESET = 3;
  let currentPartition = { scope: 'standard', mode: 'classic', difficulty: 'normal', rulesetVersion: CURRENT_RULESET };
  const issuedRuns = new Map();

  // ---------- storage ----------
  const readJson = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const writeJson = (key, v) => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full/blocked */ }
  };

  // Remembered player name (this device). Auto-fills the entry form next time.
  const loadName = () => {
    const n = readJson(NAME_KEY);
    return (n && typeof n.first === 'string' && typeof n.last === 'string') ? n : null;
  };
  const saveName = (first, last) => writeJson(NAME_KEY, { first, last });

  const sortEntries = (list) =>
    [...list].sort((a, b) => b.score - a.score || new Date(a.date) - new Date(b.date));

  const normalize = (list) =>
    sortEntries((Array.isArray(list) ? list : [])
      .filter(e => e && typeof e.score === 'number' && typeof e.name === 'string' && e.name.trim()))
      .slice(0, MAX_ENTRIES);

  // ---------- Cloudflare API ----------
  function partitionForStats(stats = {}) {
    return {
      scope: stats.daily ? 'daily' : 'standard',
      mode: stats.daily ? 'classic' : (stats.mode || 'classic'),
      difficulty: stats.hc ? 'hardcore' : 'normal',
      rulesetVersion: stats.rulesetVersion || CURRENT_RULESET,
      dailyDate: stats.daily ? stats.dailyDate : null,
    };
  }

  function queryString(partition) {
    const params = new URLSearchParams({
      scope: partition.scope || 'standard',
      mode: partition.mode || 'classic',
      difficulty: partition.difficulty || 'normal',
      rulesetVersion: String(partition.rulesetVersion || CURRENT_RULESET),
    });
    if (partition.dailyDate) params.set('dailyDate', partition.dailyDate);
    return params.toString();
  }

  const boardStorageKey = (base, partition) => `${base}:${queryString(partition)}`;

  async function apiFetch(path, options) {
    if (!API_BASE) throw new Error('cloudflare_not_configured');
    const res = await fetch(API_BASE + path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `cloudflare_${res.status}`);
    return data;
  }

  async function workerFetch(partition) {
    const res = await fetch(`${API_BASE}/v1/leaderboards?${queryString(partition)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('worker fetch failed: ' + res.status);
    const data = await res.json();
    return normalize(data.entries);
  }

  function startRun(info = {}) {
    if (!REMOTE || !info.runId) return Promise.resolve(null);
    const promise = apiFetch('/v1/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runType: info.runType,
        mode: info.mode,
        difficulty: info.hardcore ? 'hardcore' : 'normal',
        rulesetVersion: info.rulesetVersion,
        dailyDate: info.dailyDate || null,
        seed: info.seed,
      }),
    });
    issuedRuns.set(info.runId, promise);
    return promise;
  }

  async function getDaily() {
    return apiFetch('/v1/daily', { headers: { Accept: 'application/json' } });
  }

  async function loadBoard(partition = currentPartition) {
    if (REMOTE) {
      const entries = await workerFetch(partition);
      writeJson(boardStorageKey(CACHE_KEY, partition), entries);
      return { entries, source: 'remote' };
    }
    return { entries: normalize(readJson(boardStorageKey(LOCAL_KEY, partition))), source: 'local' };
  }

  async function submitEntry(entry, stats) {
    if (REMOTE) {
      let issued = issuedRuns.get(stats.runId);
      if (!issued) {
        startRun({
          runId: stats.runId, runType: stats.daily ? 'daily' : stats.mode,
          mode: stats.mode, hardcore: stats.hc, rulesetVersion: stats.rulesetVersion,
          dailyDate: stats.dailyDate, seed: stats.seed,
        });
        issued = issuedRuns.get(stats.runId);
      }
      const run = await issued;
      const data = await apiFetch(`/v1/runs/${encodeURIComponent(run.runId)}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${run.finishToken}` },
        body: JSON.stringify({
          entry,
          progress: [{
            score: entry.score, round: entry.round, perfects: entry.perfect,
            bestCombo: entry.combo, accuracy: entry.acc, finished: true,
          }],
        }),
      });
      issuedRuns.delete(stats.runId);
      const entries = normalize(data.entries);
      writeJson(boardStorageKey(CACHE_KEY, currentPartition), entries);
      if (data.entryId) entry.id = data.entryId;
      return { entries, made: !!data.made, source: 'remote' };
    }
    const localKey = boardStorageKey(LOCAL_KEY, currentPartition);
    const entries = sortEntries([...normalize(readJson(localKey)), entry]).slice(0, MAX_ENTRIES);
    writeJson(localKey, entries);
    return { entries, made: entries.some(e => e.id === entry.id), source: 'local' };
  }

  // ---------- rendering ----------
  const MODE_LABEL = { classic: 'CLASSIC', endless: 'ENDLESS', zen: 'ZEN' };
  const MEDALS = ['🥇', '🥈', '🥉'];

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  function setStatus(text, kind = '') {
    if (!elStatus) return;
    elStatus.textContent = text;
    elStatus.className = 'board-status' + (kind ? ' ' + kind : '');
  }

  function render(entries) {
    if (!elPodium || !elList) return;
    elPodium.innerHTML = '';
    elList.innerHTML = '';

    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'board-empty';
      empty.textContent = 'NO SCORES YET — BE THE FIRST LEGEND ⏳';
      elList.appendChild(empty);
      return;
    }

    // top 3 podium, rendered 2nd–1st–3rd so gold sits in the middle
    const podiumOrder = [1, 0, 2];
    podiumOrder.forEach(rank => {
      const e = entries[rank];
      if (!e) return;
      const card = document.createElement('div');
      card.className = `podium-card p${rank + 1}` + (e.id && e.id === lastSubmittedId ? ' me' : '');
      card.innerHTML = `
        <div class="podium-medal">${MEDALS[rank]}</div>
        <div class="podium-name"></div>
        <div class="podium-score"></div>
        <div class="podium-meta"></div>
        <div class="podium-base">${rank + 1}</div>`;
      card.querySelector('.podium-name').textContent = e.name;
      if (e.hc) card.querySelector('.podium-name').append(hcBadge());
      card.querySelector('.podium-score').textContent = e.score.toLocaleString();
      card.querySelector('.podium-meta').textContent =
        `${MODE_LABEL[e.mode] || ''} · ${fmtDate(e.date)}`;
      if (e.id && e.id === lastSubmittedId) card.append(youBadge());
      elPodium.appendChild(card);
    });

    // ranks 4–20
    entries.slice(3).forEach((e, i) => {
      const li = document.createElement('li');
      li.className = 'board-row' + (e.id && e.id === lastSubmittedId ? ' me' : '');
      li.innerHTML = `
        <span class="row-rank">${i + 4}</span>
        <span class="row-name"></span>
        <span class="row-mode"></span>
        <span class="row-date"></span>
        <span class="row-score"></span>`;
      li.querySelector('.row-name').textContent = e.name;
      if (e.hc) li.querySelector('.row-name').append(hcBadge());
      li.querySelector('.row-mode').textContent = MODE_LABEL[e.mode] || '';
      li.querySelector('.row-date').textContent = fmtDate(e.date);
      li.querySelector('.row-score').textContent = e.score.toLocaleString();
      if (e.id && e.id === lastSubmittedId) li.querySelector('.row-name').append(youBadge());
      elList.appendChild(li);
    });

    if (window.anime) {
      anime({ targets: '.podium-card', translateY: [50, 0], opacity: [0, 1], delay: anime.stagger(120, { start: 100 }), duration: 700, easing: 'easeOutBack' });
      anime({ targets: '.board-row', translateX: [-30, 0], opacity: [0, 1], delay: anime.stagger(40, { start: 350 }), duration: 450, easing: 'easeOutCubic' });
    }

    const mine = elPodium.querySelector('.me') || elList.querySelector('.me');
    if (mine) setTimeout(() => mine.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 600);
  }

  function youBadge() {
    const b = document.createElement('span');
    b.className = 'you-badge';
    b.textContent = 'YOU';
    return b;
  }

  function hcBadge() {
    const b = document.createElement('span');
    b.className = 'hc-badge';
    b.textContent = '💀';
    b.title = 'Hardcore run';
    return b;
  }

  // ---------- show / refresh ----------
  async function show() {
    if (window.ChronosGame) window.ChronosGame.showScreen('board');
    setStatus('⏳ SYNCING WITH THE TIMELINE…');
    try {
      const { entries, source } = await loadBoard();
      render(entries);
      setStatus(source === 'remote'
        ? `⚡ LIVE GLOBAL BOARD · ${entries.length}/${MAX_ENTRIES} LEGENDS`
        : '📍 LOCAL BOARD — CLOUDFLARE BACKEND NOT CONFIGURED', source);
    } catch (err) {
      const cached = readJson(boardStorageKey(CACHE_KEY, currentPartition));
      if (cached) {
        render(normalize(cached));
        setStatus('⚠ OFFLINE — SHOWING LAST KNOWN STANDINGS', 'error');
      } else {
        render([]);
        setStatus('⚠ LEADERBOARD UNREACHABLE — CHECK CONNECTION', 'error');
      }
    }
  }

  // ---------- game-over qualification ----------
  async function onGameEnd(stats) {
    pendingStats = null;
    if (!elLbCheck) return;
    currentPartition = partitionForStats(stats);
    // GOD-mode (creator demo) runs are for fun only — never ranked
    if (stats.god) {
      elLbCheck.hidden = false;
      elLbCheck.className = 'lb-check';
      elLbCheck.textContent = '◈ DEMO RUN — NOT RANKED';
      return;
    }
    if (stats.daily && !stats.dailyOnline) {
      elLbCheck.hidden = false;
      elLbCheck.className = 'lb-check qualified';
      elLbCheck.textContent = `🗓️ OFFLINE DAILY — "${stats.riftName || 'Today'}" · LOCAL BEST SAVED`;
      return;
    }
    // Rival Code race: a private head-to-head — show the result, never ranked.
    if (stats.rival) {
      elLbCheck.hidden = false;
      elLbCheck.className = 'lb-check ' + (stats.beatRival ? 'qualified' : '');
      elLbCheck.textContent = stats.beatRival
        ? `🏁 YOU BEAT ${(stats.rivalName || 'RIVAL').toUpperCase()}! ${stats.score.toLocaleString()} vs ${(stats.rivalScore || 0).toLocaleString()}`
        : `🏁 ${(stats.rivalName || 'RIVAL').toUpperCase()} WINS — ${(stats.rivalScore || 0).toLocaleString()} vs ${stats.score.toLocaleString()}. Rematch!`;
      return;
    }
    // Zen has no lives, so scores are unbounded — keep it off the global board
    if (stats.mode === 'zen' || stats.score <= 0) { elLbCheck.hidden = true; return; }

    elLbCheck.hidden = false;
    elLbCheck.textContent = '⏳ CHECKING GLOBAL RANKS…';
    elLbCheck.className = 'lb-check';

    let entries;
    try { ({ entries } = await loadBoard(currentPartition)); }
    catch {
      entries = normalize(readJson(boardStorageKey(CACHE_KEY, currentPartition)));
      if (!entries.length && REMOTE) {
        elLbCheck.textContent = '⚠ COULD NOT REACH THE LEADERBOARD';
        elLbCheck.classList.add('error');
        return;
      }
    }

    const rank = entries.filter(e => e.score >= stats.score).length + 1;
    if (window.ChronosShare) window.ChronosShare.setRank(rank); // feeds the share card
    if (rank <= MAX_ENTRIES) {
      elLbCheck.textContent = `🏆 GLOBAL #${rank} — YOU MADE THE TOP 20!`;
      elLbCheck.classList.add('qualified');
      pendingStats = stats;
      openNameOverlay(stats, rank);
    } else {
      const cutoff = entries[MAX_ENTRIES - 1] ? entries[MAX_ENTRIES - 1].score : 0;
      elLbCheck.textContent = `GLOBAL RANK #${rank} — TOP 20 STARTS ABOVE ${cutoff.toLocaleString()}`;
    }
  }

  // ---------- name entry ----------
  function openNameOverlay(stats, rank) {
    $('nameScore').textContent = stats.score.toLocaleString();
    $('nameRank').textContent = '#' + rank;
    elNameError.hidden = true;
    elNameSubmit.disabled = false;
    elOverlay.hidden = false;

    // Auto-fill from the last name used on this device (if any)
    const saved = loadName();
    const known = !!saved;
    $('firstName').value = saved ? saved.first : '';
    $('lastName').value = saved ? saved.last : '';
    elNameSubmit.textContent = known ? 'SUBMIT SCORE' : 'ENGRAVE MY NAME';

    if (window.anime) {
      anime({ targets: '.name-card', scale: [0.7, 1], opacity: [0, 1], duration: 500, easing: 'easeOutBack' });
      anime({ targets: '.name-crown', translateY: [-30, 0], rotate: ['-20deg', '0deg'], duration: 700, easing: 'easeOutElastic(1, .5)' });
    }
    // If we know them, focus the submit so a returning player can one-tap;
    // otherwise focus the first field so they can type.
    setTimeout(() => (known ? elNameSubmit : $('firstName')).focus(), 300);
  }

  function closeNameOverlay() {
    elOverlay.hidden = true;
    elNameForm.reset();
  }

  // Cap each name part at 12 chars — benchmark "Raymond Ariwoola" fits comfortably
  const cleanName = (s) =>
    s.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);

  elNameForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingStats) { closeNameOverlay(); return; }

    const first = cleanName($('firstName').value);
    const last = cleanName($('lastName').value);
    if (!first || !last) {
      elNameError.textContent = 'Please enter both first and last name.';
      elNameError.hidden = false;
      return;
    }

    // Remember for next time (even if the submit later fails)
    saveName(first, last);

    const entry = {
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: `${first} ${last}`,
      score: pendingStats.score,
      mode: pendingStats.mode,
      round: pendingStats.round,
      combo: pendingStats.combo,
      acc: pendingStats.acc,
      perfect: pendingStats.perfect,
      hc: !!pendingStats.hc,
      // Full ruleset identity — keeps scores comparable across balance changes
      // and enables Daily/replay validation and assisted-run categorisation.
      gameVersion: pendingStats.gameVersion || null,
      rulesetVersion: pendingStats.rulesetVersion != null ? pendingStats.rulesetVersion : null,
      seed: pendingStats.seed || null,
      assists: pendingStats.assists || {},
      dailyDate: pendingStats.dailyDate || null,
      scope: pendingStats.daily ? 'daily' : 'standard',
      date: new Date().toISOString(),
    };

    elNameSubmit.disabled = true;
    elNameSubmit.textContent = 'ENGRAVING…';
    elNameError.hidden = true;

    try {
      const { made } = await submitEntry(entry, pendingStats);
      pendingStats = null;
      lastSubmittedId = made ? entry.id : null;
      closeNameOverlay();
      await show();
      if (!made) setStatus('⚠ EDGED OUT WHILE SUBMITTING — SO CLOSE!', 'error');
    } catch (err) {
      elNameSubmit.disabled = false;
      elNameSubmit.textContent = 'RETRY';
      elNameError.textContent = 'Could not reach the leaderboard. Check your connection and retry.';
      elNameError.hidden = false;
    }
  });

  $('nameSkip')?.addEventListener('click', () => {
    pendingStats = null;
    closeNameOverlay();
  });

  // ---------- navigation ----------
  $('menuBoardBtn')?.addEventListener('click', show);
  $('overBoardBtn')?.addEventListener('click', show);
  $('boardRefreshBtn')?.addEventListener('click', show);
  $('boardPlayBtn')?.addEventListener('click', () => {
    if (window.ChronosGame) {
      window.ChronosGame.refreshMenuStats();
      window.ChronosGame.showScreen('menu');
    }
  });

  window.ChronosLB = { onGameEnd, show, startRun, getDaily };
})();
