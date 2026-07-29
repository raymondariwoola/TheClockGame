(function initChronosClash(root) {
  'use strict';
  if (!root?.ChronosMultiplayerClient) return;
  const apiBase = String(root.CHRONOS_LB_CONFIG?.apiBase || '').replace(/\/+$/, '');
  const client = new root.ChronosMultiplayerClient.MultiplayerClient({ baseUrl: apiBase });
  let modal = null; let active = null; let lastSeed = null; let progressFloor = 0;

  function playerName() {
    try { const value = JSON.parse(localStorage.getItem('cs_player_name') || 'null'); return value?.first ? `${value.first} ${value.last || ''}`.trim() : ''; }
    catch { return ''; }
  }
  function overlay() {
    modal?.remove(); modal = document.createElement('div'); modal.className = 'overlay clash-overlay';
    modal.innerHTML = '<div class="overlay-card clash-card" role="dialog" aria-modal="true"><div class="clash-body"></div></div>';
    document.body.appendChild(modal); return modal;
  }
  function button(label, primary = false) { const value = document.createElement('button'); value.type = 'button'; value.className = primary ? 'btn-primary' : 'btn-secondary'; value.textContent = label; return value; }
  function heading(host, eyebrow, title, note) {
    host.innerHTML = ''; const eye = document.createElement('div'); eye.className = 'clash-eyebrow'; eye.textContent = eyebrow;
    const h = document.createElement('h2'); h.textContent = title; const p = document.createElement('p'); p.className = 'clash-note'; p.textContent = note;
    host.append(eye, h, p);
  }
  function input(placeholder, value = '') { const field = document.createElement('input'); field.className = 'clash-input'; field.placeholder = placeholder; field.maxLength = 24; field.value = value; return field; }
  function actions(...buttons) { const row = document.createElement('div'); row.className = 'clash-actions'; row.append(...buttons); return row; }
  function status() { const value = document.createElement('div'); value.className = 'clash-status'; value.setAttribute('role', 'status'); return value; }
  function close() { modal?.remove(); modal = null; }
  function safeMessage(code) {
    return ({ offline: 'No connection. Single-player modes still work offline.', room_full: 'This room already has two players.',
      room_not_found: 'This Clash expired or was cancelled.', room_started: 'This Clash already started.',
      multiplayer_disabled: 'Live Clash is temporarily disabled.', multiplayer_unconfigured: 'Live Clash is not configured yet.',
      origin_forbidden: 'This game address is not allowed by the Worker.', rate_limited: 'Too many attempts. Wait a moment and retry.',
      socket_failed: 'The live connection failed. Please retry.' })[code] || 'The timeline slipped. Please retry.';
  }
  function roomRows(host, room) {
    const box = document.createElement('div'); box.className = 'clash-room';
    const seatRows = [['HOST', room.seats.host], ['GUEST', room.seats.guest]];
    for (const [label, seat] of seatRows) {
      const row = document.createElement('div'); const key = document.createElement('span'); key.textContent = label;
      const value = document.createElement('strong'); value.textContent = seat ? `${seat.name}${seat.ready ? ' · READY' : ''}` : 'Waiting…'; row.append(key, value); box.appendChild(row);
    }
    const meta = document.createElement('div'); const key = document.createElement('span'); key.textContent = 'FORMAT';
    const value = document.createElement('strong'); value.textContent = `${room.roundLimit || 10} ROUNDS · ${room.difficulty.toUpperCase()}`; meta.append(key, value); box.appendChild(meta);
    host.appendChild(box);
  }
  function shareUrl(code) { return root.ChronosMultiplayerClient.buildUrl(location.href, code); }

  function openMenu() {
    const view = overlay(); const host = view.querySelector('.clash-body');
    heading(host, 'TWO PLAYERS · LIVE', 'CHRONO CLASH', 'Race the same ten rounds. Only resolved progress crosses the network.');
    const name = input('Your name', playerName()); const code = input('Room code'); code.autocapitalize = 'characters';
    const difficulty = document.createElement('select'); difficulty.className = 'clash-input'; difficulty.innerHTML = '<option value="normal">Normal</option><option value="hardcore">Hardcore · 2×</option>';
    const state = status(); const create = button('CREATE CLASH', true); const join = button('JOIN CODE'); const cancel = button('CLOSE');
    host.append(name, difficulty, code, state, actions(create, join, cancel)); cancel.addEventListener('click', close);
    create.addEventListener('click', async () => {
      if (!name.value.trim()) { state.textContent = 'Enter your name first.'; return; }
      create.disabled = true; create.textContent = 'CREATING…';
      try {
        const created = await client.create({ name: name.value, difficulty: difficulty.value });
        history.replaceState(null, '', shareUrl(created.session.code));
        await client.connect(); showLobby(created.room);
      }
      catch (error) { create.disabled = false; create.textContent = 'RETRY'; state.textContent = safeMessage(error.code); }
    });
    join.addEventListener('click', () => joinCode(code.value, name.value));
  }

  async function joinCode(code, initialName = playerName()) {
    const normalized = root.ChronosMultiplayerClient.normalizeCode(code);
    if (!normalized) return showError('INVALID ROOM CODE', 'Use the full eight-character code.');
    const view = overlay(); const host = view.querySelector('.clash-body');
    heading(host, 'LIVE INVITE', 'JOIN CHRONO CLASH', 'Claim the second seat, then both players press Ready.');
    const name = input('Your name', initialName); const state = status(); const join = button('JOIN CLASH', true); const cancel = button('CLOSE');
    host.append(name, state, actions(join, cancel)); cancel.addEventListener('click', close);
    join.addEventListener('click', async () => {
      if (!name.value.trim()) { state.textContent = 'Enter your name first.'; return; }
      join.disabled = true; join.textContent = 'JOINING…';
      try { const joined = await client.join({ code: normalized, name: name.value }); await client.connect(); showLobby(joined.room); }
      catch (error) { join.disabled = false; join.textContent = 'RETRY'; state.textContent = safeMessage(error.code); }
    });
  }

  function showLobby(room = client.room) {
    if (!room) return; const view = overlay(); const host = view.querySelector('.clash-body');
    heading(host, `ROOM ${room.code}`, room.state === 'waiting' ? 'ASSEMBLE THE TIMELINE' : 'CLASH IN PROGRESS', 'Capabilities stay in this tab; the shared link contains only the room code.');
    roomRows(host, room); const connection = status(); connection.textContent = client.connection === 'connected' ? '● Live connection ready' : 'Connecting…';
    const ready = button('READY', true); const copy = button('COPY INVITE'); const share = button('SHARE'); const leave = button('LEAVE');
    const own = room.you || client.session(room.code)?.seat; const ownSeat = room.seats?.[own];
    ready.disabled = !room.seats.guest || ownSeat?.ready || room.state !== 'waiting'; ready.textContent = ownSeat?.ready ? 'READY ✓' : 'READY';
    ready.addEventListener('click', () => { try { client.ready(); ready.disabled = true; ready.textContent = 'READY ✓'; } catch (error) { connection.textContent = safeMessage(error.code); } });
    copy.addEventListener('click', async () => { const url = shareUrl(room.code); await navigator.clipboard.writeText(url).catch(() => {}); copy.textContent = 'COPIED ✓'; });
    share.addEventListener('click', async () => { const url = shareUrl(room.code); if (navigator.share) await navigator.share({ title: 'Chrono Clash', text: 'Race me in Chronos Strike', url }).catch(() => {}); else copy.click(); });
    leave.addEventListener('click', () => { try { client.forfeit(); } catch {} client.disconnect(); client.clearSession(room.code); active = null; hideHud(); close(); });
    host.append(connection, actions(ready, copy, share, leave));
    if (room.state === 'countdown' || room.state === 'playing') startRoom(room);
    if (room.state === 'finished' || room.state === 'forfeit') showResult(room);
  }

  function startRoom(room) {
    if (!room?.seed || lastSeed === room.seed) return; lastSeed = room.seed;
    const seat = room.you || client.session(room.code)?.seat; if (!seat) return;
    const own = room.seats[seat]; progressFloor = own?.progress?.attempts || 0;
    active = { code: room.code, seat, matchNumber: room.matchNumber, suddenDeath: room.suddenDeath, seed: room.seed };
    close(); updateHud(room); root.ChronosGame?.startClash({
      code: room.code, seat, seed: room.seed, difficulty: room.difficulty, roundLimit: room.roundLimit,
      matchNumber: room.matchNumber, suddenDeath: room.suddenDeath,
    });
  }

  function hud() {
    let value = document.getElementById('clashHud');
    if (!value) {
      value = document.createElement('div'); value.id = 'clashHud'; value.className = 'clash-hud'; value.hidden = true;
      const center = document.querySelector('.hud-center'); center?.appendChild(value);
    }
    return value;
  }
  function updateHud(room, opponentProgress) {
    const value = hud(); if (!value || !active) return; const opponentId = active.seat === 'host' ? 'guest' : 'host';
    const you = room?.seats?.[active.seat]; const opponent = room?.seats?.[opponentId]; const remote = opponentProgress || opponent?.progress || {};
    value.innerHTML = '';
    const mine = document.createElement('button'); mine.type = 'button'; mine.className = 'clash-chip you'; mine.textContent = `YOU · ${you?.progress?.score ?? 0}`; mine.title = 'Open private options'; mine.addEventListener('click', () => root.ChronosGame?.openCheats());
    const rival = document.createElement('div'); rival.className = 'clash-chip rival'; rival.textContent = `${opponent?.name || 'RIVAL'} · ${remote.score ?? 0} · R${remote.round ?? 0}`;
    const dot = document.createElement('span'); dot.className = `clash-dot ${opponent?.connected ? 'online' : ''}`; rival.prepend(dot);
    value.append(mine, rival); value.hidden = false;
  }
  function hideHud() { const value = document.getElementById('clashHud'); if (value) value.hidden = true; }

  function onProgress(value) {
    if (!active || value.attempts <= progressFloor) return;
    progressFloor = value.attempts;
    try { client.progress(value); } catch {}
    const room = client.room; if (room?.seats?.[active.seat]) room.seats[active.seat].progress = value; updateHud(room);
  }
  function onGameEnd(stats) {
    if (!active || !stats?.clash || stats.clashMeta?.code !== active.code) return;
    const value = { score: stats.score, round: stats.round, perfect: stats.perfect, combo: stats.combo, acc: stats.acc, attempts: Math.max(progressFloor, stats.round) };
    progressFloor = value.attempts; try { client.finish(value); } catch (error) { return showError('RESULT NOT SENT', safeMessage(error.code)); }
    const view = overlay(); const host = view.querySelector('.clash-body'); heading(host, 'LIVE CLASH', 'WAITING FOR RIVAL', 'Your result is locked in. The room stays private.');
    const state = status(); state.textContent = client.connection === 'connected' ? '● Connected' : 'Reconnecting…'; host.appendChild(state);
  }
  function showResult(room) {
    const view = overlay(); const host = view.querySelector('.clash-body'); const seatId = client.session(room.code)?.seat; const won = room.result?.winner === seatId;
    const title = room.result?.winner == null ? 'TIMELINE DRAW' : won ? 'YOU WON THE CLASH' : 'RIVAL WON THE CLASH';
    heading(host, room.suddenDeath ? `SUDDEN DEATH ${room.suddenDeath}` : `MATCH ${room.matchNumber}`, title, room.result?.reason === 'disconnect' ? 'The other timeline disconnected.' : 'Final ordinary scores—no labels, no callouts.');
    roomRows(host, room); const scores = document.createElement('div'); scores.className = 'clash-final';
    scores.textContent = `${room.seats.host.name}: ${room.seats.host.progress.score.toLocaleString()} · ${room.seats.guest?.name || 'Guest'}: ${(room.seats.guest?.progress.score || 0).toLocaleString()}`;
    const rematch = button('REMATCH', true); const done = button('DONE');
    rematch.disabled = !seatId; rematch.addEventListener('click', () => { try { client.rematch(); rematch.disabled = true; rematch.textContent = 'WAITING…'; } catch {} });
    done.addEventListener('click', () => { active = null; hideHud(); close(); }); host.append(scores, actions(rematch, done));
  }
  function showError(title, note) { const view = overlay(); const host = view.querySelector('.clash-body'); heading(host, 'CHRONO CLASH', title, note); const done = button('CLOSE', true); done.addEventListener('click', close); host.appendChild(done); }
  function forfeit() { if (!active) return; try { client.forfeit(); } catch {} active = null; hideHud(); }

  client.on('snapshot', ({ room }) => { if (active) updateHud(room); else showLobby(room); });
  client.on('presence', ({ room }) => { if (room) { client.room = room; if (active) updateHud(room); else showLobby(room); } });
  client.on('rematch_state', ({ room }) => { if (room) showResult(room); });
  client.on('countdown', (payload) => { client.room = payload.room; startRoom(payload.room); });
  client.on('opponent_progress', ({ progress }) => updateHud(client.room, progress));
  client.on('opponent_finished', ({ progress }) => updateHud(client.room, progress));
  client.on('result', ({ room }) => { client.room = room; active = null; hideHud(); showResult(room); });
  client.on('expired', () => { active = null; hideHud(); showError('ROOM EXPIRED', 'Create a fresh Clash to play again.'); });
  client.on('connection', ({ connection }) => { document.body.classList.toggle('clash-reconnecting', connection === 'reconnecting'); });

  root.ChronosClash = { open: openMenu, onProgress, onGameEnd, forfeit };
  document.getElementById('clashOpenBtn')?.addEventListener('click', openMenu);
  const incoming = root.ChronosMultiplayerClient.codeFromUrl(location.href);
  if (incoming) setTimeout(async () => {
    try {
      const recovered = await client.recover(incoming);
      if (!recovered.session) joinCode(incoming);
      else if (active) updateHud(client.room || recovered.room);
      else showLobby(recovered.room);
    }
    catch (error) { error.code === 'session_missing' ? joinCode(incoming) : showError('CLASH UNAVAILABLE', safeMessage(error.code)); }
  }, 120);
  else if (incoming === '') setTimeout(() => showError('INVALID ROOM CODE', 'Ask your friend to copy the full link again.'), 120);
})(typeof globalThis !== 'undefined' ? globalThis : this);
