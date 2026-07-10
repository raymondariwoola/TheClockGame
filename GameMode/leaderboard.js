// Chronos Strike — global Top-20 leaderboard ("Hall of Time").
// Backed by a public GitHub Gist (see leaderboard-config.js). Falls back to a
// local, this-browser-only board when no gist is configured or when offline.

(() => {
  'use strict';

  const MAX_ENTRIES = 20;
  const cfg = window.CHRONOS_LB_CONFIG || {};
  const WORKER_URL = (cfg.workerUrl || '').trim().replace(/\/+$/, '');
  const GIST_ID = (cfg.gistId || '').trim();
  const GIST_FILE = cfg.gistFile || 'chronos-leaderboard.json';
  const TOKEN = Array.isArray(cfg.tokenParts) ? cfg.tokenParts.join('').trim() : '';
  // worker = Cloudflare proxy (token stays server-side); remote = direct gist
  // (token exposed in browser); local = this-browser-only fallback.
  const MODE = WORKER_URL ? 'worker' : (GIST_ID ? 'remote' : 'local');
  const REMOTE = MODE !== 'local';
  const LOCAL_KEY = 'cs_local_board';
  const CACHE_KEY = 'cs_board_cache';

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

  // ---------- storage ----------
  const readJson = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const writeJson = (key, v) => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full/blocked */ }
  };

  const sortEntries = (list) =>
    [...list].sort((a, b) => b.score - a.score || new Date(a.date) - new Date(b.date));

  const normalize = (list) =>
    sortEntries((Array.isArray(list) ? list : [])
      .filter(e => e && typeof e.score === 'number' && typeof e.name === 'string' && e.name.trim()))
      .slice(0, MAX_ENTRIES);

  // ---------- gist API ----------
  async function fetchRemote() {
    const headers = { Accept: 'application/vnd.github+json' };
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
    if (!res.ok) throw new Error('gist fetch failed: ' + res.status);
    const gist = await res.json();
    const file = gist.files && gist.files[GIST_FILE];
    if (!file) throw new Error(`"${GIST_FILE}" not found in gist`);
    let content = file.content;
    if (file.truncated) content = await (await fetch(file.raw_url)).text();
    const data = JSON.parse(content || '{"entries":[]}');
    return normalize(data.entries);
  }

  async function saveRemote(entries) {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: { [GIST_FILE]: { content: JSON.stringify({ entries }, null, 2) } },
      }),
    });
    if (!res.ok) throw new Error('gist save failed: ' + res.status);
  }

  // ---------- worker proxy (token stays server-side) ----------
  async function workerFetch() {
    const res = await fetch(WORKER_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('worker fetch failed: ' + res.status);
    const data = await res.json();
    return normalize(data.entries);
  }

  async function workerSubmit(entry) {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry }),
    });
    if (!res.ok) throw new Error('worker submit failed: ' + res.status);
    const data = await res.json();
    return { entries: normalize(data.entries), made: !!data.made, source: 'remote' };
  }

  async function loadBoard() {
    if (MODE === 'worker') {
      const entries = await workerFetch();
      writeJson(CACHE_KEY, entries);
      return { entries, source: 'remote' };
    }
    if (MODE === 'remote') {
      const entries = await fetchRemote();
      writeJson(CACHE_KEY, entries);
      return { entries, source: 'remote' };
    }
    return { entries: normalize(readJson(LOCAL_KEY)), source: 'local' };
  }

  // Re-fetch, merge, trim, save — so a concurrent submission elsewhere
  // isn't clobbered. Returns whether the entry survived the merge.
  async function submitEntry(entry) {
    if (MODE === 'worker') {
      const result = await workerSubmit(entry);
      writeJson(CACHE_KEY, result.entries);
      return result;
    }
    if (MODE === 'remote' && TOKEN) {
      let entries;
      try { entries = await fetchRemote(); }
      catch { entries = normalize(readJson(CACHE_KEY)); }
      entries = sortEntries([...entries, entry]).slice(0, MAX_ENTRIES);
      const made = entries.some(e => e.id === entry.id);
      if (made) await saveRemote(entries);
      writeJson(CACHE_KEY, entries);
      return { entries, made, source: 'remote' };
    }
    const entries = sortEntries([...normalize(readJson(LOCAL_KEY)), entry]).slice(0, MAX_ENTRIES);
    writeJson(LOCAL_KEY, entries);
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

  // ---------- show / refresh ----------
  async function show() {
    if (window.ChronosGame) window.ChronosGame.showScreen('board');
    setStatus('⏳ SYNCING WITH THE TIMELINE…');
    try {
      const { entries, source } = await loadBoard();
      render(entries);
      setStatus(source === 'remote'
        ? `⚡ LIVE GLOBAL BOARD · ${entries.length}/${MAX_ENTRIES} LEGENDS`
        : '📍 LOCAL BOARD — configure leaderboard-config.js for global scores', source);
    } catch (err) {
      const cached = readJson(CACHE_KEY);
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
    // Zen has no lives, so scores are unbounded — keep it off the global board
    if (stats.mode === 'zen' || stats.score <= 0) { elLbCheck.hidden = true; return; }

    elLbCheck.hidden = false;
    elLbCheck.textContent = '⏳ CHECKING GLOBAL RANKS…';
    elLbCheck.className = 'lb-check';

    let entries;
    try { ({ entries } = await loadBoard()); }
    catch {
      entries = normalize(readJson(CACHE_KEY));
      if (!entries.length && REMOTE) {
        elLbCheck.textContent = '⚠ COULD NOT REACH THE LEADERBOARD';
        elLbCheck.classList.add('error');
        return;
      }
    }

    const rank = entries.filter(e => e.score >= stats.score).length + 1;
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
    elNameSubmit.textContent = 'ENGRAVE MY NAME';
    elOverlay.hidden = false;
    if (window.anime) {
      anime({ targets: '.name-card', scale: [0.7, 1], opacity: [0, 1], duration: 500, easing: 'easeOutBack' });
      anime({ targets: '.name-crown', translateY: [-30, 0], rotate: ['-20deg', '0deg'], duration: 700, easing: 'easeOutElastic(1, .5)' });
    }
    setTimeout(() => $('firstName').focus(), 300);
  }

  function closeNameOverlay() {
    elOverlay.hidden = true;
    elNameForm.reset();
  }

  const cleanName = (s) =>
    s.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);

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

    const entry = {
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: `${first} ${last}`,
      score: pendingStats.score,
      mode: pendingStats.mode,
      round: pendingStats.round,
      combo: pendingStats.combo,
      acc: pendingStats.acc,
      date: new Date().toISOString(),
    };

    elNameSubmit.disabled = true;
    elNameSubmit.textContent = 'ENGRAVING…';
    elNameError.hidden = true;

    try {
      const { made } = await submitEntry(entry);
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

  window.ChronosLB = { onGameEnd, show };
})();
