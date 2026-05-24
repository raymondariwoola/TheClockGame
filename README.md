# 🕐 Clock Quest

A beautifully gamified, voice-interactive clock-learning suite for young children, built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no server — open the HTML file and play.

Built originally for a 7-year-old learning to read analog clocks for his Grade 1 final exams, Clock Quest has grown into a **full activity library** that covers everything in a typical Year 1 / Grade 1 telling-time curriculum: reading the clock, drawing the hands, matching clocks to written phrases, ticking the correct clock, ordering durations, time arithmetic, turns and direction, word problems, and free-play. Wrapped in a Duolingo-grade aesthetic: glowing midnight palette, bouncy buttons, a friendly owl mascot ("Professor Hoot"), confetti bursts, screen-warping clock transitions, and a fully human-sounding voice teacher powered by the Web Speech API.

---

## ✨ Features

### 🎮 Two ways to play

**Quick Play** — the original five-level "Tell the Time" ladder, unchanged. Earn stars, unlock the next level, climb to Clock Master.

**Activity Library** — ten gamified activities, each with multiple game modes. Tap a tile, pick a difficulty + mode, and play.

### 🧩 The ten activities

| Activity | What it teaches |
|---|---|
| 🕐 **Tell the Time** | Read the clock, pick the time from four choices (the classic) |
| 🗣 **Word Time** | Read the clock, pick the written phrase ("quarter past three") |
| ✏️ **Draw the Hands** | Drag hour & minute hands to show a given time |
| ✅ **Tick the Clock** | Pick the clock that shows the spoken time from a row of four |
| 🔗 **Match Up** | Drag four written times onto four clocks |
| 📏 **Order Durations** | Sort `15 mins · half hour · 45 mins · 1 hour` shortest → longest using big ⬆⬇ arrow buttons |
| ➕ **Time Facts** | Quick-fire arithmetic — "how many minutes in 1 hour?", "1h 30m = ___ minutes" |
| 📖 **Word Problems** | Story cards — "A machine makes 1 toy per minute. How many in 1 hour?" |
| 🔄 **Turns & Direction** | Clockwise, anticlockwise, quarter and half turns |
| 🛠 **Build a Clock** | Sandbox — drag the hands freely, the voice narrates whatever time you make |

### 🎯 Five game modes

Modes are orthogonal — most activities support several. Pick the one that fits your mood.

| Mode | Loop |
|---|---|
| 🧘 **Practice** | Untimed, unlimited questions, hints available. Play until you stop. |
| 🎯 **Quiz** | 10 questions, 1–3 star scoring. Saves stars per activity + level. |
| ⏱️ **Timed** | 60 seconds — answer as many as you can. Streaks of 3 grant +3s bonus. "Beat your best" persists. |
| 🧠 **Memorize** | Clock flashes for 2 s, then hides. Answer from memory. |
| 🎨 **Sandbox** | Free play. No score, no timer. Available on Build-a-Clock. |

### 🌀 Cool screen transitions

Every screen change runs through a **clock-themed iris wipe** — a coloured portal expands from your tap point while a tiny gold clock spins in the centre (hour hand 540°, minute hand 1080°, school-bell speed), then the new screen reveals with a bounce. Mode pickers cascade their pills in one by one. Tapped tiles squish-stretch with a brightness flash and emit a tap-burst ring. All pure CSS + vanilla JS — no GSAP, no frameworks, but feels like a AAA app. Respects `prefers-reduced-motion`.

### 🦉 Voice & Audio (Professor Hoot speaks!)
- **Auto-detects the best voice on your device** — prefers macOS Premium/Siri voices, Edge neural voices, Google voices
- Voice quality badge (Premium / Enhanced / Neural / Standard / Basic) with tips on installing better voices
- **School-style time phrasing** — "twenty past four", "quarter to two", "half past six" (matches Toby's Year 1 worksheets, not "20 minutes past 4")
- **Natural prosody** — sentence chunking, pitch jitter, rising intonation on questions, slowed exclamations
- Question narration, correct/wrong reactions, streak shouts, idle nudges, hints, tutorials
- **Hold-to-hear**: long-press any answer button to hear it spoken before committing
- **Name personalisation** — Hoot greets you and sprinkles your name into praise
- Separate mute toggles for 🔊 sound effects and 🗣️ voice
- All beeps, chimes, and fanfares generated on the fly via the Web Audio API (no audio files)

### 🎨 Visual Polish
- **SVG analog clock** drawn entirely in code — glowing radial gradient face, rounded hands that animate smoothly with cubic-bezier bounce, jewelled centre, pulsing aura
- Each clock SVG declares unique gradient IDs so **multiple clocks on the same screen** (Tick the Clock, Match Up) all render with bright faces, not dark blanks
- Hands rotate via shortest path (no backwards-spin glitches)
- Mini-clocks use boosted number sizes (×1.4), bolder weights, and thicker hands so a 5-year-old can read them at a glance
- **Animated owl mascot** with happy / sad / excited mood states, lip-sync pulse while speaking
- Confetti particle bursts on correct answers
- Floating twinkling stars background
- Bouncy buttons with 3D press feedback and tap-burst rings
- Fully responsive — tablet-first, scales gracefully to desktop and phone

### 🎁 UX Niceties
- **Tutorial overlay** the first time you enter each Quick-Play level — Hoot explains how to read clocks at that difficulty
- **Hint button** (💡) — context-aware tips based on the current time
- **Repeat button** (🔁) — re-asks the question
- **Idle nudges** — after 15s of inactivity, the clock wiggles and Hoot offers encouragement
- **Settings panel** (⚙️) — voice picker, speech speed slider, player name, test voice, reset progress
- Progress, stars, best timed-mode runs, and preferences persist via `localStorage`

---

## 🚀 Getting Started

1. Clone or download this repository.
2. Open `index.html` directly in any modern browser (Chrome, Safari, Firefox, Edge).
3. On first launch, enter your name (or skip), and Professor Hoot will welcome you.
4. Pick a Quick-Play level **or** scroll down to the Activity Library and pick a tile.

No installation, no dependencies, no internet required after the first load (only used to fetch Google Fonts).

---

## 📁 Project Structure

```
TheClockGame/
├── index.html          # Main entry point — home / game / results screens + modals
├── styles.css          # All styling — palette, keyframes, transitions, responsive layout
├── README.md
└── js/
    ├── audio.js        # Web Audio API — programmatic chimes, bwonk, sparkle, fanfare
    ├── voice.js        # Web Speech API wrapper — voice scoring, prosody, school-style time phrasing
    ├── mascot.js       # Inline SVG owl (Professor Hoot) with mood states
    ├── clock.js        # SVG analog clock — main + interactive + mini-clock factory
    ├── confetti.js     # Lightweight canvas particle burst
    ├── dragdrop.js     # Pointer-based drag helper + radial angle-drag for clock hands
    ├── transitions.js  # Screen transition orchestrator — iris wipe, cascade, tap-burst
    ├── activities.js   # Activity Registry + all 10 activities + shared helpers
    └── game.js         # Shell — home, mode picker, mode loops, results, settings
```

Each file is a self-contained IIFE loaded as a plain `<script>` tag — no modules, no bundler, no transpiler.

---

## 🏗️ Architecture

### Activity Registry

Each activity is a small module that exposes a single contract:

```js
{
  id, name, icon, blurb,
  supports: { levels: [1..5], modes: ['practice','quiz','timed','memorize','sandbox'] },
  run(ctx) // returns Promise<{ correct: boolean }>
}
```

The shell handles screen transitions, scoring, voice, mascot, and results — activities just generate one question per `run()` call and resolve when the user answers. The mode loop wraps any activity uniformly:

```
Quiz      → run() × 10, tally stars
Timed     → run() in a loop for 60s, count correct
Practice  → run() forever
Memorize  → run() × 10 with ctx.flashClock() instead of ctx.showClock()
Sandbox   → run() once, never resolves (user exits via Back)
```

Adding a new activity = one IIFE in `activities.js`, push to the registry — the shell picks it up automatically and gives it modes for free.

### Screen transitions

`Transitions.wipe(callback, { origin, tone })` runs the iris-wipe sequence around any DOM swap:

1. A coloured radial-gradient circle (`clip-path: circle()`) blooms from the tap origin to cover the screen
2. A gold clock-face SVG scales in and spins (hour 540°, minute 1080°) — thematic flourish
3. The screen swap runs while everything is covered
4. The iris collapses to centre, revealing the new screen with a `screenIn` bounce

Plus helpers: `Transitions.pulse(el)` (squish-stretch), `Transitions.tapBurst(el)` (origin-ring), `Transitions.cascade(parent, selector)` (stagger-in children via `--i` index var).

---

## 🎮 Quick-Play Difficulty Levels

| Level | Name | What You Learn |
|---|---|---|
| 1 | ⭐ O'Clock | Whole hours — minute hand stays on 12 |
| 2 | 🌙 Half Past | Adds the concept of half past (`:00` and `:30`) |
| 3 | 🌟 Quarter Hours | Adds quarter past and quarter to (`:00`, `:15`, `:30`, `:45`) |
| 4 | 🚀 Five Minutes | Any 5-minute interval |
| 5 | 🏆 Clock Master | Full minute precision |

Activities in the library each declare which of these levels they support — Order Durations skips level 5 (only multiples of 5 make sense for sorting), Word Time starts at level 2 (no phrases for level 1's `o'clock`-only), etc.

---

## 🗣️ Getting the Best Voice

The voice quality varies by OS and browser. The app auto-picks the best available, but you can dramatically upgrade with a free install:

- **macOS:** System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → tick a **(Premium)** voice (Ava, Zoe, or Samantha Premium). These sound nearly human.
- **Windows:** Use **Microsoft Edge** — it ships with free neural voices (Aria, Jenny).
- **Chrome on any OS:** Google-prefixed voices (e.g. "Google US English") work well but require an internet connection.

Open the ⚙️ Settings panel to see the current voice's quality badge. If it says **Basic**, follow the tip in the panel to upgrade.

---

## ♿ Accessibility

- Every interactive element has an `aria-label`
- Colour is never the sole indicator of correctness — always paired with icon (✓ / ✗) and animation
- Minimum 18px text, 24px+ on clock numerals (mini-clocks bumped ×1.4)
- High contrast throughout
- Voice readback covers anyone who can't see the screen well
- **Respects `prefers-reduced-motion`** — disables transitions, tap-bursts, mode-picker pop, and cascades
- Drag interactions also work as keyboard-tappable arrows where it matters (Order Durations)

---

## 🛠️ Tech Notes

- **No frameworks.** Vanilla HTML5, CSS3, and modern JavaScript (ES6+).
- **No build step.** Files run directly in the browser.
- **SVG clock hands** use a wrapping `<g>` translated to centre, with a child `<g>` rotated via CSS transform — so transitions reliably animate across Chrome, Safari, and Firefox.
- **Unique SVG defs IDs per clock** (`faceGrad_1`, `faceGrad_2`, …) prevent the second clock on a page from rendering as a dark blob when the first clock isn't in the DOM.
- **Pointer Events API** with `setPointerCapture` powers all drag interactions — works identically on mouse, touch, and stylus.
- **Voice scoring system** ranks every voice on the device by quality markers (Premium, Enhanced, Natural, Neural, Siri, etc.) and friendly-name preference; novelty voices (Albert, Cellos, Whisper, etc.) are hard-rejected.
- **Prosody chunking** splits text on sentence boundaries and speaks each chunk separately with small gaps, pitch jitter, and rising intonation on questions — so the TTS sounds like a person breathing rather than a robot.
- **School-style time phrasing** via a 12-entry lookup table — `5 → "five past"`, `15 → "quarter past"`, `35 → "twenty-five to"` etc. — matches how the words appear on UK/Commonwealth Year 1 worksheets.

---

## 📦 Storage

All progress is saved in `localStorage` under keys prefixed with `cq_`:

- `cq_progress_v1` — stars per Quick-Play level, unlocked level, last played level, player name, tutorials seen, **per-activity stars + best timed runs**, **endless best score**
- `cq_muted` — sound effects mute state
- `cq_voice_muted` — voice mute state
- `cq_voice_name` — selected voice
- `cq_voice_rate` — speech speed
- `cq_name_skipped` — whether the first-launch name prompt has been dismissed

The progress payload extends additively — older saved progress migrates without data loss (missing fields default to empty, no version bump needed).

Clear browser storage or use the **Reset all progress** button in Settings to start fresh.

---

## 🦉 Made for Toby

Built for a 7-year-old named Toby revising for his Grade 1 final exams, with his 2-year-old sister Arianna in mind for future difficulty curves. The goal: an app you don't have to remind a kid to play.
