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
| FE-6B | Time Shards / Secret Sabotage | Not started |
| FE-6C | Compact rematch stories | Not started |
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

## Resume rule

Start the next incomplete phase only after the current phase validation and commit are complete. Each later phase must update this file, `FUTURE_ENHANCEMENT.md`, the current PWA shell revision when client assets change, and `OWNER_ACTIONS.md` when deployment steps change.
