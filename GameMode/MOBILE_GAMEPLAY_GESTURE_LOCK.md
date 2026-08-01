# Mobile gameplay gesture lock

> Status: complete locally; owner push pending.
>
> Scope: `GameMode/` gameplay surface only.
>
> Shell revision: 15.

## Decision

Chronos Strike blocks browser zoom gestures only while `screen-game` is active. Informational screens retain normal browser zoom for accessibility:

- main menu;
- results and sharing;
- Hall of Time leaderboards;
- accessibility, cosmetics, achievements, identity, connection, install, Ghost, and Clash dialogs.

This is deliberate. A global `user-scalable=no` viewport was rejected because it would remove an important low-vision control from every screen and some browsers can ignore it anyway.

## Implementation

- `#screen-game` and its HUD, arena, clock, and strike control use `touch-action: none`.
- Scrollable/informational screens explicitly retain `touch-action: manipulation`, which allows normal panning and pinch zoom while suppressing non-standard double-tap behavior where supported.
- `gameplay-gestures.js` handles Safari’s non-standard `gesturestart` and `gesturechange` events only on the active game element.
- A scoped `dblclick` fallback prevents browser default zoom behavior on the game element.
- No global `touchstart` or `touchmove` cancellation is used, so menu/dialog scrolling remains native.
- The viewport intentionally has no `user-scalable=no` or `maximum-scale` restriction.
- The module contains no scoring, strike, multiplayer, Ghost, cheat, or leaderboard logic.

## Expected behavior

| Surface | One-finger tap | Vertical scroll | Double-tap zoom | Pinch zoom |
|---|---:|---:|---:|---:|
| Active gameplay | Strike normally | Not applicable | Blocked | Blocked |
| Menu/results/boards | Controls normally | Available | Browser-dependent | Available |
| Dialogs and forms | Controls/text normally | Available when needed | Browser-dependent | Available |

Browser accessibility settings remain authoritative and may override site gesture policy. The implementation therefore prevents ordinary accidental gestures without claiming an impossible absolute lock on every device configuration.

## Validation

- focused gesture guard tests;
- CSS contract tests for locked and zoomable surfaces;
- viewport regression test proving global zoom remains enabled;
- Safari gesture fallback scope test;
- coherent service-worker shell revision test;
- complete `npm run verify` suite;
- mobile browser inspection at 390 × 844 before commit.

## Owner publication

This phase changes only static GameMode files. It needs no Cloudflare Worker deployment, secret, variable, database migration, leaderboard operation, or `.dev.vars` change.

From the repository root, after reviewing the local commit:

```powershell
git status --short --branch
git log --oneline origin/main..main
git push origin main
```

This behavior first shipped in shell revision 15. The completed menu UI release carries it forward unchanged in shell revision 16 through the existing run-safe PWA update notice.

## Physical acceptance check after publication

On Android Chrome and iPhone Safari, including the installed PWA where available:

1. Open the updated GameMode online and accept the update from the idle menu.
2. Start Classic and rapidly double-tap different parts of the arena.
3. Attempt a two-finger pinch in and out over the clock, HUD, and strike button.
4. Confirm the viewport remains fixed and each legitimate tap still resolves normally.
5. Finish or quit to the menu.
6. Confirm the menu scrolls vertically and pinch zoom remains available.
7. Open Results, Hall of Time, Accessibility, Ghost, and Clash dialogs; confirm their controls and scrolling remain usable.
8. Rotate once during the menu and once during a non-live game; confirm the viewport returns to the correct layout.

## Rollback

Rollback must remain forward-only:

1. Remove or adjust the gameplay gesture rules/module.
2. Increase the shell and all asset query revisions to a new number higher than 15.
3. Run `npm run verify`.
4. Commit and push the forward fix.

Do not restore an older service-worker revision unchanged.
