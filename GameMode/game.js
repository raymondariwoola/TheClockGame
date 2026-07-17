// Chronos Strike — reflex-based timing challenge.
// Stop the clock at the right moment. Built on vanilla JS + anime.js.

(() => {
  'use strict';

  // ============================================================
  // CONFIG — single source of truth for tunable game constants.
  // Menu copy, difficulty scaling, and rank thresholds are all
  // rendered from here so the UI can never drift out of sync
  // (e.g. the old "25 rounds" label vs the real 40-round campaign).
  // ============================================================
  const CONFIG = {
    gameVersion: '1.1.0',   // bumped whenever balance/rules change
    rulesetVersion: 1,      // increment when scoring/generation changes competitively
    classicRounds: 40,      // length of the Classic campaign
    lives: { classic: 3, endless: 1, zen: 0 },
    modes: {
      classic: {
        emoji: '⚡', title: 'Classic',
        // {rounds} is interpolated so the copy always matches classicRounds
        desc: '{rounds} rounds, 3 lives, escalating mayhem',
      },
      endless: {
        emoji: '∞', title: 'Endless',
        desc: 'No end. One life. How far can you go?',
      },
      zen: {
        emoji: '🌀', title: 'Zen · Precision Lab',
        desc: 'Training lab — tune speed & zones, read your timing error, heat-map your strikes.',
      },
    },
    ranks: [
      { letter: 'S', minScore: 8000, minAcc: 90 },
      { letter: 'A', minScore: 5000, minAcc: 80 },
      { letter: 'B', minScore: 3000, minAcc: 65 },
      { letter: 'C', minScore: 1500, minAcc: 0 },
      { letter: 'D', minScore: 500,  minAcc: 0 },
      { letter: 'F', minScore: 0,    minAcc: 0 },
    ],
  };

  // ============================================================
  // RNG — versioned, seeded pseudo-random generator.
  // ALL gameplay generation (round params, modifiers, boss order,
  // power drops) draws from this single deterministic stream so a
  // given run identity reproduces the exact same challenge. Cosmetic
  // randomness (particles, starfield, taunts) stays on Math.random.
  //
  // Run identity that seeds the stream:
  //   gameVersion | rulesetVersion | mode | difficulty | seed
  // (assists are recorded in metadata but deliberately DO NOT change
  //  the seed, so an assisted run faces the identical challenge.)
  // ============================================================
  const RNG = (() => {
    const E = window.ChronosEngine;   // pure PRNG lives in engine.js (single source)
    let baseSeed = '';
    let main = E.wrap(Math.random);   // pre-seed fallback = native randomness

    return {
      seed(seedStr) { baseSeed = String(seedStr); main = E.makeRNG(baseSeed); },
      getSeed() { return baseSeed; },
      next: () => main.next(),
      range: (min, max) => main.range(min, max),
      int: (a, b) => main.int(a, b),
      pick: (arr) => main.pick(arr),
      chance: (p) => main.chance(p),
      // Independent sub-stream (e.g. for time-based modifier effects) that
      // won't disturb the main generation stream's ordering.
      spawn(label) { return E.makeRNG(baseSeed + '::' + label); },
    };
  })();

  // Render the mode-card descriptions from CONFIG so copy stays in sync.
  function applyMenuCopy() {
    Object.entries(CONFIG.modes).forEach(([mode, m]) => {
      const card = document.querySelector(`.mode-card[data-mode="${mode}"]`);
      if (!card) return;
      const descEl = card.querySelector('.mode-desc');
      if (descEl) descEl.textContent = m.desc.replace('{rounds}', CONFIG.classicRounds);
      const titleEl = card.querySelector('.mode-title');
      if (titleEl && m.title) titleEl.textContent = m.title;
    });
  }

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
    try { muted = localStorage.getItem('cs_mute_sfx') === '1'; } catch (e) {}
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
      metro()   { tone(1500, 0.03, 'sine', 0.06); },   // Precision Lab metronome tick
      ghost()   { tone(700, 0.04, 'sine', 0.045); },    // ghost-replay strike marker
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
      isMuted() { return muted; },
      setMuted(v) { muted = !!v; try { localStorage.setItem('cs_mute_sfx', muted ? '1' : '0'); } catch (e) {} },
      toggleMuted() { this.setMuted(!muted); return muted; },
    };
  })();

  // -------- Procedural music bed (WebAudio, fully offline) --------
  // A gentle generative loop used when a soundtrack file is missing or won't
  // play (e.g. there is no Normal.mp3). Guarantees every mode still has a
  // musical bed without shipping a binary asset. Per-mood so a future missing
  // Hardcore.mp3 would fall back to a darker, faster variant automatically.
  const ProceduralMusic = (() => {
    let ac = null, master = null;
    let playing = false, mood = 'normal';
    let timer = null, nextTime = 0, step = 0;

    const LOOKAHEAD = 0.12;   // seconds of audio scheduled ahead of the clock
    const TICK = 25;          // scheduler poll interval (ms)
    const A4 = 440;
    const hz = (semi) => A4 * Math.pow(2, semi / 12);   // semitones from A4 → Hz

    // Minor-key palettes: one triad chord per bar (semitones from A4), looped,
    // plus an 8-step eighth-note arpeggio pattern added onto the chord root.
    const MOODS = {
      normal: {
        bpm: 80, wave: 'triangle', cutoff: 1500, master: 0.16,
        chords: [[-12, -8, -5], [-3, 1, 4], [-8, -4, -1], [-10, -6, -3]],
        arp: [0, 7, 12, 7, 3, 10, 7, 12],
      },
      hardcore: {
        bpm: 128, wave: 'sawtooth', cutoff: 1000, master: 0.12,
        chords: [[-12, -9, -5], [-13, -10, -6], [-15, -12, -8], [-10, -7, -3]],
        arp: [0, 12, 7, 12, 0, 15, 7, 12],
      },
    };

    function ensure() {
      if (ac) return ac;
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ac = null; return null; }
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);
      return ac;
    }

    function voice(freq, t, dur, wave, gain, cutoff) {
      const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = cutoff;
      o.type = wave; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    function pad(chordSemis, t, dur, cfg) {
      chordSemis.forEach(s => {
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = cfg.cutoff * 0.8;
        o.type = 'sine'; o.frequency.value = hz(s + 12);
        o.detune.value = Math.random() * 6 - 3;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(master);
        o.start(t); o.stop(t + dur + 0.05);
      });
    }

    function scheduleStep(cfg, stepIdx, t) {
      const eighth = (60 / cfg.bpm) / 2;
      const barLen = eighth * 8;
      const chord = cfg.chords[Math.floor(stepIdx / 8) % cfg.chords.length];
      const inBar = stepIdx % 8;
      if (inBar === 0) {                                 // bass + pad on the downbeat
        voice(hz(chord[0] - 12), t, barLen * 0.9, cfg.wave, 0.10, cfg.cutoff * 0.6);
        pad(chord, t, barLen * 0.98, cfg);
      }
      const arpSemi = chord[0] + cfg.arp[inBar % cfg.arp.length];
      voice(hz(arpSemi), t, eighth * 0.9, cfg.wave, 0.05, cfg.cutoff);
    }

    function scheduler() {
      if (!playing || !ac) return;
      const cfg = MOODS[mood] || MOODS.normal;
      const eighth = (60 / cfg.bpm) / 2;
      while (nextTime < ac.currentTime + LOOKAHEAD) {
        scheduleStep(cfg, step, nextTime);
        nextTime += eighth;
        step++;
      }
    }

    function play(m) {
      mood = (m && MOODS[m]) ? m : 'normal';
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(MOODS[mood].master, ac.currentTime, 0.4);
      if (playing) return;                               // running already; mood updated live
      playing = true;
      nextTime = ac.currentTime + 0.08;
      if (!timer) timer = setInterval(scheduler, TICK);
    }

    function pause() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (ac && master) {
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(0, ac.currentTime, 0.2);
      }
    }

    function stop() { pause(); step = 0; }

    return { play, pause, stop };
  })();

  // -------- Soundtrack (Classic/Endless only, per-difficulty) --------
  // Streams the track from its URL (starts fast); the tiny service worker
  // (sw.js) caches the files so they aren't re-downloaded later. Zen has no
  // soundtrack. If a track file is missing/unplayable, we fall back to the
  // ProceduralMusic bed above so the mode is never silent by accident.
  const Music = (() => {
    const TRACKS = { normal: 'soundtrack/Normal.mp3', hardcore: 'soundtrack/Hardcore.mp3' };
    const VOLUME = 0.55;
    const unavailable = Object.create(null);   // track keys whose file failed to load

    let audio = null;
    let curKey = null;    // 'normal' | 'hardcore'
    let inGame = false;   // gameplay is active
    let paused = false;   // game is paused
    let muted = false;

    try { muted = localStorage.getItem('cs_mute_music') === '1'; } catch (e) {}

    const shouldPlay = () => inGame && !paused && !muted;
    const useProcedural = (key) => !TRACKS[key] || unavailable[key];

    function ensure(key) {
      if (audio && audio._key === key) return audio;
      if (audio) { try { audio.pause(); } catch (e) {} }
      audio = new Audio(TRACKS[key]);
      audio._key = key;
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = VOLUME;
      // Missing/unplayable file → remember it and switch to the procedural bed.
      audio.addEventListener('error', () => {
        unavailable[key] = true;
        if (curKey === key) { try { audio.pause(); } catch (e) {} audio = null; apply(); }
      }, { once: true });
      return audio;
    }

    function apply() {
      if (!curKey) return;
      if (useProcedural(curKey)) {
        if (audio) { try { audio.pause(); } catch (e) {} }
        if (shouldPlay()) ProceduralMusic.play(curKey);
        else ProceduralMusic.pause();
        return;
      }
      ProceduralMusic.pause();                          // silence synth when a real track plays
      const a = ensure(curKey);
      if (shouldPlay()) a.play().catch(() => {});       // autoplay can reject silently
      else { try { a.pause(); } catch (e) {} }
    }

    // difficulty: 'normal' | 'hardcore' | null (zen → no soundtrack)
    function start(difficulty) {
      if (!difficulty) { stop(); return; }
      inGame = true; paused = false; curKey = difficulty;
      apply();
    }
    function stop() {
      inGame = false;
      if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) {} }
      ProceduralMusic.stop();
    }
    function pause() {
      paused = true;
      if (audio) { try { audio.pause(); } catch (e) {} }
      ProceduralMusic.pause();
    }
    function resume() { paused = false; apply(); }
    function setMuted(v) {
      muted = !!v;
      try { localStorage.setItem('cs_mute_music', muted ? '1' : '0'); } catch (e) {}
      apply();
    }
    function isMuted() { return muted; }

    return { start, stop, pause, resume, setMuted, isMuted };
  })();

  // Register the tiny service worker that caches ONLY the soundtrack files
  // (everything else passes straight through — no stale HTML/JS).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

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
    boss: null,          // active boss encounter: { def, data } (see BOSSES)
    roundElapsed: 0,     // seconds since the current round's spin began (boss ticks)
    dailyRun: false,     // this run is today's Daily Rift
    rivalRun: false,     // this run is racing an imported Rival Code
    rivalRecord: null,   // the decoded rival ghost being raced
  };

  // -------- Modifiers --------
  const MODIFIERS = [
    { id: 'speed',    name: '⚡ HYPER SPEED',  apply: (st) => { st.handSpeed *= 1.7; } },
    { id: 'shrink',   name: '🎯 PRECISION',    apply: (st) => { st.zones.forEach(z => z.size = Math.max(6, z.size * 0.5)); } },
    { id: 'invert',   name: '🔄 INVERTED',     apply: (st) => { st.handDir = -1; } },
    { id: 'double',   name: '👯 DOUBLE HANDS', apply: (st) => {
        st.multiHand = true;
        st.hand2Angle = RNG.next() * 360;
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
        const base = RNG.next() * 360;
        st.zones = [0, 120, 240].map(off => ({
          center: (base + off) % 360,
          size: 36,
          color: 'rgba(255,224,102,0.85)',
        }));
      } },
    { id: 'quantum',  name: '⚛ QUANTUM',       apply: (st) => {
        // Teleports fire on a player-timed interval, so they draw from an
        // independent per-round sub-stream — that keeps the main generation
        // stream's ordering deterministic regardless of how long the player takes.
        const qr = RNG.spawn('quantum-r' + st.round);
        const teleport = () => {
          if (!st.spinning) return;
          st.zones.forEach(z => { if (!z.hit) z.center = qr.next() * 360; });
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
            center: (real.center + 90 * k + RNG.next() * 90) % 360,
            size: Math.max(18, real.size),
            type: 'decoy',
            color: 'rgba(255,64,96,0.75)',
          });
        });
      } },
    { id: 'pulse',    name: '💓 PULSE',        apply: (st) => { st.pulse = true; } },
  ];

  // -------- Bosses (distinct, telegraphed, deterministic every 5th round) --------
  // Each boss draws exactly ONE main-stream RNG value at setup (the placement
  // `base`), so the engine's determinism model stays valid — all variety comes
  // from the fixed cycle (ChronosEngine.bossTypeIndex) + time-based tick(), not
  // extra RNG. tick(st, dt, t) mutates zones/speed over the round (t = seconds
  // since the round began) and returns true when the zones need re-rendering.
  const BOSSES = [
    {
      id: 'twins', name: '⚔ THE TWINS', hint: 'Two targets — strike both!',
      color: 'rgba(255,224,102,0.95)',
      setup(st, base, size) {
        st.handSpeed *= 1.3; st.hitsRequired = 2;
        st.zones = [0, 180].map(off => ({
          center: (base + off) % 360, size: Math.max(16, size * 0.9), color: this.color, hit: false,
        }));
      },
    },
    {
      id: 'chronophage', name: '🕳 CHRONOPHAGE', hint: 'The zone is shrinking — strike fast!',
      color: 'rgba(139,92,255,0.95)',
      setup(st, base, size) {
        st.handSpeed *= 1.1; st.hitsRequired = 1;
        const start = Math.min(64, size * 1.4);
        st.zones = [{ center: base, size: start, color: this.color, hit: false }];
        st.boss.data = { start, floor: 12 };
      },
      tick(st, dt, t) {
        const d = st.boss.data, z = st.zones[0];
        if (!z || z.hit) return false;
        z.size = Math.max(d.floor, d.start - t * (d.start - d.floor) / 6); // gone by ~6s
        st.handSpeed += 12 * dt;                                           // and it speeds up
        return true;
      },
    },
    {
      id: 'pulse', name: '💓 PULSE ENGINE', hint: 'Strike when the zone opens wide.',
      color: 'rgba(45,255,170,0.95)',
      setup(st, base, size) {
        st.handSpeed *= 1.15; st.hitsRequired = 1;
        const mid = Math.max(18, size * 0.8);
        st.zones = [{ center: base, size: mid, color: this.color, hit: false }];
        st.boss.data = { mid, amp: mid * 0.7, freq: 3.0 };
      },
      tick(st, dt, t) {
        const d = st.boss.data, z = st.zones[0];
        if (!z || z.hit) return false;
        z.size = Math.max(6, d.mid + d.amp * Math.sin(t * d.freq));
        return true;
      },
    },
    {
      id: 'orbit', name: '🛸 ORBIT WARDEN', hint: 'The target is drifting — track it.',
      color: 'rgba(0,240,255,0.95)',
      setup(st, base, size) {
        st.handSpeed *= 1.1; st.hitsRequired = 1;
        st.zones = [{ center: base, size: Math.max(16, size * 0.95), color: this.color, hit: false }];
        // drift direction is deterministic from `base` (no extra RNG draw)
        st.boss.data = { base, drift: 42 * (Math.floor(base) % 2 === 0 ? 1 : -1) };
      },
      tick(st, dt, t) {
        const d = st.boss.data, z = st.zones[0];
        if (!z || z.hit) return false;
        z.center = (d.base + t * d.drift + 360) % 360;
        return true;
      },
    },
  ];

  // -------- Screen transitions --------
  function showScreen(id) {
    if (id === 'menu') {
      document.body.classList.remove('hardcore', 'endless');
      document.documentElement.style.setProperty('--vig', '0');
    }
    if (id !== 'game') Music.stop(); // soundtrack only lives on the game screen
    if (id !== 'game' && typeof Lab !== 'undefined') Lab.exit(); // Precision Lab is game-screen only
    if (id !== 'game' && typeof Ghost !== 'undefined') Ghost.clear(); // ghost markers are game-screen only
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
      State.roundElapsed += dt;
      // Boss encounters evolve over the round (shrink / pulse / drift).
      if (State.boss && State.boss.def.tick) {
        if (State.boss.def.tick(State, dt, State.roundElapsed)) renderZones(State.zones);
      }
      // Ghost replay: reveal the ghost's strike as its moment arrives.
      if (ghostActive()) Ghost.tick(State.round, State.roundElapsed * 1000);
      let speed = State.handSpeed;
      if (State.powers.freeze) speed = 0;
      else if (State.powers.slowmo) speed *= 0.35;
      if (State.pulse) speed *= 1 + 0.45 * Math.sin(ts * 0.004);
      if (State.jolt !== 1) speed *= State.jolt;
      // Precision Lab slow-mo (a deliberate practice aid, not a power).
      if (State.mode === 'zen' && Lab.isActive() && Lab.getConfig().slowmo) speed *= 0.4;
      const prevAngle = State.handAngle;
      State.handAngle = (State.handAngle + speed * State.handDir * dt + 360) % 360;
      if (State.multiHand) {
        State.hand2Angle = (State.hand2Angle + State.hand2Speed * State.hand2Dir * dt + 360) % 360;
      }
      // Metronome: tick each time the hand sweeps through the target centre.
      if (State.mode === 'zen' && Lab.isActive() && Lab.getConfig().metronome && State.zones[0]) {
        if (passedAngle(prevAngle, State.handAngle, State.zones[0].center, State.handDir)) {
          AudioFx.metro();
          elStrikeHint.classList.add('metro-flash');
          setTimeout(() => elStrikeHint.classList.remove('metro-flash'), 90);
        }
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

  const CLASSIC_ROUNDS = CONFIG.classicRounds; // single source of truth (see CONFIG)

  // -------- Difficulty curve (deterministic; logic in engine.js) --------
  // Classic/zen speed CAPS (beatable); Endless never caps — it keeps
  // accelerating until you crack, which is the whole point of survival.
  function roundParams(round, mode) {
    return ChronosEngine.roundParams(round, mode, State.hardcore, RNG);
  }

  // Returns a MODIFIER object or null. Selection index comes from the engine so
  // it's deterministic and unit-testable; we map it back to the local object
  // (whose .apply carries the visual/State side effects).
  function pickModifier(round, mode) {
    const i = ChronosEngine.pickModifier(round, mode, RNG, MODIFIERS.length);
    return i >= 0 ? MODIFIERS[i] : null;
  }

  // -------- Round setup --------
  function setupRound() {
    State.hitsRequired = 1;
    State.hitsDone = 0;
    State.multiHand = false;
    State.modifier = null;
    State.pulse = false;
    State.boss = null;
    State.roundElapsed = 0;
    State.bossRound = State.mode !== 'zen' && State.round > 1 && State.round % 5 === 0;
    elModifierTag.hidden = true;
    elModifierTag.classList.remove('boss');

    const { speed, size, dir } = roundParams(State.round, State.mode);
    State.handSpeed = speed;
    State.handDir = dir;
    State.handAngle = RNG.next() * 360;

    State.zones = [{
      center: RNG.next() * 360,
      size,
      color: 'rgba(45,255,170,0.85)',
      hit: false,
    }];

    if (State.bossRound) {
      // Distinct boss encounter, chosen by a fixed cycle (learnable order).
      // Exactly one RNG draw here (`base`) keeps engine determinism intact.
      const base = RNG.next() * 360;
      const idx = ChronosEngine.bossTypeIndex(State.round, State.mode, BOSSES.length);
      const boss = BOSSES[idx] || BOSSES[0];
      State.boss = { def: boss, data: {} };
      boss.setup(State, base, size);
      elModifierTag.textContent = `${boss.name} · 2× SCORE`;
      elModifierTag.classList.add('boss');
      elModifierTag.hidden = false;
      AudioFx.boss();
      flashJudgment(boss.name, 'great');
      // Telegraph the mechanic a beat later so it's readable, not noise.
      setTimeout(() => { if (State.spinning && State.boss && State.boss.def === boss) flashJudgment(boss.hint, 'good'); }, 800);
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

    // Precision Lab: Zen rounds use fixed, player-chosen parameters (the random
    // zone centre is kept for variety). No modifiers/bosses ever run in Zen.
    if (State.mode === 'zen' && Lab.isActive()) {
      const c = Lab.getConfig();
      State.handSpeed = c.speed;
      State.handDir = c.dir;
      if (State.zones[0]) State.zones[0].size = c.size;
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

    // Ghost replay (Daily or Rival): draw this round's markers + refresh HUD.
    if (ghostActive()) {
      Ghost.renderRound(State.round);
      Ghost.updateHud(State.round, State.score);
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

  // -------- Strike logic (timing/scoring math in engine.js) --------
  const angularDistance = ChronosEngine.angularDistance;
  const classify = ChronosEngine.classify;
  const passedAngle = ChronosEngine.passedCenter;   // Precision Lab metronome crossing

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

    // Remember this strike's angle + time-into-round for ghost recording,
    // captured now (the hand keeps moving before scoring resolves).
    State._lastStrike = { angle: ang, t: State.roundElapsed };

    // Precision Lab: log angular + timing error against the nearest zone.
    if (State.mode === 'zen' && Lab.isActive()) {
      const err = ChronosEngine.strikeError(ang, best.center, State.handDir, State.handSpeed);
      Precision.record(err, kind, ang);
    }

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

  const scoreFor = ChronosEngine.scoreFor;   // base hit-quality points (engine.js)

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
    if (Cheat.isActive()) gained *= Cheat.getMult(); // cheat: score multiplier (server-defined)
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

    logGhost(kind);

    if (State.hitsDone >= State.hitsRequired) {
      // round complete
      stopSpin();
      setTimeout(nextRound, 500);
    }
  }

  // Ghost recording/playback runs for both Daily Rift and Rival Code races.
  function ghostActive() { return State.dailyRun || State.rivalRun; }

  // Ghost replay: record the just-resolved strike and refresh HUD.
  function logGhost(kind) {
    if (!ghostActive()) return;
    const ls = State._lastStrike;
    Ghost.recordStrike(State.round, ls ? ls.angle : State.handAngle, kind, ls ? ls.t : State.roundElapsed, State.score);
    Ghost.updateHud(State.round, State.score);
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

    logGhost('miss');

    if (State.mode !== 'zen') {
      if (Cheat.isActive()) {
        // Cheat lives are a hidden pool — the HUD keeps showing full hearts and
        // never changes; only exhausting the whole pool ends the run.
        if (Cheat.consumeLife() <= 0) {
          State.lives = 0;            // so the game-over title reads correctly
          stopSpin();
          setTimeout(endGame, 600);
          return;
        }
      } else {
        State.lives--;
        renderLives();
        if (State.lives <= 0) {
          stopSpin();
          setTimeout(endGame, 600);
          return;
        }
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
    let r = RNG.next() * total, chosen = pool[pool.length - 1];
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

  // Fresh random seed for a normal run (stored so it can be shared/replayed).
  function newSeed() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  // Accessibility assists that materially change timing — recorded in run
  // metadata but NOT folded into the RNG seed, so an assisted run faces the
  // exact same generated challenge. (Placeholder until assists ship.)
  function collectAssists() { return {}; }
  // The identity that seeds the deterministic stream. Same identity ⇒ same run.
  // A Daily Rift depends only on rulesetVersion + date (NOT gameVersion), so the
  // day plays identically for everyone regardless of which patch they're on.
  function runIdentityString(mode) {
    if (State.rivalRun && State.rivalRecord) return State.rivalRecord.identity;
    if (State.dailyRun) return Daily.seedFor(State.dailyDate);
    const diff = State.hardcore ? 'hc' : 'n';
    return [CONFIG.gameVersion, CONFIG.rulesetVersion, mode, diff, State.seed].join('|');
  }

  function startMode(mode) {
    State.mode = mode;
    State.round = 1;
    State.score = 0;
    State.combo = 1;
    State.comboStreak = 0;
    State.hardcore = (mode === 'zen') ? false : Difficulty.isHardcore();
    // Daily Rift: fixed Normal difficulty and a date-pinned seed so the
    // challenge is identical for everyone (re-pinned here so RETRY replays it).
    if (State.dailyRun) {
      State.hardcore = false;
      State.forcedSeed = Daily.seedFor(State.dailyDate);
    }
    // Rival Code race: adopt the encoded difficulty so the rules match exactly
    // (the identity is supplied by runIdentityString → identical challenge).
    if (State.rivalRun && State.rivalRecord) {
      State.hardcore = !!State.rivalRecord.hardcore;
    }
    // Seed the deterministic run. A Daily/custom run can pin State.forcedSeed
    // before calling startMode; otherwise we mint a fresh, shareable seed.
    State.seed = State.forcedSeed || newSeed();
    State.forcedSeed = null;                 // one-shot
    State.assists = collectAssists();
    State.runId = 'r_' + State.seed;
    RNG.seed(runIdentityString(mode));
    // Ghost replay: record this run and load a ghost to race, if any.
    if (State.dailyRun) {
      Ghost.startRecording(runIdentityString(mode), { mode, hardcore: false, date: State.dailyDate });
      Ghost.loadForToday(State.dailyDate);
    } else if (State.rivalRun) {
      Ghost.startRecording(runIdentityString(mode), { mode, hardcore: State.hardcore, date: 'rival' });
      Ghost.loadFromRecord(State.rivalRecord);   // race the imported rival ghost
    } else {
      Ghost.clear();
    }
    // Classic always has 3 lives (hardcore adds pressure via speed + taunts,
    // not fewer lives); endless is a single-life survival run.
    State.maxLives = mode === 'endless' ? 1 : (mode === 'zen' ? 0 : 3);
    State.lives = mode === 'zen' ? 999 : State.maxLives;
    State.survivalMult = 1;
    State.jolt = 1;
    document.body.classList.toggle('hardcore', State.hardcore);
    document.body.classList.toggle('endless', mode === 'endless');
    if (Cheat.isActive()) Cheat.resetLives(); // refill the hidden cheat pool for the new run
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
    // Precision Lab lives on the Zen game screen; hide it for other modes.
    if (mode === 'zen') Lab.enter(); else Lab.exit();
    showScreen('game');
    // Soundtrack: Classic/Endless only, chosen by difficulty. Zen stays silent.
    Music.start(mode === 'zen' ? null : (State.hardcore ? 'hardcore' : 'normal'));
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
    const rankLetter = computeRank(State.score, acc, State.perfectHits);
    $('overAcc').textContent = acc + '%';
    $('overRank').textContent = rankLetter;
    $('newBest').hidden = !newBestScore;
    $('overTitle').textContent = State.lives <= 0 ? 'GAME OVER' : 'RUN COMPLETE';

    showScreen('over');
    refreshMenuStats();

    if (window.anime) {
      anime({ targets: '.over-stat', translateY: [40, 0], opacity: [0, 1], delay: anime.stagger(80), duration: 600, easing: 'easeOutCubic' });
      anime({ targets: '.over-title', scale: [0.6, 1], opacity: [0, 1], duration: 700, easing: 'easeOutBack' });
    }

    const runStats = {
      score: State.score,
      mode: State.mode,
      round: State.round,
      combo: State.bestCombo,
      acc,
      perfect: State.perfectHits,
      god: State.godTainted,
      hc: State.hardcore,
      rankLetter,
      // Ruleset identity — lets scores stay comparable across balance changes,
      // powers Daily/replay validation, and categorises assisted runs.
      gameVersion: CONFIG.gameVersion,
      rulesetVersion: CONFIG.rulesetVersion,
      seed: State.seed,
      runId: State.runId,
      assists: State.assists || {},
      cheat: (typeof Cheat !== 'undefined' && Cheat.isActive()) || false,
      // Daily Rift metadata (present only on daily runs).
      daily: !!State.dailyRun,
      dailyDate: State.dailyRun ? State.dailyDate : null,
      riftName: State.dailyRun ? Daily.nameFor(State.dailyDate) : null,
    };

    // Daily Rift: record the local best/attempts for today (never global yet).
    if (State.dailyRun) {
      Daily.recordResult(runStats);
      runStats.ghostBeaten = Ghost.hasGhost() && State.score > Ghost.ghostScore();
      Ghost.saveIfBest();   // keep the best run of the day as the ghost
    }
    // Rival Code race: annotate the result (never touches the global board).
    if (State.rivalRun && State.rivalRecord) {
      runStats.rival = true;
      runStats.rivalName = State.rivalRecord.name || 'Rival';
      runStats.rivalScore = State.rivalRecord.score || 0;
      runStats.beatRival = State.score > runStats.rivalScore;
    }
    // "Challenge a friend" — offer to copy this run as a Rival Code when it was
    // a recorded run (Daily or Rival) with at least one strike.
    updateChallengeButton();

    // shareable score card (share.js) — gets the global rank later, if any
    if (window.ChronosShare) window.ChronosShare.setStats(runStats);

    // global leaderboard qualification check (leaderboard.js)
    if (window.ChronosLB) window.ChronosLB.onGameEnd(runStats);
  }

  function computeRank(score, acc, perfect) {
    // Thresholds live in CONFIG.ranks (ordered best → worst); logic in engine.js.
    return ChronosEngine.computeRank(CONFIG.ranks, score, acc);
  }

  // Show/wire the game-over "Challenge a friend" button for recorded runs.
  function updateChallengeButton() {
    const btn = document.getElementById('challengeBtn');
    if (!btn) return;
    const canShare = ghostActive() && Ghost.recordedCount() > 0;
    btn.hidden = !canShare;
    if (!canShare) return;
    btn.onclick = async () => {
      const code = Rival.encodeCurrentRun();
      if (!code) { Rival.toast('Nothing to share yet'); return; }
      const ok = await Rival.copy(code);
      Rival.toast(ok ? '🏁 Rival Code copied — challenge a friend!' : 'Copy failed — see console');
      if (!ok) console.log('Rival Code:', code);
    };
  }

  function refreshMenuStats() {
    $('menuBest').textContent = loadInt(LS.bestScore);
    $('menuCombo').textContent = loadInt(LS.bestCombo);
    $('menuRound').textContent = loadInt(LS.bestRound);
    Daily.render();
  }

  // -------- Pause --------
  function togglePause(force) {
    if (!State.spinning) return;
    State.paused = force != null ? force : !State.paused;
    elPauseOverlay.hidden = !State.paused;
    if (State.paused) Music.pause(); else Music.resume();
  }

  // -------- Bindings --------
  $$('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      State.dailyRun = false; State.rivalRun = false;   // a normal mode pick leaves Daily/Rival
      if (window.anime) {
        anime({ targets: btn, scale: [1, 1.1, 1], duration: 250 });
      }
      setTimeout(() => startMode(mode), 200);
    });
  });

  // Daily Rift launch
  const dailyPlayBtn = $('dailyPlayBtn');
  if (dailyPlayBtn) dailyPlayBtn.addEventListener('click', (e) => {
    if (window.anime) anime({ targets: dailyPlayBtn, scale: [1, 1.08, 1], duration: 220 });
    setTimeout(() => Daily.play(e), 180);
  });

  // Rival Codes: share your best Daily ghost, or paste a code to race one.
  const dailyChallengeBtn = $('dailyChallengeBtn');
  if (dailyChallengeBtn) dailyChallengeBtn.addEventListener('click', async () => {
    const code = Rival.encodeStoredDaily(Daily.todayKey());
    if (!code) { Rival.toast('Play the rift first to create a ghost'); return; }
    const ok = await Rival.copy(code);
    Rival.toast(ok ? '🏁 Rival Code copied — challenge a friend!' : 'Copy failed — see console');
    if (!ok) console.log('Rival Code:', code);
  });
  const rivalRaceBtn = $('rivalRaceBtn'), rivalInput = $('rivalInput'), rivalError = $('rivalError');
  function doRivalRace() {
    if (!rivalInput) return;
    const started = Rival.startRace(rivalInput.value);
    if (!started) {
      if (rivalError) { rivalError.textContent = 'That doesn\'t look like a valid Rival Code.'; rivalError.hidden = false; }
    } else if (rivalError) { rivalError.hidden = true; rivalInput.value = ''; }
  }
  if (rivalRaceBtn) rivalRaceBtn.addEventListener('click', doRivalRace);
  if (rivalInput) rivalInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRivalRace(); });

  elStrikeBtn.addEventListener('click', strike);
  elPauseBtn.addEventListener('click', () => togglePause());
  $('resumeBtn').addEventListener('click', () => togglePause(false));

  // -------- Audio controls: mute music / SFX independently --------
  (() => {
    const btn = $('audioBtn'), pop = $('audioPop');
    const mRow = $('toggleMusic'), sRow = $('toggleSfx');
    const mState = $('musicState'), sState = $('sfxState');
    if (!btn || !pop) return;
    function sync() {
      const mOn = !Music.isMuted(), sOn = !AudioFx.isMuted();
      mState.textContent = mOn ? 'ON' : 'OFF';
      sState.textContent = sOn ? 'ON' : 'OFF';
      mRow.classList.toggle('off', !mOn);
      sRow.classList.toggle('off', !sOn);
      btn.textContent = (mOn || sOn) ? '🔊' : '🔇';
      btn.classList.toggle('muted', !(mOn || sOn));
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; });
    mRow.addEventListener('click', () => { Music.setMuted(!Music.isMuted()); sync(); });
    sRow.addEventListener('click', () => { AudioFx.setMuted(!AudioFx.isMuted()); sync(); });
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !e.target.closest('.audio-ctrl')) pop.hidden = true;
    });
    sync();
  })();
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
  // CHEAT MODE — a real, RANKED cheat (unlike GOD/admin demo mode).
  // The passphrase is verified by the Cloudflare Worker (CHEAT_CODE secret),
  // and the modifiers themselves (score multiplier, unlimited lives) come
  // back FROM the worker env — so the exact values aren't baked into this file.
  // Cheat runs ARE submitted to the leaderboard like any normal run.
  // ============================================================
  const Cheat = (() => {
    let active = false;
    let mult = 3;          // score multiplier (from the worker)
    let lives = 9999;      // total cheat lives (from the worker) — hidden from the HUD
    let livesLeft = 9999;  // remaining this run
    const WORKER = ((window.CHRONOS_LB_CONFIG && window.CHRONOS_LB_CONFIG.workerUrl) || '')
      .trim().replace(/\/+$/, '');

    const isActive = () => active;
    const getMult = () => (active ? mult : 1);
    const resetLives = () => { livesLeft = lives; };     // call at the start of each run
    const consumeLife = () => --livesLeft;               // returns lives remaining

    async function verify(code) {
      code = (code || '').trim();
      if (!code || !WORKER) return null;
      try {
        const res = await fetch(WORKER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verifyCheat', code }),
        });
        if (res.ok) { const d = await res.json().catch(() => null); if (d && d.ok) return d; }
      } catch (e) {}
      return null;
    }

    function enable(mods) {
      active = true;
      mods = mods || {};
      mult = (typeof mods.mult === 'number' && mods.mult > 0) ? mods.mult : 3;
      lives = (typeof mods.lives === 'number' && mods.lives >= 1) ? Math.floor(mods.lives) : 9999;
      livesLeft = lives;
      if (typeof God !== 'undefined' && God.isActive()) God.disable(); // mutually exclusive
      // mask any hearts already lost — the HUD goes back to showing full lives
      if (State.spinning && State.mode !== 'zen') { State.lives = State.maxLives; renderLives(); }
      showIndicator();
    }
    function disable() { active = false; hideIndicator(); }

    // ---- tiny indicator (distinct from GOD's gold ◈) ----
    let indicatorEl = null;
    function showIndicator() {
      if (!indicatorEl) {
        indicatorEl = document.createElement('button');
        indicatorEl.className = 'cheat-indicator';
        indicatorEl.textContent = '❖';
        indicatorEl.title = 'Cheat mode — click for options';
        indicatorEl.setAttribute('aria-label', 'Cheat mode options');
        indicatorEl.addEventListener('click', openPanel);
        document.body.appendChild(indicatorEl);
      }
      indicatorEl.hidden = false;
    }
    function hideIndicator() { if (indicatorEl) indicatorEl.hidden = true; }

    function buildOverlay(html) {
      const ov = document.createElement('div');
      ov.className = 'overlay god-overlay';
      ov.innerHTML = html;
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
      return ov;
    }
    function toast(text) {
      const t = document.createElement('div');
      t.className = 'god-toast cheat-toast';
      t.textContent = text;
      document.body.appendChild(t);
      requestAnimationFrame(() => t.classList.add('show'));
      setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 1800);
    }

    function promptCode() {
      const ov = buildOverlay(`
        <div class="overlay-card god-card cheat-card">
          <div class="god-glyph cheat-glyph">❖</div>
          <h2>CHEAT CODE</h2>
          <input id="cheatCodeInput" type="password" placeholder="ENTER CODE" autocomplete="off" spellcheck="false" />
          <div class="god-error" id="cheatErr" hidden>Access denied.</div>
          <div class="god-actions">
            <button class="btn-primary" id="cheatGo">UNLOCK</button>
            <button class="btn-secondary" id="cheatCancel">CANCEL</button>
          </div>
        </div>`);
      const input = ov.querySelector('#cheatCodeInput');
      const err = ov.querySelector('#cheatErr');
      const go = ov.querySelector('#cheatGo');
      setTimeout(() => input.focus(), 120);
      const submit = async () => {
        go.disabled = true; go.textContent = 'CHECKING…'; err.hidden = true;
        const res = await verify(input.value);
        if (res) { enable(res); ov.remove(); toast('❖ CHEAT ENGAGED'); }
        else {
          go.disabled = false; go.textContent = 'UNLOCK';
          err.hidden = false; input.value = ''; input.focus();
        }
      };
      go.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      ov.querySelector('#cheatCancel').addEventListener('click', () => ov.remove());
    }

    function openPanel() {
      const ov = buildOverlay(`
        <div class="overlay-card god-card cheat-card">
          <div class="god-glyph cheat-glyph">❖</div>
          <h2>CHEAT MODE</h2>
          <p class="god-note">Modifiers active. This run <strong>counts</strong> on the leaderboard.</p>
          <div class="god-actions">
            <button class="btn-secondary" id="cheatClose">CLOSE</button>
            <button class="btn-primary danger" id="cheatOff">RETURN TO NORMAL</button>
          </div>
        </div>`);
      ov.querySelector('#cheatClose').addEventListener('click', () => ov.remove());
      ov.querySelector('#cheatOff').addEventListener('click', () => { disable(); ov.remove(); toast('NORMAL MODE'); });
    }

    return { isActive, getMult, resetLives, consumeLife, enable, disable, promptCode, openPanel };
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
      if (typeof Cheat !== 'undefined' && Cheat.isActive()) Cheat.disable(); // mutually exclusive
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

    // ---- direct admin entry (used by the typed 'godmode' shortcut) ----
    function open() { active ? openPanel() : promptCode(); }

    // ---- chooser: pick ADMIN (demo) or CHEAT (ranked) before entering a code ----
    function openChooser() {
      if (active) return openPanel();                 // admin already on → its panel
      if (Cheat.isActive()) return Cheat.openPanel();  // cheat already on → its panel
      const ov = buildOverlay(`
        <div class="overlay-card god-card">
          <div class="god-glyph">◈</div>
          <h2>ACCESS</h2>
          <p class="god-note">Choose an access mode, then enter its passphrase.</p>
          <div class="god-actions">
            <button class="btn-primary" id="chCheat">❖ CHEAT CODE</button>
            <button class="btn-primary" id="chAdmin">◈ ADMIN · DEMO</button>
          </div>
          <div class="god-actions">
            <button class="btn-secondary" id="chCancel">CANCEL</button>
          </div>
        </div>`);
      ov.querySelector('#chCheat').addEventListener('click', () => { ov.remove(); Cheat.promptCode(); });
      ov.querySelector('#chAdmin').addEventListener('click', () => { ov.remove(); promptCode(); });
      ov.querySelector('#chCancel').addEventListener('click', () => ov.remove());
    }

    // ---- secret triggers ----
    function armTriggers() {
      // 1) tap the CHRONOS logo 5× within 1.5s → chooser
      const logo = document.querySelector('.logo-title');
      if (logo) {
        let taps = [];
        logo.addEventListener('click', () => {
          const now = Date.now();
          taps = taps.filter(t => now - t < 1500);
          taps.push(now);
          if (taps.length >= 5) { taps = []; openChooser(); }
        });
      }
      // 2) typed shortcuts anywhere (outside form fields):
      //    "godmode" → admin prompt, "cheat" → cheat prompt
      let buf = '', bufTimer = null;
      addEventListener('keydown', (e) => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const k = (e.key || '').toLowerCase();
        if (k.length !== 1 || !/[a-z]/.test(k)) return;
        buf = (buf + k).slice(-8);
        clearTimeout(bufTimer);
        bufTimer = setTimeout(() => { buf = ''; }, 1200);
        if (buf.endsWith('godmode')) { buf = ''; open(); }
        else if (buf.endsWith('cheat')) { buf = ''; Cheat.isActive() ? Cheat.openPanel() : Cheat.promptCode(); }
      });
    }

    return { isActive, enable, disable, armTriggers };
  })();
  God.armTriggers();

  // Expose the bits leaderboard.js needs for navigation
  // ============================================================
  // PRECISION LAB — Zen becomes a training environment.
  //   • Precision: per-strike angular/timing error, heat-map, tendency summary.
  //   • Lab: live config (speed / zone width / direction / slow-mo / metronome)
  //     + quick presets, persisted per device.
  // Strike-error math is pure and lives in engine.js (strikeError), so it's
  // unit-tested and identical to what the game shows.
  // ============================================================
  const Precision = (() => {
    const MAX = 100;                 // rolling window of recent strikes
    let strikes = [];
    const heatEl = () => document.getElementById('labHeat');

    function reset() {
      strikes = [];
      const h = heatEl(); if (h) h.innerHTML = '';
      const r = document.getElementById('labReadout'); if (r) { r.textContent = ''; r.className = 'lab-readout'; }
      renderSummary();
    }

    function record(err, kind, angle) {
      strikes.push({ signedMs: err.signedMs, deg: err.deg, ms: err.ms, early: err.early, late: err.late, kind });
      if (strikes.length > MAX) strikes.shift();
      showReadout(err, kind);
      addHeat(angle, kind);
      renderSummary();
    }

    function showReadout(err, kind) {
      const el = document.getElementById('labReadout'); if (!el) return;
      if (err.deg < 0.05) {
        el.textContent = 'PERFECT · dead centre';
      } else {
        const dir = err.early ? 'early' : 'late';
        el.textContent = `${err.deg.toFixed(1)}° ${dir} · ${Math.round(err.ms)} ms ${dir}`;
      }
      const tone = kind === 'perfect' ? 'perfect' : kind === 'miss' ? 'miss' : 'ok';
      el.className = 'lab-readout show ' + tone;
      void el.offsetWidth;             // retrigger the pop animation
      el.classList.add('flash');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show', 'flash'), 1500);
    }

    function addHeat(angle, kind) {
      const h = heatEl(); if (!h) return;
      const a = (angle - 90) * Math.PI / 180;
      const r = 230;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', 300 + Math.cos(a) * r);
      c.setAttribute('cy', 300 + Math.sin(a) * r);
      c.setAttribute('r', kind === 'perfect' ? 7 : 5);
      const color = kind === 'perfect' ? '#2dffaa' : kind === 'great' ? '#00f0ff'
        : kind === 'good' ? '#ffe066' : '#ff4060';
      c.setAttribute('fill', color);
      c.setAttribute('opacity', 0.55);
      h.appendChild(c);
      // fade older dots by lowering opacity, and cap DOM to MAX
      const dots = h.childNodes;
      for (let i = 0; i < dots.length; i++) {
        const age = dots.length - i;
        dots[i].setAttribute('opacity', Math.max(0.12, 0.6 - age * 0.006).toFixed(3));
      }
      while (h.childNodes.length > MAX) h.removeChild(h.firstChild);
    }

    function renderSummary() {
      const el = document.getElementById('labSummary'); if (!el) return;
      const n = strikes.length;
      if (!n) { el.textContent = 'No strikes yet — start striking to profile your timing.'; return; }
      const meanMs = strikes.reduce((s, x) => s + x.signedMs, 0) / n;
      const perfects = strikes.filter(x => x.kind === 'perfect').length;
      const hits = strikes.filter(x => x.kind !== 'miss').length;
      const bias = Math.abs(meanMs) < 3 ? 'dead on' : `${Math.abs(meanMs).toFixed(0)} ms ${meanMs < 0 ? 'early' : 'late'}`;
      el.innerHTML = `Avg: <b>${bias}</b> · ${Math.round(perfects / n * 100)}% perfect · ` +
        `${Math.round(hits / n * 100)}% on target · ${n} strike${n === 1 ? '' : 's'}`;
    }

    return { record, reset, renderSummary };
  })();

  const Lab = (() => {
    const STORE = 'cs_lab_v1';
    const DEFAULTS = { speed: 130, size: 40, dir: 1, slowmo: false, metronome: false };
    const PRESETS = {
      slow:    { speed: 90,  size: 46, dir: 1,  slowmo: false },
      fast:    { speed: 420, size: 34, dir: 1,  slowmo: false },
      reverse: { speed: 180, size: 40, dir: -1, slowmo: false },
      tight:   { speed: 200, size: 16, dir: 1,  slowmo: false },
      boss:    { speed: 300, size: 22, dir: -1, slowmo: false },
    };
    let cfg = load();
    let wired = false;

    function load() {
      try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || '{}')); }
      catch { return Object.assign({}, DEFAULTS); }
    }
    function save() { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch {} }
    function getConfig() { return cfg; }
    function isActive() { return State.mode === 'zen'; }

    function enter() {
      const panel = document.getElementById('labPanel');
      if (panel) panel.hidden = false;
      document.body.classList.add('lab');
      Precision.reset();
      wire();
      paint();
    }
    function exit() {
      const panel = document.getElementById('labPanel');
      if (panel) panel.hidden = true;
      document.body.classList.remove('lab');
    }

    // Apply live changes to the running round without waiting for the next one.
    function applyLive() {
      if (!isActive()) return;
      State.handSpeed = cfg.speed;
      State.handDir = cfg.dir;
      if (State.zones[0]) { State.zones[0].size = cfg.size; renderZones(State.zones); }
    }

    function paint() {
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      const val = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      val('labSpeed', cfg.speed); set('labSpeedVal', cfg.speed);
      val('labSize', cfg.size); set('labSizeVal', cfg.size);
      const dirBtn = document.getElementById('labDir');
      if (dirBtn) dirBtn.textContent = cfg.dir === 1 ? '↻ CW' : '↺ CCW';
      const slow = document.getElementById('labSlow');
      if (slow) slow.classList.toggle('on', cfg.slowmo);
      const metro = document.getElementById('labMetro');
      if (metro) metro.classList.toggle('on', cfg.metronome);
    }

    function wire() {
      if (wired) return; wired = true;
      const speed = document.getElementById('labSpeed');
      const size = document.getElementById('labSize');
      if (speed) speed.addEventListener('input', () => {
        cfg.speed = parseInt(speed.value, 10);
        document.getElementById('labSpeedVal').textContent = cfg.speed;
        save(); applyLive();
      });
      if (size) size.addEventListener('input', () => {
        cfg.size = parseInt(size.value, 10);
        document.getElementById('labSizeVal').textContent = cfg.size;
        save(); applyLive();
      });
      const dirBtn = document.getElementById('labDir');
      if (dirBtn) dirBtn.addEventListener('click', () => { cfg.dir = -cfg.dir; save(); paint(); applyLive(); AudioFx.newRound(); });
      const slow = document.getElementById('labSlow');
      if (slow) slow.addEventListener('click', () => { cfg.slowmo = !cfg.slowmo; save(); paint(); });
      const metro = document.getElementById('labMetro');
      if (metro) metro.addEventListener('click', () => { cfg.metronome = !cfg.metronome; save(); paint(); });
      document.querySelectorAll('.lab-presets [data-preset]').forEach(b => {
        b.addEventListener('click', () => {
          const p = PRESETS[b.dataset.preset]; if (!p) return;
          cfg = Object.assign({}, DEFAULTS, cfg, p);
          save(); paint(); applyLive(); AudioFx.powerup();
        });
      });
      const reset = document.getElementById('labReset');
      if (reset) reset.addEventListener('click', () => { Precision.reset(); AudioFx.strike(); });
    }

    return { enter, exit, getConfig, isActive, applyLive };
  })();

  // ============================================================
  // GHOST REPLAY — race your best Daily run.
  // A run's absolute timeline is player-paced (rounds only advance on a hit),
  // so ghosts are stored PER ROUND: for each round we keep where and how long
  // into the round the previous best run struck. Because the Daily seed is
  // fixed, round N's zones/hand are identical between runs, so the ghost's
  // strike angle is a directly comparable target on the same clock.
  // ============================================================
  const Ghost = (() => {
    const STORE = 'cs_ghost_daily_v1';
    const NS = 'http://www.w3.org/2000/svg';
    let recording = null;   // the run currently being recorded (Daily only)
    let playback = null;    // the loaded best-run ghost for today (indexed)
    let revealed = null;    // Set of ghost-strike keys already pulsed this round
    const layer = () => document.getElementById('ghostLayer');

    // ---- recording ----
    function startRecording(identity, meta) {
      recording = {
        identity, mode: meta.mode, hardcore: !!meta.hardcore, date: meta.date,
        gameVersion: CONFIG.gameVersion, rulesetVersion: CONFIG.rulesetVersion,
        score: 0, rounds: 0, strikes: [],
      };
    }
    function recordStrike(round, angle, kind, tSeconds, cumScore) {
      if (!recording) return;
      recording.strikes.push({ round, angle: +(+angle).toFixed(2), kind, t: Math.round(tSeconds * 1000), s: cumScore });
      recording.score = cumScore;
      recording.rounds = round;
    }
    function recordedCount() { return recording ? recording.strikes.length : 0; }

    // ---- persistence ----
    function saveIfBest() {
      if (!recording || !recording.strikes.length) return false;
      let prev = null; try { prev = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch {}
      if (prev && prev.date === recording.date && prev.score >= recording.score) return false;
      try { localStorage.setItem(STORE, JSON.stringify(recording)); } catch {}
      return true;
    }
    function storedForDate(dateKey) {
      let g = null; try { g = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch {}
      return (g && g.date === dateKey && Array.isArray(g.strikes) && g.strikes.length) ? g : null;
    }

    // ---- playback ----
    function loadForToday(dateKey) {
      const g = storedForDate(dateKey);
      if (!g) { playback = null; return null; }
      const idx = ChronosEngine.indexReplay(g.strikes);
      playback = { score: g.score, rounds: g.rounds, byRound: idx.byRound, scoreByRound: idx.scoreByRound, maxRound: idx.maxRound };
      return playback;
    }
    // Load a ghost straight from a record object (used by Rival Codes).
    function loadFromRecord(rec) {
      if (!rec || !Array.isArray(rec.strikes) || !rec.strikes.length) { playback = null; return null; }
      const idx = ChronosEngine.indexReplay(rec.strikes);
      playback = { score: rec.score || 0, rounds: rec.rounds || 0, name: rec.name || 'Rival',
        byRound: idx.byRound, scoreByRound: idx.scoreByRound, maxRound: idx.maxRound };
      return playback;
    }
    function getRecording() { return recording; }
    function hasGhost() { return !!playback; }
    function ghostScore() { return playback ? playback.score : 0; }
    function ghostName() { return playback ? (playback.name || 'Ghost') : 'Ghost'; }
    function ghostScoreThroughRound(r) {
      if (!playback) return 0;
      if (r >= playback.maxRound) return playback.score;
      return playback.scoreByRound[r] != null ? playback.scoreByRound[r] : 0;
    }

    // Draw this round's ghost strike markers (faint until their moment arrives).
    function renderRound(round) {
      revealed = new Set();
      const l = layer(); if (!l) return;
      l.innerHTML = '';
      if (!playback || !playback.byRound[round]) return;
      playback.byRound[round].forEach((s, i) => {
        const a = (s.angle - 90) * Math.PI / 180;
        const x2 = 300 + Math.cos(a) * 230, y2 = 300 + Math.sin(a) * 230;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', 300); line.setAttribute('y1', 300);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', 'rgba(255,255,255,0.22)');
        line.setAttribute('stroke-width', 3);
        line.setAttribute('stroke-dasharray', '4 7');
        line.setAttribute('stroke-linecap', 'round');
        l.appendChild(line);
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', x2); dot.setAttribute('cy', y2); dot.setAttribute('r', 8);
        dot.setAttribute('fill', 'none');
        dot.setAttribute('stroke', 'rgba(255,255,255,0.45)');
        dot.setAttribute('stroke-width', 2);
        dot.dataset.key = 'g' + round + '-' + i;
        l.appendChild(dot);
      });
    }

    // Called each frame: when the ghost's strike time passes, pulse its marker.
    function tick(round, elapsedMs) {
      if (!playback || !revealed || !playback.byRound[round]) return;
      playback.byRound[round].forEach((s, i) => {
        const key = 'g' + round + '-' + i;
        if (!revealed.has(key) && elapsedMs >= s.t) {
          revealed.add(key);
          AudioFx.ghost();
          const dot = layer() && layer().querySelector(`[data-key="${key}"]`);
          if (dot) {
            dot.setAttribute('stroke', s.kind === 'miss' ? 'rgba(255,64,96,0.9)' : 'rgba(255,255,255,0.95)');
            dot.setAttribute('stroke-width', 4);
            dot.setAttribute('r', 11);
          }
        }
      });
    }

    // Live "you vs ghost" HUD, refreshed after each of your strikes.
    function updateHud(currentRound, yourScore) {
      const el = document.getElementById('ghostHud');
      if (!el) return;
      if (!playback) { el.hidden = true; return; }
      const gAt = ghostScoreThroughRound(currentRound);
      const delta = yourScore - gAt;
      const sign = delta >= 0 ? '+' : '−';
      el.hidden = false;
      el.className = 'ghost-hud' + (delta >= 0 ? ' ahead' : ' behind');
      const label = playback.name ? `${playback.name} ` : '';
      el.innerHTML = `👻 ${label}${ghostScore().toLocaleString()} · <b>${sign}${Math.abs(delta).toLocaleString()}</b>`;
    }

    function clear() {
      const l = layer(); if (l) l.innerHTML = '';
      revealed = null;
      const el = document.getElementById('ghostHud'); if (el) el.hidden = true;
    }

    return {
      startRecording, recordStrike, recordedCount, saveIfBest, storedForDate,
      loadForToday, loadFromRecord, getRecording, hasGhost, ghostScore, ghostName,
      ghostScoreThroughRound, renderRound, tick, updateHud, clear,
    };
  })();

  // ============================================================
  // RIVAL CODES — export a ghost as a paste-safe code; import one to race the
  // EXACT same challenge asynchronously. Encodes the run's RNG identity, so the
  // recipient reproduces the rounds/bosses/modifiers bit-for-bit (codec lives
  // in engine.js: encodeRival / decodeRival).
  // ============================================================
  const Rival = (() => {
    // Player's display name (remembered by the leaderboard), else "Rival".
    function playerName() {
      try {
        const n = JSON.parse(localStorage.getItem('cs_player_name') || 'null');
        if (n && (n.first || n.last)) return `${n.first || ''} ${n.last || ''}`.trim();
      } catch {}
      return 'Rival';
    }

    function encodeRecord(rec, name) {
      if (!rec || !Array.isArray(rec.strikes) || !rec.strikes.length) return null;
      return ChronosEngine.encodeRival(Object.assign({}, rec, { name: name || rec.name || playerName() }));
    }
    // Code for the run you just played (from the live recording).
    function encodeCurrentRun() { return encodeRecord(Ghost.getRecording(), playerName()); }
    // Code for your stored best Daily ghost.
    function encodeStoredDaily(dateKey) { return encodeRecord(Ghost.storedForDate(dateKey), playerName()); }

    // Begin a race against an imported code. Returns false on an invalid code.
    function startRace(code, origin) {
      const rec = ChronosEngine.decodeRival(code);
      if (!rec || !rec.strikes.length) return false;
      State.dailyRun = false;
      State.rivalRun = true;
      State.rivalRecord = rec;
      AudioFx.newRound();
      startMode(rec.mode === 'endless' ? 'endless' : rec.mode === 'zen' ? 'zen' : 'classic');
      return true;
    }

    async function copy(text) {
      if (!text) return false;
      try { await navigator.clipboard.writeText(text); return true; }
      catch {
        // Fallback for browsers without the async clipboard API.
        try {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy'); ta.remove(); return ok;
        } catch { return false; }
      }
    }

    function toast(text) {
      const t = document.createElement('div');
      t.className = 'god-toast cheat-toast';
      t.textContent = text;
      document.body.appendChild(t);
      requestAnimationFrame(() => t.classList.add('show'));
      setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 1900);
    }

    return { playerName, encodeCurrentRun, encodeStoredDaily, startRace, copy, toast };
  })();

  // ============================================================
  // DAILY TIME RIFT — one deterministic, globally-fair challenge per UTC day.
  // Built entirely on the seeded engine: everyone on the same rulesetVersion
  // faces the identical sequence. Local best/attempts only for now — the global
  // Daily board waits until submission validation is ready (see roadmap).
  // ============================================================
  const Daily = (() => {
    const STORE = 'cs_daily_v1';
    const ROUNDS = CONFIG.classicRounds;
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // Flavour pools — the name is deterministic per date, purely cosmetic.
    const ADJ = ['Reverse', 'Shattered', 'Frozen', 'Blazing', 'Twin', 'Phantom', 'Quantum',
      'Warped', 'Neon', 'Silent', 'Savage', 'Crimson', 'Golden', 'Hollow', 'Fractured', 'Astral'];
    const NOUN = ['Gravity', 'Eclipse', 'Vortex', 'Cascade', 'Paradox', 'Mirage', 'Circuit',
      'Horizon', 'Tempest', 'Meridian', 'Threshold', 'Requiem', 'Spiral', 'Lattice', 'Zenith', 'Rift'];

    // UTC calendar-day key, e.g. "2026-07-17".
    function todayKey(d = new Date()) {
      return d.getUTCFullYear() + '-' +
        String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(d.getUTCDate()).padStart(2, '0');
    }
    // Seed identity depends ONLY on rulesetVersion + date (not gameVersion).
    function seedFor(dateKey) { return `daily|${CONFIG.rulesetVersion}|${dateKey}`; }

    function nameFor(dateKey) {
      const r = ChronosEngine.makeRNG('riftname|' + dateKey);
      const adj = r.pick(ADJ), noun = r.pick(NOUN);
      const wd = WEEKDAYS[new Date(dateKey + 'T00:00:00Z').getUTCDay()];
      return `${adj} ${noun} ${wd}`;
    }
    function previewFor(dateKey) {
      return ChronosEngine.riftPreview(seedFor(dateKey), 'classic', false, ROUNDS);
    }

    function load() {
      try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
    }
    function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch {} }
    // Today's record, resetting automatically when the UTC day rolls over.
    function today() {
      const key = todayKey();
      let rec = load();
      if (!rec || rec.date !== key) { rec = { date: key, best: 0, attempts: 0, bestRank: '—', completed: false }; save(rec); }
      return rec;
    }

    function recordResult(stats) {
      const rec = today();
      rec.attempts++;
      if (stats.score > rec.best) { rec.best = stats.score; rec.bestRank = stats.rankLetter || '—'; }
      if (stats.mode === 'classic' && stats.round >= ROUNDS) rec.completed = true;
      save(rec);
    }

    function play(origin) {
      State.dailyRun = true;
      State.rivalRun = false;
      State.dailyDate = todayKey();
      AudioFx.newRound();
      startMode('classic');   // Daily is Classic/Normal; startMode pins the seed
    }

    // ---- menu card rendering + live countdown ----
    let countdownTimer = null;
    function msUntilNextUTCDay() {
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
      return next - now.getTime();
    }
    function fmtCountdown(ms) {
      const s = Math.max(0, Math.floor(ms / 1000));
      const h = String(Math.floor(s / 3600)).padStart(2, '0');
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${h}:${m}:${ss}`;
    }
    function tickCountdown() {
      const el = document.getElementById('dailyCountdown');
      if (!el) return;
      const ms = msUntilNextUTCDay();
      el.textContent = 'Next rift in ' + fmtCountdown(ms);
      if (ms <= 1000) { render(); }   // rolled over → refresh the whole card
    }

    function render() {
      const card = document.getElementById('dailyCard');
      if (!card) return;
      const key = todayKey();
      const rec = today();
      const prev = previewFor(key);
      const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
      set('dailyName', nameFor(key));
      const bits = [`Opens ${prev.opensDir}`, `${prev.modifierCount} modifiers`, `${prev.bossCount} bosses`];
      set('dailyPreview', 'Classic · Normal · ' + bits.join(' · '));
      set('dailyBest', rec.best > 0 ? `Best today: ${rec.best.toLocaleString()} (${rec.bestRank})` : 'Best today: —');
      set('dailyAttempts', `Attempts: ${rec.attempts}`);
      // Ghost line: if a best-run ghost exists for today, advertise the race.
      const ghostEl = document.getElementById('dailyGhost');
      const g = Ghost.storedForDate(key);
      if (ghostEl) {
        if (g) { ghostEl.hidden = false; ghostEl.textContent = `👻 Ghost: ${g.score.toLocaleString()}`; }
        else ghostEl.hidden = true;
      }
      // Show "Challenge a friend" only once a ghost exists to share.
      const chBtn = document.getElementById('dailyChallengeBtn');
      if (chBtn) chBtn.hidden = !g;
      const badge = document.getElementById('dailyDone');
      if (badge) badge.hidden = !rec.completed;
      card.hidden = false;
      tickCountdown();
      if (!countdownTimer) countdownTimer = setInterval(tickCountdown, 1000);
    }

    return { todayKey, seedFor, nameFor, previewFor, recordResult, play, render };
  })();

  window.ChronosGame = {
    showScreen, refreshMenuStats,
    // Deterministic-run surface (used by share cards, Daily Rift, and tests).
    RNG,
    getRunInfo: () => ({
      gameVersion: CONFIG.gameVersion,
      rulesetVersion: CONFIG.rulesetVersion,
      mode: State.mode,
      hardcore: !!State.hardcore,
      seed: State.seed,
      runId: State.runId,
      assists: State.assists || {},
    }),
    // Pin the seed for the next run (Daily Rift / Rival Codes / replays).
    setForcedSeed: (s) => { State.forcedSeed = s ? String(s) : null; },
    // Dev/test hooks.
    debugGhost: () => ({
      todayKey: Daily.todayKey(),
      recorded: Ghost.recordedCount(),
      hasGhost: Ghost.hasGhost(),
      ghostScore: Ghost.ghostScore(),
      ghostName: Ghost.ghostName(),
      rivalRun: !!State.rivalRun,
      ghostMarkers: (document.getElementById('ghostLayer') || {}).childElementCount || 0,
      hudHidden: (document.getElementById('ghostHud') || {}).hidden,
    }),
    // Run the REAL setupRound for a given round and return a snapshot (no
    // gameplay side effects persist). Used to verify boss cycling.
    debugSetupRound: (round, mode = 'classic', hardcore = false, seed = 'test') => {
      State.mode = mode; State.hardcore = hardcore; State.round = round;
      State.dailyRun = false; State.rivalRun = false; State.spinning = false;
      RNG.seed([CONFIG.gameVersion, CONFIG.rulesetVersion, mode, hardcore ? 'hc' : 'n', seed].join('|'));
      setupRound();
      return {
        bossRound: State.bossRound,
        bossId: State.boss ? State.boss.def.id : null,
        hitsRequired: State.hitsRequired,
        zoneCount: State.zones.length,
        zones: State.zones.map(z => ({ center: Math.round(z.center), size: Math.round(z.size), type: z.type || null })),
      };
    },
  };

  // Initial menu render
  applyMenuCopy();
  refreshMenuStats();
  if (window.anime) {
    anime({ targets: '.logo-ring', rotate: '360deg', duration: 12000, loop: true, easing: 'linear' });
    anime({ targets: '.menu-stats .stat-card', translateY: [30, 0], opacity: [0, 1], delay: anime.stagger(100, { start: 200 }), duration: 600, easing: 'easeOutCubic' });
    anime({ targets: '.menu-modes .mode-card', translateY: [40, 0], opacity: [0, 1], delay: anime.stagger(120, { start: 400 }), duration: 700, easing: 'easeOutBack' });
  }
})();
