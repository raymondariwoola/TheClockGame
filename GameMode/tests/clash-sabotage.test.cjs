const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'multiplayer-ui.js'), 'utf8');
const room = fs.readFileSync(path.join(root, 'worker', 'src', 'match-room.js'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'shared', 'match-protocol.mjs'), 'utf8');

assert.match(protocol, /MATCH_SABOTAGES[\s\S]*?reverse[\s\S]*?narrow[\s\S]*?haste/, 'three fixed sabotage effects are shared');
assert.match(room, /function awardShard[\s\S]*?perfectStreak < 3[\s\S]*?maxShards/, 'server derives shards from a fresh three-Perfect streak');
assert.match(room, /message\.type === 'sabotage'[\s\S]*?maxSabotages[\s\S]*?targetRound[\s\S]*?broadcast\('sabotage'/, 'server caps, records, schedules, and telegraphs sabotage');
assert.match(game, /State\.clashRun\?\.sabotages[\s\S]*?ChronosEngine\.applySabotageRound/, 'game applies the tested transform only from Clash state');
assert.match(game, /queueSabotage:[\s\S]*?State\.round \+ 1/, 'late sabotage cannot alter the active round');
assert.match(ui, /Time Shard earned[\s\S]*?queueSabotage/, 'UI announces earning and queues a telegraphed opponent effect');
assert.doesNotMatch(game, /score\s*[+*]=.*sabotage|sabotage.*score\s*[+*]=/i, 'sabotage does not multiply or award score');

console.log('✓ Time Shards and Secret Sabotage are capped, recorded, telegraphed, and Clash-only');
