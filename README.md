# 🕐 Clock Quest

A beautifully gamified, voice-interactive clock-reading game for young children, built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no server — open the HTML file and play.

Created for a 7-year-old learning to read analog clocks, with an aesthetic that aims for Duolingo-level polish: glowing midnight palette, bouncy buttons, a friendly owl mascot ("Professor Hoot"), confetti celebrations, and a fully human-sounding voice teacher powered by the Web Speech API.

---

## ✨ Features

### Gameplay
- **5 progressive difficulty levels** — from "⭐ O'Clock" (whole hours only) to "🏆 Clock Master" (full minute precision)
- Earn **stars** to unlock the next level (5 stars total to progress)
- **10 questions per round**, scored with star ratings (1–3 stars based on accuracy)
- **Streak bonuses** at 3, 5, 7, and 10 correct in a row — with escalating voice reactions ("On fire!" → "LEGENDARY!")
- Smart distractor generation — wrong answers are *plausible near-misses*, not random, so the game is genuinely challenging

### Voice & Audio (Professor Hoot speaks!)
- **Auto-detects the best voice on your device** — prefers macOS Premium/Siri voices, Edge neural voices, Google voices
- Voice quality badge (Premium / Enhanced / Neural / Standard / Basic) with tips on installing better voices
- **Natural prosody** — sentence chunking, pitch jitter, rising intonation on questions, slowed exclamations
- Question narration, correct/wrong reactions, streak shouts, idle nudges, hints, tutorials
- **Hold-to-hear**: long-press any answer button to hear it spoken before committing
- **Name personalisation** — Hoot greets you and sprinkles your name into praise
- Separate mute toggles for 🔊 sound effects and 🗣️ voice
- All beeps, chimes, and fanfares generated on the fly via the Web Audio API (no audio files)

### Visual Polish
- **SVG analog clock** drawn entirely in code — glowing radial gradient face, rounded hands that animate smoothly with cubic-bezier bounce, jewelled centre, pulsing aura
- Hands rotate via shortest path (no backwards-spin glitches)
- **Animated owl mascot** with happy / sad / excited mood states, lip-sync pulse while speaking
- Confetti particle bursts on correct answers
- Floating twinkling stars background
- Bouncy buttons with 3D press feedback
- Fully responsive — tablet-first, scales gracefully to desktop and phone

### UX Niceties
- **Tutorial overlay** the first time you enter each level — Hoot explains how to read clocks at that difficulty
- **Hint button** (💡) — context-aware tips based on the current time
- **Repeat button** (🔁) — re-asks the question
- **Idle nudges** — after 15s of inactivity, the clock wiggles and Hoot offers encouragement
- **Settings panel** (⚙️) — voice picker, speech speed slider, player name, test voice, reset progress
- Progress, stars, and preferences persist via `localStorage`

---

## 🚀 Getting Started

1. Clone or download this repository.
2. Open `index.html` directly in any modern browser (Chrome, Safari, Firefox, Edge).
3. On first launch, enter your name (or skip), and Professor Hoot will welcome you.
4. Pick a level and play!

No installation, no dependencies, no internet required after the first load (only used to fetch Google Fonts).

---

## 📁 Project Structure

```
TheClockGame/
├── index.html          # Main entry point — three screens (home / game / results) + modals
├── styles.css          # All styling — palette, keyframes, responsive layout
└── js/
    ├── audio.js        # Web Audio API — programmatic chimes, bwonk, sparkle, fanfare
    ├── voice.js        # Web Speech API wrapper — voice scoring, prosody, time-to-words
    ├── mascot.js       # Inline SVG owl (Professor Hoot) with mood states
    ├── clock.js        # SVG analog clock builder with animated hands
    ├── confetti.js     # Lightweight canvas particle burst
    └── game.js         # Game loop, level config, state, settings, all wiring
```

Each file is self-contained and loaded as a plain `<script>` tag — no modules, no bundler.

---

## 🎮 Difficulty Levels

| Level | Name | What You Learn |
|---|---|---|
| 1 | ⭐ O'Clock | Whole hours — minute hand stays on 12 |
| 2 | 🌙 Half Past | Adds the concept of half past (`:00` and `:30`) |
| 3 | 🌟 Quarter Hours | Adds quarter past and quarter to (`:00`, `:15`, `:30`, `:45`) |
| 4 | 🚀 Five Minutes | Any 5-minute interval |
| 5 | 🏆 Clock Master | Full minute precision |

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
- Minimum 18px text, 24px+ on the clock numerals
- High contrast throughout
- Voice readback covers anyone who can't see the screen well

---

## 🛠️ Tech Notes

- **No frameworks.** Vanilla HTML5, CSS3, and modern JavaScript (ES6+).
- **No build step.** Files run directly in the browser.
- **SVG clock hands** use a wrapping `<g>` translated to centre, with a child `<g>` rotated via CSS transform — so transitions reliably animate across Chrome, Safari, and Firefox.
- **Voice scoring system** ranks every voice on the device by quality markers (Premium, Enhanced, Natural, Neural, Siri, etc.) and friendly-name preference; novelty voices (Albert, Cellos, Whisper, etc.) are hard-rejected.
- **Prosody chunking** splits text on sentence boundaries and speaks each chunk separately with small gaps, pitch jitter, and rising intonation on questions — so the TTS sounds like a person breathing rather than a robot.

---

## 📦 Storage

All progress is saved in `localStorage` under keys prefixed with `cq_`:

- `cq_progress_v1` — stars per level, unlocked level, last played level, player name, tutorials seen
- `cq_muted` — sound effects mute state
- `cq_voice_muted` — voice mute state
- `cq_voice_name` — selected voice
- `cq_voice_rate` — speech speed
- `cq_name_skipped` — whether the first-launch name prompt has been dismissed

Clear browser storage or use the **Reset all progress** button in Settings to start fresh.

---

## 🦉 Made for Toby

Built for a 7-year-old named Toby who's learning to read clocks, with his 2-year-old sister Arianna in mind for future difficulty curves. Designed to be the kind of app you don't have to be reminded to play.
