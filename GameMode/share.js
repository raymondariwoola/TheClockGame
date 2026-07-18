// Chronos Strike — shareable score card.
// Renders the finished run as a poster-style PNG on a canvas, then hands it to
// the native share sheet (Web Share Level 2) with text + link, falling back to
// download / copy on platforms without file sharing.
//
// Fully additive: game.js calls setStats() at game over, leaderboard.js calls
// setRank() once the global rank is known. Nothing else depends on this file.

(() => {
  'use strict';

  const W = 1080, H = 1350;
  const $ = (id) => document.getElementById(id);

  let stats = null;       // run stats from game.js
  let globalRank = null;  // global placement from leaderboard.js (if any)
  let blob = null;        // generated PNG, ready before share() is invoked
  let objUrl = null;

  // Where the game lives — derived, so it works on any host/path.
  const GAME_URL = (location.origin + location.pathname).replace(/index\.html?$/i, '');
  const MODE_LABEL = { classic: 'CLASSIC', endless: 'ENDLESS', zen: 'ZEN' };

  const C = {
    cyan: '#00f0ff', magenta: '#ff2bb5', violet: '#8b5cff',
    yellow: '#ffe066', green: '#2dffaa', red: '#ff4060',
    ink: '#e6efff', dim: 'rgba(230,239,255,0.55)',
  };
  const RANK_COLOR = { S: C.yellow, A: C.cyan, B: C.green, C: C.violet, D: C.dim, F: C.red };

  // ---------- public API ----------
  function setStats(s) { stats = s; globalRank = null; blob = null; }
  function setRank(r) { globalRank = r; }

  function playerName() {
    try {
      const n = JSON.parse(localStorage.getItem('cs_player_name') || 'null');
      if (n && n.first) return `${n.first} ${n.last || ''}`.trim().toUpperCase();
    } catch (e) {}
    return 'ANONYMOUS';
  }

  // ---------- canvas helpers ----------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Manual letter-spacing (ctx.letterSpacing isn't universally supported).
  function spacedWidth(ctx, text, sp) {
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + sp;
    return w - sp;
  }
  function spacedText(ctx, text, cx, y, sp) {
    const prev = ctx.textAlign;
    ctx.textAlign = 'left';
    let x = cx - spacedWidth(ctx, text, sp) / 2;
    for (const ch of text) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + sp;
    }
    ctx.textAlign = prev;
  }
  function glow(ctx, color, amount) { ctx.shadowColor = color; ctx.shadowBlur = amount; }
  function noGlow(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

  async function ensureFonts() {
    if (!document.fonts) return;
    try {
      await Promise.all([
        document.fonts.load('900 160px Orbitron'),
        document.fonts.load('800 44px Orbitron'),
        document.fonts.load('700 46px Orbitron'),
        document.fonts.load('700 24px Orbitron'),
        document.fonts.load('500 28px Rajdhani'),
        document.fonts.load('700 30px Rajdhani'),
      ]);
      await document.fonts.ready;
    } catch (e) { /* fall back to system fonts */ }
  }

  // ---------- the card ----------
  function drawCard() {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    const score = stats ? stats.score : 0;
    const mode = (stats && MODE_LABEL[stats.mode]) || 'CLASSIC';
    const hc = !!(stats && stats.hc);
    const isGod = !!(stats && stats.god);
    const letter = (stats && stats.rankLetter) || 'F';

    // ---- background ----
    const bg = ctx.createRadialGradient(W / 2, -160, 60, W / 2, H * 0.5, H);
    bg.addColorStop(0, '#131a3c');
    bg.addColorStop(0.38, '#0a0e22');
    bg.addColorStop(1, '#04050d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // starfield
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const r = Math.random() * 1.9 + 0.4;
      const hue = 180 + Math.random() * 120;
      ctx.fillStyle = `hsla(${hue}, 90%, 72%, ${0.15 + Math.random() * 0.5})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // faint clock motif behind the content
    ctx.save();
    ctx.translate(W / 2, 700);
    ctx.strokeStyle = 'rgba(0,240,255,0.07)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 430, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 388, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 - 90) * Math.PI / 180;
      const big = i % 5 === 0;
      ctx.strokeStyle = `rgba(0,240,255,${big ? 0.14 : 0.06})`;
      ctx.lineWidth = big ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (big ? 350 : 366), Math.sin(a) * (big ? 350 : 366));
      ctx.lineTo(Math.cos(a) * 384, Math.sin(a) * 384);
      ctx.stroke();
    }
    ctx.restore();

    // outer frame
    ctx.strokeStyle = 'rgba(0,240,255,0.35)';
    ctx.lineWidth = 3;
    rr(ctx, 24, 24, W - 48, H - 48, 34);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // ---- wordmark ----
    const titleGrad = ctx.createLinearGradient(0, 80, 0, 160);
    titleGrad.addColorStop(0, '#ffffff');
    titleGrad.addColorStop(0.55, C.cyan);
    titleGrad.addColorStop(1, C.violet);
    ctx.font = '900 86px Orbitron, sans-serif';
    ctx.fillStyle = titleGrad;
    glow(ctx, 'rgba(0,240,255,0.55)', 34);
    spacedText(ctx, 'CHRONOS', W / 2, 148, 12);
    noGlow(ctx);

    ctx.font = '500 26px Rajdhani, sans-serif';
    ctx.fillStyle = C.dim;
    spacedText(ctx, 'STRIKE', W / 2, 192, 16);

    // ---- mode chip ----
    const chipText = hc ? `${mode}  ·  HARDCORE` : mode;
    ctx.font = '700 24px Orbitron, sans-serif';
    const chipW = spacedWidth(ctx, chipText, 5) + 64;
    const chipX = (W - chipW) / 2, chipY = 232, chipH = 54;
    ctx.fillStyle = hc ? 'rgba(255,64,96,0.14)' : 'rgba(0,240,255,0.1)';
    ctx.strokeStyle = hc ? C.red : 'rgba(0,240,255,0.5)';
    ctx.lineWidth = 2;
    rr(ctx, chipX, chipY, chipW, chipH, 27);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = hc ? C.red : C.cyan;
    glow(ctx, hc ? C.red : C.cyan, 14);
    spacedText(ctx, chipText, W / 2, chipY + 36, 5);
    noGlow(ctx);

    // ---- player ----
    ctx.font = '700 44px Orbitron, sans-serif';
    ctx.fillStyle = '#fff';
    glow(ctx, 'rgba(255,255,255,0.35)', 18);
    let name = playerName();
    while (spacedWidth(ctx, name, 2) > W - 160 && name.length > 4) name = name.slice(0, -1);
    spacedText(ctx, name, W / 2, 372, 2);
    noGlow(ctx);

    // ---- score ----
    ctx.font = '700 22px Orbitron, sans-serif';
    ctx.fillStyle = C.dim;
    spacedText(ctx, 'FINAL SCORE', W / 2, 438, 9);

    const scoreStr = score.toLocaleString();
    const sGrad = ctx.createLinearGradient(0, 470, 0, 590);
    sGrad.addColorStop(0, '#ffffff');
    sGrad.addColorStop(0.6, C.cyan);
    sGrad.addColorStop(1, '#0066ff');
    let sSize = 160;
    ctx.font = `900 ${sSize}px Orbitron, sans-serif`;
    while (ctx.measureText(scoreStr).width > W - 140 && sSize > 70) {
      sSize -= 8;
      ctx.font = `900 ${sSize}px Orbitron, sans-serif`;
    }
    ctx.fillStyle = sGrad;
    glow(ctx, 'rgba(0,240,255,0.7)', 46);
    ctx.fillText(scoreStr, W / 2, 580);
    noGlow(ctx);

    // ---- rank badge ----
    const rc = RANK_COLOR[letter] || C.dim;
    const bx = W / 2, by = 706, br = 62;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4,5,13,0.7)';
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = rc;
    glow(ctx, rc, 26); ctx.stroke(); noGlow(ctx);
    ctx.font = '900 62px Orbitron, sans-serif';
    ctx.fillStyle = rc;
    ctx.textBaseline = 'middle';
    glow(ctx, rc, 20);
    ctx.fillText(letter, bx, by + 4);
    noGlow(ctx);
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 18px Orbitron, sans-serif';
    ctx.fillStyle = C.dim;
    spacedText(ctx, 'RANK', bx, by + br + 30, 6);

    // ---- global placement ----
    let gText, gColor;
    if (isGod) { gText = 'DEMO RUN · NOT RANKED'; gColor = C.dim; }
    else if (globalRank && globalRank <= 20) { gText = `GLOBAL #${globalRank} — TOP 20`; gColor = C.yellow; }
    else if (globalRank) { gText = `GLOBAL #${globalRank}`; gColor = C.cyan; }
    else { gText = 'HALL OF TIME'; gColor = C.violet; }
    ctx.font = '800 34px Orbitron, sans-serif';
    ctx.fillStyle = gColor;
    glow(ctx, gColor, 18);
    spacedText(ctx, gText, W / 2, 860, 4);
    noGlow(ctx);

    // ---- stat tiles ----
    const tiles = [
      [String(stats ? stats.perfect : 0), 'PERFECT'],
      ['x' + (stats ? stats.combo : 1), 'COMBO'],
      [String(stats ? stats.round : 1), (stats && stats.mode === 'endless') ? 'WAVE' : 'ROUND'],
      [(stats ? stats.acc : 0) + '%', 'ACCURACY'],
    ];
    const gap = 20, tw = (W - 120 - gap * 3) / 4, th = 148, ty = 918;
    tiles.forEach((t, i) => {
      const tx = 60 + i * (tw + gap);
      const g = ctx.createLinearGradient(tx, ty, tx, ty + th);
      g.addColorStop(0, 'rgba(0,240,255,0.09)');
      g.addColorStop(1, 'rgba(139,92,255,0.04)');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(0,240,255,0.28)';
      ctx.lineWidth = 2;
      rr(ctx, tx, ty, tw, th, 18);
      ctx.fill(); ctx.stroke();

      ctx.font = '800 42px Orbitron, sans-serif';
      ctx.fillStyle = '#fff';
      glow(ctx, 'rgba(0,240,255,0.5)', 14);
      ctx.fillText(t[0], tx + tw / 2, ty + 74);
      noGlow(ctx);

      ctx.font = '700 16px Orbitron, sans-serif';
      ctx.fillStyle = C.dim;
      spacedText(ctx, t[1], tx + tw / 2, ty + 112, 3);
    });

    // ---- footer ----
    ctx.font = '700 32px Rajdhani, sans-serif';
    ctx.fillStyle = C.magenta;
    glow(ctx, C.magenta, 16);
    spacedText(ctx, "THINK YOU'RE FASTER?", W / 2, 1170, 3);
    noGlow(ctx);

    ctx.font = '500 24px Rajdhani, sans-serif';
    ctx.fillStyle = C.ink;
    let url = GAME_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    spacedText(ctx, url, W / 2, 1218, 1);

    const d = new Date();
    ctx.font = '500 20px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(230,239,255,0.4)';
    spacedText(ctx, d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      W / 2, 1262, 2);

    return cv;
  }

  function shareText() {
    const mode = (stats && MODE_LABEL[stats.mode]) || 'CLASSIC';
    const hc = stats && stats.hc ? ' 💀 HARDCORE' : '';
    const score = stats ? stats.score.toLocaleString() : '0';
    const lines = [`⚡ I scored ${score} on CHRONOS STRIKE — ${mode}${hc}`];
    if (stats && stats.god) lines.push('(demo run — not ranked)');
    else if (globalRank && globalRank <= 20) lines.push(`🏆 Global #${globalRank} — Top 20 in the Hall of Time!`);
    else if (globalRank) lines.push(`Global rank #${globalRank}`);
    if (stats) lines.push(`Rank ${stats.rankLetter} · ${stats.perfect} perfect · ×${stats.combo} combo`);
    lines.push('');
    lines.push(`Think you're faster? ⏱️ ${GAME_URL}`);
    return lines.join('\n');
  }

  // ---------- flow ----------
  async function build() {
    await ensureFonts();
    const cv = drawCard();
    blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    if (objUrl) URL.revokeObjectURL(objUrl);
    objUrl = URL.createObjectURL(blob);
    return objUrl;
  }

  function hint(msg, kind) {
    const el = $('shareHint');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'share-hint' + (kind ? ' ' + kind : '');
  }

  async function open() {
    const ov = $('shareOverlay'), img = $('sharePreview'), btn = $('shareNativeBtn');
    if (!ov || !img) return;
    // If the player hasn't set a name yet, capture it first so the card isn't
    // anonymous — they can tap Share again after saving.
    if (window.ChronosIdentity && !window.ChronosIdentity.has()) { window.ChronosIdentity.open(); return; }
    hint('Rendering your card…');
    img.removeAttribute('src');
    ov.hidden = false;
    try {
      img.src = await build();
      hint('');
    } catch (e) {
      hint('Could not render the card.', 'error');
      return;
    }
    // Only offer the native sheet where it can actually take the image.
    const canFiles = canShareFiles();
    if (btn) btn.hidden = !navigator.share;
    if (navigator.share && !canFiles) hint('Your browser shares the link only — use Download for the image.');
  }

  function close() {
    const ov = $('shareOverlay');
    if (ov) ov.hidden = true;
  }

  function file() {
    try { return new File([blob], 'chronos-strike.png', { type: 'image/png' }); }
    catch (e) { return null; }
  }
  function canShareFiles() {
    const f = blob && file();
    return !!(f && navigator.canShare && navigator.canShare({ files: [f] }));
  }

  async function nativeShare() {
    if (!blob) return;
    const text = shareText();
    try {
      const f = file();
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
        // Link is inside `text` too — some targets drop the `url` field.
        await navigator.share({ files: [f], title: 'Chronos Strike', text });
      } else if (navigator.share) {
        await navigator.share({ title: 'Chronos Strike', text, url: GAME_URL });
      }
      close();
    } catch (e) {
      if (e && e.name === 'AbortError') return; // user dismissed the sheet
      hint('Share failed — try Download instead.', 'error');
    }
  }

  function download() {
    if (!objUrl) return;
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `chronos-strike-${stats ? stats.score : 0}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    hint('Saved! Attach it anywhere you like.', 'ok');
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText());
      hint('Text + link copied.', 'ok');
    } catch (e) {
      hint('Could not copy — select the text manually.', 'error');
    }
  }

  // ---------- wiring ----------
  document.addEventListener('DOMContentLoaded', () => {
    $('shareBtn') && $('shareBtn').addEventListener('click', open);
    $('shareNativeBtn') && $('shareNativeBtn').addEventListener('click', nativeShare);
    $('shareDownloadBtn') && $('shareDownloadBtn').addEventListener('click', download);
    $('shareCopyBtn') && $('shareCopyBtn').addEventListener('click', copyText);
    $('shareCloseBtn') && $('shareCloseBtn').addEventListener('click', close);
    const ov = $('shareOverlay');
    ov && ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  });

  window.ChronosShare = { setStats, setRank, open };
})();
