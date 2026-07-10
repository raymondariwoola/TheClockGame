# TheClockGame Project

## Project Structure
- `index.html` - UI entry point (Clock Quest)
- `js/` folder - Game modules (activities, audio, clock, etc.)
- `GameMode/` - Chronos Strike, a reflex timing mini-game (separate page)

## Key Files
- @js/game.js - Core gameplay
- @js/activities.js - Activity logic
- @style.css - Styling

## Chronos Strike (GameMode/)
- @GameMode/game.js - Game loop, rounds, modifiers, boss rounds, overdrive, scoring
- @GameMode/leaderboard.js - Global top-20 leaderboard (GitHub Gist backend, localStorage fallback)
- @GameMode/leaderboard-config.js - Gist ID + token config (see comments inside for setup)
- Screens are sections toggled via `showScreen()`; game.js exposes `window.ChronosGame`, leaderboard.js exposes `window.ChronosLB`