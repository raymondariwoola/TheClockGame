// Chronos Strike — engine test suite (no dependencies).
// Run:  node GameMode/engine.test.mjs   (or  npm test  from repo root)
//
// Exercises the SAME pure functions the game uses (engine.js), so a green run
// means scoring, classification, and deterministic round generation are intact.

import E from './engine.js';

// ---------- tiny test harness ----------
let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; fails.push(msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function approx(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, `${msg} — expected ~${b}, got ${a}`); }

// Mirror of CONFIG.ranks in game.js (kept in sync manually; asserted by shape).
const RANKS = [
  { letter: 'S', minScore: 8000, minAcc: 90 },
  { letter: 'A', minScore: 5000, minAcc: 80 },
  { letter: 'B', minScore: 3000, minAcc: 65 },
  { letter: 'C', minScore: 1500, minAcc: 0 },
  { letter: 'D', minScore: 500,  minAcc: 0 },
  { letter: 'F', minScore: 0,    minAcc: 0 },
];

// ---------- angularDistance ----------
eq(E.angularDistance(0, 0), 0, 'angDist same');
eq(E.angularDistance(10, 350), 20, 'angDist wraps the short way');
eq(E.angularDistance(0, 180), 180, 'angDist opposite');
eq(E.angularDistance(350, 10), 20, 'angDist symmetric wrap');
eq(E.angularDistance(90, 270), 180, 'angDist quarter-opposite');

// ---------- classify ----------
// half = 20 → perfect ≤ min(3, 5)=3, great ≤ 11, good ≤ 20, else miss
eq(E.classify(0, 20), 'perfect', 'classify centre');
eq(E.classify(3, 20), 'perfect', 'classify perfect edge');
eq(E.classify(3.01, 20), 'great', 'classify just past perfect');
eq(E.classify(11, 20), 'great', 'classify great edge');
eq(E.classify(11.01, 20), 'good', 'classify just past great');
eq(E.classify(20, 20), 'good', 'classify good edge');
eq(E.classify(20.01, 20), 'miss', 'classify miss past zone');
// tight zone: half=4 → perfect ≤ 1 (4*0.25), great ≤ 2.2, good ≤ 4
eq(E.classify(1, 4), 'perfect', 'classify tight perfect');
eq(E.classify(3, 4), 'good', 'classify tight good');

// ---------- scoreFor ----------
eq(E.scoreFor('perfect'), 100, 'scoreFor perfect');
eq(E.scoreFor('great'), 60, 'scoreFor great');
eq(E.scoreFor('good'), 30, 'scoreFor good');
eq(E.scoreFor('miss'), 0, 'scoreFor miss');
eq(E.scoreFor('nonsense'), 0, 'scoreFor unknown → 0');

// ---------- computeRank ----------
eq(E.computeRank(RANKS, 9000, 95), 'S', 'rank S');
eq(E.computeRank(RANKS, 9000, 70), 'B', 'rank high score, acc 70 → B (fails S & A acc gates)');
eq(E.computeRank(RANKS, 5000, 80), 'A', 'rank A edge');
eq(E.computeRank(RANKS, 3000, 65), 'B', 'rank B edge');
eq(E.computeRank(RANKS, 1500, 0), 'C', 'rank C ignores acc');
eq(E.computeRank(RANKS, 500, 0), 'D', 'rank D edge');
eq(E.computeRank(RANKS, 499, 100), 'F', 'rank below D → F');
eq(E.computeRank(RANKS, 0, 0), 'F', 'rank zero → F');

// ---------- RNG determinism & distribution ----------
(() => {
  const id = '1.1.0|1|classic|n|seedXYZ';
  const a = E.makeRNG(id), b = E.makeRNG(id), c = E.makeRNG('1.1.0|1|classic|hc|seedXYZ');
  const seqA = Array.from({ length: 8 }, () => a.next());
  const seqB = Array.from({ length: 8 }, () => b.next());
  const seqC = Array.from({ length: 8 }, () => c.next());
  ok(JSON.stringify(seqA) === JSON.stringify(seqB), 'RNG same identity → identical sequence');
  ok(JSON.stringify(seqA) !== JSON.stringify(seqC), 'RNG difficulty change → different sequence');
  ok(seqA.every(v => v >= 0 && v < 1), 'RNG values in [0,1)');

  // distribution over 200k draws
  const g = E.makeRNG('dist'); let sum = 0; const buckets = new Array(10).fill(0);
  const N = 200000;
  for (let i = 0; i < N; i++) { const v = g.next(); sum += v; buckets[Math.min(9, Math.floor(v * 10))]++; }
  approx(sum / N, 0.5, 0.01, 'RNG mean ≈ 0.5');
  ok(buckets.every(b => Math.abs(b - N / 10) < N / 10 * 0.06), 'RNG buckets within 6% of uniform');

  // helpers
  const h = E.makeRNG('helpers');
  const ints = Array.from({ length: 1000 }, () => h.int(1, 6));
  ok(ints.every(n => n >= 1 && n <= 6 && Number.isInteger(n)), 'RNG.int inclusive range');
  ok(new Set(ints).size === 6, 'RNG.int covers full range');
})();

// ---------- roundParams validity + curve ----------
(() => {
  const rng = E.makeRNG('rp');
  let prevClassicSpeed = 0;
  for (let r = 1; r <= 200; r++) {
    const p = E.roundParams(r, 'classic', false, rng);
    ok(isFinite(p.speed) && p.speed > 0, `classic speed>0 @${r}`);
    ok(p.size >= 13 && p.size <= 60, `classic size in [13,60] @${r} (${p.size})`);
    ok(p.dir === 1 || p.dir === -1, `dir ∈ {-1,1} @${r}`);
  }
  // Classic speed CAPS: ramp = min(round*13, 430) → caps at 150+430 = 580
  const late = E.roundParams(999, 'classic', false, E.makeRNG('x'));
  approx(late.speed, 580, 0.001, 'classic speed caps at 580');
  // Endless NEVER caps: round 999 speed far exceeds classic cap
  const endlessLate = E.roundParams(999, 'endless', false, E.makeRNG('x'));
  ok(endlessLate.speed > 5000, 'endless speed never caps (grows unbounded)');
  // Hardcore is faster + tighter floor
  const nHc = E.roundParams(30, 'classic', true, E.makeRNG('x'));
  ok(nHc.size >= 10, 'hardcore size floor is 10');
  ok(E.roundParams(5, 'classic', true, E.makeRNG('y')).speed >
     E.roundParams(5, 'classic', false, E.makeRNG('y')).speed, 'hardcore faster than normal');
  // Zen size floor 13, no hardcore effect
  ok(E.roundParams(50, 'zen', true, E.makeRNG('z')).size >= 13, 'zen size floor 13');
})();

// ---------- pickModifier validity ----------
(() => {
  const count = E.MODIFIER_IDS.length;
  const rng = E.makeRNG('pm');
  for (let r = 1; r <= 500; r++) {
    const iZen = E.pickModifier(r, 'zen', rng, count);
    eq(iZen, -1, `zen never has a modifier @${r}`);
  }
  const rng2 = E.makeRNG('pm2');
  for (let r = 1; r < 3; r++) eq(E.pickModifier(r, 'classic', rng2, count), -1, `no modifier before round 3 @${r}`);
  const rng3 = E.makeRNG('pm3');
  let sawOne = false;
  for (let r = 3; r <= 500; r++) {
    const i = E.pickModifier(r, 'classic', rng3, count);
    ok(i === -1 || (i >= 0 && i < count), `modifier index valid @${r} (${i})`);
    if (i >= 0) sawOne = true;
  }
  ok(sawOne, 'modifiers do appear from round 3+');
})();

// ---------- 1000-round seeded simulation + determinism ----------
// Faithfully mirrors the main-stream RNG draw ORDER of setupRound() in game.js
// so this reproduces the exact challenge a seed produces. If setupRound's draw
// order changes, update this model (and bump CONFIG.rulesetVersion).
function simulateRun(identity, mode, hardcore, rounds) {
  const rng = E.makeRNG(identity);
  const count = E.MODIFIER_IDS.length;
  // per-modifier main-stream draw counts inside apply() (see MODIFIERS in game.js)
  const APPLY_DRAWS = { double: 1, multi: 1, decoy: 2 }; // others draw 0 on the main stream
  const out = [];
  for (let r = 1; r <= rounds; r++) {
    const p = E.roundParams(r, mode, hardcore, rng);   // draw: dir
    const handAngle = rng.next() * 360;                // draw: hand angle
    const zoneCenter = rng.next() * 360;               // draw: base zone centre (always)
    const boss = E.isBossRound(r, mode);
    let bossBase = null, modId = null;
    if (boss) {
      bossBase = rng.next() * 360;                     // draw: boss second-zone base
    } else {
      const i = E.pickModifier(r, mode, rng, count);   // draw(s): prob (+ index)
      if (i >= 0) {
        modId = E.MODIFIER_IDS[i];
        const extra = APPLY_DRAWS[modId] || 0;
        for (let k = 0; k < extra; k++) rng.next();     // draw(s): modifier.apply
      }
    }
    out.push({ r, speed: p.speed, size: p.size, dir: p.dir, handAngle, zoneCenter, boss, modId });
  }
  return out;
}

(() => {
  const identity = '1.1.0|1|classic|n|dailySeed42';
  const runA = simulateRun(identity, 'classic', false, 1000);
  const runB = simulateRun(identity, 'classic', false, 1000);
  ok(JSON.stringify(runA) === JSON.stringify(runB), '1000-round run is fully reproducible from its seed');

  const runDiff = simulateRun('1.1.0|1|classic|n|OTHERseed', 'classic', false, 1000);
  ok(JSON.stringify(runA) !== JSON.stringify(runDiff), 'different seed → different run');

  // validity across the whole run
  let allValid = true, bossOk = true, angOk = true;
  for (const s of runA) {
    if (!(isFinite(s.speed) && s.speed > 0 && s.size >= 13 && (s.dir === 1 || s.dir === -1))) allValid = false;
    if (!(s.handAngle >= 0 && s.handAngle < 360 && s.zoneCenter >= 0 && s.zoneCenter < 360)) angOk = false;
    // boss cadence: every 5th round after round 1
    const shouldBoss = s.r > 1 && s.r % 5 === 0;
    if (s.boss !== shouldBoss) bossOk = false;
    // reachability: a positive zone size guarantees a non-empty perfect band
    if (Math.min(3, (s.size / 2) * 0.25) <= 0) allValid = false;
  }
  ok(allValid, 'every generated round has reachable, valid parameters');
  ok(angOk, 'every hand/zone angle is within [0,360)');
  ok(bossOk, 'boss rounds land exactly every 5th round (after round 1)');

  // modifiers only reference real ids
  ok(runA.every(s => s.modId === null || E.MODIFIER_IDS.includes(s.modId)), 'all modifier ids are valid');
})();

// ---------- report ----------
console.log(`\nChronos Strike engine tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nFailures:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
} else {
  console.log('✓ all green\n');
}
