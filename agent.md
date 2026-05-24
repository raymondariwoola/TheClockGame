# 🕐 Clock Quest — AI Agent Build Prompt

## Project Overview

Build a **fully self-contained, HTML application** (HTML + CSS + JS, maybe some external frameworks, no servers, no build steps) called **Clock Quest** — a beautifully gamified, interactive clock-reading game for young children aged 5–8. The game must be fun, engaging, visually spectacular, and genuinely educational. It should work perfectly offline after a single file download.

---

## Target Audience

- **Primary user:** Toby, 7 years old — learning to read analog clocks for the first time.
- **Secondary user:** Arianna, ~2 years old — will grow into it; the game must be age-scalable via difficulty levels.
- **Context:** Parent-supervised tablet or desktop play at home.

---

## Core Design Principles

### Aesthetic Direction
Commit to a **playful, whimsical, world-building aesthetic** — think illustrated storybook meets arcade game. This must feel handcrafted and alive, NOT generic. Choose:

- A warm, rich colour palette (deep midnight blues, warm yellows, soft purples, coral accents — like a magical night sky)
- Distinctive, characterful fonts — a bouncy display font for headings (e.g. Fredoka One or Baloo 2 from Google Fonts), paired with a rounded, legible body font
- The clock face should feel like a **living object** — glowing, breathing (subtle CSS pulse), with personality
- Animated clock hands that move smoothly with CSS transitions
- Celebratory particle/confetti effects on correct answers
- Friendly character mascot (a simple SVG owl or star with eyes) that reacts emotionally to correct/wrong answers
- Subtle background animation (floating stars, clouds, or sparkles)
- Every interaction should feel delightful — bouncy buttons, satisfying sounds (Web Audio API), happy animations

### Visual Quality Bar
This must look **state-of-the-art for a kids' educational app**. Think Duolingo-level polish. No flat, boring layouts. Use:
- Drop shadows and glows on the clock
- Rounded, bubbly UI components
- Smooth CSS keyframe animations throughout
- A responsive layout that works on both desktop and tablet (768px+)

---

## Game Structure

### Difficulty Levels (Progressive Learning)

| Level | Name | What Toby Learns | Clock Behaviour |
|---|---|---|---|
| 1 | ⭐ O'Clock | Hour hand only, minute hand fixed at 12 | Only whole hours |
| 2 | 🌙 Half Past | Adds half past concept | :00 and :30 only |
| 3 | 🌟 Quarter Hours | Quarter past & quarter to | :00, :15, :30, :45 |
| 4 | 🚀 Five Minutes | Full 5-minute intervals | Any 5-minute mark |
| 5 | 🏆 Clock Master | Full minute precision | Any time |

The player must **unlock** each level by completing the previous one (earn 5 stars to unlock next level). Stars are stored in `localStorage` so progress persists across sessions.

---

## Gameplay Mechanics

### Main Game Loop

1. A **beautiful analog clock face** is displayed with hands set to a random time appropriate for the current level.
2. The player is asked: **"What time does the clock show?"**
3. Four answer options appear as large, tappable buttons showing digital times (e.g. `3:00`, `3:30`, `6:15`, `9:45`).
4. Player taps an answer:
   - ✅ **Correct:** Confetti explosion, mascot celebrates, upbeat chime (Web Audio), score +10, streak tracked
   - ❌ **Wrong:** Mascot winces, gentle error sound, clock hands animate to shake slightly, correct answer is briefly highlighted before moving on
5. After **10 questions**, the round ends → Score screen with stars earned (1–3 stars based on accuracy), unlocks shown, option to replay or advance.

### Scoring
- 10 questions per round
- 3 stars = 9–10 correct
- 2 stars = 6–8 correct
- 1 star = 3–5 correct
- 0 stars = < 3 correct (retry encouraged with mascot motivation message)

### Streak Bonus
Track answer streaks. At 3-in-a-row: display a "🔥 On Fire!" badge. At 5-in-a-row: bonus animation and extra points.

---

## The Clock Face (Most Important Component)

The analog clock must be **SVG-based**, drawn entirely in code (no image assets). It must include:

- A circular face with a subtle radial gradient (warm white/cream centre, soft edge glow)
- Hour markers (bold for 12, 3, 6, 9 — lighter for others)
- Numbers 1–12 rendered cleanly around the face
- **Hour hand:** Short, thick, rounded — animated with CSS `transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)` for a satisfying bounce
- **Minute hand:** Long, thinner, rounded — same animation
- **Centre dot:** Decorative jewel/gem look with a radial gradient
- **Glow effect:** The entire clock has a soft CSS `box-shadow` / SVG `filter: drop-shadow` glow that pulses subtly
- **Tick marks** around the edge for every minute (fine lines)
- Clock hands must animate to their new position on every new question — never jump instantly

---

## Sound Design (Web Audio API — No External Files)

Generate all sounds programmatically using the Web Audio API:

| Event | Sound |
|---|---|
| Correct answer | Ascending 3-note chime (C–E–G), warm and bright |
| Wrong answer | Low, soft "bwonk" — not harsh or scary |
| Level complete | Short fanfare (4–5 notes) |
| Button hover | Subtle soft tick |
| Streak bonus | Sparkle ascending arpeggio |

All sounds should be **short (< 1 second)** and child-friendly. Include a **mute toggle button** (🔊/🔇) in the corner.

---

## Screens / Views

### 1. Home Screen
- Game title "Clock Quest" in large display font with a glow effect
- Mascot character front and centre, animated (bobbing up and down)
- Level selection grid showing locked/unlocked levels with star ratings
- "Play" button for the last active level

### 2. Game Screen
- Top bar: Level name, score, streak indicator, mute button
- Large SVG clock face, centred
- Question text: `"What time is it?"` in large friendly font
- 4 answer buttons in a 2×2 grid below the clock — large, rounded, colourful
- Mascot in a corner reacting in real time

### 3. Results Screen
- Stars animation (stars fly in one by one)
- Score summary
- Unlock announcement if a new level is unlocked
- "Play Again" and "Next Level" buttons
- Mascot with win/lose expression

---

## Technical Requirements

- **Single `.html` file** — No restrictions on number of pages.
- No restrictions on number of CSS and JS files
- ** External dependencies are allowed as long as they don't break ** — Google Fonts may be loaded via `<link>` (CDN), everything else self-contained or external but non-breaking.
- **localStorage** for saving progress (stars per level, highest level unlocked)
- **No frameworks** — vanilla HTML5, CSS3, JavaScript (ES6+)
- SVG clock drawn entirely in JS/SVG markup, no `<canvas>` for the clock face
- Fully **responsive** — works at 768px width and above (tablet-first)
- All animations via **CSS keyframes** and **JS-driven class toggling**
- Correct answer options must always be randomised in position so the answer isn't always in the same spot

---

## Mascot Design (SVG, inline)

Create a simple, adorable **owl character** built entirely from SVG shapes (circles, ellipses, paths). It should have:
- Large expressive eyes that can change (happy 😊, surprised 😮, sad 😢, excited 🤩)
- Small wings
- A little graduation cap (it's the teacher!)
- Three emotional states controlled by JS class toggling: `.mascot--happy`, `.mascot--sad`, `.mascot--excited`

---

## Accessibility

- All buttons must have `aria-label` attributes
- Colour is never the only indicator of correctness (always paired with icon + animation)
- Font sizes minimum 18px for game UI, 24px+ for clock numbers
- High contrast between text and backgrounds

---

## Deliverable

The main HTML file must open directly in any modern browser with zero setup. On open, the home screen appears immediately, fully functional, with level 1 unlocked by default. All progress is saved automatically via localStorage.

---

## Quality Bar

Before considering this done, verify:
- [ ] Clock hands animate smoothly to every new time
- [ ] All 5 difficulty levels are playable
- [ ] Stars and progress persist after page refresh
- [ ] Sounds play correctly (and mute toggle works)
- [ ] Mascot reacts visually to correct and wrong answers
- [ ] Confetti/particle effect fires on correct answers
- [ ] Streak counter works and resets on wrong answer
- [ ] Results screen shows correct star count
- [ ] New level unlocks when 5 stars are earned on current level
- [ ] Buttons are large enough for a child's finger on a tablet
- [ ] No console errors on load or during gameplay

---

*This game is being built for a 7-year-old named Toby and his younger sister Arianna. Make it magical.*