# 🦉 Hoot's Playground — AI Agent Build Prompt

## Project Overview

Build a **fully self-contained, browser-based learning suite** (HTML + CSS + JS, no servers, no build step required) called **Hoot's Playground** — a magical first-learning world for very young children. It is the second app in a growing suite hosted by the same mascot, **Professor Hoot**, who already stars in *Clock Quest* (the older-sibling app teaching analog clocks).

This app is the **toddler-and-preschool gateway**: alphabet, numbers, colors, shapes, animals, and more. It must feel like opening a magical storybook — every tap should reward, nothing should ever fail, and the whole experience should make the child want to come back tomorrow.

> 🎯 **Non-negotiable design promise:** A two-year-old should be able to use this app **without an adult**, without ever hitting a dead end, error message, or "wrong" feedback that feels punishing.

---

## Target Audience

- **Primary user:** Arianna, ~2 years old — pre-reader, pre-writer, developing fine motor control on a touchscreen. Loves bright colors, animals, repetition.
- **Secondary user:** Children 3–5 — emerging readers, can recognize letters/numbers, ready for light "find the X" challenges.
- **Tertiary user:** Children 6+ — moving toward writing letters, simple spelling, counting beyond 20. (This is where they graduate up to *Clock Quest* and future suite apps.)
- **Context:** Parent-supervised tablet (iPad / Android tablet / touch-screen Chromebook) at home. Must also work on desktop with mouse and on phones in landscape.

---

## The Suite Vision (Important Context)

This app is **app #2** in what will become **Hoot Academy** — a growing universe of educational apps for children aged 2–10, all hosted by the same character. Build accordingly:

- **Shared mascot:** Professor Hoot the owl. The SVG markup, mood states, and animations should be **copy-pasted from Clock Quest** (`js/mascot.js`) so the character looks and behaves identically.
- **Shared design tokens:** Reuse the warm midnight-sky palette (deep blues, golds, corals, soft purples) so the apps feel like family.
- **Shared voice character:** Same Professor Hoot voice persona — warm, encouraging, never condescending. Reuse the same voice-selection logic, including the Premium voice tip in settings.
- **Shared progress object key prefix:** Use `hp_` for *Hoot's Playground* localStorage keys (Clock Quest uses `cq_`), so future apps can coexist without colliding.
- **Future-proof:** Structure code so the mascot, voice, audio, and confetti modules could later live in a shared `/common/` folder when the suite is unified.

---

## Core Design Principles

### Aesthetic Direction
**Magical storybook playroom.** Think Sago Mini meets Khan Academy Kids meets Eric Carle illustrations. Commit fully — no flat, generic UI.

- **Palette:** Build on the Clock Quest palette but skew **brighter and warmer** for daytime play. Deep midnight blue still anchors the background, but add:
  - 🌅 Sunrise coral `#ff8c66`
  - 🍋 Lemon yellow `#ffd966`
  - 🌿 Soft mint `#7fdca8`
  - 💜 Lavender `#c9a3ff`
  - 🌸 Bubblegum pink `#ff9bc7`
  - Plus warm cream `#fff5dc` for surfaces
- **Typography:** Display headings in **Fredoka** (already loaded for Clock Quest) or **Baloo 2** — bouncy, rounded, child-friendly. For category titles use jumbo size (60px+). Letters in alphabet mode should be in a beautiful chunky display face like **Fredoka 700** or **Bagel Fat One**.
- **Backgrounds:** Each category gets its own subtle themed background (e.g., Animals = soft forest silhouette; Numbers = floating bubbles; Colors = paint-splash motif; Alphabet = constellation letters).
- **Everything bounces.** Tap a card → it pops. Drag a thing → it springs back. Idle → things bob gently. Use cubic-bezier(0.34, 1.56, 0.64, 1) for that satisfying overshoot.
- **Particle effects everywhere:** Confetti on correct, sparkles on tap, hearts on favorites, stars on streaks.

### Visual Quality Bar
**Disney-app polish, indie warmth.** Reference apps to match the feeling of: *Sago Mini Forest Flyer*, *Endless Alphabet*, *Khan Academy Kids*, *Toca Boca*. Use:

- Soft shadows and glows (no hard, flat edges)
- Rounded everything (`border-radius: 24px+`)
- SVG illustrations preferred over emoji where the design needs personality (emoji are fine for placeholders or category icons, but main game objects — animals, letters, shapes — should be styled SVG or carefully designed)
- Smooth keyframe animations throughout
- A subtle parallax / floating animation in backgrounds to make scenes feel alive

---

## App Structure

### Home / "Playground" Screen
A single home that shows **Professor Hoot in the middle of a cozy playroom**, with category "doors" or "islands" arranged around him. Each door is a giant, tappable, illustrated entry point.

- Hoot waves and says: *"Hi! What do you want to learn today?"*
- Categories appear as **big colorful tiles** (180px+ tap target), each with:
  - A themed icon/illustration
  - The category name (also spoken on tap-and-hold)
  - A small progress ring showing stickers earned in that category
- Small ⚙️ gear in corner opens settings.
- Small 🏆 trophy opens **Sticker Book** (see Rewards).

### Categories (each is its own "world")

| Category | Icon | What's Inside |
|---|---|---|
| 🔤 **Alphabet** | Rainbow A | Letters A–Z with sounds, words, and find-it games |
| 🔢 **Numbers** | Golden 7 | 1–20, counting, simple addition (age-gated) |
| 🎨 **Colors** | Paint splash | 12 colors, color-mixing, color hunts |
| 🐾 **Animals** | Friendly owl | Animals with real recorded sounds, habitats, names |
| 🔷 **Shapes** | Star + heart | Circle, square, triangle, star, heart, etc. |
| 🎵 **Music & Rhymes** | Music note | Sing-alongs, instrument tap-to-play, nursery rhymes (optional v2) |
| 🌦️ **Weather & Seasons** | Sun + cloud | Sunny, rainy, snowy — name them, dress Hoot for the weather (optional v2) |
| 🍎 **Food** | Apple | Fruits, veggies, healthy choices, what does Hoot want? (optional v2) |

**Build phase 1:** Alphabet, Numbers, Colors, Animals, Shapes. The others are stretch goals you can stub with "Coming soon!" tiles that play a teaser sound when tapped.

---

## Per-Category Game Specs

Each category has **multiple play modes**, gated by the difficulty/age setting.

### 🔤 Alphabet

**Modes:**
1. **Explore mode** (default, all ages) — A grid of 26 letter tiles. Tap one → letter zooms forward, speaks the letter name ("A!"), then the phonetic sound ("ah!"), then a word that starts with it shown as an illustration ("Apple! 🍎"). Tap again to hear again. **No wrong answers — pure discovery.**
2. **Find the Letter** (3+) — Hoot says *"Find the letter B!"*. Four tiles appear, child taps one. Correct = celebration; wrong = gentle "Try again!" with the correct tile glowing.
3. **Letter Sounds** (4+) — Hoot says a sound ("buh"), child picks the letter that makes it.
4. **Beginning Letters** (5+) — A picture appears (cat 🐱), child picks the letter it starts with.
5. **ABC Song mode** — Tap to start; letters light up in sequence as the ABC song plays (use TTS or a recorded version if supplied).

**Every letter MUST:**
- Be spoken in **letter name** ("A") AND **phonetic sound** ("ah")
- Have an associated **example word and image** (Apple, Ball, Cat, Duck, …)
- Have a sticker awarded the first time it's mastered

### 🔢 Numbers

**Modes:**
1. **Counting Garden** (2+) — Tap a number 1–10 → that many cute objects pop into existence with a "boing!" sound for each. Hoot counts along: *"One... two... three!"*
2. **Tap to Count** (2+) — A pile of objects appears (say 5 apples). Child taps each one in turn; each tap = "one", "two", "three"… Final tap reveals *"Five apples!"*
3. **Find the Number** (3+) — *"Where is the number seven?"* — 4 numerals, pick one.
4. **How Many?** (4+) — A scene with objects (e.g., 3 ducks), 4 number choices, pick the right one.
5. **Simple Addition** (5+) — Visual: 2 apples + 1 apple = ? — child picks from 3 options. Use **only single-digit + single-digit** with sum ≤ 10.

Range: 1–10 for ages 2–4, 1–20 for 5+, simple addition for 6+.

### 🎨 Colors

**Modes:**
1. **Color Splash** (2+) — A wheel of 12 color blobs. Tap one → blob splashes outward across the screen, color is spoken. *"Red! Like an apple."*
2. **Find the Color** (3+) — *"Tap all the red things!"* — A scene with multiple objects, child taps every red one. Each correct tap = sparkle + "Yes!"
3. **Color Match** (3+) — Two halves of an object, different colors; drag matching halves together.
4. **Color Mixing** (5+) — Two paint blobs combine when dragged together → reveals new color. (Yellow + Blue = Green!) Pure delight, no quiz.
5. **Rainbow Builder** (4+) — Drag color arcs into order to build a rainbow → it animates and sparkles.

### 🐾 Animals

**Modes:**
1. **Animal Zoo** (2+) — Grid of animals. Tap one → animal becomes large, plays its **real recorded sound** (parent-supplied — see Assets), and Hoot says the animal's name and a fun fact. *"Cow! Cows say moo. Cows live on farms."*
2. **Who Said That?** (3+) — Hoot plays a sound, child picks the animal from 4 choices.
3. **Where Do I Live?** (4+) — Animals are scattered around the screen; child drags each to its habitat (farm, ocean, forest, jungle).
4. **Baby Animals** (4+) — Match the baby to its parent. (Calf → cow, foal → horse, etc.)
5. **Animal Parade** (free play) — Tap animals to add them to a parade across the screen, each making its sound.

**Animal list (12 starter pack):** cow, sheep, horse, pig, chicken, dog, cat, duck, owl, lion, elephant, monkey.

### 🔷 Shapes

**Modes:**
1. **Shape Explorer** (2+) — Grid of shapes. Tap one → it spins, grows, and Hoot says the name. *"Triangle! It has three sides."*
2. **Find the Shape** (3+) — *"Find the heart!"* — pick from 4.
3. **Shape Sorter** (3+) — Drag shapes into matching holes (classic toy mechanic).
4. **Build a Picture** (4+) — Drag shapes onto a canvas to build a house, a face, a sun. Free play.

---

## Difficulty / Age Settings

A simple **age selector** in settings — or detected on first launch via a one-time "How old is your child?" prompt with three big illustrated buttons:

| Setting | Age | What Changes |
|---|---|---|
| 🐣 **Tiny Hoot** | 1–2 | Explore modes only. Massive tap targets (≥120px). No fail states. Voice is slower, more melodic. Auto-advance after long pauses. Every tap is celebrated. |
| 🌱 **Little Hoot** | 3–4 | Adds Find-the-X modes. Wrong answers get a gentle "Try again!" — never a sad sound, never a star deducted. Still no fails. |
| ⭐ **Big Hoot** | 5+ | Adds advanced modes (sounds → letter, beginning letters, addition). Introduces stars-earned and streaks. Closer to Clock Quest's mechanics. |

Setting is **persistent** in localStorage. Parent can change anytime in ⚙️ settings.

---

## The "No-Fail" Philosophy (Critical for Tiny Hoot)

For ages 2–4, the app must **never** make the child feel they got something wrong:

- Wrong tap → cheerful "Oops, try again!" + the correct answer glows invitingly.
- After 2 wrong attempts on the same prompt → the correct answer **gently wiggles and sparkles**, and if they tap it (or any answer), it counts as correct.
- After 3 wrong attempts → Hoot just announces the answer himself and moves on: *"This one is C! Let's try another."*
- No timers. No countdowns. No "you lose" screens. No deducted points.
- Every play session ends with a **certificate of fun** showing what they explored ("You played with 8 letters today!").

---

## Mascot: Professor Hoot (Reuse from Clock Quest)

**Use the exact same SVG owl from `js/mascot.js` in Clock Quest.** Copy it byte-for-byte. The character must be visually identical so kids who grow into Clock Quest recognize him.

Additional moods to add for this app:
- `.mascot--curious` — head tilts slightly, one eye larger
- `.mascot--sleepy` — eyes half closed (for idle states)
- `.mascot--singing` — beak opens and closes with note bubbles for music/ABC modes

Hoot should appear:
- **On the home playground** front and center, idly bobbing.
- **In every category screen**, in a corner, reacting in real time.
- **Speaking** — when Hoot is talking, mascot pulses with `.speaking` class (already in Clock Quest CSS).

---

## Voice & Audio Architecture

### Voice (TTS) — Reuse Clock Quest's `voice.js` Wholesale
Copy `js/voice.js` and `Phrases` and the voice settings UI from Clock Quest. Same Premium-voice detection, same prosody chunking, same name personalization.

Add to the Phrases module:
- **Discovery exclamations** (for free-play): "Ooh!", "Wow, look at that!", "Beautiful!", "Yes!"
- **Encouragement for repeated play**: "Want to do another?", "Tap a different one!"
- **Toddler-tier praise** (used in Tiny Hoot mode): softer, slower, more melodic — *"Goooood job!"*

### Real Recorded Sounds (Animal Category)

The parent will supply MP3/OGG/WAV audio files for animal sounds. Structure:

```
/assets/sounds/animals/
  cow.mp3
  sheep.mp3
  horse.mp3
  ...
```

**Loader requirements:**
- Files are loaded lazily on first use of the Animals category.
- If a file is missing, fall back to TTS speaking the sound word ("moo moo!").
- Volume normalized to ~0.8 to avoid jump-scares.
- Each sound preceded by a tiny 100ms silence to feel less abrupt.
- Build a simple manifest at `/assets/sounds/manifest.json` so adding new sounds = just dropping a file and editing the manifest.

### Generated Audio (Web Audio API)
Reuse Clock Quest's `audio.js` for: tap chimes, success arpeggios, "boing" pops (number counting), error bonk (only used above age 5). Add:
- **Tap chime** — soft xylophone "pling" on any tap
- **Object pop** — used when objects appear during counting
- **Sparkle** — used for color-mixing reveals
- **Rainbow chord** — C major triad held with reverb-like sustain for rainbow builds

---

## Rewards: The Sticker Book

A central, persistent **Sticker Book** the child unlocks stickers for. Stickers are the only "score" — no points, no stars.

- Each letter mastered = 1 sticker (26 total in Alphabet)
- Each number mastered = 1 sticker (10 or 20 total)
- Each color discovered = 1 sticker (12 total)
- Each animal heard = 1 sticker (12 total)
- Each shape recognized = 1 sticker (6+ total)
- **Secret bonus stickers** for: playing 3 days in a row, completing a whole category, building a rainbow, animal parade with 5+ animals
- Sticker Book accessible from home via 🏆 button. Stickers appear pasted to pages, can be tapped to hear what they are.

**Visual:** Sticker book opens like a real book, pages flip with a soft sound. Empty slots show ghosted outlines of what could go there (encourages exploration).

---

## Story Mode (Stretch — VERY high delight)

A linked-up adventure where Professor Hoot needs the child's help across categories:

> *"Oh no! All the letters fell out of my book! Can you help me put them back?"*

→ Child taps letters in alphabetical order → next scene:

> *"Now I need to feed the animals. Can you find the cow?"*

→ Find-the-animal mini-game → next scene:

> *"Let's paint a rainbow!"*

→ Color mixing mini-game → end with a printable-feeling "You did it!" certificate.

Story mode is short (5–8 min), perfect for a single sitting, and ends with a sticker.

---

## Free Play / Discovery Mode

Every category should have a **"Just Play"** option that has no goal — child just taps anything and gets a delightful response. This is critical for the 2-year-old who isn't ready for prompts at all.

---

## Technical Requirements

- **Vanilla HTML/CSS/JS** primarily. **External libraries are allowed** if they materially improve quality — recommendations:
  - **GSAP** (free tier) for buttery animation timelines if needed beyond CSS
  - **Howler.js** for robust audio loading/playback (especially for the animal sounds) — handles iOS Safari quirks
  - Anything from a CDN is fine; no npm/build step
- **Multi-page or SPA** — your choice. Recommended: **single-page with hash routing** (`#alphabet`, `#numbers`) so it works offline and feels instant. Or separate HTML files per category — both fine.
- **No backend.** Everything in localStorage.
- **Storage keys prefixed `hp_`** (e.g., `hp_progress`, `hp_age_setting`, `hp_stickers`).
- **Offline-first** — must work with no internet after first load. Service worker optional but nice.
- **Tablet-first responsive** — primary target 1024×768+. Phone landscape (≥568px wide) should also work; phone portrait can show a "Please rotate to landscape" overlay if layout doesn't fit.
- **Touch-first interactions** — use `pointer` events (works for mouse, touch, stylus). All tap targets ≥80px on default, ≥120px in Tiny Hoot mode.
- **Performance** — must run smoothly on a 5-year-old budget Android tablet. Lazy-load category assets; don't preload all animal sounds on home screen.

### Suggested File Structure
```
/index.html                    # Home / playground
/css/
  /tokens.css                  # Shared color/font tokens
  /home.css
  /alphabet.css
  /numbers.css
  /colors.css
  /animals.css
  /shapes.css
  /sticker-book.css
  /modals.css
/js/
  /common/
    mascot.js                  # Copied from Clock Quest
    voice.js                   # Copied from Clock Quest
    audio.js                   # Copied & extended
    confetti.js                # Copied from Clock Quest
    storage.js                 # hp_ prefixed wrapper
    progress.js                # Sticker / mastery tracker
    age-settings.js
    router.js                  # Hash router
  /alphabet/
    alphabet-data.js           # Letters + words + images
    alphabet-game.js
  /numbers/
    numbers-data.js
    numbers-game.js
  /colors/
    colors-data.js
    colors-game.js
  /animals/
    animals-data.js            # Animal facts + sound file refs
    animals-game.js
  /shapes/
    shapes-data.js
    shapes-game.js
  /sticker-book/
    sticker-book.js
  /app.js                      # Bootstrap, router init
/assets/
  /sounds/
    /animals/                  # Parent-supplied
      cow.mp3
      ...
    /manifest.json
  /images/
    /alphabet/                 # A is for Apple etc. - SVG preferred
    /animals/                  # Optional - SVG illustrations
  /icons/
```

### Recommended External Libraries

| Library | Use | License | Why |
|---|---|---|---|
| Howler.js | Animal sound playback | MIT | Handles iOS audio unlock + cross-format fallback flawlessly |
| GSAP (free) | Complex animation timelines (rainbow build, parade) | Free | Smoother than CSS for sequenced moves |
| Lottie (optional) | Hand-crafted animations for celebrations | MIT | If you find free Lottie files from LottieFiles |
| confetti.js (or reuse ours) | Particle bursts | MIT | We already have one — reuse |

Don't bring in React/Vue/Svelte. Stay vanilla — this app should be tiny, fast, and easily hackable.

---

## Accessibility

- **Voice-first navigation** — everything spoken; reading should never be required.
- **Huge touch targets** — minimum 80px, 120px in Tiny Hoot mode.
- **High contrast** — text on warm cream, never gray-on-gray.
- **Color is never the only signal** — paired with shape, sound, or icon.
- **Reduce motion** — respect `prefers-reduced-motion` media query for parents who want to dial back animations.
- **All buttons** have `aria-label` for screen readers.
- **No flashing >3hz** — protect against photosensitive seizures.

---

## Parent Mode (Settings + Optional Dashboard)

Behind a **long-press on the gear icon** (3 seconds — keeps toddlers out), open a parent panel showing:
- Total play time this week
- Categories explored
- Stickers earned
- Age setting toggle
- Voice picker (same as Clock Quest)
- Sound effect volume slider
- "Reset progress" button (with confirm)
- Link to Clock Quest if installed (for older siblings)

---

## What Makes This State of the Art (Required Differentiators)

These are the elements that elevate this from "a kids' app" to *the* kids' app:

1. **The mascot is a real character.** Hoot remembers the kid's name, comments on their preferences ("You really love the dog, don't you?"), and reacts emotionally to long absences ("I missed you!").
2. **Every sound is hand-crafted.** No stock buzzers. Web Audio chimes are tuned to consonant intervals. Animal sounds are real recordings.
3. **The TTS sounds human.** Use the voice quality logic from Clock Quest — auto-detect Premium voices, prompt to install if missing.
4. **The animations are physics-feeling.** Every interaction has weight, springiness, and follow-through. Static UI is forbidden.
5. **Discovery > evaluation.** The default mode in every category is exploration, not quiz. The child can play forever without ever being "tested."
6. **The Sticker Book is real.** Stickers persist, the book fills up, and it's genuinely satisfying to flip through. This is the meta-reward.
7. **Adaptive difficulty.** If a child gets the same prompt wrong twice in Tiny/Little Hoot mode, the next prompts narrow to easier ones. If they crush 5 in a row, gently introduce harder ones.
8. **Story Mode.** A short narrative thread that ties categories together — the most-loved mode.
9. **It works offline.** No "please connect to the internet" — ever.
10. **It feels like a place, not an app.** The home screen is a playroom you visit, not a menu you navigate.

---

## Deliverable

A repository / folder that opens via `index.html` in any modern browser with zero setup:

- Home playground appears immediately with all 5 phase-1 categories playable.
- Tiny Hoot mode is the default until the parent selects otherwise.
- All progress saves automatically via localStorage.
- Animal sounds load from `/assets/sounds/animals/` if present, fall back to TTS otherwise.
- Mascot is identical to Clock Quest's owl.
- Voice and settings UI mirror Clock Quest's.

---

## Quality Bar

Before considering this done, verify:

### Functional
- [ ] All 5 phase-1 categories (Alphabet, Numbers, Colors, Animals, Shapes) playable in all three age modes
- [ ] Sticker Book persists and fills correctly
- [ ] Voice plays clearly; Premium voice tip shows when only Basic voices available
- [ ] Animal sounds play when files supplied; falls back to TTS when missing
- [ ] Story Mode runs end-to-end and awards a sticker
- [ ] No-fail philosophy enforced in Tiny/Little Hoot modes (verified by deliberately tapping wrong 5 times in a row)
- [ ] Parent panel accessible via long-press, contains all settings
- [ ] Works offline after first load (test with DevTools offline mode)

### Polish
- [ ] Every interactive element bounces / pops on tap
- [ ] Mascot reacts visually in every category screen
- [ ] Confetti / sparkles fire on positive events
- [ ] No flat / static screens
- [ ] Backgrounds have subtle motion (floating, parallax, twinkling)
- [ ] All transitions between screens are smooth, never jarring

### Robustness
- [ ] No console errors on load or during 10 minutes of play
- [ ] Works on iPad Safari, Android Chrome, desktop Chrome, desktop Safari, desktop Firefox
- [ ] Tap targets meet 80px / 120px minimums
- [ ] Layout doesn't break at 1024×768, 1280×800, 768×1024
- [ ] `prefers-reduced-motion` users get a calmer experience

### Suite Continuity
- [ ] Professor Hoot mascot is byte-identical to Clock Quest's
- [ ] Voice and audio modules are reused (not reimplemented)
- [ ] localStorage keys are all `hp_` prefixed
- [ ] Visual design feels like a sibling app to Clock Quest

---

## Future Suite Integration (Notes for Later)

When this app and Clock Quest are unified into **Hoot Academy**:
- Both apps' progress/stickers will surface on a shared home.
- The mascot, voice, and audio modules become a shared `/common/` library.
- A child's "Hoot profile" persists across apps with their name, age, and earned achievements.
- A parent dashboard spans both apps.

Design with this future in mind: keep modules clean, keep data structures portable, avoid tight coupling between game logic and UI.

---

*This app is being built for Arianna, age ~2. It must feel like a place she wants to visit every day. Make it magical. Make it warm. Make every single tap feel like a tiny gift.*
