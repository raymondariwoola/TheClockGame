(function initChronosShareCards(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosShareCards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createShareCardApi(root) {
  'use strict';

  const COLORS = {
    cyan: '#00f0ff', blue: '#2876ff', magenta: '#ff2bb5', violet: '#8b5cff',
    yellow: '#ffe066', green: '#2dffaa', red: '#ff4060', white: '#f7fbff',
    ink: '#dbe8ff', dim: 'rgba(219,232,255,0.62)', panel: 'rgba(8,14,34,0.84)',
  };
  const MODE_LABELS = { classic: 'CLASSIC', endless: 'ENDLESS', zen: 'ZEN' };

  function clean(value, fallback = '') {
    return String(value == null ? fallback : value).replace(/[<>\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  }
  function upper(value, fallback = '') { return clean(value, fallback).toUpperCase(); }
  function number(value) { return Math.max(0, Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0); }
  function score(value) { return number(value).toLocaleString('en-US'); }
  function mode(value) { return MODE_LABELS[value] || upper(value, 'CLASSIC'); }
  function difficulty(value) { return value === 'hardcore' ? 'HARDCORE' : 'NORMAL'; }
  function isDaily(challenge) {
    return String(challenge?.seed || '').startsWith('daily|') || String(challenge?.identity || '').includes('|daily|');
  }
  function winnerName(challenge) {
    const winner = challenge?.result?.winner;
    if (winner === 'guest') return challenge?.guest?.name || 'GUEST';
    if (winner === 'host') return challenge?.host?.name || 'HOST';
    return 'TIMELINE DRAW';
  }

  function ghostInviteModel(challenge) {
    const hidden = !!challenge?.hideHostScore;
    return {
      kind: 'ghost-invite', accent: COLORS.magenta,
      eyebrow: isDaily(challenge) ? 'DAILY RIFT CHALLENGE' : 'GHOST CHALLENGE',
      title: isDaily(challenge) ? 'BEAT MY DAILY RUN' : 'BEAT MY TIME',
      subtitle: 'SAME CLOCK. SAME TIMELINE. YOUR REFLEXES.',
      heroLabel: hidden ? 'SCORE TARGET' : 'TARGET TO BEAT',
      hero: hidden ? 'MYSTERY' : score(challenge?.host?.result?.score),
      heroNote: hidden ? 'REVEALED AFTER YOU FINISH' : 'POINTS',
      code: upper(challenge?.code),
      rows: [
        ['CHALLENGER', upper(challenge?.host?.name, 'ANONYMOUS')],
        ['MODE', `${mode(challenge?.mode)} · ${difficulty(challenge?.difficulty)}`],
        ['WINDOW', 'OPEN FOR 7 DAYS'],
      ],
      cta: 'CAN YOU OUTRUN THE GHOST?',
    };
  }

  function ghostResultModel(challenge) {
    const hostScore = number(challenge?.host?.result?.score);
    const guestScore = number(challenge?.guest?.result?.score);
    const winner = challenge?.result?.winner;
    return {
      kind: 'ghost-result', accent: winner === 'tie' ? COLORS.violet : COLORS.green,
      eyebrow: isDaily(challenge) ? 'DAILY RIFT RESULT' : 'GHOST RESULT',
      title: winner === 'tie' ? 'TIME LOCKED' : `${upper(winnerName(challenge))} WINS`,
      subtitle: 'ONE TIMELINE. TWO RUNS. FINAL VERDICT.',
      heroLabel: 'WINNING SCORE', hero: score(Math.max(hostScore, guestScore)), heroNote: winner === 'tie' ? 'DRAW' : 'POINTS',
      code: upper(challenge?.code),
      rows: [
        [upper(challenge?.host?.name, 'HOST'), score(hostScore)],
        [upper(challenge?.guest?.name, 'GUEST'), score(guestScore)],
        ['MODE', `${mode(challenge?.mode)} · ${difficulty(challenge?.difficulty)}`],
      ],
      cta: 'SETTLE THE NEXT TIMELINE',
    };
  }

  function clashInviteModel(room) {
    return {
      kind: 'clash-invite', accent: COLORS.cyan,
      eyebrow: 'LIVE TWO-PLAYER CHALLENGE', title: 'CHRONO CLASH',
      subtitle: 'SAME TEN ROUNDS. LIVE SCORES. ONE WINNER.',
      heroLabel: 'ROOM CODE', hero: upper(room?.code), heroNote: 'JOIN WHILE THE ROOM IS OPEN',
      code: upper(room?.code),
      rows: [
        ['CHALLENGER', upper(room?.seats?.host?.name, 'ANONYMOUS')],
        ['FORMAT', `${number(room?.roundLimit) || 10} ROUNDS · ${difficulty(room?.difficulty)}`],
        ['STATUS', room?.seats?.guest ? 'RIVAL CONNECTED' : 'WAITING FOR A RIVAL'],
      ],
      cta: 'ENTER THE CLASH',
    };
  }

  function clashResultModel(room) {
    const host = room?.seats?.host;
    const guest = room?.seats?.guest;
    const winner = room?.result?.winner;
    const winnerSeat = winner === 'host' ? host : winner === 'guest' ? guest : null;
    const story = room?.result?.story || {};
    const storyText = Number(story.suddenDeath || room?.suddenDeath) > 0 ? 'SUDDEN-DEATH FINISH'
      : Number(story.margin) > 0 ? `WIN BY ${score(story.margin)}` : `WIN ON ${upper(room?.result?.reason, 'TIEBREAK')}`;
    const changes = Math.max(0, number(story.leadChanges));
    return {
      kind: 'clash-result', accent: winnerSeat ? COLORS.yellow : COLORS.violet,
      eyebrow: room?.suddenDeath ? `SUDDEN DEATH ${number(room.suddenDeath)}` : `CHRONO CLASH · MATCH ${number(room?.matchNumber) || 1}`,
      title: winnerSeat ? `${upper(winnerSeat.name)} WINS` : 'TIMELINE DRAW',
      subtitle: 'THE LIVE CLOCK HAS SPOKEN.',
      heroLabel: winnerSeat ? 'WINNING SCORE' : 'FINAL SCORE',
      hero: score(winnerSeat?.progress?.score ?? host?.progress?.score), heroNote: winnerSeat ? 'POINTS' : 'DRAW',
      code: upper(room?.code),
      rows: [
        [upper(host?.name, 'HOST'), score(host?.progress?.score)],
        [upper(guest?.name, 'GUEST'), score(guest?.progress?.score)],
        ['STORY', `${storyText}${changes ? ` · ${changes} LEAD ${changes === 1 ? 'CHANGE' : 'CHANGES'}` : ''}`],
      ],
      cta: 'RUN IT BACK',
    };
  }

  function shareUrl(baseUrl, kind, codeValue) {
    if (!['ghost', 'clash'].includes(kind)) throw new Error('bad_share_kind');
    const url = new URL(String(baseUrl || ''));
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/s/${kind}/${encodeURIComponent(clean(codeValue))}`;
    url.search = ''; url.hash = '';
    return url.toString();
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
  }
  function fit(ctx, value, maxWidth, start, minimum, weight = 800, family = 'Orbitron, sans-serif') {
    let size = start; const text = clean(value);
    do { ctx.font = `${weight} ${size}px ${family}`; size -= 2; } while (ctx.measureText(text).width > maxWidth && size > minimum);
    return text;
  }
  function seedFor(value) {
    let seed = 2166136261;
    for (const char of clean(value)) { seed ^= char.charCodeAt(0); seed = Math.imul(seed, 16777619); }
    return seed >>> 0;
  }
  function random(seed) {
    let value = seed || 1;
    return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
  }
  function backdrop(ctx, width, height, model) {
    const gradient = ctx.createRadialGradient(width * 0.5, -height * 0.15, 20, width * 0.5, height * 0.52, height);
    gradient.addColorStop(0, '#182455'); gradient.addColorStop(0.38, '#091127'); gradient.addColorStop(1, '#03050c');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const rand = random(seedFor(`${model.kind}|${model.code}`));
    for (let i = 0; i < Math.round(width * height / 9000); i++) {
      const x = rand() * width, y = rand() * height, radius = 0.5 + rand() * 1.8;
      ctx.fillStyle = `rgba(${rand() > 0.7 ? '255,43,181' : '0,240,255'},${0.12 + rand() * 0.42})`;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(width * 0.78, height * 0.54); ctx.strokeStyle = 'rgba(0,240,255,0.075)';
    for (const ratio of [0.22, 0.27, 0.32]) { ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, height * ratio, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 24; i++) { const angle = i * Math.PI / 12; const r1 = height * 0.275, r2 = height * (i % 2 ? 0.292 : 0.305); ctx.beginPath(); ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1); ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = model.accent; ctx.globalAlpha = 0.3; ctx.lineWidth = Math.max(2, width / 450);
    roundRect(ctx, 24, 24, width - 48, height - 48, 30); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function brand(ctx, width, top, scale) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const gradient = ctx.createLinearGradient(0, top, 0, top + 70 * scale);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.55, COLORS.cyan); gradient.addColorStop(1, COLORS.violet);
    ctx.fillStyle = gradient; ctx.shadowColor = 'rgba(0,240,255,0.55)'; ctx.shadowBlur = 24 * scale;
    ctx.font = `900 ${66 * scale}px Orbitron, sans-serif`; ctx.fillText('CHRONOS', width / 2, top + 60 * scale); ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.dim; ctx.font = `600 ${20 * scale}px Rajdhani, sans-serif`; ctx.fillText('S T R I K E', width / 2, top + 94 * scale);
  }
  function chip(ctx, text, centerX, y, accent, scale = 1) {
    ctx.font = `700 ${18 * scale}px Orbitron, sans-serif`; const width = ctx.measureText(text).width + 46 * scale;
    ctx.fillStyle = 'rgba(7,13,31,0.82)'; ctx.strokeStyle = accent; ctx.lineWidth = 2 * scale;
    roundRect(ctx, centerX - width / 2, y, width, 42 * scale, 21 * scale); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.fillText(text, centerX, y + 28 * scale);
  }
  function row(ctx, x, y, width, height, label, value, accent, fontScale = 1) {
    ctx.fillStyle = COLORS.panel; ctx.strokeStyle = 'rgba(0,240,255,0.18)'; ctx.lineWidth = 2;
    roundRect(ctx, x, y, width, height, 16); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.dim; ctx.font = `700 ${18 * fontScale}px Orbitron, sans-serif`; ctx.fillText(clean(label), x + 24, y + height * 0.58);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.white; ctx.shadowColor = accent; ctx.shadowBlur = 8;
    const text = fit(ctx, value, width * 0.58, 25 * fontScale, 15 * fontScale, 800); ctx.fillText(text, x + width - 24, y + height * 0.61); ctx.shadowBlur = 0;
  }
  function drawPortrait(model) {
    const width = 1080, height = 1350; const canvas = root.document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); backdrop(ctx, width, height, model); brand(ctx, width, 60, 1.15);
    chip(ctx, model.eyebrow, width / 2, 220, model.accent, 1);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.white; ctx.shadowColor = model.accent; ctx.shadowBlur = 24;
    ctx.font = '900 58px Orbitron, sans-serif'; ctx.fillText(fit(ctx, model.title, width - 120, 58, 34, 900), width / 2, 344); ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.dim; ctx.font = '700 24px Rajdhani, sans-serif'; ctx.fillText(model.subtitle, width / 2, 392);
    ctx.fillStyle = 'rgba(6,11,27,0.88)'; ctx.strokeStyle = model.accent; ctx.lineWidth = 3; roundRect(ctx, 90, 445, 900, 330, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.dim; ctx.font = '700 20px Orbitron, sans-serif'; ctx.fillText(model.heroLabel, width / 2, 510);
    ctx.fillStyle = COLORS.white; ctx.shadowColor = model.accent; ctx.shadowBlur = 36;
    ctx.font = '900 118px Orbitron, sans-serif'; ctx.fillText(fit(ctx, model.hero, 790, 118, 56, 900), width / 2, 650); ctx.shadowBlur = 0;
    ctx.fillStyle = model.accent; ctx.font = '700 20px Orbitron, sans-serif'; ctx.fillText(model.heroNote, width / 2, 713);
    model.rows.slice(0, 3).forEach((item, index) => row(ctx, 90, 815 + index * 98, 900, 78, item[0], item[1], model.accent));
    ctx.textAlign = 'center'; ctx.fillStyle = model.accent; ctx.shadowColor = model.accent; ctx.shadowBlur = 15; ctx.font = '800 30px Rajdhani, sans-serif'; ctx.fillText(model.cta, width / 2, 1165); ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.ink; ctx.font = '600 24px Rajdhani, sans-serif'; ctx.fillText('raymondariwoola.github.io/TheClockGame/GameMode', width / 2, 1212);
    ctx.fillStyle = 'rgba(219,232,255,0.42)'; ctx.font = '600 18px Orbitron, sans-serif'; ctx.fillText(model.code ? `INVITE ${model.code}` : 'CHRONOS STRIKE', width / 2, 1262);
    return canvas;
  }
  function drawSocial(model) {
    const width = 1200, height = 630; const canvas = root.document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); backdrop(ctx, width, height, model);
    ctx.textAlign = 'left'; const gradient = ctx.createLinearGradient(74, 40, 520, 150); gradient.addColorStop(0, '#fff'); gradient.addColorStop(0.5, COLORS.cyan); gradient.addColorStop(1, COLORS.violet);
    ctx.fillStyle = gradient; ctx.shadowColor = 'rgba(0,240,255,0.5)'; ctx.shadowBlur = 20; ctx.font = '900 54px Orbitron, sans-serif'; ctx.fillText('CHRONOS', 72, 98); ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.dim; ctx.font = '700 18px Rajdhani, sans-serif'; ctx.fillText('S T R I K E', 76, 128);
    ctx.fillStyle = model.accent; ctx.font = '700 19px Orbitron, sans-serif'; ctx.fillText(model.eyebrow, 74, 190);
    ctx.fillStyle = COLORS.white; ctx.shadowColor = model.accent; ctx.shadowBlur = 18; ctx.font = '900 50px Orbitron, sans-serif'; ctx.fillText(fit(ctx, model.title, 650, 50, 30, 900), 72, 252); ctx.shadowBlur = 0;
    const leftRows = model.rows.slice(0, 2); leftRows.forEach((item, index) => row(ctx, 72, 300 + index * 82, 610, 64, item[0], item[1], model.accent, 0.82));
    ctx.fillStyle = model.accent; ctx.font = '800 23px Rajdhani, sans-serif'; ctx.fillText(model.cta, 74, 525);
    ctx.fillStyle = COLORS.dim; ctx.font = '600 18px Rajdhani, sans-serif'; ctx.fillText('PLAY FREE · NO ACCOUNT REQUIRED', 74, 559);
    ctx.fillStyle = 'rgba(5,10,24,0.9)'; ctx.strokeStyle = model.accent; ctx.lineWidth = 3; roundRect(ctx, 735, 105, 390, 420, 28); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.dim; ctx.font = '700 18px Orbitron, sans-serif'; ctx.fillText(model.heroLabel, 930, 190);
    ctx.fillStyle = COLORS.white; ctx.shadowColor = model.accent; ctx.shadowBlur = 32; ctx.font = '900 76px Orbitron, sans-serif'; ctx.fillText(fit(ctx, model.hero, 330, 76, 38, 900), 930, 310); ctx.shadowBlur = 0;
    ctx.fillStyle = model.accent; ctx.font = '700 17px Orbitron, sans-serif'; ctx.fillText(model.heroNote, 930, 356);
    if (model.code && model.hero !== model.code) { chip(ctx, model.code, 930, 420, model.accent, 0.82); }
    return canvas;
  }

  async function ensureFonts() {
    if (!root?.document?.fonts) return;
    try { await Promise.all([root.document.fonts.load('900 76px Orbitron'), root.document.fonts.load('800 30px Rajdhani')]); await root.document.fonts.ready; } catch {}
  }
  async function build(model, layout = 'portrait') {
    if (!root?.document) throw new Error('document_unavailable');
    await ensureFonts(); const canvas = layout === 'social' ? drawSocial(model) : drawPortrait(model);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('card_render_failed');
    return blob;
  }
  function makeFile(blob, filename) {
    try { return new root.File([blob], filename || 'chronos-strike.png', { type: 'image/png' }); } catch { return null; }
  }
  async function copyText(text) {
    try { await root.navigator?.clipboard?.writeText(text); return true; } catch { return false; }
  }
  function download(blob, filename = 'chronos-strike.png') {
    const url = root.URL.createObjectURL(blob); const link = root.document.createElement('a'); link.href = url; link.download = filename;
    root.document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }
  async function share({ blob, model, title, text, url, filename = 'chronos-strike.png' }) {
    const image = blob || await build(model, 'portrait'); const file = makeFile(image, filename); const fullText = url && !String(text).includes(url) ? `${text}\n\n${url}` : text;
    try {
      if (root.navigator?.share && file && root.navigator.canShare?.({ files: [file] })) {
        await root.navigator.share({ files: [file], title, text: fullText }); return { action: 'shared', file: true, blob: image };
      }
      if (root.navigator?.share) { await root.navigator.share({ title, text, url }); return { action: 'shared', file: false, blob: image }; }
      download(image, filename); const copied = await copyText(fullText); return { action: copied ? 'downloaded-copied' : 'downloaded', file: true, blob: image };
    } catch (error) {
      if (error?.name === 'AbortError') return { action: 'cancelled', file: false, blob: image };
      throw error;
    }
  }

  return {
    COLORS, ghostInviteModel, ghostResultModel, clashInviteModel, clashResultModel,
    shareUrl, build, share, download, copyText,
  };
});
