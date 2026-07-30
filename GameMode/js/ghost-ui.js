(function initChronosGhostUi(root) {
  'use strict';
  if (!root?.ChronosGhostClient) return;

  const apiBase = String(root.CHRONOS_LB_CONFIG?.apiBase || '').replace(/\/+$/, '');
  const client = new root.ChronosGhostClient.GhostChallengeClient({ baseUrl: apiBase });
  const cards = root.ChronosShareCards;
  const inviteCards = new Map();
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

  function gameUrl() { return `${location.origin}${location.pathname}`.replace(/index\.html?$/i, ''); }
  function directUrl(code) { return root.ChronosGhostClient.buildUrl(location.href, code); }
  function cardUrl(code) { return cards && apiBase ? cards.shareUrl(apiBase, 'ghost', code) : directUrl(code); }
  function prepareInvite(challenge) {
    if (!cards) return Promise.resolve({ portrait: null, preview: false });
    if (inviteCards.has(challenge.code)) return inviteCards.get(challenge.code);
    const pending = (async () => {
      const model = cards.ghostInviteModel(challenge);
      const [portrait, social] = await Promise.all([cards.build(model, 'portrait'), cards.build(model, 'social')]);
      let preview = false;
      const session = client.session(challenge.code);
      if (session?.seat === 'host') {
        try { await client.uploadShareCard(social, challenge.code); preview = true; } catch { preview = false; }
      } else preview = true;
      return { portrait, preview };
    })().catch((error) => { inviteCards.delete(challenge.code); throw error; });
    inviteCards.set(challenge.code, pending); return pending;
  }
  function inviteText(challenge, url) {
    const target = challenge.hideHostScore ? 'The target is hidden until you finish.' : `Target: ${challenge.host.result?.score?.toLocaleString() || 0} points.`;
    return `${challenge.host.name} challenged you to a ${challenge.difficulty} ${challenge.mode} run in Chronos Strike. ${target}\n\n${url}`;
  }
  function addInviteActions(host, challenge, close) {
    const link = document.createElement('input'); link.className = 'ghost-cloud-input ghost-link'; link.readOnly = true; link.value = cardUrl(challenge.code);
    const state = document.createElement('div'); state.className = 'ghost-cloud-status'; state.setAttribute('role', 'status'); state.textContent = 'Rendering challenge card…';
    const actions = document.createElement('div'); actions.className = 'ghost-cloud-actions';
    const copy = button('PREPARING…', 'btn-primary'); const share = button('PREPARING…'); copy.disabled = true; share.disabled = true;
    actions.append(copy, share, close); host.append(link, state, actions);
    const ready = prepareInvite(challenge).then((artifacts) => {
      link.value = artifacts.preview ? cardUrl(challenge.code) : directUrl(challenge.code);
      copy.disabled = false; share.disabled = false; copy.textContent = 'COPY LINK'; share.textContent = 'SHARE CARD';
      state.textContent = artifacts.preview ? 'Image card and rich link preview are ready.' : 'Image card ready. Link preview upload was unavailable.';
      return artifacts;
    }).catch(() => {
      link.value = directUrl(challenge.code); copy.disabled = false; copy.textContent = 'COPY LINK'; share.textContent = 'CARD UNAVAILABLE';
      state.textContent = 'The link is ready, but the image could not be rendered.'; return null;
    });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link.value); copy.textContent = 'COPIED ✓'; }
      catch { link.focus(); link.select(); copy.textContent = 'SELECTED'; }
    });
    share.addEventListener('click', async () => {
      const artifacts = await ready; if (!artifacts) return;
      try {
        const result = await cards.share({ blob: artifacts.portrait, title: 'Beat my Chronos Strike time', text: inviteText(challenge, link.value), url: link.value, filename: `chronos-ghost-${challenge.code}.png` });
        if (result.action !== 'cancelled') state.textContent = result.file ? 'Challenge card shared.' : 'Challenge link shared. Save the card if you also want the image.';
      } catch { state.textContent = 'Share failed. Copy the rich link instead.'; }
    });
    close.addEventListener('click', () => host.closest('.overlay')?.remove());
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
    addInviteActions(host, challenge, button('DONE'));
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
      host.appendChild(status); addInviteActions(host, challenge, close); return;
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
    const state = document.createElement('div'); state.className = 'ghost-cloud-status'; state.setAttribute('role', 'status'); state.textContent = 'Rendering result card…';
    const share = button('PREPARING…', 'btn-primary'); share.disabled = true; const close = button('DONE');
    const ready = cards ? cards.build(cards.ghostResultModel(challenge), 'portrait').then((blob) => { share.disabled = false; share.textContent = 'SHARE RESULT'; state.textContent = 'Result card ready.'; return blob; }).catch(() => { state.textContent = 'Result card unavailable.'; return null; }) : Promise.resolve(null);
    share.addEventListener('click', async () => {
      const blob = await ready; if (!blob) return; const url = gameUrl();
      const text = `${challenge.host.name} scored ${challenge.host.result?.score?.toLocaleString() || 0}; ${challenge.guest?.name || 'Guest'} scored ${challenge.guest?.result?.score?.toLocaleString() || 0} in a Chronos Strike Ghost Challenge.\n\n${url}`;
      try { const result = await cards.share({ blob, title: 'Chronos Strike Ghost Result', text, url, filename: `chronos-ghost-result-${challenge.code}.png` }); if (result.action !== 'cancelled') state.textContent = 'Result shared.'; }
      catch { state.textContent = 'Share failed. Please try again.'; }
    });
    const actionRow = document.createElement('div'); actionRow.className = 'ghost-cloud-actions'; actionRow.append(share, close);
    close.addEventListener('click', () => modal.remove()); host.append(state, actionRow);
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
