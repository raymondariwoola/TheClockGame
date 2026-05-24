# 🦉 Little Learners — AI Agent Build Prompt

## Project Overview

Build a **fully self-contained, multi-page web application** (HTML + CSS + JS, no servers, no build steps) called **Little Learners** — a beautifully gamified, deeply interactive learning suite for very young children (ages 2–5) covering the building blocks of early learning: **Letters, Numbers, Colors, Animals, Shapes, Body Parts, Family, Food, Counting, and Phonics**. The app must feel magical, calm-but-exciting, and genuinely educational. It should work perfectly offline after one download.

It is the second app in the **Professor Hoot Learning Suite** (the first being *Clock Quest*). The mascot, visual identity, voice system, and progress storage must be **architected for reuse** across future suite apps.

---

## Target Audience

- **Primary user:** Arianna, ~2 years old — pre-reader, just starting to recognise letters, numbers, and the world around her.
- **Secondary user:** Toby, 7 years old — will dip in and out, especially on harder difficulties.
- **Context:** Parent-supervised tablet (primary), phone, or desktop play at home. Often used during quiet time, bedtime wind-down, or short bursts.

**Critical design assumption:** the primary user **cannot read**. Every instruction, prompt, button, and feedback must be delivered through **voice + icon + colour + animation simultaneously**. Text exists for the parent and older siblings — never as the only signal.

---

## The Mascot — Professor Hoot (Suite-wide character)

Use the **same owl mascot** as Clock Quest — same SVG construction, same emotional states (`happy`, `sad`, `excited`), same graduation cap. Add new states needed for this app:

- `mascot--thinking` (eyes look up, slight tilt)
- `mascot--celebrating` (wings flap, sparkles)
- `mascot--singing` (beak open, music notes float)
- `mascot--waving` (one wing raised — for greetings)

**Suite reuse rule:** Extract the mascot into a standalone file `shared/mascot.js` that exports a consistent API:
```js
Mascot.build()           // returns SVG element
Mascot.setMood(el, mood) // 'happy' | 'sad' | 'excited' | 'thinking' | 'celebrating' | 'singing' | 'waving'
Mascot.speak(el, on)     // toggles speaking animation
Mascot.wave(el)          // one-shot wave
```

The mascot must feel like the **same character across all suite apps** — same proportions, colours, personality, voice.

---

## Core Design Principles

### Aesthetic Direction — "Storybook Daytime"

Where Clock Quest used a magical midnight palette, Little Learners is **bright, warm daytime** — like a sunlit nursery wall:

- **Palette:** soft sky blues, sunshine yellows, grass greens, peachy pinks, lavender, cream — high saturation but soft (no neon). Think *Sandra Boynton meets Pixar's Up*.
- **Fonts:** `Fredoka` (700) for headings, `Baloo 2` (500/700) for body — extra-large sizes (toddlers need it).
- **Shapes:** rounded everything, no sharp corners ever. Buttons are pill or blob shaped. Cards have 24–32px radius.
- **Texture:** subtle paper grain or watercolour wash behind elements (CSS noise or SVG filter).
- **Motion:** every element breathes, bobs, wiggles, or pulses gently. Nothing static. Use cubic-bezier(0.34, 1.56, 0.64, 1) liberally.
- **Backgrounds:** each category has its own themed background (e.g. Animals → grassy field with floating leaves; Numbers → starry math sky; Colors → rainbow gradient).

### Visual Quality Bar

This must match or exceed Khan Academy Kids / Endless Alphabet / Sago Mini polish. Specifically:

- Massive tap targets (minimum **96×96px**, prefer 120px+)
- Drop shadows, soft glows, layered depth
- SVG illustrations for every concept (drawn in code where simple; can use inline SVG strings from public-domain sources like OpenMoji where complex)
- Smooth keyframe animations everywhere
- Celebratory particle effects (confetti, sparkles, stars, hearts) on correct answers
- Responsive: phone portrait → tablet → desktop, all first-class

---

## Suite Architecture (CRITICAL)

The folder structure must support future suite expansion:

```
little-learners/
├── index.html              # Main hub — category picker
├── styles/
│   ├── shared.css          # Suite-wide variables, mascot, buttons, modals
│   └── learners.css        # App-specific styles
├── shared/                 # Reusable across ALL suite apps
│   ├── mascot.js           # Professor Hoot SVG + moods
│   ├── voice.js            # TTS wrapper (port from Clock Quest, enhance)
│   ├── audio.js            # Web Audio sound effects
│   ├── confetti.js         # Particle bursts
│   ├── progress.js         # localStorage wrapper, suite-aware namespacing
│   ├── ui.js               # Modal, button, toast helpers
│   └── theme.js            # CSS variable theme switcher
├── js/
│   ├── hub.js              # Category picker logic
│   ├── game-letters.js
│   ├── game-numbers.js
│   ├── game-colors.js
│   ├── game-animals.js
│   ├── game-shapes.js
│   ├── game-bodyparts.js
│   ├── game-family.js
│   ├── game-food.js
│   ├── game-counting.js
│   └── game-phonics.js
├── pages/
│   ├── letters.html
│   ├── numbers.html
│   ├── colors.html
│   ├── animals.html
│   ├── shapes.html
│   ├── bodyparts.html
│   ├── family.html
│   ├── food.html
│   ├── counting.html
│   └── phonics.html
└── assets/
    ├── sounds/animals/     # Parent will supply (cow.mp3, dog.mp3, etc.)
    ├── sounds/sfx/         # Optional extra SFX
    └── images/             # Any image assets if needed (SVG preferred inline)
```

**Suite progress namespacing:** all localStorage keys live under `pp_learners_*` (Professor Hoot Learners). The shared `progress.js` exposes a namespaced API so each app in the suite can coexist:
```js
Progress.app('learners').get('stars.letters') // → number
Progress.app('learners').set('stars.letters', 5)
Progress.app('learners').profile()            // → { name, age, avatar }
```

A **shared profile** (name, age, optional avatar) is read by every suite app, so the child only ever introduces themselves once.

---

## Age-Based Difficulty Levels

The parent picks the child's **age** (or "Age Mode") on first launch — this auto-tunes every category. Override per-category at any time.

| Age Mode | Visual Cue | Behaviour |
|---|---|---|
| 👶 **Toddler** (2–3) | Big Bear icon | 2 answer choices, super slow voice, all visuals labelled with icons, mascot narrates everything, no penalties |
| 🧒 **Preschool** (3–4) | Yellow Star icon | 3 answer choices, normal pace, simple rounds, gentle encouragement |
| 🎒 **Kindergarten** (4–5) | Green Apple icon | 4 answer choices, faster pace, mini-challenges, stars/score |
| 🚀 **Early Reader** (5+) | Rocket icon | 4–6 choices, spelling/phonics blends, timed bonus rounds (optional) |

**Toddler mode rule:** there is no such thing as "wrong". Every tap is met with positive feedback — wrong taps gently redirect ("That's the cat! Can you find the dog?"). Stars are still awarded but always at least 1.

---

## Categories (Each is a Self-Contained Mini-Game)

Each category is its own page/file, but they share the suite components. All categories share the **same lesson rhythm**:

1. **Discover** mode (free-play exploration: tap things, hear them)
2. **Practice** mode (gentle multiple choice or matching)
3. **Quiz** mode (10-round assessment with stars)

The child picks the mode from a sub-menu inside the category.

### 1. 🔤 Letters (A–Z)
- **Discover:** Tap any letter on a big alphabet grid → Hoot says the letter name + a phonic ("A says 'ah', like APPLE 🍎") + shows an example word with an SVG illustration that pops in.
- **Practice:** "Find the letter B!" — child taps from 2–4 letters.
- **Quiz:** Mixed: find-the-letter, what-letter-makes-the-sound, match-uppercase-to-lowercase.
- Include **letter tracing** mode (optional): big dotted letter, child drags finger along path (HTML5 pointer events + SVG path).

### 2. 🔢 Numbers (0–20)
- **Discover:** Number grid. Tap → Hoot says number + shows that many objects animating in (e.g. 5 → 5 ducks waddle across).
- **Practice:** "Find the number 7!"
- **Quiz:** "How many apples?" → tap correct number.
- Include **dot-tap counting**: dots appear, child taps each one and Hoot counts along ("one... two... three... THREE!").

### 3. 🎨 Colors
- **Discover:** Color wheel. Tap → Hoot names it + screen washes in that colour briefly + shows themed objects ("Red! Like a STRAWBERRY 🍓, a FIRE TRUCK 🚒, a HEART ❤️").
- **Practice:** "Which one is blue?" with 2–4 coloured shapes.
- **Quiz:** Mix: name-the-color, find-the-color, "what color is the SUN?" with a picture.

### 4. 🐾 Animals (with sounds — parent will supply)
- **Discover:** Animal grid (cow, dog, cat, duck, lion, elephant, horse, sheep, pig, frog, owl, bee, etc.). Tap → plays the **real animal sound from `assets/sounds/animals/<name>.mp3`** + Hoot says the animal's name.
- **Practice:** "Which one is the cow?" — show 2–4 animals.
- **Quiz:** Mixed: "Which animal says MOO?" (play sound, child picks animal); "What sound does a duck make?" (show duck, child picks from 3 sound buttons).
- Code must **gracefully handle missing audio files** — if a sound file 404s, still show the animal and have Hoot say the name + verbal sound ("The cow says moooo!").
- Make the audio loader configurable: a single `js/animals-data.js` file listing each animal, its image/SVG, sound filename, and Hoot's verbal version — so adding new animals is a one-line change.

### 5. 🔷 Shapes
- **Discover:** Circle, square, triangle, rectangle, oval, star, heart, diamond, hexagon, crescent. Tap → Hoot names it + shape morphs/dances + shows "Like a PIZZA 🍕!"
- **Practice + Quiz:** standard find-the-shape rounds.

### 6. 👋 Body Parts
- A big friendly cartoon child (SVG, neutral skin tone option or several skin-tone variants the parent can pick). Tap body part → Hoot names it + part wiggles.
- "Where is your nose?" → child taps the nose on the figure.

### 7. 👨‍👩‍👧 Family
- Mom, Dad, Sister, Brother, Baby, Grandma, Grandpa, etc. Cartoon characters. Hoot names each.
- Allow **photo upload** (localStorage as base64) so the parent can attach the actual family member's name+photo for personalisation — this is gold-tier delight.

### 8. 🍎 Food
- Fruits + Veggies + common foods. Tap → name + "Yummy!" + Hoot reacts.
- "Find the apple!"

### 9. 🔟 Counting
- Visual counting practice. Bubbles float up, child taps each one — Hoot counts along.
- "How many?" puzzles.
- Counting songs (one-two-three-four-FIVE, once I caught a fish alive — via TTS).

### 10. 📖 Phonics
- Letter sounds, blending. "C-A-T... CAT!"
- Drag letters into slots to build simple 3-letter words.
- Show picture, child taps letters in order.

---

## Voice System (Critical for Pre-readers)

Reuse and extend `Voice` from Clock Quest. Specifically:

- **Auto-pick best voice on device** (scoring system: Premium > Enhanced > Neural > Standard).
- **Prosody chunking** (split on sentence boundaries, pitch jitter, rising intonation on questions).
- **Speaker rate** defaults to **0.9× for Toddler mode**, 1.0× otherwise.
- **Always speak the instruction.** Every question must be voiced. Auto-replay 8 seconds after question appears if not answered.
- **Singing mode** for letter songs, counting songs, etc. — use pitched short phrases with pauses for musicality (TTS won't actually sing, but we can imitate cadence).
- **Name personalisation** ("Great job, Arianna!").
- **Hold-to-hear** on every answer button (long-press to hear what it is before tapping).
- **Mascot lip-sync** — speaking class pulses the mascot while voice is talking.

Add new method:
```js
Voice.spell(word)  // "C... A... T... CAT!" with pauses
Voice.count(n)     // "one, two, three, FOUR!" — last one stressed
Voice.cheer()      // randomised exclamation
```

---

## Sound Design (Web Audio API + supplied MP3s)

- **Generated SFX** (reuse from Clock Quest): correct chime, wrong bwonk, sparkle, fanfare, hover tick.
- **Add:** soft "pop" (for tap feedback on Discover mode), "swish" (transitions), "ding" (counter up), magical sparkle (unlocks).
- **Real audio:** the animal sounds live in `assets/sounds/animals/`. Use `<audio>` elements with preload="auto" once a category is opened. Provide a loader with graceful fallback.

---

## Screens / Views

### 1. Hub (index.html)
- Big title "Little Learners" with bobbing Professor Hoot
- Greeting: "Hi {name}! What do you want to learn today?"
- **Category grid** — 10 large colourful cards (one per category) with icon + label. Each card pulses gently and on hover/tap, Hoot says its name.
- Bottom strip: age-mode badge, settings cog, parent button (gated by simple math-gate so toddlers can't open it: "Tap the 7" between 3 numbers).
- "Continue last activity" button if applicable.

### 2. Category Page (e.g. pages/animals.html)
- Top bar: back arrow (big!), category icon + name, mode picker (Discover / Practice / Quiz)
- Main area: the activity
- Hoot in corner, reactive
- Voice + Sound mute toggles top-right

### 3. Results / Mini-Celebration
- After every Practice or Quiz round: stars fly in, Hoot cheers, confetti, "Play again" / "Pick another" / "Home"
- Toddler mode: ALWAYS 3 stars, no failure

### 4. Settings (suite-wide, lives in shared/ui.js modal)
- Child's name
- Age mode (Toddler / Preschool / Kindergarten / Early Reader)
- Voice picker + speed
- Voice quality badge (Premium/Enhanced/etc.) with install tip if Basic
- Sound effects toggle
- Background music toggle (gentle ambient loop, off by default)
- Parent dashboard link
- Reset progress

### 5. Parent Dashboard (math-gated)
- Stars per category
- Time spent per category
- Suggestions ("Arianna loves Colors! Try Shapes next.")
- Export/import progress (JSON download/upload)

---

## Interactive Magic (Use Liberally)

These are the moments that make a toddler shriek with joy:

- **Letter pop-in:** when a letter is named, the corresponding object image bursts in with bounce
- **Animal jiggle:** every animal SVG has an idle wiggle and a tap-reaction (cow moos and jumps)
- **Color wash:** when a color is named, a soft full-screen tint flashes briefly
- **Counter bubbles:** numbers count up with bouncing bubbles
- **Hoot reactions:** Hoot's eyes follow the cursor/finger on Discover screens (subtle parallax)
- **Drag-and-drop:** for matching/phonics — items snap with a satisfying haptic-style animation
- **Shake-to-reset:** on tablets, shake the device to clear current answer (just a fun easter egg, behind a toggle)
- **Day/Night theme:** time-of-day-aware — switches to softer warmer palette after 6pm (great for bedtime use)
- **Sticker rewards:** earned stickers unlock for the child's personal sticker book (a separate fun-only screen)

---

## Accessibility & Toddler-Safety

- All interactions must work with **a single finger tap** — no double-tap, no drag required for core gameplay (drag is bonus only)
- **No reading required** anywhere in primary flow
- High contrast everywhere
- Colour is never the only signal — always paired with icon + voice
- **Parent gate** for settings, reset, dashboard (simple "Tap the X" puzzle)
- No external links, no ads, no in-app anything
- **Auto-pause** after 20 minutes with a gentle "Time for a break!" overlay (parent can dismiss)

---

## Technical Requirements

- **Multi-file vanilla HTML/CSS/JS** — no build step, no framework
- External libraries allowed if helpful (e.g. lottie-web for richer animations, howler.js for audio if Web Audio is awkward). **Prefer zero deps where possible.**
- Google Fonts via `<link>` is fine
- All SVGs inline or in JS strings
- `localStorage` only (no IndexedDB needed unless using photo upload — then use IndexedDB for blobs)
- Must work **offline** after first load — consider a service worker for asset caching (optional but recommended)
- Fully responsive: 360px phone portrait → 1440px desktop
- Pages link to each other via standard `<a href>` — keep navigation clean
- All shared components imported via `<script src="shared/...">` so any single page works standalone

---

## Animal Sound File Convention (Parent will supply)

Use lowercase, singular, hyphen-separated names. Format: MP3, < 200KB each, < 3 seconds long.

```
assets/sounds/animals/cow.mp3
assets/sounds/animals/dog.mp3
assets/sounds/animals/cat.mp3
assets/sounds/animals/duck.mp3
assets/sounds/animals/lion.mp3
assets/sounds/animals/elephant.mp3
assets/sounds/animals/horse.mp3
assets/sounds/animals/sheep.mp3
assets/sounds/animals/pig.mp3
assets/sounds/animals/frog.mp3
assets/sounds/animals/owl.mp3
assets/sounds/animals/bee.mp3
assets/sounds/animals/rooster.mp3
assets/sounds/animals/monkey.mp3
assets/sounds/animals/wolf.mp3
```

Define the animal roster in **one config file** (`js/data/animals.js`) so adding a new animal = one entry. Each entry includes: name, emoji or SVG ref, sound filename, verbal sound ("The cow says moooo"), and example sentence.

---

## Suite Vision (Future-proofing)

This app should be built so that in the future, the parent can drop in:
- *Clock Quest* (existing)
- *Word Builder* (reading)
- *Math Adventures*
- *World Atlas Junior*

…and they all share Professor Hoot, the same profile, the same settings, the same voice config, the same star economy. To enable this:

- All shared code lives in `shared/` and uses a `PP` namespace (`PP.Mascot`, `PP.Voice`, `PP.Progress`)
- The profile and settings persist under `pp_profile_*` (not app-scoped)
- A future "Suite Launcher" page can list installed apps and show overall progress

---

## Deliverable

A folder `little-learners/` containing all files. Opening `little-learners/index.html` directly in a browser must:
- Show the hub immediately with all 10 categories
- Greet the child by name (or prompt for it on first launch)
- Allow tapping any category and playing the Discover / Practice / Quiz modes
- Persist progress and profile via localStorage
- Speak everything aloud

---

## Quality Bar

Before considering this done, verify:

- [ ] All 10 categories playable in all 3 modes (Discover / Practice / Quiz)
- [ ] Professor Hoot is consistent across every page (same SVG, same animations)
- [ ] Age mode tunes difficulty appropriately (verified at Toddler and Kindergarten)
- [ ] Voice speaks every prompt; auto-replays if child doesn't answer
- [ ] Animal sounds load from `assets/sounds/animals/` with graceful fallback
- [ ] Toddler mode never tells the child they're wrong
- [ ] Parent gate prevents toddlers opening settings
- [ ] Profile (name, age) persists across pages and sessions
- [ ] All buttons are min 96×96px on touch devices
- [ ] No reading required anywhere in primary flow
- [ ] Confetti / celebration fires on every correct answer
- [ ] Mascot pulses when speaking (lip-sync illusion)
- [ ] Suite namespacing (`PP.*`, `pp_*` localStorage) is in place
- [ ] App works fully offline after first load
- [ ] No console errors on load or during play
- [ ] Adding a new animal requires editing exactly one config file

---

## Final Notes for the Implementing Agent

- **Do not skimp on the SVGs.** Each animal, fruit, body part etc. needs a recognisable illustration. Use OpenMoji or Twemoji SVGs (CC-BY) if you can't draw them in code — embed them inline. Twemoji's PNGs are available via CDN; SVGs can be inlined.
- **Toddler attention spans are seconds.** Rounds are 5–8 questions max for under-4s. Quick celebration after every single correct answer.
- **Voice is the soul of this app.** A silent toddler app is broken. Treat the Voice integration as P0.
- **Test on a tablet in portrait orientation.** That's the primary device. Then test landscape, then desktop.
- **Make it feel like the same Professor Hoot.** When Arianna eventually plays Clock Quest in a few years, she should recognise her friend.

*This app is for Arianna (2) and the toddler-aged sibling of every family that downloads it. Make it the first app she opens every morning.*
