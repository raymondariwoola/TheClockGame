const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'multiplayer-ui.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'worker', 'src', 'match-api.js'), 'utf8');

assert.match(ui, /handicapSelect\([\s\S]*?voluntary skill handicap[\s\S]*?ACCEPT HANDICAPS & READY/, 'each player chooses and explicitly accepts visible handicaps');
assert.match(ui, /room\.seats\?\.\[seat\]\?\.handicap/, 'game receives its server-frozen seat handicap');
assert.match(api, /normalizeMatchHandicap\(parsed\.value\.handicap\)/, 'Worker API allowlists both host and guest selections');
assert.match(game, /if \(!State\.clashRun && window\.ChronosLB/, 'Clash continues to bypass ordinary leaderboard run issuance');
assert.match(game, /ChronosEngine\.clashHandicap\(State\.maxLives, State\.clashRun\?\.handicap\)/, 'start assistance is applied only through Clash state');
assert.match(game, /State\.clashRun && handicapRound\.zoneScale/, 'wider targets are applied only in Clash');

console.log('✓ skill handicap presets are voluntary, visible, frozen, and private-Clash only');
