(function initChronosGhostUi(root) {
  'use strict';
  if (!root?.ChronosGhostClient) return;

  const apiBase = String(root.CHRONOS_LB_CONFIG?.apiBase || '').replace(/\/+$/, '');
  const client = new root.ChronosGhostClient.GhostChallengeClient({ baseUrl: apiBase });
  let activeGuest = null;

  function name() {
    try {
      const value = JSON.parse(localStorage.getItem('cs_player_name') || 'null');
      return value?.first ? `${value.first} ${value.last || ''}`.trim() : '';
    } catch { return ''; }
  }

  function cleanName(value) {
    return String(value || '').replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  }

  function resultFrom(record, stats) {
    if (stats) return { score: stats.score, round: stats.round, perfect: stats.perfect, combo: stats.combo, acc: stats.acc };
    let perfect = 0, hits = 0, streak = 0, combo = 1;
    for (const strike of record.strikes || []) {
      if (strike.kind === 'miss') streak = 0;
      else { hits++; streak++; combo = Math.max(combo, 1 + Math.floor(streak / 3)); if (strike.kind === 'perfect') perfect++; }
    }
    return {
      score: record.score || 0, round: record.rounds || 0, perfect, combo,
      acc: record.strikes?.length ? Math.round(hits / record.strikes.length * 100) : 0,
    };
  }

  function overlay() {
    const element = document.createElement('div');
    element.className = 'overlay ghost-cloud-overlay';
    element.innerHTML = '<div class="overlay-card ghost-cloud-card" role="dialog" aria-modal="true"><div class="ghost-cloud-body"></div></div>';
    element.addEventListener('click', (event) => { if (event.target === element) element.remove(); });
    document.body.appendChild(element);
    return element;
  }

  function button(label, className = 'btn-secondary') {
    const element = document.createElement('button');
    element.type = 'button'; element.className = className; element.textContent = label;
    return element;
  }

  function heading(host, eyebrow, title, note) {
    host.innerHTML = '';
    const eye = document.createElement('div'); eye.className = 'ghost-cloud-eyebrow'; eye.textContent = eyebrow;
    const h = document.createElement('h2'); h.textContent = title;
    const p = document.createElement('p'); p.className = 'ghost-cloud-note'; p.textContent = note;
    host.append(eye, h, p);
  }

  function addSummary(host, challenge) {
    const summary = document.createElement('div'); summary.className = 'ghost-cloud-summary';
    const score = challenge.host.result ? challenge.host.result.score.toLocaleString() : 'Hidden until finish';
    const rows = [
      ['HOST', challenge.host.name],
      ['CHALLENGE', `${challenge.mode.toUpperCase()} · ${challenge.difficulty.toUpperCase()}`],
      ['TARGET', score],
      ['CODE', challenge.code],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      const key = document.createElement('span'); key.textContent = label;
      const content = document.createElement('strong'); content.textContent = value;
      row.append(key, content); summary.appendChild(row);
    }
    host.appendChild(summary);
  }

  function openCreate(stats, record) {
    if (!record?.strikes?.length) return;
    const modal = overlay();
    const host = modal.querySelector('.ghost-cloud-body');
    heading(host, 'PLAY LATER · 7 DAYS', 'BEAT MY TIME', 'Create a short link that replays this exact run.');

    const player = document.createElement('input');
    player.className = 'ghost-cloud-input'; player.maxLength = 24; player.placeholder = 'Your name'; player.value = name();
    const hideLabel = document.createElement('label'); hideLabel.className = 'ghost-cloud-check';
    const hide = document.createElement('input'); hide.type = 'checkbox';
    const hideText = document.createElement('span'); hideText.textContent = 'Hide my final score until they finish';
    hideLabel.append(hide, hideText);
    const status = document.createElement('div'); status.className = 'ghost-cloud-status'; status.setAttribute('role', 'status');
    const actions = document.createElement('div'); actions.className = 'ghost-cloud-actions';
    const create = button('CREATE CHALLENGE', 'btn-primary');
    const close = button('CLOSE');
    actions.append(create, close); host.append(player, hideLabel, status, actions);
    close.addEventListener('click', () => modal.remove());
    create.addEventListener('click', async () => {
      const playerName = cleanName(player.value);
      if (!playerName) { status.textContent = 'Enter a name first.'; return; }
      create.disabled = true; create.textContent = 'CREATING…'; status.textContent = '';
      try {
        const created = await client.createFromReplay({
          name: playerName, record, result: resultFrom(record, stats), hideHostScore: hide.checked,
        });
        showInvite(modal, created.challenge);
      } catch (error) {
        create.disabled = false; create.textContent = 'RETRY'; status.textContent = message(error.code);
      }
    });
  }

  function showInvite(modal, challenge) {
    const host = modal.querySelector('.ghost-cloud-body');
    heading(host, 'CHALLENGE READY', 'SEND THE GHOST', 'The link contains only the public challenge code.');
    addSummary(host, challenge);
    const url = root.ChronosGhostClient.buildUrl(location.href, challenge.code);
    const link = document.createElement('input'); link.className = 'ghost-cloud-input ghost-link'; link.readOnly = true; link.value = url;
    const actions = document.createElement('div'); actions.className = 'ghost-cloud-actions';
    const copy = button('COPY LINK', 'btn-primary'); const share = button('SHARE'); const close = button('DONE');
    actions.append(copy, share, close); host.append(link, actions);
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); copy.textContent = 'COPIED ✓'; }
      catch { link.focus(); link.select(); copy.textContent = 'SELECTED'; }
    });
    share.addEventListener('click', async () => {
      if (navigator.share) await navigator.share({ title: 'Beat my Chronos Strike time', text: `Can you beat ${challenge.host.name}?`, url }).catch(() => {});
      else copy.click();
    });
    close.addEventListener('click', () => modal.remove());
  }

  function recordFrom(challenge) {
    if (!challenge.replay) return null;
    return {
      ...challenge.replay,
      name: challenge.host.name,
      hideScore: challenge.hideHostScore && challenge.state !== 'finished' && !challenge.host.result,
      score: challenge.host.result?.score || challenge.replay.score || 0,
      rounds: challenge.replay.rounds,
    };
  }

  function startGuest(challenge) {
    const record = recordFrom(challenge);
    if (!record) return false;
    activeGuest = { code: challenge.code };
    return root.ChronosGame?.startGhostChallenge(record, { cloud: true, code: challenge.code, seat: 'guest' });
  }

  async function openCode(code) {
    const modal = overlay();
    const host = modal.querySelector('.ghost-cloud-body');
    heading(host, 'CLOUD GHOST', 'LOADING CHALLENGE', 'Fetching the replay…');
    try {
      const recovered = await client.recover(code);
      renderChallenge(modal, recovered.challenge, recovered.session);
    } catch (error) {
      heading(host, 'CLOUD GHOST', 'CHALLENGE UNAVAILABLE', message(error.code));
      const close = button('CLOSE'); close.addEventListener('click', () => modal.remove()); host.appendChild(close);
    }
  }

  function renderChallenge(modal, challenge, session) {
    const host = modal.querySelector('.ghost-cloud-body');
    if (challenge.state === 'finished') return showResult(modal, challenge);
    heading(host, 'CLOUD GHOST', 'BEAT MY TIME', 'Race the same seed, targets, bosses, and modifiers.');
    addSummary(host, challenge);
    const status = document.createElement('div'); status.className = 'ghost-cloud-status'; status.setAttribute('role', 'status');
    const actions = document.createElement('div'); actions.className = 'ghost-cloud-actions';
    const close = button('CLOSE');

    if (session?.seat === 'host') {
      status.textContent = challenge.state === 'open' ? 'Waiting for your friend to accept.' : 'Your friend is playing now.';
      const copy = button('COPY LINK', 'btn-primary');
      copy.addEventListener('click', async () => {
        const url = root.ChronosGhostClient.buildUrl(location.href, challenge.code);
        await navigator.clipboard.writeText(url).catch(() => {}); copy.textContent = 'COPIED ✓';
      });
      actions.append(copy, close);
    } else if (session?.seat === 'guest') {
      const start = button('START RACE', 'btn-primary');
      start.addEventListener('click', () => { if (startGuest(challenge)) modal.remove(); });
      actions.append(start, close);
    } else {
      const player = document.createElement('input'); player.className = 'ghost-cloud-input'; player.maxLength = 24; player.placeholder = 'Your name'; player.value = name();
      const join = button('JOIN RACE', 'btn-primary');
      join.addEventListener('click', async () => {
        const playerName = cleanName(player.value);
        if (!playerName) { status.textContent = 'Enter a name first.'; return; }
        join.disabled = true; join.textContent = 'JOINING…';
        try {
          const joined = await client.join(challenge.code, playerName);
          if (startGuest(joined.challenge)) modal.remove();
        } catch (error) { join.disabled = false; join.textContent = 'RETRY'; status.textContent = message(error.code); }
      });
      host.appendChild(player); actions.append(join, close);
    }
    close.addEventListener('click', () => modal.remove());
    host.append(status, actions);
  }

  function showResult(modal, challenge) {
    const host = modal.querySelector('.ghost-cloud-body');
    const result = challenge.result;
    const won = result?.winner === 'guest';
    const title = result?.winner === 'tie' ? 'TIME LOCKED — TIE' : won ? 'YOU BEAT THE GHOST' : `${challenge.host.name.toUpperCase()} HOLDS THE LINE`;
    heading(host, 'CHALLENGE RESULT', title, 'No accounts, no cheat labels—just the final clock.');
    addSummary(host, challenge);
    if (challenge.guest?.result) {
      const guest = document.createElement('div'); guest.className = 'ghost-result-score';
      guest.textContent = `${challenge.guest.name}: ${challenge.guest.result.score.toLocaleString()} · ${challenge.guest.result.perfect} perfects`;
      host.appendChild(guest);
    }
    const close = button('DONE', 'btn-primary'); close.addEventListener('click', () => modal.remove()); host.appendChild(close);
  }

  async function onGameEnd(stats) {
    if (!activeGuest || !stats?.ghostChallenge?.cloud || stats.ghostChallenge.code !== activeGuest.code) return;
    try {
      client.code = activeGuest.code;
      const challenge = await client.finishGuest(resultFrom(null, stats));
      activeGuest = null;
      const modal = overlay(); showResult(modal, challenge);
    } catch (error) {
      const modal = overlay(); const host = modal.querySelector('.ghost-cloud-body');
      heading(host, 'CLOUD GHOST', 'RESULT NOT SENT', message(error.code));
      const retry = button('RETRY', 'btn-primary');
      retry.addEventListener('click', () => { modal.remove(); onGameEnd(stats); }); host.appendChild(retry);
    }
  }

  function message(code) {
    const messages = {
      offline: 'No connection. Local ghosts still work offline.', challenge_not_found: 'This challenge expired or was cancelled.',
      challenge_claimed: 'Another guest already claimed this challenge.', challenge_not_ready: 'The host replay is not ready yet.',
      rate_limited: 'Too many attempts. Wait a moment and retry.', ghosts_unconfigured: 'Cloud ghosts are not configured yet.',
    };
    return messages[code] || 'The timeline slipped. Please retry.';
  }

  root.ChronosGhost = { openCreate, openCode, onGameEnd };
  const incoming = root.ChronosGhostClient.codeFromUrl(location.href);
  if (incoming) setTimeout(() => openCode(incoming), 100);
  else if (incoming === '') setTimeout(() => {
    const modal = overlay(); const host = modal.querySelector('.ghost-cloud-body');
    heading(host, 'CLOUD GHOST', 'INVALID CHALLENGE LINK', 'Ask your friend to copy the full link again.');
    const close = button('CLOSE', 'btn-primary'); close.addEventListener('click', () => modal.remove()); host.appendChild(close);
  }, 100);
})(typeof globalThis !== 'undefined' ? globalThis : this);
