// Chronos Strike — pure game engine.
// The deterministic, DOM-free core shared by the game (browser global
// `window.ChronosEngine`) and the test suite (Node `import`/`require`).
// Everything here is a pure function of its inputs so it can be unit-tested
// and so a seeded run reproduces the exact same challenge.
//
// IMPORTANT: changing any generation/scoring behaviour here is a competitive
// change — bump CONFIG.rulesetVersion in game.js so old scores stay comparable.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChronosEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- seeded RNG ----------
  // xmur3: string → repeatable 32-bit seed function.
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  // mulberry32: fast, well-distributed 32-bit PRNG.
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Wrap a raw [0,1) generator with convenience helpers.
  function wrap(gen) {
    return {
      next: () => gen(),
      range: (min, max) => min + gen() * (max - min),
      int: (a, b) => Math.floor(gen() * (b - a + 1)) + a,   // inclusive [a,b]
      pick: (arr) => arr[Math.floor(gen() * arr.length)],
      chance: (p) => gen() < p,
    };
  }
  function makeRNG(seedStr) { return wrap(mulberry32(xmur3(String(seedStr))())); }

  // ---------- timing / scoring ----------
  // Shortest angular gap between two clock-face angles (degrees).
  function angularDistance(a, b) {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  }
  // Grade a strike by how close (in degrees) the hand was to a zone centre.
  function classify(distToCenter, zoneHalf) {
    const perfectBand = Math.min(3, zoneHalf * 0.25);
    const greatBand = zoneHalf * 0.55;
    if (distToCenter <= perfectBand) return 'perfect';
    if (distToCenter <= greatBand) return 'great';
    if (distToCenter <= zoneHalf) return 'good';
    return 'miss';
  }
  function scoreFor(kind) {
    if (kind === 'perfect') return 100;
    if (kind === 'great') return 60;
    if (kind === 'good') return 30;
    return 0;
  }
  // Rank letter from ordered thresholds (best → worst); see CONFIG.ranks.
  function computeRank(ranks, score, acc) {
    for (const r of ranks) {
      if (score >= r.minScore && acc >= r.minAcc) return r.letter;
    }
    return 'F';
  }

  // Precision Lab: signed angular + timing error of a strike relative to a
  // zone centre. Convention: negative = EARLY (hand hadn't reached the centre
  // for its travel direction), positive = LATE. `speed` is degrees/second.
  function strikeError(handAngle, zoneCenter, handDir, speed) {
    // signed shortest angle from hand → centre, in (-180, 180]
    const diff = ((zoneCenter - handAngle + 540) % 360) - 180;
    const deg = Math.abs(diff);
    // early = the centre is still ahead of the hand along its travel direction
    const early = deg === 0 ? false : (handDir === 1 ? diff > 0 : diff < 0);
    const late = deg !== 0 && !early;
    const ms = speed > 0 ? (deg / speed) * 1000 : 0;
    return {
      deg,                                   // magnitude, degrees
      ms,                                    // magnitude, milliseconds
      early, late,
      signedDeg: early ? -deg : deg,         // − early / + late
      signedMs: early ? -ms : ms,
    };
  }

  // ---------- deterministic round generation ----------
  // MODIFIER_IDS order MUST match the MODIFIERS array in game.js so that a
  // selected index maps to the same modifier in both places.
  const MODIFIER_IDS = ['speed', 'shrink', 'invert', 'double', 'phantom', 'multi', 'quantum', 'decoy', 'pulse'];

  // Hand speed / zone size / rotation direction for a round.
  // `rng` supplies the single direction draw (kept here so the draw order in
  // the game's generation stream is unchanged).
  function roundParams(round, mode, hardcore, rng) {
    const hc = hardcore && mode !== 'zen';
    const base = mode === 'zen' ? 130 : (hc ? 175 : 150);
    const ramp = (mode === 'endless')
      ? round * (hc ? 16 : 13)
      : Math.min(round * 13, hc ? 540 : 430);
    const speed = (base + ramp) * (hc ? 1.12 : 1);
    const floor = hc ? 10 : 13;
    const size = Math.max(floor, (hc ? 56 : 60) - round * (hc ? 1.9 : 1.55));
    const dir = rng.next() < 0.5 ? -1 : 1;
    return { speed, size, dir };
  }

  // Returns a modifier index into MODIFIER_IDS, or -1 for none.
  // Draw parity with the original: 1 draw when it declines, 2 when it selects.
  function pickModifier(round, mode, rng, count) {
    if (mode === 'zen') return -1;
    if (round < 3) return -1;
    if (rng.next() > Math.min(0.18 + round * 0.04, 0.85)) return -1;
    return Math.floor(rng.next() * count);
  }

  // Is this a boss round for the given mode? (deterministic, no RNG)
  function isBossRound(round, mode) {
    return mode !== 'zen' && round > 1 && round % 5 === 0;
  }

  // Did the hand sweep through `center` this frame (prev → cur, travelling
  // in `dir`)? Used by the Precision Lab metronome. Ignores implausibly large
  // jumps (≥180°/frame) so a stutter can't produce a phantom tick.
  function passedCenter(prev, cur, center, dir) {
    const fwd = ((cur - prev) * dir + 360) % 360;    // forward distance travelled
    const toC = ((center - prev) * dir + 360) % 360; // forward distance to centre
    return fwd > 0 && fwd < 180 && toC <= fwd;
  }

  // Main-stream RNG draws performed inside a modifier's apply() in game.js.
  // (Others draw 0 on the main stream; quantum uses an independent sub-stream.)
  const MODIFIER_APPLY_DRAWS = { double: 1, multi: 1, decoy: 2 };

  // Reproduce the exact per-round generation a run identity produces, mirroring
  // the RNG draw ORDER of setupRound() in game.js. Same identity ⇒ same run, so
  // this powers Daily previews, replay validation, and the test simulations.
  // If setupRound's draw order changes, update this (and bump rulesetVersion).
  function simulateRun(identity, mode, hardcore, rounds) {
    const rng = makeRNG(identity);
    const count = MODIFIER_IDS.length;
    const out = [];
    for (let r = 1; r <= rounds; r++) {
      const p = roundParams(r, mode, hardcore, rng);   // draw: dir
      const handAngle = rng.next() * 360;              // draw: hand angle
      const zoneCenter = rng.next() * 360;             // draw: base zone centre (always)
      const boss = isBossRound(r, mode);
      let bossBase = null, modId = null;
      if (boss) {
        bossBase = rng.next() * 360;                   // draw: boss second-zone base
      } else {
        const i = pickModifier(r, mode, rng, count);   // draw(s): prob (+ index)
        if (i >= 0) {
          modId = MODIFIER_IDS[i];
          const extra = MODIFIER_APPLY_DRAWS[modId] || 0;
          for (let k = 0; k < extra; k++) rng.next();  // draw(s): modifier.apply
        }
      }
      out.push({ r, speed: p.speed, size: p.size, dir: p.dir, handAngle, zoneCenter, boss, bossBase, modId });
    }
    return out;
  }

  // Truthful, compact summary of what a run identity actually plays like —
  // used for the Daily Rift preview so the card never lies about the day.
  function riftPreview(identity, mode, hardcore, rounds) {
    const run = simulateRun(identity, mode, hardcore, rounds);
    const mods = new Set();
    let bossCount = 0;
    run.forEach(s => { if (s.modId) mods.add(s.modId); if (s.boss) bossCount++; });
    return {
      opensDir: run[0] ? (run[0].dir === 1 ? 'clockwise' : 'counter-clockwise') : 'clockwise',
      topSpeed: Math.round(run[run.length - 1] ? run[run.length - 1].speed : 0),
      tightest: Math.round(Math.min(...run.map(s => s.size))),
      modifiers: [...mods],
      modifierCount: mods.size,
      bossCount,
    };
  }

  return {
    xmur3, mulberry32, wrap, makeRNG,
    angularDistance, classify, scoreFor, computeRank,
    MODIFIER_IDS, MODIFIER_APPLY_DRAWS, roundParams, pickModifier, isBossRound,
    simulateRun, riftPreview, strikeError, passedCenter,
  };
});
