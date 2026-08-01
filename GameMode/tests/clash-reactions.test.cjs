const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const protocol = fs.readFileSync(path.join(root, 'shared', 'match-protocol.mjs'), 'utf8');
const client = fs.readFileSync(path.join(root, 'js', 'multiplayer.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'multiplayer-ui.js'), 'utf8');
const room = fs.readFileSync(path.join(root, 'worker', 'src', 'match-room.js'), 'utf8');

for (const id of ['nice', 'close', 'wow', 'again', 'gg']) {
  assert.match(protocol, new RegExp(`\\b${id}:`), `${id} is in the shared allowlist`);
}
assert.match(client, /reaction\(id\)[\s\S]*?invalid_reaction[\s\S]*?send\('reaction'/, 'client rejects anything outside its preset reactions');
assert.match(room, /message\.type === 'reaction'[\s\S]*?MATCH_REACTIONS[\s\S]*?reactionCooldownMs[\s\S]*?others\(/, 'Worker validates, throttles, and relays reactions only to the opponent');
assert.match(protocol, /reaction_ack/, 'shared protocol declares the delivery acknowledgement');
assert.match(room, /reaction_ack[\s\S]*?delivered/, 'Worker acknowledges whether an opponent socket received the reaction');
assert.doesNotMatch(room, /room\.reactions|reactionHistory/, 'Worker does not retain reaction history');
assert.match(ui, /cs_clash_reactions_muted/, 'incoming-reaction mute choice is local and persistent');
assert.match(ui, /reactionControls\(true\)/, 'live gameplay receives a compact reaction dock');
assert.match(ui, /reaction_ack[\s\S]*?Sent to rival[\s\S]*?reaction not delivered/, 'sender feedback reports delivery instead of an optimistic local-only success');
assert.match(ui, /invalid_message[\s\S]*?Live server update required/, 'a stale Worker produces a clear reaction-specific update warning');
assert.match(ui, /insertAdjacentElement\('afterend', value\)/, 'live controls are placed in normal gameplay flow after STRIKE');
assert.doesNotMatch(ui, /contenteditable|textarea/i, 'reaction UI has no free-text surface');

console.log('✓ preset Clash reactions are fixed, ephemeral, throttled, and locally mutable');
