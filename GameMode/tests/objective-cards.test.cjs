const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Objectives = require('../js/objectives.js');

class Store {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.get(key) || null; }
  setItem(key, value) { this.map.set(key, value); }
}

const first = Objectives.draw('daily|1|2026-08-01', 'classic');
const second = Objectives.draw('daily|1|2026-08-01', 'classic');
assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id), 'same run identity draws the same two cards');
assert.equal(new Set(first.map((item) => item.id)).size, 2, 'draw contains two unique cards');
assert.equal(Objectives.draw('zen-seed', 'zen', 6).some((item) => ['against-flow', 'clean-boss'].includes(item.id)), false, 'Zen excludes impossible cards');
assert.equal(Objectives.draw('limited', 'classic', 2, ['perfect-trio', 'streak-six']).every((item) => ['perfect-trio', 'streak-six'].includes(item.id)), true, 'run availability can exclude missing mechanics');

const store = new Store();
const tracker = Objectives.createTracker({ identity: 'fixed-seed', mode: 'classic', store });
const cards = tracker.snapshot().cards;
const metrics = {};
for (const card of cards) metrics[card.metric] = card.target;
let update = tracker.update(metrics);
assert.equal(update.newly.length, 2, 'both selected goals can complete');
assert.equal(update.profile.total, 2, 'completion increments bounded local mastery');
update = tracker.update(metrics);
assert.equal(update.newly.length, 0, 'one card cannot reward twice in one run');
assert.equal(update.profile.total, 2);
const nextRun = Objectives.createTracker({ identity: 'another-seed', mode: 'classic', store });
assert.equal(nextRun.snapshot().profile.total, 2, 'mastery persists between runs');
assert.equal(Objectives.mastery(3).theme, 'bronze');
assert.equal(Objectives.mastery(10).theme, 'cyan');
assert.equal(Objectives.mastery(25).theme, 'gold');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'objectives.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.doesNotMatch(source, /Math\.random|score\s*[+*]=|multiplier/i, 'objective draw and rewards do not use gameplay RNG or scoring');
assert.match(game, /RNG\.seed\(identity\);\s*ObjectiveCards\.start\(identity, mode\)/, 'objective draw starts from identity without consuming the gameplay RNG');
assert.match(game, /ChronosEngine\.simulateRun\(identity[\s\S]*?reverseOpportunities[\s\S]*?hasBoss[\s\S]*?eligibleIds/, 'draw excludes objectives whose mechanic does not occur in the deterministic run');
assert.match(game, /objectiveCleanBosses[\s\S]*?objectiveCleanRounds[\s\S]*?updateObjectiveCards/, 'real run events update objective progress');
assert.match(html, /id="objectiveHud"[\s\S]*?id="objectiveResults"/, 'HUD and result surfaces both expose the two cards');
assert.match(html, /id="menuObjectiveSummary"/, 'Progress exposes local objective mastery');

console.log('✓ Objective Cards are deterministic, optional, local, and visual-mastery only');
