# Clock Quest — Enhancement & Feature Roadmap

> Code-informed product ideas for the child-focused clock-learning game.  
> Reviewed against the repository in July 2026.

## The short version

Clock Quest is already a polished learning suite rather than a simple clock quiz. It has five difficulty levels, ten activities, five reusable play modes, voice teaching, an expressive mascot, tactile clock controls, persistent progress, and strong visual feedback.

The next leap should make the game feel like a learning world that remembers the player:

1. Add a light **time-travel story campaign** that gives the activity library purpose and progression.
2. Add **adaptive mastery and “My Next Mission”** so Professor Hoot becomes a personal teacher.
3. Give progress a visible destination through **collections, profiles, and a parent dashboard**.
4. Make the whole experience **fully offline, accessible, testable, and easy to extend**.

## Current experience audit

### What is already excellent

- Five learning levels, from whole hours through minute precision.
- Ten activities: Tell the Time, Read the Time, Draw the Hands, Tick the Clock, Match Up, Order Durations, Time Facts, Story Problems, Turns & Direction, and Build-a-Clock.
- Reusable Practice, Quiz, Timed, Memorize, and Sandbox loops.
- Professor Hoot voice teaching, hints, repeat, idle nudges, name personalization, and tutorials.
- Multiple input styles: tap, drag/drop, and radial hand dragging.
- Progress, stars, timed bests, sound, voice, and player preferences persist locally.
- Excellent presentation fundamentals: responsive SVG clocks, transitions, mascot moods, confetti, generated sound effects, and reduced-motion support.

### Friction and maintenance items to fix first

| Finding | Why it matters | Suggested fix |
|---|---|---|
| README activity support does not fully match the registry | Contributors may design against stale behavior | Generate or manually synchronize the activity capability table |
| Level 5 means true minute precision in Quick Play but five-minute ticks in the activity registry | The same label represents two curricula | Separate curriculum difficulty from activity capability, or explain the difference in UI |
| Questions use unseeded randomness with limited repetition control | Sessions can repeat and bugs are difficult to reproduce | Pass a seeded random source through each activity context |
| Progress measures stars and timed bests, not concept mastery | The game cannot identify what the child needs next | Track performance using curriculum skill tags |
| Drag interactions have limited keyboard equivalents | Some activities require precise pointer input | Add selectable, tap-to-place, and keyboard alternatives |
| Remote Google Fonts weaken the offline promise | Layout and appearance can change without a connection | Vendor critical fonts or ship dependable system-font fallbacks |
| There is no automated test suite | Question generation and progression can regress silently | Add deterministic unit tests and a short browser smoke suite |

## Priority roadmap

| Priority | Feature | Impact | Effort |
|---|---|---|---|
| P0 | Baseline fixes, seeded randomness, and tests | High | Small–Medium |
| P1 | Adaptive mastery + “My Next Mission” | Very high | Medium |
| P1 | Hoot's Time-Travel Adventure | Very high | Large |
| P1 | Installable, fully offline PWA | High | Medium |
| P2 | Parent/teacher dashboard and profiles | High | Medium–Large |
| P2 | Hoot's Observatory collection | High | Medium |
| P2 | Real-world schedules and elapsed-time activities | High | Medium |
| P2 | Accessibility control center | High | Medium |
| P3 | Lesson creator and challenge codes | Medium–High | Large |
| P3 | Shared Hoot Academy profile and crossover rewards | Medium | Large |

## Signature features

### 1. Hoot's Time-Travel Adventure

Turn the existing activity library into a short, replayable story campaign.

**Player fantasy:** Professor Hoot's clock tower has shattered, scattering golden gears across different eras. Each region restores a clock skill:

- **Sunrise Village** — o'clock and daily routines.
- **Moonlit Station** — half past and train departures.
- **Festival Square** — quarter past and quarter to.
- **Rocket Repair Bay** — five-minute precision and durations.
- **The Clockwork Castle** — mixed mastery and full-minute challenges.

Each map node can launch an existing activity and mode, so most of the work is authored sequencing, progression, and presentation rather than ten new minigames. Every region ends with a “boss lesson” combining three interaction types—for example, reading a clock, moving its hands, and then solving a short elapsed-time story.

**Why it is worth doing:** the current library is broad but choice-heavy. A campaign supplies purpose, pacing, and a clear next step without removing free play.

**Implementation shape:**

- Add a data-driven `campaign.js` with worlds, nodes, prerequisites, activity ID, mode, level, and rewards.
- Extend progress with completed nodes, mastery gates, earned gears, and last campaign position.
- Keep the Activity Registry contract unchanged; campaign nodes should call the existing activity runner.
- Offer clear **Adventure** and **Free Play** paths so existing direct access remains available.

**Delight details:** a repairable clock tower on the home screen, era-specific Hoot costumes, animated postcards after each world, and a final clock that visibly gains parts as skills are mastered.

### 2. Adaptive mastery and “My Next Mission”

Replace purely random practice with a small, local learning engine.

Track mastery by skill rather than only by activity score. Suggested skill keys:

- `hour-hand-reading`
- `minute-hand-00-30`
- `quarter-past-to`
- `five-minute-reading`
- `minute-precision`
- `time-words`
- `hand-placement`
- `duration-comparison`
- `time-conversion`
- `turn-direction`

For every response, record correctness, response time, hint use, and misconception type. Weight future questions toward weak or fading skills while retaining easy wins and varied activity types.

**Player-facing behavior:**

- Home gets one large button: **“Hoot's pick: 5-minute mission.”**
- Hoot explains the goal: “Let's practice quarter-to times. You’re nearly there!”
- A mission mixes multiple existing activities around one concept.
- Results name growth rather than only score: “You can read quarter past! Let’s keep working on quarter to.”

Keep this encouraging and transparent. Avoid punishing streak loss, artificial urgency, or guilt-based return mechanics for children.

### 3. Parent and teacher dashboard

Add an adult-gated dashboard. A “hold for three seconds, then solve 7 + 5” gate is enough to avoid accidental entry.

**Dashboard contents:**

- Multiple child profiles with name, avatar, approximate age/year group, and separate progress.
- Mastery by concept, recent sessions, hint usage, accuracy, and response-time trend.
- “Needs practice” and “ready to advance” summaries in plain language.
- Curriculum toggles: 12/24-hour time, UK “quarter to” phrasing, digital/analog mix, and five-minute versus minute precision.
- Session controls: question count, timer on/off, voice rate, motion intensity, and preferred activities.
- Export/import a small JSON backup; optionally add a printable progress summary later.

Avoid surveillance-style analytics. Learning data should remain on-device by default, with explicit opt-in if synchronization is ever introduced.

### 4. Hoot's Observatory collection

Give progress a visible, playful destination. Correct practice and campaign milestones earn stars that restore constellations. Each constellation represents a real skill and opens a tiny interactive reward: ring Saturn, launch a comet, make an owl constellation flap, or set planets to different times.

Cosmetics can include:

- Clock faces, hand shapes, and number styles.
- Professor Hoot hats and accessories.
- Background themes and portal transitions.
- Confetti, sparkle, and celebration styles.

Avoid loot boxes or random paid rewards. Let the child see exactly which learning achievement unlocks each item.

### 5. Real-world time missions

The biggest curriculum opportunity is transferring clock reading into schedules and elapsed time.

- **My Day:** arrange wake-up, school, lunch, play, and bedtime on a visual timeline.
- **What Happens Next?:** connect an analog clock to a familiar daily event.
- **How Long Until...?:** advance a clock by 5, 10, 15, 30, or 60 minutes.
- **Time Detective:** spot the impossible schedule, such as “Lunch at 2:00 a.m.”
- **Race the Bus:** solve an elapsed-time story by moving two clocks rather than selecting an answer.
- **Clock Around the World:** introduce 24-hour time and simple time zones at advanced levels.

These should be introduced as concrete stories before symbolic arithmetic.

### 6. Better teaching feedback

Make incorrect answers more instructive without feeling negative:

- Animate the minute hand counting by fives after an incorrect answer.
- Visually trace the “past” and “to” halves of the clock face.
- On Draw the Hands, diagnose the hour and minute hands separately.
- If the hour hand is placed exactly on a number at half past, demonstrate why it belongs between hours.
- Add a worked-example hint before revealing the answer.
- Use misconception-aware distractors: swapped hands, wrong hour around `:45`, and reading the clock number as literal minutes.
- Let Hoot occasionally make a mistake and ask the child to correct him.

### 7. More replayable modes

- **Hoot Says:** reproduce a growing sequence of times, Simon-style.
- **Clock Bingo:** fill a 3×3 board by solving mixed prompts.
- **Two Truths and a Time:** select the two clocks that match their labels.
- **Beat Hoot:** catch Professor Hoot's deliberate clock-reading mistakes.
- **Co-op Pass-and-Play:** siblings alternate questions to restore one constellation.
- **Calm Mode:** no score or wrong state; incorrect choices become guided exploration.

### 8. Lesson creator and challenge codes

Let an adult or child configure:

- One or more activities.
- Allowed times or a time range.
- Number of questions.
- Whether hints and timers are enabled.
- A title and optional spoken message from Hoot.

Export the configuration as a short URL fragment or compact code. Teachers could create “Friday Quarter-Hour Review,” while parents could build a five-question bedtime mission. Basic sharing needs no server when the complete configuration is encoded and versioned.

### 9. Fully installable and offline

Turn Clock Quest into a dependable PWA:

- Add an app manifest with icons, theme colors, standalone display mode, and shortcuts.
- Cache the complete app shell, scripts, styles, fonts, and required assets.
- Use versioned caches and show an update-ready message instead of mixing asset versions.
- Bundle fonts or preserve layout with tested system-font fallbacks.
- Put the install action in Settings rather than showing an intrusive startup prompt.
- Keep every learning mode usable without a network after installation.

### 10. Accessibility control center

Add first-class controls for:

- High contrast, low stimulation, reduced particles, reduced motion, and reduced audio overlap.
- Scalable text and a large-controls mode.
- Full keyboard navigation and consistently visible focus states.
- Tap-to-select/tap-to-place alternatives for every drag interaction.
- Screen-reader live regions for new questions, timer changes, hints, and answer feedback.
- Text equivalents for meaningful audio and voice cues.

Low-stimulation mode should preserve Hoot and positive feedback while disabling idle wiggles, confetti, portal wipes, and simultaneous sound cues.

## Architecture improvements

### One source of truth for curriculum configuration

Move levels, skill tags, activity capabilities, tutorials, and mode definitions into data objects. Render user-facing labels and documentation tables from those objects where practical. This will prevent curriculum and documentation mismatches.

### Deterministic question generation

Pass a seeded pseudo-random generator through each activity context. This enables:

- Reproducible bug reports.
- Stable automated tests.
- Shareable lesson codes.
- Repeat prevention without fragile global state.
- Fair comparison when two children play the same challenge.

### Versioned progress and migration

Formalize the additive local-storage payload before adding profiles and mastery:

```text
clockQuestProfile
├── identity and accessibility preferences
├── curriculum mastery
├── campaign progress
├── activity records
├── collection and cosmetics
└── creator challenge history
```

Every schema version should have an explicit migration and preserve existing stars, names, and personal bests.

### Testing strategy

1. **Unit tests:** time formatting, “past/to” wording, clock-hand angles, distractor uniqueness, duration/fact answers, and mastery selection.
2. **Seeded simulations:** generate at least 1,000 questions and assert that each prompt, answer, and distractor set is valid.
3. **Browser smoke tests:** home → activity → answer → results, plus settings, profile switching, and progress reload.
4. **Accessibility checks:** keyboard-only completion, modal focus trapping, live announcements, and reduced-motion screenshots.
5. **Device matrix:** iPad Safari portrait first, then Android Chrome, phone landscape, and major desktop browsers.

## Suggested release sequence

### Release 1 — Trust the clock

- Fix activity documentation and level-definition mismatches.
- Add seeded randomness and core unit tests.
- Add keyboard/tap alternatives and visible focus styles.
- Formalize progress migrations.

### Release 2 — Hoot knows what I need

- Add curriculum skill tags and mastery tracking.
- Launch “My Next Mission.”
- Improve misconception-specific teaching feedback.
- Add multiple profiles and the parent dashboard MVP.

### Release 3 — A reason to return

- Ship the first two Time-Travel Adventure worlds.
- Add the Observatory collection and initial cosmetics.
- Add the first real-world elapsed-time missions.

### Release 4 — Create and share

- Add lesson challenge codes.
- Complete offline installation and asset caching.
- Ship the remaining campaign worlds and replayable modes.

### Release 5 — Hoot Academy ready

- Introduce a shared profile and accessibility preference format that future Hoot games can reuse.
- Add opt-in crossover cosmetics earned through genuine learning accomplishments.
- Expand teacher tools and printable progress summaries.

## Recommended first implementation slice

Start with the **Adaptive Mission MVP** because it makes the existing ten-activity investment feel dramatically smarter without requiring a large volume of new art.

1. Tag generated questions with one or two skill IDs.
2. Record result, response time, hint use, activity, level, and timestamp.
3. Compute a simple 0–100 mastery score per skill using recent attempts.
4. Build a five-question mission biased toward the two weakest unlocked skills.
5. Put **Hoot's Next Mission** above Quick Play on the home screen.
6. End with one specific strength and one friendly next step.
7. Add unit tests for skill selection and progress migration.

Once this works, the same mastery data can drive Adventure gates, the parent dashboard, Observatory unlocks, and custom lesson recommendations.
