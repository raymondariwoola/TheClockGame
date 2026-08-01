(function initChronosClash(root) {
  'use strict';
  if (!root?.ChronosMultiplayerClient) return;
  const apiBase = String(root.CHRONOS_LB_CONFIG?.apiBase || '').replace(/\/+$/, '');
  const client = new root.ChronosMultiplayerClient.MultiplayerClient({ baseUrl: apiBase });
  const cards = root.ChronosShareCards;
  const reactions = root.ChronosMultiplayerClient.REACTIONS || {};
  const sabotages = root.ChronosMultiplayerClient.SABOTAGES || {};
  const handicaps = root.ChronosMultiplayerClient.HANDICAPS || { none: { label: 'Standard', description: 'No assistance.' } };
  const REACTION_MUTE_KEY = 'cs_clash_reactions_muted';
  const inviteCards = new Map();
  let modal = null; let active = null; let lastSeed = null; let progressFloor = 0; let localObjectives = null; let pendingReaction = null;

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
  function handicapSelect() {
    const field = document.createElement('select'); field.className = 'clash-input clash-handicap-select'; field.setAttribute('aria-label', 'Your voluntary skill handicap');
    for (const [id, item] of Object.entries(handicaps)) { const option = document.createElement('option'); option.value = id; option.textContent = `${item.label} · ${item.description}`; field.appendChild(option); }
    return field;
  }
  function actions(...buttons) { const row = document.createElement('div'); row.className = 'clash-actions'; row.append(...buttons); return row; }
  function status() { const value = document.createElement('div'); value.className = 'clash-status'; value.setAttribute('role', 'status'); return value; }
  function close() { modal?.remove(); modal = null; }
  function safeMessage(code) {
    return ({ offline: 'No connection. Single-player modes still work offline.', room_full: 'This room already has two players.',
      room_not_found: 'This Clash expired or was cancelled.', room_started: 'This Clash already started.',
      multiplayer_disabled: 'Live Clash is temporarily disabled.', multiplayer_unconfigured: 'Live Clash is not configured yet.',
      origin_forbidden: 'This game address is not allowed by the Worker.', rate_limited: 'Too many attempts. Wait a moment and retry.',
      reaction_rate_limited: 'Reactions need a short breather.', invalid_reaction: 'That reaction is unavailable.',
      invalid_message: 'Live server update required. Reactions are not available yet.',
      invalid_sabotage: 'That sabotage is unavailable.', sabotage_unavailable: 'Sabotage is available only during a live Clash.',
      no_shards: 'Land three Perfects in a row to earn a Time Shard.', sabotage_limit: 'Both Time Shards have already been spent.',
      sabotage_pending: 'Your rival already has a sabotage queued for their next round.', sabotage_too_late: 'The final round is already in motion. Save the shard for the rematch.',
      socket_failed: 'The live connection failed. Please retry.' })[code] || 'The timeline slipped. Please retry.';
  }
  function reactionsMuted() { try { return localStorage.getItem(REACTION_MUTE_KEY) === '1'; } catch { return false; } }
  function setReactionsMuted(value) { try { localStorage.setItem(REACTION_MUTE_KEY, value ? '1' : '0'); } catch {} }
  function reactionToast(text) {
    let value = document.getElementById('clashReactionToast');
    if (!value) { value = document.createElement('div'); value.id = 'clashReactionToast'; value.className = 'clash-reaction-toast'; value.setAttribute('role', 'status'); value.setAttribute('aria-live', 'polite'); document.body.appendChild(value); }
    value.textContent = text; value.classList.remove('show'); void value.offsetWidth; value.classList.add('show');
    clearTimeout(reactionToast.timer); reactionToast.timer = setTimeout(() => value.classList.remove('show'), 1800);
  }
  function sendReaction(id, controls) {
    const reaction = reactions[id]; if (!reaction) return;
    try {
      client.reaction(id); pendingReaction = id; reactionToast(`Sending ${reaction.emoji} ${reaction.label}`);
      for (const control of controls.querySelectorAll('[data-clash-reaction]')) control.disabled = true;
      setTimeout(() => { for (const control of controls.querySelectorAll('[data-clash-reaction]')) control.disabled = false; }, 1250);
    } catch (error) { reactionToast(safeMessage(error.code)); }
  }
  function reactionControls(compact = false) {
    const wrap = document.createElement('div'); wrap.className = `clash-reactions${compact ? ' compact' : ''}`;
    const label = document.createElement('span'); label.className = 'clash-reaction-label'; label.textContent = compact ? 'REACT' : 'QUICK REACTIONS'; wrap.appendChild(label);
    for (const [id, reaction] of Object.entries(reactions)) {
      const control = document.createElement('button'); control.type = 'button'; control.className = 'clash-reaction-btn'; control.dataset.clashReaction = id;
      control.setAttribute('aria-label', reaction.label); control.title = reaction.label; control.textContent = reaction.emoji;
      control.addEventListener('click', () => sendReaction(id, wrap)); wrap.appendChild(control);
    }
    const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'clash-reaction-mute';
    const paint = () => { const muted = reactionsMuted(); mute.textContent = muted ? '🔕 MUTED' : '🔔 ON'; mute.setAttribute('aria-pressed', muted ? 'true' : 'false'); };
    mute.addEventListener('click', () => { setReactionsMuted(!reactionsMuted()); paint(); }); paint(); wrap.appendChild(mute);
    return wrap;
  }
  function reactionDock() {
    let value = document.getElementById('clashReactionDock');
    if (!value) { value = reactionControls(true); value.id = 'clashReactionDock'; value.hidden = true; actionDock().appendChild(value); }
    return value;
  }
  function actionDock() {
    let value = document.getElementById('clashActionDock');
    if (!value) {
      value = document.createElement('div'); value.id = 'clashActionDock'; value.className = 'clash-action-dock'; value.hidden = true;
      value.setAttribute('aria-label', 'Clash reactions and sabotage'); value.addEventListener('click', (event) => event.stopPropagation());
      const strike = document.getElementById('strikeBtn'); strike?.insertAdjacentElement('afterend', value);
    }
    return value;
  }
  function objectiveResult(snapshot = localObjectives) {
    if (!snapshot?.cards?.length) return null;
    const value = document.createElement('div'); value.className = `clash-objective-result objective-theme-${snapshot.profile?.theme || 'standard'}`;
    const title = document.createElement('strong'); const done = snapshot.cards.filter((card) => card.completed).length;
    title.textContent = `🃏 OBJECTIVES · ${done}/${snapshot.cards.length} · ${snapshot.profile?.rank || 'Objective Scout'}`; value.appendChild(title);
    for (const card of snapshot.cards) { const row = document.createElement('span'); row.textContent = `${card.completed ? '✓' : '○'} ${card.title}`; value.appendChild(row); }
    return value;
  }
  function sabotageDock() {
    let value = document.getElementById('clashSabotageDock');
    if (value) return value;
    value = document.createElement('div'); value.id = 'clashSabotageDock'; value.className = 'clash-sabotage-dock'; value.hidden = true;
    const summary = document.createElement('button'); summary.type = 'button'; summary.className = 'clash-shard-summary'; summary.setAttribute('aria-expanded', 'false');
    const choices = document.createElement('div'); choices.className = 'clash-sabotage-choices'; choices.hidden = true;
    for (const [effect, item] of Object.entries(sabotages)) {
      const control = document.createElement('button'); control.type = 'button'; control.dataset.clashSabotage = effect;
      control.textContent = item.emoji; control.title = `${item.label}: ${item.description}`; control.setAttribute('aria-label', `${item.label}. ${item.description}`);
      control.addEventListener('click', () => { try { client.sabotage(effect); choices.hidden = true; summary.setAttribute('aria-expanded', 'false'); } catch (error) { reactionToast(safeMessage(error.code)); } });
      choices.appendChild(control);
    }
    summary.addEventListener('click', () => { choices.hidden = !choices.hidden; summary.setAttribute('aria-expanded', choices.hidden ? 'false' : 'true'); });
    value.append(summary, choices); actionDock().appendChild(value); return value;
  }
  function updateSabotageDock(room = client.room) {
    const value = sabotageDock(); if (!active) { value.hidden = true; return; }
    const own = room?.seats?.[active.seat]; const opponent = active.seat === 'host' ? 'guest' : 'host';
    const pending = (room?.sabotages || []).some((item) => item.by === active.seat && item.target === opponent && item.round > (own?.progress?.round || 0));
    const summary = value.querySelector('.clash-shard-summary'); const count = Math.max(0, Number(own?.shards) || 0);
    summary.textContent = `◆ ${count}`; summary.disabled = count < 1 || pending;
    summary.setAttribute('aria-label', `${count} Time Shards. ${pending ? 'A sabotage is already queued.' : count < 1 ? 'Land three Perfects in a row to earn a shard.' : 'Open sabotage choices.'}`);
    summary.title = pending ? 'A sabotage is already queued.' : count < 1 ? 'Land three Perfects in a row to earn a shard.' : 'Spend one shard on the rival’s next round.';
    for (const control of value.querySelectorAll('[data-clash-sabotage]')) control.disabled = count < 1 || pending;
    if (summary.disabled) { value.querySelector('.clash-sabotage-choices').hidden = true; summary.setAttribute('aria-expanded', 'false'); }
    value.hidden = false;
  }
  function roomRows(host, room) {
    const box = document.createElement('div'); box.className = 'clash-room';
    const seatRows = [['HOST', room.seats.host], ['GUEST', room.seats.guest]];
    for (const [label, seat] of seatRows) {
      const row = document.createElement('div'); const key = document.createElement('span'); key.textContent = label;
      const value = document.createElement('strong'); const handicap = handicaps[seat?.handicap] || handicaps.none;
      value.textContent = seat ? `${seat.name} · ${handicap.label}${seat.ready ? ' · ACCEPTED' : ''}` : 'Waiting…'; row.append(key, value); box.appendChild(row);
    }
    const meta = document.createElement('div'); const key = document.createElement('span'); key.textContent = 'FORMAT';
    const value = document.createElement('strong'); value.textContent = `${room.roundLimit || 10} ROUNDS · ${room.difficulty.toUpperCase()}`; meta.append(key, value); box.appendChild(meta);
    host.appendChild(box);
  }
  function gameUrl() { return `${location.origin}${location.pathname}`.replace(/index\.html?$/i, ''); }
  function directShareUrl(code) { return root.ChronosMultiplayerClient.buildUrl(location.href, code); }
  function shareUrl(code) { return cards && apiBase ? cards.shareUrl(apiBase, 'clash', code) : directShareUrl(code); }
  function prepareInvite(room) {
    if (!cards) return Promise.resolve({ portrait: null, preview: false });
    if (inviteCards.has(room.code)) return inviteCards.get(room.code);
    const pending = (async () => {
      const model = cards.clashInviteModel(room);
      const [portrait, social] = await Promise.all([cards.build(model, 'portrait'), cards.build(model, 'social')]);
      let preview = false; const session = client.session(room.code);
      if (session?.seat === 'host') {
        try { await client.uploadShareCard(social, room.code); preview = true; } catch { preview = false; }
      } else preview = true;
      return { portrait, preview };
    })().catch((error) => { inviteCards.delete(room.code); throw error; });
    inviteCards.set(room.code, pending); return pending;
  }
  function inviteText(room, url) {
    return `${room.seats.host.name} challenged you to a live ${room.difficulty} Chrono Clash: ${room.roundLimit || 10} rounds on the same clock.\n\n${url}`;
  }

  function openMenu() {
    const view = overlay(); const host = view.querySelector('.clash-body');
    heading(host, 'TWO PLAYERS · LIVE', 'CHRONO CLASH', 'Race the same ten rounds. Only resolved progress crosses the network.');
    const name = input('Your name', playerName()); const code = input('Room code'); code.autocapitalize = 'characters';
    const difficulty = document.createElement('select'); difficulty.className = 'clash-input'; difficulty.innerHTML = '<option value="normal">Normal</option><option value="hardcore">Hardcore · 2×</option>';
    const handicap = handicapSelect();
    const state = status(); const create = button('CREATE CLASH', true); const join = button('JOIN CODE'); const cancel = button('CLOSE');
    host.append(name, difficulty, handicap, code, state, actions(create, join, cancel)); cancel.addEventListener('click', close);
    create.addEventListener('click', async () => {
      if (!name.value.trim()) { state.textContent = 'Enter your name first.'; return; }
      create.disabled = true; create.textContent = 'CREATING…';
      try {
        const created = await client.create({ name: name.value, difficulty: difficulty.value, handicap: handicap.value });
        history.replaceState(null, '', directShareUrl(created.session.code));
        await client.connect(); showLobby(created.room);
      }
      catch (error) { create.disabled = false; create.textContent = 'RETRY'; state.textContent = safeMessage(error.code); }
    });
    join.addEventListener('click', () => joinCode(code.value, name.value, handicap.value));
  }

  async function joinCode(code, initialName = playerName(), initialHandicap = 'none') {
    const normalized = root.ChronosMultiplayerClient.normalizeCode(code);
    if (!normalized) return showError('INVALID ROOM CODE', 'Use the full eight-character code.');
    const view = overlay(); const host = view.querySelector('.clash-body');
    heading(host, 'LIVE INVITE', 'JOIN CHRONO CLASH', 'Claim the second seat, then both players press Ready.');
    const name = input('Your name', initialName); const handicap = handicapSelect(); handicap.value = root.ChronosMultiplayerClient.normalizeHandicap(initialHandicap);
    const state = status(); const join = button('JOIN CLASH', true); const cancel = button('CLOSE');
    host.append(name, handicap, state, actions(join, cancel)); cancel.addEventListener('click', close);
    join.addEventListener('click', async () => {
      if (!name.value.trim()) { state.textContent = 'Enter your name first.'; return; }
      join.disabled = true; join.textContent = 'JOINING…';
      try { const joined = await client.join({ code: normalized, name: name.value, handicap: handicap.value }); await client.connect(); showLobby(joined.room); }
      catch (error) { join.disabled = false; join.textContent = 'RETRY'; state.textContent = safeMessage(error.code); }
    });
  }

  function showLobby(room = client.room) {
    if (!room) return; const view = overlay(); const host = view.querySelector('.clash-body');
    heading(host, `ROOM ${room.code}`, room.state === 'waiting' ? 'ASSEMBLE THE TIMELINE' : 'CLASH IN PROGRESS', 'Capabilities stay in this tab; the shared link contains only the room code.');
    roomRows(host, room); const connection = status(); connection.textContent = client.connection === 'connected' ? '● Live connection ready' : 'Connecting…';
    const ready = button('READY', true); const copy = button('PREPARING CARD…'); const share = button('PREPARING CARD…'); const leave = button('LEAVE');
    const own = room.you || client.session(room.code)?.seat; const ownSeat = room.seats?.[own];
    ready.disabled = !room.seats.guest || ownSeat?.ready || room.state !== 'waiting'; ready.textContent = ownSeat?.ready ? 'HANDICAPS ACCEPTED ✓' : 'ACCEPT HANDICAPS & READY';
    ready.addEventListener('click', () => { try { client.ready(); ready.disabled = true; ready.textContent = 'HANDICAPS ACCEPTED ✓'; } catch (error) { connection.textContent = safeMessage(error.code); } });
    copy.disabled = true; share.disabled = true;
    const cardState = prepareInvite(room).then((artifacts) => {
      copy.disabled = false; share.disabled = false; copy.textContent = 'COPY INVITE'; share.textContent = 'SHARE CARD'; return artifacts;
    }).catch(() => { copy.disabled = false; copy.textContent = 'COPY INVITE'; share.textContent = 'CARD UNAVAILABLE'; return null; });
    copy.addEventListener('click', async () => {
      const artifacts = await cardState; const url = artifacts?.preview ? shareUrl(room.code) : directShareUrl(room.code);
      await navigator.clipboard.writeText(url).catch(() => {}); copy.textContent = 'COPIED ✓';
    });
    share.addEventListener('click', async () => {
      const artifacts = await cardState; if (!artifacts) return;
      const url = artifacts.preview ? shareUrl(room.code) : directShareUrl(room.code);
      try { await cards.share({ blob: artifacts.portrait, title: 'Chrono Clash', text: inviteText(room, url), url, filename: `chronos-clash-${room.code}.png` }); }
      catch { connection.textContent = 'Share failed. Copy the invite instead.'; }
    });
    leave.addEventListener('click', () => { try { client.forfeit(); } catch {} client.disconnect(); client.clearSession(room.code); active = null; hideHud(); close(); });
    host.append(reactionControls(), connection, actions(ready, copy, share, leave));
    if (room.state === 'countdown' || room.state === 'playing') startRoom(room);
    if (room.state === 'finished' || room.state === 'forfeit') showResult(room);
  }

  function startRoom(room) {
    if (!room?.seed || lastSeed === room.seed) return; lastSeed = room.seed;
    const seat = room.you || client.session(room.code)?.seat; if (!seat) return;
    const own = room.seats[seat]; progressFloor = own?.progress?.attempts || 0;
    active = { code: room.code, seat, matchNumber: room.matchNumber, suddenDeath: room.suddenDeath, seed: room.seed }; localObjectives = null;
    close(); actionDock().hidden = false; reactionDock().hidden = false; updateHud(room); root.ChronosGame?.startClash({
      code: room.code, seat, seed: room.seed, difficulty: room.difficulty, roundLimit: room.roundLimit,
      matchNumber: room.matchNumber, suddenDeath: room.suddenDeath,
      sabotages: (room.sabotages || []).filter((value) => value.target === seat),
      handicap: room.seats?.[seat]?.handicap || 'none',
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
    value.append(mine, rival); value.hidden = false; updateSabotageDock(room);
  }
  function hideHud() {
    const value = document.getElementById('clashHud'); if (value) value.hidden = true;
    const actions = document.getElementById('clashActionDock'); if (actions) actions.hidden = true;
    const reaction = document.getElementById('clashReactionDock'); if (reaction) reaction.hidden = true;
    const sabotage = document.getElementById('clashSabotageDock'); if (sabotage) sabotage.hidden = true;
  }

  function onProgress(value) {
    if (!active || value.attempts <= progressFloor) return;
    progressFloor = value.attempts;
    try { client.progress(value); } catch {}
    const room = client.room; if (room?.seats?.[active.seat]) room.seats[active.seat].progress = value; updateHud(room);
  }
  function onGameEnd(stats) {
    if (!active || !stats?.clash || stats.clashMeta?.code !== active.code) return;
    localObjectives = stats.objectives || null;
    const value = { score: stats.score, round: stats.round, perfect: stats.perfect, perfectStreak: 0, combo: stats.combo, acc: stats.acc, attempts: Math.max(progressFloor, stats.round) };
    progressFloor = value.attempts; try { client.finish(value); } catch (error) { return showError('RESULT NOT SENT', safeMessage(error.code)); }
    const view = overlay(); const host = view.querySelector('.clash-body'); heading(host, 'LIVE CLASH', 'WAITING FOR RIVAL', 'Your result is locked in. The room stays private.');
    const state = status(); state.textContent = client.connection === 'connected' ? '● Connected' : 'Reconnecting…'; const objectives = objectiveResult(); if (objectives) host.appendChild(objectives); host.appendChild(state);
  }
  function showResult(room) {
    const view = overlay(); const host = view.querySelector('.clash-body'); const seatId = client.session(room.code)?.seat; const won = room.result?.winner === seatId;
    const title = room.result?.winner == null ? 'TIMELINE DRAW' : won ? 'YOU WON THE CLASH' : 'RIVAL WON THE CLASH';
    heading(host, room.suddenDeath ? `SUDDEN DEATH ${room.suddenDeath}` : `MATCH ${room.matchNumber}`, title, room.result?.reason === 'disconnect' ? 'The other timeline disconnected.' : 'Final ordinary scores—no labels, no callouts.');
    roomRows(host, room); const scores = document.createElement('div'); scores.className = 'clash-final';
    scores.textContent = `${room.seats.host.name}: ${room.seats.host.progress.score.toLocaleString()} · ${room.seats.guest?.name || 'Guest'}: ${(room.seats.guest?.progress.score || 0).toLocaleString()}`;
    const storyModel = root.ChronosMultiplayerClient.rematchStory(room, seatId); const story = document.createElement('div'); story.className = 'clash-rematch-story';
    const storyTitle = document.createElement('strong'); storyTitle.textContent = storyModel.headline; const storyDetails = document.createElement('span'); storyDetails.textContent = storyModel.details.join(' · ');
    story.append(storyTitle, storyDetails);
    const rematch = button('REMATCH', true); const share = button('PREPARING CARD…'); const done = button('DONE'); share.disabled = true;
    rematch.disabled = !seatId; rematch.addEventListener('click', () => { try { client.rematch(); rematch.disabled = true; rematch.textContent = 'WAITING…'; } catch {} });
    const cardState = status(); cardState.textContent = 'Rendering result card…';
    const prepared = cards ? cards.build(cards.clashResultModel(room), 'portrait').then((blob) => { share.disabled = false; share.textContent = 'SHARE RESULT'; cardState.textContent = 'Result card ready.'; return blob; }).catch(() => { cardState.textContent = 'Result card unavailable.'; return null; }) : Promise.resolve(null);
    share.addEventListener('click', async () => {
      const blob = await prepared; if (!blob) return; const url = gameUrl();
      const text = `${room.seats.host.name} scored ${room.seats.host.progress.score.toLocaleString()}; ${room.seats.guest?.name || 'Guest'} scored ${(room.seats.guest?.progress.score || 0).toLocaleString()} in Chrono Clash.\n\n${url}`;
      try { const result = await cards.share({ blob, title: 'Chrono Clash Result', text, url, filename: `chronos-clash-result-${room.code}.png` }); if (result.action !== 'cancelled') cardState.textContent = 'Result shared.'; }
      catch { cardState.textContent = 'Share failed. Please try again.'; }
    });
    done.addEventListener('click', () => { active = null; localObjectives = null; hideHud(); close(); });
    const objectives = objectiveResult(); host.append(scores, story); if (objectives) host.appendChild(objectives); host.append(reactionControls(), cardState, actions(rematch, share, done));
  }
  function showError(title, note) { const view = overlay(); const host = view.querySelector('.clash-body'); heading(host, 'CHRONO CLASH', title, note); const done = button('CLOSE', true); done.addEventListener('click', close); host.appendChild(done); }
  function forfeit() { if (!active) return; try { client.forfeit(); } catch {} active = null; hideHud(); }

  client.on('snapshot', ({ room }) => { if (active) updateHud(room); else showLobby(room); });
  client.on('presence', ({ room }) => { if (room) { client.room = room; if (active) updateHud(room); else showLobby(room); } });
  client.on('rematch_state', ({ room }) => { if (room) showResult(room); });
  client.on('countdown', (payload) => { client.room = payload.room; startRoom(payload.room); });
  client.on('opponent_progress', ({ progress }) => updateHud(client.room, progress));
  client.on('opponent_finished', ({ progress }) => updateHud(client.room, progress));
  client.on('reaction', ({ seat, id }) => {
    if (reactionsMuted() || !reactions[id]) return;
    const name = client.room?.seats?.[seat]?.name || 'Rival'; const reaction = reactions[id]; reactionToast(`${name} · ${reaction.emoji} ${reaction.label}`);
  });
  client.on('reaction_ack', ({ id, delivered }) => {
    if (pendingReaction !== id || !reactions[id]) return; pendingReaction = null;
    const reaction = reactions[id]; reactionToast(delivered ? `Sent to rival · ${reaction.emoji} ${reaction.label}` : 'Rival is reconnecting · reaction not delivered');
  });
  client.on('shard_state', ({ room }) => { if (room) { client.room = room; updateSabotageDock(room); const own = room.seats?.[active?.seat]; if (own?.shards) reactionToast(`💠 Time Shard earned · ${own.shards}/2 ready`); } });
  client.on('sabotage', ({ sabotage, room }) => {
    if (room) client.room = room; updateSabotageDock(room);
    if (!active || !sabotage || !sabotages[sabotage.effect]) return;
    const item = sabotages[sabotage.effect];
    if (sabotage.target === active.seat) {
      root.ChronosGame?.queueSabotage(sabotage);
      reactionToast(`⚠ Rival queued ${item.label} for round ${sabotage.round}`);
    } else if (sabotage.by === active.seat) reactionToast(`💠 ${item.label} queued for rival round ${sabotage.round}`);
  });
  client.on('error', ({ code }) => {
    if (code === 'invalid_message' && !pendingReaction) return;
    if (['reaction_rate_limited', 'invalid_reaction', 'invalid_message', 'invalid_sabotage', 'sabotage_unavailable', 'no_shards', 'sabotage_limit', 'sabotage_pending', 'sabotage_too_late'].includes(code)) {
      if (code === 'invalid_message') pendingReaction = null;
      reactionToast(safeMessage(code));
    }
  });
  client.on('result', ({ room }) => { client.room = room; active = null; hideHud(); showResult(room); });
  client.on('expired', () => { active = null; hideHud(); showError('ROOM EXPIRED', 'Create a fresh Clash to play again.'); });
  client.on('connection', ({ connection }) => { document.body.classList.toggle('clash-reconnecting', connection === 'reconnecting'); });

  root.ChronosClash = { open: openMenu, onProgress, onGameEnd, forfeit };
  reactionDock(); sabotageDock(); hideHud();
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
