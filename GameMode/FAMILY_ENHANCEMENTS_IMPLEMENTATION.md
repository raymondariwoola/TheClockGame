# Chronos family enhancements implementation

> **Scope:** `GameMode/` only. Five phases are implemented in the owner-selected order and committed independently after testing.
>
> **Cost boundary:** zero monetary cost. Reuse the existing static PWA and hibernating Clash Durable Object; create no new paid service or permanent social data.
>
> **Protected behavior:** ordinary scoring, private cheats, leaderboards, Ghosts, Daily, sharing, and non-Clash modes remain unchanged unless a phase explicitly documents its isolated integration.

## Status

| Phase | Enhancement | Status |
|---|---|---|
| FE-6A | Preset reactions | Complete |
| FE-6B | Time Shards / Secret Sabotage | Complete |
| FE-6C | Compact rematch stories | Complete |
| FE-6D | Skill handicap presets | Not started |
| FE-6E | Objective Cards | Not started |

## FE-6A — Preset reactions

### Implementation

- Added exactly five server/client-shared reactions: Nice, Too close, Wow, Again, and Good game.
- Added no free-text field, public chat, message history, profile data, or moderation surface.
- Reactions travel only over the existing private Clash WebSocket and are relayed only to the opponent.
- The Match Durable Object validates the allowlist and enforces a 1.2-second per-socket cooldown.
- Reactions are ephemeral: they are never written into room state, SQLite storage, results, share cards, leaderboards, or analytics.
- Added reaction controls to the Clash lobby and result dialog plus a compact safe-area-aware live-match dock.
- Added a persistent local incoming-reaction mute toggle under `cs_clash_reactions_muted`. Muting is device-local and is never sent to the opponent.
- Advanced the coherent PWA shell to revision 17.

### Validation

- Shared protocol tests lock the allowlist, envelope, and cooldown.
- Client tests prove preset sending and local rejection of arbitrary text.
- Durable Object tests prove opponent-only delivery, invalid-value rejection, rate limiting, and absence from stored room state.
- Static UI tests prove the mute preference, compact live dock, and absence of a free-text surface.
- Full engine/client/Worker verification, syntax, no-Gist scan, Worker dry run, PWA revision checks, and `git diff --check` pass before commit.

## FE-6B — Time Shards / Secret Sabotage

### Implementation

- Limited the mechanic to live Chrono Clash. Ordinary Classic, Endless, Zen, Daily, Ghost, leaderboard, and share flows do not read sabotage state.
- A fresh streak of three Perfect hits earns one Time Shard. A player must drop below that threshold before another streak can earn the second shard.
- Capped every match at two earned shards and two spends per player. Rematches and sudden death reset the shard economy rather than carrying an advantage forward.
- Added three fixed effects: Reverse Time reverses the next round, Tight Window narrows its real target by 20%, and Time Rush raises its hand speed by 15%.
- A spend is validated, deducted, assigned to a future round, stored in the bounded room record, and broadcast by the Match Durable Object before it can affect play.
- Prevented stacking multiple pending sabotages onto the same rival round.
- Added an accessible shard/sabotage dock with 44 px controls, descriptive labels, disabled-state explanations, safe-area positioning, and immediate sender/target announcements.
- The game applies the effect only from server-frozen Clash state and marks it consumed locally. It never awards or multiplies score.
- Included `perfectStreak` in bounded Clash progress so the server can derive the reward without receiving tap-by-tap replay data.
- Advanced the coherent PWA shell to revision 18.

### Validation

- Protocol/client tests lock the fixed effect allowlist and reject arbitrary values.
- Durable Object tests prove the three-Perfect award, shard deduction, two-use bounds, future-round assignment, opponent telegraph, and invalid/no-shard rejection.
- Static integration tests prove the effects are Clash-only, future-round-only, announced, and disconnected from scoring.
- Existing private-cheat tests remain unchanged and pass; cheats are neither disabled nor remotely labelled by this mechanic.
- Full engine/client/Worker verification, syntax, no-Gist scan, Worker dry run, PWA revision checks, mobile menu audit, and `git diff --check` pass before commit.

## FE-6C — Compact rematch stories

### Implementation

- Added three bounded server counters to each live match: current leader, lead-change count, and closest non-zero score gap.
- Retained no per-round score timeline, event log, analytics stream, or new storage object. The counters expire with the existing Match room.
- Froze margin, lead changes, closest gap, winner, reason, and sudden-death count into the final result summary.
- Preserved lead-change context when a draw enters sudden death and reset it for a true rematch.
- Added a perspective-aware client formatter producing concise outcomes such as `WON BY 28`, `LOST BY 28`, `SUDDEN-DEATH WIN`, or `LOSS BY DISCONNECT`.
- Placed the story directly above the existing Rematch action and included a neutral compact version on the Clash result share card with a `RUN IT BACK` call to action.
- Kept the result deterministic for reconnecting clients because its compact summary comes from the room result rather than transient local animation state.
- Advanced the coherent PWA shell to revision 19.

### Validation

- Durable Object tests prove two score-lead crossings become exactly two retained lead changes and that no history/timeline field exists.
- Client tests cover win/loss perspective, margins, sudden death, disconnects, and draws.
- Share-card tests lock the neutral story row and rematch call to action.
- Static UI tests prove the story is paired with Rematch and the final result freezes the bounded summary.
- Full engine/client/Worker verification, syntax, no-Gist scan, Worker dry run, PWA revision checks, mobile menu audit, and `git diff --check` pass before commit.

## Resume rule

Start the next incomplete phase only after the current phase validation and commit are complete. Each later phase must update this file, `FUTURE_ENHANCEMENT.md`, the current PWA shell revision when client assets change, and `OWNER_ACTIONS.md` when deployment steps change.
