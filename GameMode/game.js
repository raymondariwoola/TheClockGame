// Chronos Strike — reflex-based timing challenge.
// Stop the clock at the right moment. Built on vanilla JS + anime.js.

(() => {
  'use strict';

  // -------- Storage --------
  const LS = {
    bestScore: 'cs_best_score',
    bestCombo: 'cs_best_combo',
    bestRound: 'cs_best_round',
  };
  const loadInt = (k) => parseInt(localStorage.getItem(k) || '0', 10) || 0;
  const saveInt = (k, v) => localStorage.setItem(k, String(v));

  // -------- DOM helpers --------
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const screens = {
    menu: $('screen-menu'),
    game: $('screen-game'),
    over: $('screen-over'),
    board: $('screen-board'),
  };
  const elBgFx = $('bgFx');
  const elFxCanvas = $('fxCanvas');
  const elScore = $('scoreVal');
  const elCombo = $('comboVal');
  const elComboBar = $('comboBar');
  const elComboBlock = $('comboBlock');
  const elRoundLabel = $('roundLabel');
  const elModifierTag = $('modifierTag');
  const elLives = $('lives');
  const elJudgment = $('judgment');
  const elStrikeBtn = $('strikeBtn');
  const elPauseBtn = $('pauseBtn');
  const elPauseOverlay = $('pauseOverlay');
  const elCountdown = $('countdown');
  const elPowerups = $('powerups');
  const elRoundProgress = $('roundProgress');
  const elClockSvg = $('clockSvg');
  const elHandLayer = $('handLayer');
  const elHand = $('hand');
  const elHand2 = $('hand2');
  const elZoneLayer = $('zoneLayer');
  const elTickLayer = $('tickLayer');
  const elStrikeHint = $('strikeRingHint');

  // -------- Audio (tiny WebAudio) --------
  const AudioFx = (() => {
    let ctx = null;
    let muted = false;
    const ensure = () => {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch { ctx = null; }
      }
      return ctx;
    };
    const tone = (freq, dur, type = 'sine', gain = 0.18) => {
      if (muted) return;
      const c = ensure(); if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    };
    const sweep = (f1, f2, dur, type = 'sawtooth', gain = 0.15) => {
      if (muted) return;
      const c = ensure(); if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), c.currentTime + dur);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    };
    return {
      perfect() { tone(1320, 0.18, 'triangle', 0.22); tone(1980, 0.16, 'sine', 0.14); },
      great()   { tone(990, 0.16, 'triangle', 0.2); },
      good()    { tone(660, 0.14, 'sine', 0.18); },
      miss()    { sweep(220, 60, 0.32, 'sawtooth', 0.18); },
      strike()  { tone(440, 0.05, 'square', 0.06); },
      countdown(n) { tone(n === 0 ? 880 : 440, 0.1, 'triangle', 0.18); },
      powerup() { tone(660, 0.08); tone(990, 0.08); tone(1320, 0.12); },
      gameover() { sweep(440, 80, 0.7, 'sawtooth', 0.22); },
      newRound() { tone(523, 0.08); tone(784, 0.1); },
      overdrive() { sweep(440, 1760, 0.35, 'square', 0.12); tone(1760, 0.2, 'triangle', 0.16); },
      boss() { tone(110, 0.4, 'sawtooth', 0.2); tone(220, 0.3, 'square', 0.1); },
      trap() { sweep(600, 40, 0.5, 'square', 0.2); },
      taunt() { sweep(320, 90, 0.4, 'sawtooth', 0.14); tone(150, 0.2, 'square', 0.1); },
      jolt() { sweep(180, 900, 0.18, 'square', 0.12); },
      super() { tone(660, 0.1, 'triangle', 0.18); tone(880, 0.1, 'triangle', 0.16); tone(1320, 0.14, 'triangle', 0.18); tone(1760, 0.18, 'sine', 0.12); },
    };
  })();

  // -------- Background starfield --------
  const Stars = (() => {
    let stars = [];
    let w = 0, h = 0, ctx = null;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = elBgFx.width = innerWidth * dpr;
      h = elBgFx.height = innerHeight * dpr;
      elBgFx.style.width = innerWidth + 'px';
      elBgFx.style.height = innerHeight + 'px';
      ctx = elBgFx.getContext('2d');
      stars = Array.from({ length: 140 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.7 + 0.3,
        r: Math.random() * 1.6 + 0.4,
        s: Math.random() * 0.4 + 0.1,
        hue: 180 + Math.random() * 120,
      }));
    };
    const tick = () => {
      if (!ctx) return;
      ctx.fillStyle = 'rgba(4,5,13,0.35)';
      ctx.fillRect(0, 0, w, h);
      for (const st of stars) {
        st.y += st.s * st.z;
        if (st.y > h) { st.y = 0; st.x = Math.random() * w; }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${st.hue}, 90%, 70%, ${0.4 + st.z * 0.5})`;
        ctx.arc(st.x, st.y, st.r * st.z, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    };
    addEventListener('resize', resize);
    resize();
    tick();
    return {};
  })();

  // -------- FX particles (canvas overlay) --------
  const Fx = (() => {
    let ctx = null, parts = [], w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = elFxCanvas.width = innerWidth * dpr;
      h = elFxCanvas.height = innerHeight * dpr;
      elFxCanvas.style.width = innerWidth + 'px';
      elFxCanvas.style.height = innerHeight + 'px';
      ctx = elFxCanvas.getContext('2d');
    };
    const burst = (x, y, color, count = 24, power = 8) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      x *= dpr; y *= dpr;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (Math.random() * 0.6 + 0.4) * power * dpr;
        parts.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: Math.random() * 3 + 1.5,
          life: 1, decay: 0.012 + Math.random() * 0.02,
          color,
        });
      }
    };
    const tick = () => {
      if (!ctx) { requestAnimationFrame(tick); return; }
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.97; p.vy *= 0.97;
        p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.fillStyle = p.color.replace('ALPHA', p.life.toFixed(2));
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(tick);
    };
    addEventListener('resize', resize);
    resize();
    tick();
    return { burst };
  })();

  // -------- Clock face drawing (ticks once at start) --------
  function drawTicks() {
    if (!elTickLayer) return;
    elTickLayer.innerHTML = '';
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 - 90) * Math.PI / 180;
      const isHour = i % 5 === 0;
      const r1 = isHour ? 230 : 240;
      const r2 = 252;
      const x1 = 300 + Math.cos(a) * r1;
      const y1 = 300 + Math.sin(a) * r1;
      const x2 = 300 + Math.cos(a) * r2;
      const y2 = 300 + Math.sin(a) * r2;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', isHour ? 'rgba(0,240,255,0.85)' : 'rgba(0,240,255,0.25)');
      line.setAttribute('stroke-width', isHour ? 3 : 1.5);
      line.setAttribute('stroke-linecap', 'round');
      elTickLayer.appendChild(line);
    }
    // hour numerals
    for (let h = 1; h <= 12; h++) {
      const a = (h * 30 - 90) * Math.PI / 180;
      const x = 300 + Math.cos(a) * 205;
      const y = 300 + Math.sin(a) * 205;
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x); t.setAttribute('y', y + 8);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', 'rgba(255,255,255,0.55)');
      t.setAttribute('font-family', 'Orbitron, sans-serif');
      t.setAttribute('font-weight', '700');
      t.setAttribute('font-size', '20');
      t.textContent = h;
      elTickLayer.appendChild(t);
    }
  }
  drawTicks();

  // -------- Zone helpers --------
  // Zones are arcs on the clock face. Angles in degrees, 0 = 12 o'clock.
  function describeArc(cx, cy, r, startDeg, endDeg) {
    const sa = (startDeg - 90) * Math.PI / 180;
    const ea = (endDeg - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);
    const large = (endDeg - startDeg) % 360 > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  function renderZones(zones) {
    elZoneLayer.innerHTML = '';
    zones.forEach((z, idx) => {
      if (z.hidden) return;
      const boost = (z.type === 'decoy') ? 1 : (State.zoneBoost || 1);
      const halfArc = z.size * boost / 2;
      const start = z.center - halfArc;
      const end = z.center + halfArc;
      // perfect band (inner)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', describeArc(300, 300, 230, start, end));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', z.color || 'rgba(45,255,170,0.85)');
      path.setAttribute('stroke-width', 18);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', z.opacity != null ? z.opacity : 0.85);
      path.setAttribute('filter', 'url(#glow)');
      if (z.type === 'decoy') path.setAttribute('stroke-dasharray', '6 10');
      path.dataset.idx = idx;
      elZoneLayer.appendChild(path);

      // decoys have no sweet-spot — they are pure danger
      if (z.type === 'decoy') return;

      // perfect sweet-spot (smaller, centered)
      const perfHalf = Math.min(3, halfArc * 0.25);
      const perfPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      perfPath.setAttribute('d', describeArc(300, 300, 230, z.center - perfHalf, z.center + perfHalf));
      perfPath.setAttribute('fill', 'none');
      perfPath.setAttribute('stroke', '#ffffff');
      perfPath.setAttribute('stroke-width', 22);
      perfPath.setAttribute('stroke-linecap', 'round');
      perfPath.setAttribute('opacity', 0.9);
      perfPath.setAttribute('filter', 'url(#strongGlow)');
      elZoneLayer.appendChild(perfPath);
    });
  }

  // -------- Game state --------
  const State = {
    mode: 'classic',         // classic | endless | zen
    round: 1,
    score: 0,
    combo: 1,
    comboStreak: 0,
    lives: 3,
    perfectHits: 0,
    totalHits: 0,
    totalAttempts: 0,
    bestCombo: 1,
    handAngle: 0,
    handSpeed: 180,          // deg/sec
    handDir: 1,
    spinning: false,
    paused: false,
    zones: [],
    hitsRequired: 1,
    hitsDone: 0,
    modifier: null,
    bossRound: false,
    overdrive: false,
    perfectStreak: 0,
    pulse: false,
    rafId: null,
    lastTs: 0,
    overlayBusy: false,
    multiHand: false,
    hand2Angle: 0,
    hand2Speed: 120,
    hand2Dir: -1,
    phantomTimeout: null,
    quantumTimeout: null,
    started: false,
    godTainted: false,   // true if GOD mode was ever active this run (never ranked)
    hardcore: false,     // opt-in double-points difficulty (harder + relentless taunts)
    maxLives: 3,
    jolt: 1,             // transient hand-speed multiplier used by hardcore taunts
    survivalMult: 1,     // endless-only: grows each wave + on streaks, scales all score
    powers: {},          // active super powers: id -> seconds left (Infinity = until used)
    zoneBoost: 1,        // magnet/star widen the target zones
  };

  // -------- Modifiers --------
  const MODIFIERS = [
    { id: 'speed',    name: '⚡ HYPER SPEED',  apply: (st) => { st.handSpeed *= 1.7; } },
    { id: 'shrink',   name: '🎯 PRECISION',    apply: (st) => { st.zones.forEach(z => z.size = Math.max(6, z.size * 0.5)); } },
    { id: 'invert',   name: '🔄 INVERTED',     apply: (st) => { st.handDir = -1; } },
    { id: 'double',   name: '👯 DOUBLE HANDS', apply: (st) => {
        st.multiHand = true;
        st.hand2Angle = Math.random() * 360;
        st.hand2Speed = st.handSpeed * 0.7;
        st.hand2Dir = -st.handDir;
      } },
    { id: 'phantom',  name: '👻 PHANTOM',      apply: (st) => {
        st.zones.forEach(z => z.opacity = 0.0);
        // flash visible briefly each second
        let on = false;
        const blink = () => {
          if (!st.spinning) return;
          on = !on;
          st.zones.forEach(z => z.opacity = on ? 0.85 : 0.0);
          renderZones(st.zones);
          st.phantomTimeout = setTimeout(blink, 700);
        };
        blink();
      } },
    { id: 'multi',    name: '✨ MULTI-STRIKE', apply: (st) => {
        st.hitsRequired = 3;
        // place 3 zones distributed
        const base = Math.random() * 360;
        st.zones = [0, 120, 240].map(off => ({
          center: (base + off) % 360,
          size: 36,
          color: 'rgba(255,224,102,0.85)',
        }));
      } },
    { id: 'quantum',  name: '⚛ QUANTUM',       apply: (st) => {
        const teleport = () => {
          if (!st.spinning) return;
          st.zones.forEach(z => { if (!z.hit) z.center = Math.random() * 360; });
          renderZones(st.zones);
          st.quantumTimeout = setTimeout(teleport, 1200);
        };
        st.quantumTimeout = setTimeout(teleport, 1200);
      } },
    { id: 'decoy',    name: '💀 DECOYS',       apply: (st) => {
        // two red trap arcs — striking one costs a life AND 100 points
        const real = st.zones[0];
        [1, 2].forEach(k => {
          st.zones.push({
            center: (real.center + 90 * k + Math.random() * 90) % 360,
            size: Math.max(18, real.size),
            type: 'decoy',
            color: 'rgba(255,64,96,0.75)',
          });
        });
      } },
    { id: 'pulse',    name: '💓 PULSE',        apply: (st) => { st.pulse = true; } },
  ];

  // -------- Screen transitions --------
  function showScreen(id) {
    if (id === 'menu') {
      document.body.classList.remove('hardcore', 'endless');
      document.documentElement.style.setProperty('--vig', '0');
    }
    Object.entries(screens).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle('active', k === id);
    });
  }

  function flashJudgment(text, kind) {
    elJudgment.textContent = text;
    elJudgment.className = 'judgment show ' + kind;
    if (window.anime) {
      anime.remove(elJudgment);
      anime({
        targets: elJudgment,
        scale: [{ value: 0.6, duration: 0 }, { value: 1.2, duration: 180, easing: 'easeOutBack' }, { value: 1, duration: 120 }],
        opacity: [{ value: 1, duration: 0 }, { value: 1, duration: 500 }, { value: 0, duration: 250 }],
        translateY: [0, -20],
        complete: () => { elJudgment.className = 'judgment'; },
      });
    } else {
      setTimeout(() => { elJudgment.className = 'judgment'; }, 800);
    }
  }

  function shakeScreen(intensity = 1) {
    const arena = document.querySelector('.arena');
    if (!arena) return;
    arena.style.animation = 'none';
    void arena.offsetWidth;
    arena.style.animation = `screenShake ${0.4 * intensity}s cubic-bezier(.36,.07,.19,.97)`;
  }

  function popupScore(amount, x, y, color) {
    const p = document.createElement('div');
    p.className = 'score-popup';
    p.style.color = color || '#fff';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.textContent = (amount > 0 ? '+' : '') + amount;
    document.body.appendChild(p);
    if (window.anime) {
      anime({
        targets: p,
        translateY: -80,
        opacity: [{ value: 1, duration: 0 }, { value: 1, duration: 500 }, { value: 0, duration: 400 }],
        scale: [0.6, 1.2, 1],
        duration: 900,
        easing: 'easeOutCubic',
        complete: () => p.remove(),
      });
    } else {
      setTimeout(() => p.remove(), 900);
    }
  }

  // -------- Round / hand loop --------
  function applyHandRotation() {
    elHand.setAttribute('transform', `rotate(${State.handAngle})`);
    if (State.multiHand) {
      elHand2.style.display = '';
      elHand2.setAttribute('transform', `rotate(${State.hand2Angle})`);
    } else {
      elHand2.style.display = 'none';
    }
  }

  function loop(ts) {
    if (!State.spinning) return;
    const dt = State.lastTs ? (ts - State.lastTs) / 1000 : 0;
    State.lastTs = ts;
    if (!State.paused) {
      tickPowers(dt);
      let speed = State.handSpeed;
      if (State.powers.freeze) speed = 0;
      else if (State.powers.slowmo) speed *= 0.35;
      if (State.pulse) speed *= 1 + 0.45 * Math.sin(ts * 0.004);
      if (State.jolt !== 1) speed *= State.jolt;
      State.handAngle = (State.handAngle + speed * State.handDir * dt + 360) % 360;
      if (State.multiHand) {
        State.hand2Angle = (State.hand2Angle + State.hand2Speed * State.hand2Dir * dt + 360) % 360;
      }
      applyHandRotation();
    }
    State.rafId = requestAnimationFrame(loop);
  }

  function startSpin() {
    cancelAnimationFrame(State.rafId);
    State.lastTs = 0;
    State.spinning = true;
    State.rafId = requestAnimationFrame(loop);
    Taunts.start();
  }

  function stopSpin() {
    State.spinning = false;
    State.jolt = 1;
    cancelAnimationFrame(State.rafId);
    if (State.phantomTimeout) clearTimeout(State.phantomTimeout);
    if (State.quantumTimeout) clearTimeout(State.quantumTimeout);
    State.phantomTimeout = State.quantumTimeout = null;
    Taunts.stop();
  }

  const CLASSIC_ROUNDS = 40; // longer campaign

  // -------- Difficulty curve --------
  function roundParams(round, mode) {
    const hc = State.hardcore && mode !== 'zen';
    // Base speed grows with round; hardcore starts faster and keeps climbing longer
    const base = mode === 'zen' ? 130 : (hc ? 175 : 150);
    // Classic/zen speed CAPS (beatable). Endless NEVER caps — it just keeps
    // accelerating until you crack, which is the whole point of survival.
    const ramp = (mode === 'endless')
      ? round * (hc ? 16 : 13)
      : Math.min(round * 13, hc ? 540 : 430);
    const speed = (base + ramp) * (hc ? 1.12 : 1);
    // Zone shrinks; hardcore shrinks faster to a tighter floor
    const floor = hc ? 10 : 13;
    const size = Math.max(floor, (hc ? 56 : 60) - round * (hc ? 1.9 : 1.55));
    const dir = Math.random() < 0.5 ? -1 : 1;
    return { speed, size, dir };
  }

  function pickModifier(round, mode) {
    if (mode === 'zen') return null;
    if (round < 3) return null;
    if (Math.random() > Math.min(0.18 + round * 0.04, 0.85)) return null;
    return MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
  }

  // -------- Round setup --------
  function setupRound() {
    State.hitsRequired = 1;
    State.hitsDone = 0;
    State.multiHand = false;
    State.modifier = null;
    State.pulse = false;
    State.bossRound = State.mode !== 'zen' && State.round > 1 && State.round % 5 === 0;
    elModifierTag.hidden = true;
    elModifierTag.classList.remove('boss');

    const { speed, size, dir } = roundParams(State.round, State.mode);
    State.handSpeed = speed;
    State.handDir = dir;
    State.handAngle = Math.random() * 360;

    State.zones = [{
      center: Math.random() * 360,
      size,
      color: 'rgba(45,255,170,0.85)',
      hit: false,
    }];

    if (State.bossRound) {
      // boss: two gold zones on opposite sides, faster hand, 2× score
      State.handSpeed = speed * 1.3;
      State.hitsRequired = 2;
      const base = Math.random() * 360;
      State.zones = [0, 180].map(off => ({
        center: (base + off) % 360,
        size: Math.max(16, size * 0.9),
        color: 'rgba(255,224,102,0.9)',
        hit: false,
      }));
      elModifierTag.textContent = '⚠ BOSS ROUND — 2× SCORE';
      elModifierTag.classList.add('boss');
      elModifierTag.hidden = false;
      AudioFx.boss();
      if (window.anime) {
        anime({ targets: elModifierTag, scale: [0.5, 1.1, 1], opacity: [0, 1], duration: 600, easing: 'easeOutBack' });
      }
    }

    const mod = State.bossRound ? null : pickModifier(State.round, State.mode);
    if (mod) {
      State.modifier = mod;
      mod.apply(State);
      elModifierTag.textContent = mod.name;
      elModifierTag.hidden = false;
      if (window.anime) {
        anime({ targets: elModifierTag, scale: [0.5, 1.05, 1], opacity: [0, 1], duration: 500, easing: 'easeOutBack' });
      }
    }

    renderZones(State.zones);
    elRoundLabel.textContent = State.mode === 'endless' ? `WAVE ${State.round}` : `ROUND ${State.round}`;
    elRoundProgress.style.width = State.mode === 'classic' ? ((State.round - 1) / CLASSIC_ROUNDS * 100) + '%' : '100%';

    // Mode-specific progression
    if (State.mode === 'endless' && State.round > 1) State.survivalMult += 0.15;
    updateRoundSub();
    updateVignette();
    if (State.mode === 'classic') maybeActBanner(State.round);

    // intro flourish
    if (window.anime) {
      anime({ targets: elRoundLabel, translateY: [-20, 0], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
      anime({ targets: '.warp-ring', scale: [0.8, 1], opacity: [0, 0.6, 0], duration: 900, delay: anime.stagger(100), easing: 'easeOutQuad' });
    }

    AudioFx.newRound();
    applyHandRotation();
  }

  // Sub-label under the round name: classic shows progress to the finish,
  // endless shows the growing survival multiplier.
  function updateRoundSub(pulse) {
    const sub = document.getElementById('roundSub');
    if (!sub) return;
    if (State.mode === 'classic') {
      sub.textContent = `ROUND ${State.round} / ${CLASSIC_ROUNDS}`;
      sub.hidden = false;
    } else if (State.mode === 'endless') {
      sub.textContent = `SURVIVAL ×${State.survivalMult.toFixed(2)}`;
      sub.hidden = false;
      if (pulse) { sub.classList.remove('pulse'); void sub.offsetWidth; sub.classList.add('pulse'); }
    } else {
      sub.hidden = true;
    }
  }

  // Endless: a red intensity vignette that closes in as the waves climb.
  function updateVignette() {
    const root = document.documentElement;
    const v = document.getElementById('vignette');
    if (State.mode === 'endless') {
      const t = Math.min(1, (State.round - 1) / 18);
      root.style.setProperty('--vig', (0.15 + t * 0.8).toFixed(2));
      if (v) v.classList.toggle('pulse', State.round >= 12);
    } else {
      root.style.setProperty('--vig', '0');
      if (v) v.classList.remove('pulse');
    }
  }

  // Classic: an "ACT" banner every 10 rounds to give the campaign structure.
  function maybeActBanner(round) {
    if ((round - 1) % 10 !== 0) return;
    const act = Math.floor((round - 1) / 10) + 1;
    const roman = ['', 'I', 'II', 'III', 'IV', 'V'][act] || String(act);
    flashJudgment(`ACT ${roman}`, 'great');
  }

  // -------- Strike logic --------
  function angularDistance(a, b) {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  }

  function classify(distToCenter, zoneHalf) {
    // distToCenter is degrees; zoneHalf = z.size/2
    const perfectBand = Math.min(3, zoneHalf * 0.25);
    const greatBand = zoneHalf * 0.55;
    if (distToCenter <= perfectBand) return 'perfect';
    if (distToCenter <= greatBand) return 'great';
    if (distToCenter <= zoneHalf) return 'good';
    return 'miss';
  }

  let lastStrikeTs = 0;
  function strike() {
    if (!State.spinning || State.paused) return;
    // Guard against a single tap/click firing twice (some mobile browsers emit
    // both a synthesized and a bubbled event) — that previously cost two lives.
    const nowTs = (window.performance && performance.now) ? performance.now() : Date.now();
    if (nowTs - lastStrikeTs < 90) return;
    lastStrikeTs = nowTs;
    AudioFx.strike();

    // find best (non-decoy) zone for current hand angle
    const ang = State.handAngle;
    let best = null;
    let bestDist = Infinity;
    let bestIdx = -1;
    State.zones.forEach((z, i) => {
      if (z.hit || z.type === 'decoy') return;
      const d = angularDistance(ang, z.center);
      if (d < bestDist) { bestDist = d; best = z; bestIdx = i; }
    });

    if (!best) return;

    const half = best.size * (State.zoneBoost || 1) / 2;
    let kind = classify(bestDist, half);
    if (God.isActive()) kind = 'perfect'; // creator demo: every strike lands perfect
    if (State.powers.deadeye || State.powers.star) kind = 'perfect'; // super powers

    State.totalAttempts++;

    // strike point on screen for popup
    const rect = elClockSvg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = (rect.width / 2) * (230 / 300);
    const a = (ang - 90) * Math.PI / 180;
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r;

    if (kind === 'miss') {
      // landed on a decoy trap?
      const trap = State.zones.find(z => z.type === 'decoy' && angularDistance(ang, z.center) <= z.size / 2);
      if (trap) {
        AudioFx.trap();
        const penalty = Math.min(100, State.score);
        if (penalty > 0) {
          State.score -= penalty;
          elScore.textContent = State.score;
          popupScore(-penalty, sx, sy - 60, '#ff4060');
        }
        handleMiss(sx, sy, 'TRAP!');
        return;
      }
      // tell the player which way they were off
      const diff = ((best.center - ang + 540) % 360) - 180;
      const early = State.handDir === 1 ? diff > 0 : diff < 0;
      handleMiss(sx, sy, early ? 'EARLY!' : 'LATE!');
      return;
    }

    handleHit(kind, best, bestIdx, sx, sy);
  }

  function scoreFor(kind) {
    if (kind === 'perfect') return 100;
    if (kind === 'great') return 60;
    if (kind === 'good') return 30;
    return 0;
  }

  function handleHit(kind, zone, idx, x, y) {
    zone.hit = true;
    State.totalHits++;
    if (kind === 'perfect') State.perfectHits++;

    State.comboStreak++;
    State.combo = 1 + Math.floor(State.comboStreak / 3);
    if (State.combo > State.bestCombo) State.bestCombo = State.combo;

    // overdrive kicks in at combo ×4 and holds until a miss
    const wasOverdrive = State.overdrive;
    State.overdrive = State.combo >= 4;
    if (State.overdrive && !wasOverdrive) {
      AudioFx.overdrive();
      document.body.classList.add('overdrive');
      setTimeout(() => flashJudgment('⚡ OVERDRIVE ⚡', 'perfect'), 500);
    }

    // consecutive perfects build an escalating flat bonus
    if (kind === 'perfect') State.perfectStreak++;
    else State.perfectStreak = 0;

    let gained = scoreFor(kind) * State.combo;
    if (State.modifier) gained *= 1.5;
    if (State.bossRound) gained *= 2;
    if (State.hardcore) gained *= 2;   // hardcore reward: double points
    if (State.mode === 'endless') gained *= State.survivalMult; // deeper = richer
    if (State.overdrive) gained *= 1.5;
    if (State.powers.double) gained *= 2;
    if (State.powers.triple) gained *= 3;
    if (State.powers.star) gained *= 2;
    if (State.powers.frenzy) gained += 40 * State.combo;
    if (State.perfectStreak > 1) gained += (State.perfectStreak - 1) * 25;
    gained = Math.round(gained);
    State.score += gained;

    elScore.textContent = State.score;
    elScore.classList.remove('bump');
    void elScore.offsetWidth;
    elScore.classList.add('bump');
    elStrikeHint.className = 'strike-zone flash-' + kind;
    setTimeout(() => { elStrikeHint.className = 'strike-zone'; }, 220);
    elCombo.textContent = '×' + State.combo;
    elComboBar.style.width = Math.min(100, (State.comboStreak % 3) * 33.34 + (State.combo > 1 ? 33.34 : 0)) + '%';
    elComboBlock.classList.toggle('active', State.combo > 1);

    if (kind === 'perfect') {
      AudioFx.perfect();
      Fx.burst(x, y, 'rgba(255,255,255,ALPHA)', 40, 12);
      Fx.burst(x, y, 'rgba(0,240,255,ALPHA)', 24, 8);
      flashJudgment('PERFECT!', 'perfect');
      popupScore(gained, x, y - 30, '#fff');
    } else if (kind === 'great') {
      AudioFx.great();
      Fx.burst(x, y, 'rgba(45,255,170,ALPHA)', 26, 9);
      flashJudgment('GREAT!', 'great');
      popupScore(gained, x, y - 30, '#2dffaa');
    } else {
      AudioFx.good();
      Fx.burst(x, y, 'rgba(255,224,102,ALPHA)', 18, 6);
      flashJudgment('GOOD', 'good');
      popupScore(gained, x, y - 30, '#ffe066');
    }

    // hide hit zone visually
    State.zones[idx].opacity = 0;
    renderZones(State.zones);

    State.hitsDone++;

    // 5-streak reward — differs by mode:
    //   endless   → pump the survival multiplier (keeps it relentless, no easing off)
    //   classic/zen → a random powerup (future home of full "super powers")
    if (State.comboStreak > 0 && State.comboStreak % 5 === 0) {
      if (State.mode === 'endless') {
        State.survivalMult += 0.5;
        updateRoundSub(true);
        AudioFx.powerup();
        popupScore('SURVIVAL UP', x, y - 60, '#8b5cff');
      } else {
        grantRandomPowerup();
      }
    }

    // taunt: goad the player when they're on a hot streak (nastier in hardcore)
    if (State.comboStreak >= 6 && State.comboStreak % 6 === 0) Taunts.provoke(State.combo);

    if (State.hitsDone >= State.hitsRequired) {
      // round complete
      stopSpin();
      setTimeout(nextRound, 500);
    }
  }

  function handleMiss(x, y, label = 'MISS') {
    if (God.isActive()) return; // GOD mode: misses (and life loss) are impossible
    if (!State.spinning) return; // ignore any stray miss after the round/run has stopped

    // STAR POWER — fully invincible, misses simply don't count
    if (State.powers.star) { flashJudgment('★', 'perfect'); return; }
    // SHIELD — consume it to negate this miss entirely (no life, no combo loss)
    if (State.powers.shield) {
      delete State.powers.shield;
      updatePowerups();
      AudioFx.powerup();
      flashJudgment('BLOCKED', 'good');
      elStrikeHint.className = 'strike-zone flash-good';
      setTimeout(() => { elStrikeHint.className = 'strike-zone'; }, 260);
      return;
    }

    AudioFx.miss();
    Fx.burst(x, y, 'rgba(255,64,96,ALPHA)', 30, 10);
    flashJudgment(label, 'miss');
    shakeScreen(1.2);
    elStrikeHint.className = 'strike-zone flash-miss';
    setTimeout(() => { elStrikeHint.className = 'strike-zone'; }, 260);

    // COMBO LOCK — keep the combo alive through this one miss
    if (!State.powers.combolock) {
      State.comboStreak = 0;
      State.combo = 1;
      State.perfectStreak = 0;
      State.overdrive = false;
      document.body.classList.remove('overdrive');
      elCombo.textContent = '×1';
      elComboBar.style.width = '0%';
      elComboBlock.classList.remove('active');
    }

    Taunts.onMiss();

    if (State.mode !== 'zen') {
      State.lives--;
      renderLives();
      if (State.lives <= 0) {
        stopSpin();
        setTimeout(endGame, 600);
        return;
      }
    }
  }

  function renderLives() {
    elLives.innerHTML = '';
    const maxLives = State.mode === 'zen' ? 0 : State.maxLives;
    if (maxLives === 0) {
      elLives.innerHTML = '<span class="life zen">∞</span>';
      return;
    }
    for (let i = 0; i < maxLives; i++) {
      const s = document.createElement('span');
      s.className = 'life' + (i >= State.lives ? ' lost' : '');
      s.textContent = '●';
      elLives.appendChild(s);
    }
  }

  // -------- Super Powers (Classic / Zen reward on every 5-streak) --------
  // A deliberately chaotic grab-bag. Timed powers live in State.powers
  // (id -> seconds left; Infinity = holds until consumed). Instant powers fire once.
  const POWERS = [
    // ---- timed ----
    { id: 'freeze',    name: 'TIME STOP',    icon: '❄️', kind: 'timed', dur: 1.8,      weight: 8,  blurb: 'The hand freezes solid.' },
    { id: 'slowmo',    name: 'BULLET TIME',  icon: '🐢', kind: 'timed', dur: 4.5,      weight: 12, blurb: 'Everything crawls.' },
    { id: 'double',    name: 'DOUBLE',       icon: '✖2', kind: 'timed', dur: 6,        weight: 12, blurb: 'Double points.' },
    { id: 'triple',    name: 'TRIPLE',       icon: '✖3', kind: 'timed', dur: 5,        weight: 7,  blurb: 'Triple points!' },
    { id: 'magnet',    name: 'ZONE MAGNET',  icon: '🧲', kind: 'timed', dur: 6,        weight: 11, blurb: 'Targets grow huge.' },
    { id: 'deadeye',   name: 'DEADEYE',      icon: '🎯', kind: 'timed', dur: 4,        weight: 8,  blurb: 'Every strike is PERFECT.' },
    { id: 'frenzy',    name: 'SCORE FRENZY', icon: '🔥', kind: 'timed', dur: 6,        weight: 9,  blurb: 'Bonus points on every hit.' },
    { id: 'combolock', name: 'COMBO LOCK',   icon: '🔗', kind: 'timed', dur: 8,        weight: 8,  blurb: 'Your combo survives a miss.' },
    { id: 'shield',    name: 'SHIELD',       icon: '🛡️', kind: 'timed', dur: Infinity, weight: 8,  blurb: 'Blocks the next miss.' },
    { id: 'star',      name: 'STAR POWER',   icon: '🌟', kind: 'timed', dur: 4.5,      weight: 3,  blurb: 'Invincible + auto-perfect + 2×!' },
    // ---- instant ----
    { id: 'life',      name: 'EXTRA LIFE',   icon: '❤️', kind: 'instant', weight: 6,  blurb: '+1 life.' },
    { id: 'heal',      name: 'FULL HEAL',    icon: '💖', kind: 'instant', weight: 3,  blurb: 'All lives restored.' },
    { id: 'jackpot',   name: 'JACKPOT',      icon: '💰', kind: 'instant', weight: 10, blurb: 'Instant point windfall.' },
    { id: 'overcharge',name: 'OVERCHARGE',   icon: '⚡', kind: 'instant', weight: 7,  blurb: 'Combo supercharged!' },
    { id: 'wildcard',  name: 'WILDCARD',     icon: '🎰', kind: 'instant', weight: 5,  blurb: 'Two powers at once!' },
  ];
  const POWER_BY_ID = Object.fromEntries(POWERS.map(p => [p.id, p]));

  // handleHit still calls grantRandomPowerup() — keep that name as the entry point.
  function grantRandomPowerup() { grantSuperPower(false); }

  function grantSuperPower(silent, excludeId) {
    let pool = POWERS.filter(p => p.weight > 0 && p.id !== excludeId);
    if (State.lives >= State.maxLives) pool = pool.filter(p => p.id !== 'life' && p.id !== 'heal');
    if (!pool.length) return;
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total, chosen = pool[pool.length - 1];
    for (const p of pool) { r -= p.weight; if (r <= 0) { chosen = p; break; } }
    applyPower(chosen.id, silent);
  }

  function applyPower(id, silent) {
    const p = POWER_BY_ID[id];
    if (!p) return;
    if (p.kind === 'timed') {
      State.powers[id] = p.dur;
      if (id === 'star') document.body.classList.add('starpower');
      updateZoneBoost();
    } else if (id === 'life') {
      State.lives = Math.min(State.maxLives, State.lives + 1); renderLives();
    } else if (id === 'heal') {
      State.lives = State.maxLives; renderLives();
    } else if (id === 'jackpot') {
      const bonus = 250 + State.round * 60 + (State.hardcore ? 400 : 0);
      State.score += bonus; elScore.textContent = State.score;
      elScore.classList.remove('bump'); void elScore.offsetWidth; elScore.classList.add('bump');
      const rect = elClockSvg.getBoundingClientRect();
      popupScore(bonus, rect.left + rect.width / 2, rect.top + rect.height / 3, '#ffe066');
    } else if (id === 'overcharge') {
      State.comboStreak += 9;
      State.combo = 1 + Math.floor(State.comboStreak / 3);
      if (State.combo > State.bestCombo) State.bestCombo = State.combo;
      if (!State.overdrive && State.combo >= 4) { State.overdrive = true; document.body.classList.add('overdrive'); AudioFx.overdrive(); }
      elCombo.textContent = '×' + State.combo;
      elComboBar.style.width = Math.min(100, (State.comboStreak % 3) * 33.34 + (State.combo > 1 ? 33.34 : 0)) + '%';
      elComboBlock.classList.toggle('active', State.combo > 1);
    } else if (id === 'wildcard') {
      grantSuperPower(true, 'wildcard');
      grantSuperPower(true, 'wildcard');
    }
    (id === 'star' || id === 'wildcard' || id === 'heal') ? AudioFx.super() : AudioFx.powerup();
    if (!silent) announcePower(p);
    updatePowerups();
  }

  function updateZoneBoost() {
    const boost = (State.powers.magnet || State.powers.star) ? 1.9 : 1;
    if (boost !== State.zoneBoost) { State.zoneBoost = boost; renderZones(State.zones); }
  }

  // Tick timed powers every frame; fire expiry side-effects.
  function tickPowers(dt) {
    let changed = false;
    for (const id in State.powers) {
      const v = State.powers[id];
      if (!isFinite(v)) continue;            // shield: waits to be consumed
      const nv = v - dt;
      if (nv <= 0) { delete State.powers[id]; onPowerExpire(id); changed = true; }
      else State.powers[id] = nv;
    }
    if (changed) { updateZoneBoost(); updatePowerups(); }
  }

  function onPowerExpire(id) {
    if (id === 'star') document.body.classList.remove('starpower');
  }

  function updatePowerups() {
    elPowerups.innerHTML = '';
    for (const id in State.powers) {
      const p = POWER_BY_ID[id]; if (!p) continue;
      const t = State.powers[id];
      const chip = document.createElement('div');
      chip.className = 'powerup-chip' + (id === 'star' ? ' star' : '') + (id === 'shield' ? ' shield' : '');
      chip.innerHTML = `<span class="pu-icon">${p.icon}</span><span class="pu-label">${p.name}</span>` +
        (isFinite(t) ? `<span class="pu-time">${t.toFixed(1)}s</span>` : '');
      elPowerups.appendChild(chip);
    }
  }

  // Big centre announcement when a power drops.
  let announceEl = null;
  function announcePower(p) {
    if (!announceEl) {
      announceEl = document.createElement('div');
      announceEl.className = 'power-announce';
      document.body.appendChild(announceEl);
    }
    announceEl.innerHTML =
      `<span class="pa-icon">${p.icon}</span><span class="pa-name">${p.name}</span><span class="pa-blurb">${p.blurb}</span>`;
    announceEl.classList.remove('show'); void announceEl.offsetWidth; announceEl.classList.add('show');
    clearTimeout(announceEl._t);
    announceEl._t = setTimeout(() => announceEl.classList.remove('show'), 1500);
  }
  // refresh chips every 100ms
  setInterval(() => {
    if (State.spinning && !State.paused) updatePowerups();
  }, 100);

  // -------- Flow --------
  function nextRound() {
    if (State.mode === 'classic' && State.round >= CLASSIC_ROUNDS) {
      endGame();
      return;
    }
    State.round++;
    setupRound();
    startSpin();
  }

  function startMode(mode) {
    State.mode = mode;
    State.round = 1;
    State.score = 0;
    State.combo = 1;
    State.comboStreak = 0;
    State.hardcore = (mode === 'zen') ? false : Difficulty.isHardcore();
    // Classic always has 3 lives (hardcore adds pressure via speed + taunts,
    // not fewer lives); endless is a single-life survival run.
    State.maxLives = mode === 'endless' ? 1 : (mode === 'zen' ? 0 : 3);
    State.lives = mode === 'zen' ? 999 : State.maxLives;
    State.survivalMult = 1;
    State.jolt = 1;
    document.body.classList.toggle('hardcore', State.hardcore);
    document.body.classList.toggle('endless', mode === 'endless');
    State.perfectHits = 0;
    State.totalHits = 0;
    State.totalAttempts = 0;
    State.bestCombo = 1;
    State.powers = {};
    State.zoneBoost = 1;
    document.body.classList.remove('starpower');
    State.perfectStreak = 0;
    State.overdrive = false;
    State.pulse = false;
    document.body.classList.remove('overdrive');
    State.started = true;
    State.godTainted = God.isActive(); // a run started under GOD mode is never ranked
    elScore.textContent = '0';
    elCombo.textContent = '×1';
    elComboBar.style.width = '0%';
    elComboBlock.classList.remove('active');
    renderLives();
    updatePowerups();
    showScreen('game');
    countdownThenStart();
  }

  function countdownThenStart() {
    const span = elCountdown.querySelector('span');
    elCountdown.hidden = false;
    const seq = ['3', '2', '1', 'GO!'];
    let i = 0;
    const tick = () => {
      if (i >= seq.length) {
        elCountdown.hidden = true;
        setupRound();
        startSpin();
        return;
      }
      span.textContent = seq[i];
      AudioFx.countdown(i === seq.length - 1 ? 0 : 1);
      if (window.anime) {
        anime.remove(span);
        anime({
          targets: span,
          scale: [0.4, 1.4, 1],
          opacity: [0, 1, 1, 0],
          duration: 750,
          easing: 'easeOutCubic',
        });
      }
      i++;
      setTimeout(tick, 750);
    };
    tick();
  }

  function endGame() {
    stopSpin();
    AudioFx.gameover();
    State.overdrive = false;
    document.body.classList.remove('overdrive');
    document.documentElement.style.setProperty('--vig', '0');

    // persist bests — but GOD-mode runs never pollute your records
    const prevBest = loadInt(LS.bestScore);
    const newBestScore = !State.godTainted && State.score > prevBest;
    if (!State.godTainted) {
      saveInt(LS.bestScore, Math.max(prevBest, State.score));
      saveInt(LS.bestCombo, Math.max(loadInt(LS.bestCombo), State.bestCombo));
      saveInt(LS.bestRound, Math.max(loadInt(LS.bestRound), State.round));
    }

    // stats
    $('overScore').textContent = State.score;
    $('overPerfect').textContent = State.perfectHits;
    $('overCombo').textContent = State.bestCombo;
    $('overRound').textContent = State.round;
    const acc = State.totalAttempts ? Math.round(State.totalHits / State.totalAttempts * 100) : 0;
    $('overAcc').textContent = acc + '%';
    $('overRank').textContent = computeRank(State.score, acc, State.perfectHits);
    $('newBest').hidden = !newBestScore;
    $('overTitle').textContent = State.lives <= 0 ? 'GAME OVER' : 'RUN COMPLETE';

    showScreen('over');
    refreshMenuStats();

    if (window.anime) {
      anime({ targets: '.over-stat', translateY: [40, 0], opacity: [0, 1], delay: anime.stagger(80), duration: 600, easing: 'easeOutCubic' });
      anime({ targets: '.over-title', scale: [0.6, 1], opacity: [0, 1], duration: 700, easing: 'easeOutBack' });
    }

    // global leaderboard qualification check (leaderboard.js)
    if (window.ChronosLB) {
      window.ChronosLB.onGameEnd({
        score: State.score,
        mode: State.mode,
        round: State.round,
        combo: State.bestCombo,
        acc,
        perfect: State.perfectHits,
        god: State.godTainted,
        hc: State.hardcore,
      });
    }
  }

  function computeRank(score, acc, perfect) {
    if (score >= 8000 && acc >= 90) return 'S';
    if (score >= 5000 && acc >= 80) return 'A';
    if (score >= 3000 && acc >= 65) return 'B';
    if (score >= 1500) return 'C';
    if (score >= 500) return 'D';
    return 'F';
  }

  function refreshMenuStats() {
    $('menuBest').textContent = loadInt(LS.bestScore);
    $('menuCombo').textContent = loadInt(LS.bestCombo);
    $('menuRound').textContent = loadInt(LS.bestRound);
  }

  // -------- Pause --------
  function togglePause(force) {
    if (!State.spinning) return;
    State.paused = force != null ? force : !State.paused;
    elPauseOverlay.hidden = !State.paused;
  }

  // -------- Bindings --------
  $$('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (window.anime) {
        anime({ targets: btn, scale: [1, 1.1, 1], duration: 250 });
      }
      setTimeout(() => startMode(mode), 200);
    });
  });

  elStrikeBtn.addEventListener('click', strike);
  elPauseBtn.addEventListener('click', () => togglePause());
  $('resumeBtn').addEventListener('click', () => togglePause(false));
  $('quitBtn').addEventListener('click', () => {
    togglePause(false);
    stopSpin();
    showScreen('menu');
    refreshMenuStats();
  });
  $('retryBtn').addEventListener('click', () => startMode(State.mode));
  $('menuBtn').addEventListener('click', () => { showScreen('menu'); refreshMenuStats(); });

  addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Space') {
      if (screens.game.classList.contains('active')) {
        e.preventDefault();
        strike();
      }
    } else if (e.key === 'p' || e.key === 'P') {
      if (screens.game.classList.contains('active')) togglePause();
    } else if (e.key === 'Escape') {
      if (screens.game.classList.contains('active')) {
        togglePause(true);
      }
    }
  });

  // click anywhere on arena to strike (except buttons)
  document.querySelector('.arena').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    strike();
  });

  // ============================================================
  // DIFFICULTY — Normal vs Hardcore (2× points, harder, meaner taunts).
  // Choice persists per-device; zen mode always ignores it.
  // ============================================================
  const Difficulty = (() => {
    const KEY = 'cs_hardcore';
    let hardcore = false;
    try { hardcore = localStorage.getItem(KEY) === '1'; } catch (e) {}
    const opts = $$('.diff-opt');
    function paint() {
      opts.forEach(b => b.classList.toggle('selected', (b.dataset.diff === 'hardcore') === hardcore));
      document.body.classList.toggle('hardcore-armed', hardcore);
    }
    opts.forEach(b => b.addEventListener('click', () => {
      hardcore = b.dataset.diff === 'hardcore';
      try { localStorage.setItem(KEY, hardcore ? '1' : '0'); } catch (e) {}
      if (hardcore) AudioFx.boss(); else AudioFx.newRound();
      if (window.anime) anime({ targets: b, scale: [1, 1.08, 1], duration: 220 });
      paint();
    }));
    paint();
    return { isHardcore: () => hardcore };
  })();

  // ============================================================
  // TAUNTS — snarky distractions that try to break your focus.
  // Timed + event-driven; hardcore fires more often and nastier,
  // including a brief hand-speed "jolt" to derail your momentum.
  // ============================================================
  const Taunts = (() => {
    const GENERIC = [
      'Too slow.', 'Focus.', 'Is that all?', 'Predictable.', 'Yawn.',
      'Tick… tock… fail.', 'The clock is laughing.', 'Blink and you lose.',
      'You call that timing?', 'My circuits are bored.', 'Try harder.',
      'Are you even trying?', 'Sloppy.', 'Concentrate… or don\'t.',
    ];
    const MISS = [
      'HAH! Missed.', 'Ouch.', 'Embarrassing.', 'So close. Not really.',
      'The clock wins.', 'Did you even try?', 'Told you.', 'Oof.',
    ];
    const PROVOKE = [
      'Bet you choke now.', 'Getting cocky?', 'This is where you fall apart.',
      'Don\'t get comfortable.', 'A streak? Cute.', 'Now watch you crumble.',
      'Feeling confident? Mistake.',
    ];
    const HARDCORE = [
      'Give up.', 'You\'re wasting my time.', 'Delete the app.',
      'Painful to watch.', 'Zen mode is that way →', 'Quit while you can.',
      'Pathetic.',
    ];

    const arena = () => document.querySelector('.arena');
    const stage = () => document.querySelector('.clock-stage');
    const rand = (a) => a[Math.floor(Math.random() * a.length)];
    const active = () => State.spinning && !State.paused && !God.isActive();

    let timer = null;
    let currentEl = null;   // only one taunt visible at a time

    function schedule() {
      clearTimeout(timer);
      if (!State.spinning) return;
      const hc = State.hardcore;
      const min = hc ? 5000 : 9000;
      const max = hc ? 9000 : 16000;
      timer = setTimeout(() => {
        if (active() && State.round >= (hc ? 1 : 2)) fire(hc ? pickHardType() : 'nudge');
        schedule();
      }, min + Math.random() * (max - min));
    }
    function pickHardType() {
      const r = Math.random();
      if (r < 0.35) return 'sweep';
      if (r < 0.6) return 'glitch';
      if (r < 0.82) return 'banner';
      return 'nudge';
    }

    function start() { schedule(); }
    function stop() { clearTimeout(timer); timer = null; if (currentEl) { currentEl.remove(); currentEl = null; } }

    function onMiss() {
      if (!State.spinning || God.isActive()) return;
      setTimeout(() => { if (State.spinning && !God.isActive()) show('banner', rand(MISS)); }, 260);
    }
    function provoke() {
      if (!active()) return;
      show(State.hardcore ? 'glitch' : 'banner', rand(PROVOKE));
    }

    function textFor() {
      if (State.hardcore && Math.random() < 0.4) return rand(HARDCORE);
      return rand(GENERIC);
    }
    function fire(type) { if (active()) show(type, textFor()); }

    // Each taunt stays long enough to actually read (slides in, HOLDS, slides out).
    const DUR = { nudge: 2400, banner: 2800, sweep: 2000, glitch: 1500 };
    function show(type, text) {
      if (currentEl) { currentEl.remove(); currentEl = null; }
      AudioFx.taunt();
      let el;
      if (type === 'banner') el = banner(text);
      else if (type === 'sweep') el = sweepTaunt(text);
      else if (type === 'glitch') el = glitch(text);
      else el = nudge(text);
      currentEl = el;
      setTimeout(() => { if (el === currentEl) currentEl = null; if (el) el.remove(); }, DUR[type] || 2200);
    }

    function nudge(text) {
      const el = document.createElement('div');
      el.className = 'taunt taunt-nudge';
      el.textContent = text;
      document.body.appendChild(el);
      return el;
    }
    function banner(text) {
      const host = arena() || document.body;
      const el = document.createElement('div');
      el.className = 'taunt taunt-banner ' + (Math.random() < 0.5 ? 'from-left' : 'from-right');
      el.textContent = text;
      host.appendChild(el);
      return el;
    }
    function sweepTaunt(text) {
      const host = stage() || document.body;
      const el = document.createElement('div');
      el.className = 'taunt taunt-sweep';
      el.innerHTML = '<span></span>';
      el.querySelector('span').textContent = text;
      host.appendChild(el);
      if (State.hardcore) jolt(1.6, 420);
      return el;
    }
    function glitch(text) {
      const el = document.createElement('div');
      el.className = 'taunt taunt-glitch';
      el.setAttribute('data-text', text);
      el.textContent = text;
      (arena() || document.body).appendChild(el);
      document.body.classList.add('glitching');
      if (State.hardcore) jolt(1.5, 360);
      setTimeout(() => document.body.classList.remove('glitching'), 320);
      return el;
    }
    function jolt(factor, ms) {
      AudioFx.jolt();
      State.jolt = factor;
      setTimeout(() => { State.jolt = 1; }, ms);
    }

    return { start, stop, onMiss, provoke };
  })();

  // ============================================================
  // GOD MODE — invisible creator/demo cheat.
  // Password is verified by the Cloudflare Worker (ADMIN_CODE secret),
  // so it never ships in this file. Enabling it forces every strike to
  // land PERFECT and makes lives un-losable. Any run touched by GOD mode
  // is flagged State.godTainted and is never submitted to the leaderboard.
  // ============================================================
  const God = (() => {
    let active = false;
    let autopilot = false;
    let apTimer = null;
    const WORKER = ((window.CHRONOS_LB_CONFIG && window.CHRONOS_LB_CONFIG.workerUrl) || '')
      .trim().replace(/\/+$/, '');
    // Optional offline fallback: SHA-256 hex of the admin code. Leave '' to
    // require the worker (recommended). Set it if you demo with no network.
    const FALLBACK_HASH = '';

    const isActive = () => active;

    async function verify(code) {
      code = (code || '').trim();
      if (!code) return false;
      if (WORKER) {
        try {
          const res = await fetch(WORKER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verifyAdmin', code }),
          });
          if (res.ok) { const d = await res.json().catch(() => null); if (d && d.ok) return true; }
        } catch (e) { /* fall through to offline hash */ }
      }
      if (FALLBACK_HASH && window.crypto && crypto.subtle) {
        try {
          const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
          const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
          if (hex === FALLBACK_HASH) return true;
        } catch (e) {}
      }
      return false;
    }

    function enable() {
      active = true;
      if (State.started) State.godTainted = true;
      // top up lives instantly if a run is already in progress
      if (State.spinning && State.mode !== 'zen') {
        State.lives = State.mode === 'endless' ? 1 : 3;
        renderLives();
      }
      showIndicator();
    }

    function disable() {
      active = false;
      stopAutopilot();
      hideIndicator();
    }

    // ---- autopilot: strike automatically as the hand crosses each zone ----
    function startAutopilot() {
      autopilot = true;
      if (apTimer) return;
      apTimer = setInterval(() => {
        if (!active || !State.spinning || State.paused) return;
        const near = State.zones.some(z => !z.hit && z.type !== 'decoy'
          && angularDistance(State.handAngle, z.center) <= z.size / 2);
        if (near) strike();
      }, 60);
    }
    function stopAutopilot() {
      autopilot = false;
      if (apTimer) { clearInterval(apTimer); apTimer = null; }
    }
    function toggleAutopilot() {
      if (autopilot) stopAutopilot(); else startAutopilot();
      updateIndicator();
    }

    // ---- tiny indicator ----
    let indicatorEl = null;
    function showIndicator() {
      if (!indicatorEl) {
        indicatorEl = document.createElement('button');
        indicatorEl.className = 'god-indicator';
        indicatorEl.setAttribute('aria-label', 'GOD mode options');
        indicatorEl.addEventListener('click', openPanel);
        document.body.appendChild(indicatorEl);
      }
      indicatorEl.hidden = false;
      updateIndicator();
    }
    function hideIndicator() { if (indicatorEl) indicatorEl.hidden = true; }
    function updateIndicator() {
      if (!indicatorEl) return;
      indicatorEl.textContent = autopilot ? '◈▸' : '◈';
      indicatorEl.classList.toggle('auto', autopilot);
      indicatorEl.title = 'GOD mode' + (autopilot ? ' · autopilot' : '') + ' — click for options';
    }

    // ---- overlays (reuse .overlay / .overlay-card chrome) ----
    function buildOverlay(html) {
      const ov = document.createElement('div');
      ov.className = 'overlay god-overlay';
      ov.innerHTML = html;
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
      return ov;
    }

    function promptCode() {
      const ov = buildOverlay(`
        <div class="overlay-card god-card">
          <div class="god-glyph">◈</div>
          <h2>ADMIN ACCESS</h2>
          <input id="godCodeInput" type="password" placeholder="ENTER CODE" autocomplete="off" spellcheck="false" />
          <div class="god-error" id="godErr" hidden>Access denied.</div>
          <div class="god-actions">
            <button class="btn-primary" id="godGo">UNLOCK</button>
            <button class="btn-secondary" id="godCancel">CANCEL</button>
          </div>
        </div>`);
      const input = ov.querySelector('#godCodeInput');
      const err = ov.querySelector('#godErr');
      const go = ov.querySelector('#godGo');
      setTimeout(() => input.focus(), 120);
      const submit = async () => {
        go.disabled = true; go.textContent = 'CHECKING…'; err.hidden = true;
        const ok = await verify(input.value);
        if (ok) { enable(); ov.remove(); toast('◈ GOD MODE ENGAGED'); }
        else {
          go.disabled = false; go.textContent = 'UNLOCK';
          err.hidden = false; input.value = ''; input.focus();
        }
      };
      go.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      ov.querySelector('#godCancel').addEventListener('click', () => ov.remove());
    }

    function openPanel() {
      const ov = buildOverlay(`
        <div class="overlay-card god-card">
          <div class="god-glyph">◈</div>
          <h2>GOD MODE</h2>
          <p class="god-note">Every strike lands <strong>PERFECT</strong> · lives never fall.<br>This run is <strong>not ranked</strong>.</p>
          <label class="god-toggle"><input type="checkbox" id="godAuto" ${autopilot ? 'checked' : ''}/> Autopilot — hands-free demo</label>
          <div class="god-actions">
            <button class="btn-secondary" id="godClose">CLOSE</button>
            <button class="btn-primary danger" id="godOff">RETURN TO NORMAL</button>
          </div>
        </div>`);
      ov.querySelector('#godAuto').addEventListener('change', toggleAutopilot);
      ov.querySelector('#godClose').addEventListener('click', () => ov.remove());
      ov.querySelector('#godOff').addEventListener('click', () => { disable(); ov.remove(); toast('NORMAL MODE'); });
    }

    function toast(text) {
      const t = document.createElement('div');
      t.className = 'god-toast';
      t.textContent = text;
      document.body.appendChild(t);
      requestAnimationFrame(() => t.classList.add('show'));
      setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 1800);
    }

    // ---- secret triggers ----
    function open() { active ? openPanel() : promptCode(); }
    function armTriggers() {
      // 1) tap the CHRONOS logo 5× within 1.5s
      const logo = document.querySelector('.logo-title');
      if (logo) {
        let taps = [];
        logo.addEventListener('click', () => {
          const now = Date.now();
          taps = taps.filter(t => now - t < 1500);
          taps.push(now);
          if (taps.length >= 5) { taps = []; open(); }
        });
      }
      // 2) type "godmode" anywhere (outside form fields)
      let buf = '', bufTimer = null;
      addEventListener('keydown', (e) => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const k = (e.key || '').toLowerCase();
        if (k.length !== 1 || !/[a-z]/.test(k)) return;
        buf = (buf + k).slice(-8);
        clearTimeout(bufTimer);
        bufTimer = setTimeout(() => { buf = ''; }, 1200);
        if (buf.endsWith('godmode')) { buf = ''; open(); }
      });
    }

    return { isActive, enable, disable, armTriggers };
  })();
  God.armTriggers();

  // Expose the bits leaderboard.js needs for navigation
  window.ChronosGame = { showScreen, refreshMenuStats };

  // Initial menu render
  refreshMenuStats();
  if (window.anime) {
    anime({ targets: '.logo-ring', rotate: '360deg', duration: 12000, loop: true, easing: 'linear' });
    anime({ targets: '.menu-stats .stat-card', translateY: [30, 0], opacity: [0, 1], delay: anime.stagger(100, { start: 200 }), duration: 600, easing: 'easeOutCubic' });
    anime({ targets: '.menu-modes .mode-card', translateY: [40, 0], opacity: [0, 1], delay: anime.stagger(120, { start: 400 }), duration: 700, easing: 'easeOutBack' });
  }
})();
