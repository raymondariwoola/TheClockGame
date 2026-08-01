# Chronos Strike future enhancements

> **Status:** living roadmap — PWA polish and menu/UI cleanup UI-0 through UI-6 are complete locally; owner publication and physical-device acceptance remain.
>
> **Scope:** `GameMode/` only.
>
> **Budget:** zero monetary cost; existing GitHub Pages and Cloudflare free-tier services only.
>
> **Prepared:** 31 July 2026. **Updated:** 1 August 2026.

## 1. Purpose

Chronos Strike is no longer short of features. It already has a deep single-player game, Daily Rift, ghosts, live two-player competition, leaderboards, achievements, cosmetics, private cheats, sharing, offline support, and a production Cloudflare backend. The next improvement should therefore make the existing game **easier to return to, better with family and friends, more satisfying on a phone, or easier to operate**. It should not add complexity merely to make the feature list longer.

This document provides:

- a snapshot of what already exists so that new work does not duplicate it;
- the zero-cost and mobile constraints every future feature must respect;
- a prioritized shortlist with an implementation approach for each item;
- a broader catalogue of gameplay, social, progression, accessibility, sharing, and operational ideas;
- ideas that should be deferred because they do not fit the budget or the private family-and-friends nature of the game;
- a suggested sequence and a worksheet for choosing the next phases.

“Addictive” is used here in the healthy sense: short satisfying sessions, immediate rematches, visible improvement, friendly rivalry, surprise, and memorable moments. The game should **not** punish missed days, manufacture anxiety, sell recovery, or turn family play into a chore.

---

## 2. Current baseline — do not rebuild these

The following systems are already implemented and should be extended rather than replaced:

| Area | Current capability |
|---|---|
| Core play | 40-round Classic, Endless, Zen / Precision Lab, Normal and Hardcore |
| Variety | Eight ordinary modifiers, deterministic bosses, 15 powers, combo scoring, Overdrive |
| Recurring play | Daily Rift with a shared deterministic challenge |
| Competition | Separate current-ruleset Classic, Endless, and Daily leaderboards with Normal / Hardcore navigation |
| Asynchronous social | Local personal ghosts, legacy Rival Codes, seven-day Cloudflare Ghost challenges, optional hidden target |
| Live social | Two-player Chrono Clash with ready state, countdown, progress, reconnect, forfeit, sudden death, and rematch |
| Meta | 15 achievements and 13 cosmetic choices across clock hand, strike ring, and judgment text |
| Private fun | Persistent private cheat menu available in every mode; cheat state remains local and unlabelled |
| Sharing | Finished-run score cards, invitation and result cards, challenge links, and Cloudflare social-preview cards |
| Mobile / resilience | Responsive touch UI, accessibility settings, local storage, versioned one-time stat reset, service-worker offline shell |
| Operations | Cloudflare-only dynamic data, SQLite Durable Objects, feature switches, admin operations, tests, and owner runbook |

This means the highest-value future work is not another generic leaderboard, another basic ghost, or another collection of score multipliers. It is better **session structure**, **private-group play**, **coaching**, **mobile polish**, and **safe operational tooling**.

---

## 3. Zero-cost definition and architecture rules

### 3.1 What “zero cost” means here

An enhancement qualifies only if all of the following are true:

1. It requires no subscription, paid API, app-store account, messaging service, advertising service, or separately billed database.
2. It can use the existing static GitHub Pages site and existing `chronos-leaderboard` Worker.
3. It remains useful when cloud features are unavailable.
4. Its remote storage is bounded, expiring, and administratively removable.
5. It cannot silently move the account onto a paid plan. If a free limit is reached, the online feature fails gracefully and local play continues.
6. It does not require players to create accounts or disclose more personal information.

At the time of writing, Cloudflare documents 100,000 Worker requests per day and 10 ms CPU per HTTP request on the Workers Free plan. SQLite-backed Durable Objects on the Free plan document 100,000 requests per day, 13,000 GB-s per day, five million rows read per day, 100,000 rows written per day, and 5 GB total storage. These are ceilings, not a traffic target. Free-plan operations can fail after a limit is exceeded, and the limits may change, so they must be checked again before any cloud-heavy feature is released.

Official references:

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [GitHub Pages limits](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/github-pages-limits)

### 3.2 Required implementation rules

- Prefer deterministic, client-side generation over stored content.
- Store resolved strikes, summaries, and final results—not animation frames.
- Reuse the three existing Durable Object classes unless a genuinely different consistency boundary is required.
- Use hibernating WebSockets for live play. Cloudflare specifically recommends hibernation, batching high-frequency messages, and avoiding timers that keep objects awake. See [Durable Object WebSocket best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
- Give rooms, invitations, groups, series, and detailed histories explicit expiry periods.
- Cap every list: participants, entries, matches, events, names, cards, and history.
- Rate-limit creation and mutation more tightly than reads.
- Keep offline single-player, local achievements, cosmetics, settings, cheats, and practice independent of Cloudflare.
- Do not send cheat state, passphrases, accessibility settings, or private capabilities in URLs, cards, logs, or remote game records.
- Add high-volume analytics only if explicitly approved later. Included free quotas are not a reason to collect data that the game does not need.

### 3.3 Rating key used below

| Label | Meaning |
|---|---|
| **Value: H / M / L** | Expected improvement for this family-and-friends game |
| **Effort: S / M / L / XL** | Relative implementation and validation effort, not calendar time |
| **Cloud: None** | Fully client-side; safest zero-cost option |
| **Cloud: Tiny** | A few bounded API calls or small expiring records per session |
| **Cloud: Moderate** | Repeated room traffic or retained group data; safe only with strict limits |
| **Priority: Now / Next / Later / Defer** | Recommendation, not approval |

---

## 4. Recommended shortlist

If only a handful of items are selected, these provide the best combination of fun, usefulness, mobile fit, reuse of existing systems, and cost safety.

The menu/UI cleanup in section 13 is now a prerequisite to this feature shortlist, not another competing gameplay feature. It establishes where each later enhancement belongs before more controls are added.

| Rank | Enhancement | Value | Effort | Cloud | Recommendation |
|---:|---|:---:|:---:|:---:|---|
| 1 | Practice from mistakes | H | M | None | Best improvement to skill, fairness, and retention |
| 2 | Best-of-three / best-of-five Clash series | H | M | Tiny | Gives live multiplayer a satisfying session arc |
| 3 | Quick Strike: 60- or 90-second mode | H | M | Tiny | Ideal for mobile and easy to challenge repeatedly |
| 4 | Custom Party Rift builder | H | L | Tiny | Turns existing mechanics into many family-made modes |
| 5 | Results coach and rival comparison | H | M | None / Tiny | Makes every result actionable and rematches compelling |
| 6 | Weekly Family Rift | H | M | Tiny | Solves different schedules and creates conversation all week |
| 7 | Ghost Gauntlet | H | L | Moderate | One challenge becomes a private mini-event for up to eight players |
| 8 | Pass-the-phone Party Relay | H | M | None | Immediate group fun with no network setup |
| 9 | Personal mastery and expanded achievements | M-H | M | None | Adds long-term goals without accounts or spending |
| 10 | QR invitation and join flow | M-H | S | None | Removes room-code friction when people are together |
| 11 | PWA install, update, and offline-status polish | M-H | M | None | **Complete locally; owner push pending.** Installability, run-safe updates, offline/cloud status, validation, and handoff are complete. |
| 12 | Private Family Cup | H | L | Moderate | A lightweight, expiring group season without public accounts |

### 4.1 Practice from mistakes

**Player experience.** After a completed run, the result screen offers **Practice My 3 Hardest Rounds**. The game selects misses and the widest early/late errors, reproduces those round conditions in Precision Lab, and gives clear feedback such as “42 ms early” or “hand passed the centre by 3.8°.” A player can repeat each drill until they land it twice.

**Why it is a good idea.** A leaderboard shows who won; coaching shows how to improve. This turns a loss into a useful next action and gives Zen / Precision Lab a direct purpose. It also makes difficult modifiers and bosses feel learnable rather than arbitrary.

**Implementation approach.** Extend the local run transcript with bounded diagnostic fields already known at strike resolution: target centre, hand angle, angular error, timing, modifier, boss, speed band, and judgment. At results, choose up to three representative mistakes. Use the existing deterministic engine and do not upload the drill record.

**Mobile considerations.** One prominent button, three short drills, no dense chart during play. Early/late information should use text, direction arrows, colour-independent shapes, and optional haptics.

**Risks and guardrails.** Do not record raw touch coordinates or indefinitely retain every run. Keep the last run in memory and optionally a small local “practice later” queue. Cheats may remain available; practice results never affect public boards.

**Rating:** Value H · Effort M · Cloud None · **Priority Now**.

### 4.2 Best-of-three / best-of-five Clash series

**Player experience.** A Chrono Clash host chooses Single, Best of 3, or Best of 5. Between games, both players see the series score, closest round, lead changes, and a 20-second ready/rematch window. A tie at the series level uses the existing sudden-death mechanic.

**Why it is a good idea.** One match can be decided by a single mistake or interruption. A short series creates comeback stories and reduces the temptation to abandon a room after one loss. Much of the technical foundation—room membership, rematch, score comparison, reconnect—is already present.

**Implementation approach.** Add a bounded `series` object to `MatchRoom`: format, completed games, wins per seat, current game number, and expiry. Carry players and seat capabilities across games, but issue a fresh run identity and deterministic seed for each game. Keep only compact game summaries, not full frame histories.

**Mobile considerations.** The inter-game card must fit above the fold and offer one large Ready button. Prevent screen lock only if the player explicitly opts into the browser Wake Lock API; always recover gracefully after backgrounding.

**Risks and guardrails.** Cap at five games, expire inactive series, do not create a new room on every rematch, and avoid adding live spectators in the same phase.

**Rating:** Value H · Effort M · Cloud Tiny · **Priority Now**.

### 4.3 Quick Strike — a 60- or 90-second mode

**Player experience.** Score as much as possible before the clock expires. Difficulty ramps in visible bands every 15 seconds, a boss appears near the end, and the result focuses on score, accuracy, and best streak. Quick Strike supports Normal, Hardcore, ghosts, Clash, cheats, sharing, and its own clearly named board.

**Why it is a good idea.** Most players are on mobile. A known one-minute commitment is easier to start, easier to replay, and ideal for waiting rooms, family chats, and quick challenges. It also creates comparable results without Endless’s variable length.

**Implementation approach.** Define a new ruleset playlist using the same strike engine. End by authoritative elapsed gameplay time rather than round count. Pause or background behavior must be explicit: a ranked run should pause only during sanctioned transition overlays, not when the tab is hidden. Add deterministic difficulty bands and a distinct board partition.

**Mobile considerations.** The remaining time must be visible without crowding the score. Use strong 30-, 10-, and 3-second cues that obey reduced-flash and sound settings.

**Risks and guardrails.** Timed powers and transition durations require a balance pass. Never mix its scores with Classic or Endless. Do not let repeated taps bypass one-resolution-per-target protections.

**Rating:** Value H · Effort M · Cloud Tiny · **Priority Now**.

### 4.4 Custom Party Rift builder

**Player experience.** A player creates a compact custom challenge by choosing six or fewer options: length, speed curve, lives, allowed modifiers, boss frequency, powers on/off, and Normal/Hardcore. The game generates a short share code or link. Presets such as “Pure Skill,” “Boss Chaos,” “Tiny Targets,” and “Family Friendly” avoid a complicated setup screen.

**Why it is a good idea.** The existing engine already contains enough ingredients for dozens of experiences. A constrained builder multiplies variety without requiring dozens of hand-coded permanent modes. It also lets the family invent house rules.

**Implementation approach.** Create a versioned, allowlisted `RiftRecipe`, clamp every value, and combine it with a deterministic seed. Most recipes can be encoded in a short URL locally; recipes used for Ghost or Clash should be frozen in the existing room record. Public leaderboards should not be created for arbitrary recipes.

**Mobile considerations.** Use large preset cards plus an optional Advanced sheet. Show the estimated duration before creation. A recipe summary must be readable on an invite card.

**Risks and guardrails.** Do not expose raw numeric tuning or executable configuration. Cap the recipe, validate it on client and Worker, and clearly label custom runs as party play rather than global competitive categories.

**Rating:** Value H · Effort L · Cloud Tiny · **Priority Next**.

### 4.5 Results coach and rival comparison

**Player experience.** Results explain the run in a few useful sentences: “You gained most of your score from rounds 21–30,” “Phantom caused 3 of 5 misses,” “your taps were usually early,” or “you lost the Clash by 28 points; one Great instead of Good would have won.” Against a ghost or live rival, show a compact round-by-round lead timeline and three decisive moments.

**Why it is a good idea.** It makes scores meaningful and naturally suggests a rematch. It also helps reveal balance issues without requiring invasive analytics.

**Implementation approach.** Derive insights locally from the bounded run transcript. Use deterministic rules, not AI: largest swing, repeated modifier difficulty, early/late bias, accuracy by phase, and reachable score delta. Ghost and Clash comparisons use only data already shared for the match.

**Mobile considerations.** Show three insight cards by default, with an optional details sheet. Avoid wide desktop charts; use a compact sparkline or ten-segment lead strip.

**Risks and guardrails.** Insights must be explainable and supportive, not judgmental. Never pretend a counterfactual is exact when powers or later RNG make it uncertain. Do not expose private cheat state.

**Rating:** Value H · Effort M · Cloud None / Tiny · **Priority Now**.

### 4.6 Weekly Family Rift

**Player experience.** One deterministic challenge is available for seven days. A private link lets relatives play whenever convenient. Each person gets one official attempt and optional unranked practice attempts. The private results reveal after playing or when the week ends.

**Why it is a good idea.** Daily play is hard across work schedules and time zones. A week gives everyone a realistic chance to join and creates an ongoing family conversation without requiring live coordination.

**Implementation approach.** Reuse Ghost challenge storage with a weekly identity, invite capability, bounded participant list, result visibility rule, and expiry alarm. The default can be one global deterministic Weekly Rift with local practice; a private family instance stores only names and summaries.

**Mobile considerations.** The landing page should say duration, deadline in the player’s local time, attempt rule, participant count, and whether targets/results are hidden.

**Risks and guardrails.** Never punish a missed week or erase progress. Cap participants and instances per device/network window. Keep global and private results visually distinct.

**Rating:** Value H · Effort M · Cloud Tiny · **Priority Next**.

### 4.7 Ghost Gauntlet

**Player experience.** One person creates a seven-day challenge for up to eight people. Each person races the same seed, records one result, and sees a challenge-only ranking after finishing. Optional modes include visible target, hidden target, or progressive ghosts where each new player races the current leader.

**Why it is a good idea.** It creates the feeling of a private tournament without accounts, scheduling, or public matchmaking. It builds directly on Ghost challenges and share cards.

**Implementation approach.** Extend a Ghost room from two results to a capped participant table. Use a per-participant join capability stored in session storage, idempotent completion, and a compact final ranking. Expire all detailed replay data after seven days; optionally retain only an anonymous local summary for the creator.

**Mobile considerations.** Joining must be one tap from a family-chat link. The participant list should use short names and deterministic avatars, not uploaded photos.

**Risks and guardrails.** Rate-limit joins and names; prevent one device refresh from creating duplicate seats; never make gauntlets publicly discoverable. Eight is a deliberate cap, not a starting point for large public rooms.

**Rating:** Value H · Effort L · Cloud Moderate · **Priority Next**.

### 4.8 Pass-the-phone Party Relay

**Player experience.** Two to eight people enter short names on one phone. Each person plays a 20- to 30-second leg, then a privacy handover screen hides the score until the next player confirms. Formats can be individual high score, two teams, or a shared-life relay.

**Why it is a good idea.** It works at a dinner table with one device, no network, no link sharing, and no Cloudflare usage. Physical handover creates laughs and makes the game accessible to people who would not independently open a web link.

**Implementation approach.** Add a local `PartySession` state machine with a fixed player cap, turn order, chosen format, per-leg seed, scores, and final podium. Keep it in session storage for crash recovery, then discard or save a small local result card.

**Mobile considerations.** Lock inputs during the handover, make the Ready control reachable one-handed, allow landscape/portrait changes between legs, and offer a “sanitise screen” option that hides previous results.

**Risks and guardrails.** Avoid long setup forms. Do not publish individual party scores to ordinary boards because assistance and device handover are uncontrolled. Cheats remain available as private house rules.

**Rating:** Value H · Effort M · Cloud None · **Priority Next**.

### 4.9 Personal mastery and expanded achievements

**Player experience.** Each mechanic has a small mastery track—for example Precision, Phantom, Reverse, bosses, and Hardcore—with Bronze, Silver, and Gold goals. Progress unlocks visual-only titles, clock faces, result-card frames, and effects. A personal “Chronicle” shows records and favorite modes locally.

**Why it is a good idea.** The current achievements are finite and many unlock from ordinary completion. Mastery gives players reasons to practice different mechanics, not merely chase one enormous score.

**Implementation approach.** Add versioned, local aggregate counters derived at run completion. Keep goals deterministic and gameplay-relevant: accuracy, clean clears, recovery, and variety. Cosmetics remain CSS/SVG/local-audio assets with no gameplay advantage.

**Mobile considerations.** Show only the nearest two goals on the home/results screen. The full Chronicle can be a separate scrollable sheet. Do not add permanent notification dots everywhere.

**Risks and guardrails.** Never require daily attendance, hidden grinding, purchases, or cloud identity. Back up/export local progress before any future schema reset.

**Rating:** Value M-H · Effort M · Cloud None · **Priority Next**.

### 4.10 QR invitation and join flow

**Player experience.** Every Ghost, Gauntlet, Weekly, Clash, and custom-party invite can display a QR code. A nearby person scans it and lands directly on a safe join preview. The existing copy/share actions remain available.

**Why it is a good idea.** It removes the most awkward part of same-room multiplayer: sending a link or reading a code aloud. QR generation can happen entirely in the browser.

**Implementation approach.** Use a small audited client-side QR encoder stored with the static app, generate from the existing public invitation URL, and never place seat capabilities or secrets in the encoded URL. Add a human-readable code below it as fallback.

**Mobile considerations.** Use a high-contrast quiet zone, sufficient physical size, screen-brightness hint, and a close button outside the code. Test camera recognition on iOS and Android.

**Risks and guardrails.** Do not add camera permission to the game merely to scan; the other player uses their normal camera app. Sanitize and length-bound the displayed URL.

**Rating:** Value M-H · Effort S · Cloud None · **Priority Now**.

### 4.11 PWA install, update, and offline-status polish

**Player experience.** The game explains when it can be installed, shows a small “Update ready—restart after this run” banner, displays online/offline status only when relevant, and provides a diagnostics action if a stale client cannot connect. Installed-player shortcuts can open Play, Daily Rift, or Join Challenge.

**Why it is a good idea.** Mobile players repeatedly encountered stale cached behavior during earlier releases. A graceful update flow makes the web game feel reliable and app-like without an app-store fee.

**Implementation approach.** Add a version endpoint or static build manifest, service-worker lifecycle UI, deferred activation while a run is active, and safe cache cleanup for obsolete revisions. Use in-page UI; web.dev notes that browser/OS notifications require permission and are not necessary for an update prompt. See [web.dev: Updating your PWA](https://web.dev/learn/pwa/update).

**Mobile considerations.** Never interrupt an active run. Account for iOS installation differences, standalone display safe areas, back navigation, rotation, and screen wake behavior. The game must remain fully usable in an ordinary browser tab.

**Risks and guardrails.** Do not force reload mid-run. Do not implement push notifications in this phase. Test upgrade from at least the two previous shell-cache revisions.

**Rating:** Value M-H · Effort M · Cloud None · **Priority Now**.

### 4.12 Private Family Cup

**Player experience.** A creator starts a private two- or four-week Cup with a join code. Each week has one fixed Rift; players may submit one official result. Standings award simple points for placement and participation, and a final share card celebrates the winner and fun records.

**Why it is a good idea.** It provides an ongoing group story while staying asynchronous, small, and private. It is more meaningful than a public global board for the intended audience.

**Implementation approach.** Store only a capped group roster, weekly challenge identities, compact results, and standings in an expiring Durable Object. No passwords, email, friend graph, or public discovery. A creator capability can remove a participant or close the Cup.

**Mobile considerations.** One screen must show this week’s action first; standings are secondary. Invitations use existing share cards and QR links.

**Risks and guardrails.** This is the cloud-heaviest recommended item. Cap groups, players, weeks, and result attempts; expire detailed data; rate-limit creation; include a Worker feature switch; and release only after Gauntlet traffic is understood.

**Rating:** Value H · Effort L · Cloud Moderate · **Priority Later**.

---

## 5. Comprehensive gameplay catalogue

The shortlist is not the only viable path. This section covers the broader option space. Items are grouped so they can be combined into coherent phases rather than selected randomly.

### 5.1 Short-session and skill modes

| Idea | What the player gets and why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **Quick Strike** | A fixed 60- or 90-second score chase. The time promise is ideal for phones and repeat challenges. | New deterministic playlist and separate board; balance timed powers carefully. | H · M · Tiny · Now |
| **Perfect Run** | One miss ends the run; the question is how long a player can stay flawless. It produces tense, highly shareable attempts. | Local/ghost first; separate records by difficulty; keep restart nearly instant. | M-H · S · None/Tiny · Next |
| **Boss Rush** | Consecutive bosses with a short recovery choice between them. It gives experienced players concentrated mechanical variety. | Reuse boss cycle; create explicit boss-only scoring; never mix with Classic boards. | M-H · M · None/Tiny · Next |
| **Tempo Ladder** | Every five clean strikes increases speed; a miss drops one band rather than ending the run. It makes improvement visible. | Deterministic speed bands, clear HUD, reduced-motion-safe cues. | M-H · M · None · Next |
| **Precision Marathon** | Targets gradually shrink while hand speed stays readable. This isolates accuracy from chaos. | Cap minimum target size; calibration/accessibility option; local records. | M · S · None · Next |
| **Pure Skill** | No powers, modifiers, jackpot, or random bonuses—only identical targets and rising speed. This provides a clean benchmark. | Custom Party preset or standalone local record; clearly separate from richer default play. | M-H · S · None · Now |
| **Modifier Marathon** | One selected modifier persists for a short run, allowing focused mastery and themed challenges. | Best delivered through the Party Rift builder and mastery system. | M · S-M · None/Tiny · Next |
| **Around the Clock** | Targets must be cleared in clock-number order. It reinforces the clock theme and adds memory/planning. | Use redundant labels/shapes; avoid depending on colour alone. | M · M · None · Later |
| **Memory Flash** | The target appears briefly, disappears, then the hand begins. It adds memory without relying on random visual noise. | Provide an accessibility exemption/preset; never silently include in ordinary ranked play. | M · M · None · Later |
| **No-Look Audio Trial** | Optional audio/haptic cues replace or supplement the target for a specialised practice challenge. | Prototype locally; browser audio latency differs and must not be globally ranked. | L-M · L · None · Later |
| **Target Score Chase** | Choose a target such as 5,000 and race to reach it in the fewest rounds or shortest active time. It is easy to understand. | Freeze target and rules in run context; define tie-breaker; own board if public. | M · M · Tiny · Later |
| **Three-Minute Endurance** | A longer fixed-time mode that rewards composure rather than the open-ended commitment of Endless. | Add only if Quick Strike proves popular; avoid mode-menu overload. | M · S after Quick Strike · Tiny · Later |

### 5.2 Variation and decision mechanics

| Idea | What the player gets and why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **Custom Party Rift builder** | Presets plus safe rule choices turn existing content into many family-created challenges. | Allowlisted versioned recipe; arbitrary recipes get no public board. | H · L · Tiny · Next |
| **Party Deck** | Before a match, draw three curated mutator cards and let players vote for one. The shared choice adds anticipation. | Seed the draw; record the chosen card; preset reactions only. | H · M · Tiny · Next |
| **Power Draft** | On each five-streak, choose one of two powers instead of receiving a random one. It adds agency and strategy. | Deterministic two-choice draw; timer or automatic fallback in live play. | M-H · M · None/Tiny · Next |
| **Bank or Overclock** | Before a boss, bank the combo or risk it for a visible reward. The decision makes boss rounds meaningful. | Record choice in transcript; show exact risk; balance ordinary scoring only, never alter private cheats. | H · M · None/Tiny · Next |
| **Time Shards / Secret Sabotage** | Earn a shard from skill and spend it on one telegraphed opponent effect. It creates playful trolling in Party/Clash. | Small allowlist, server-recorded use, advance warning, accessibility-safe effects, hard per-game cap. | H · L · Moderate · Later |
| **Mystery Rift** | Players see duration and difficulty but not the modifier sequence. Surprise makes repeat family challenges entertaining. | Seeded and replayable; reveal recipe after completion; never disguise accessibility hazards. | M · S · None/Tiny · Next |
| **Choose Your Path** | At checkpoints, choose “safe,” “fast,” or “chaos” for the next five rounds. It adds run identity. | Branches must use deterministic sub-streams and freeze remotely for ghosts. | M-H · L · None/Tiny · Later |
| **Objective Cards** | A run includes two optional goals such as “clear a boss without a miss” or “land three reverse Perfects.” | Deterministic local draw; reward cosmetics/mastery, not score multipliers. | M-H · M · None · Next |
| **Bingo Board** | A 3×3 local board of varied feats encourages use of modes and mechanics. Completing a row unlocks a cosmetic. | Generate weekly on-device from date/ruleset; no daily punishment. | M · M · None · Later |
| **Combo Insurance** | Earn one visible token that protects a combo once, adding a small tactical layer. | It overlaps Shield/Combo Lock; use only in a distinct mode, not default balance. | L-M · M · None · Defer |
| **Cooperative Power Choice** | In a team mode, one player’s clean streak offers a power choice that benefits both players. | Requires a future co-op protocol; do not bolt onto competitive Clash. | M · L · Moderate · Later |
| **Curated Chaos Weeks** | A checked-in static schedule activates a themed preset such as Boss Week or Reverse Week. | Derive from UTC date and local config; no live CMS required. | M · S · None · Next |

### 5.3 Fairness and comeback tools

| Idea | What the player gets and why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **Comeback meter** | Honest text such as “one Perfect puts you ahead” or “28 points behind.” It creates hope without altering odds. | Compute from current scoring bounds; never promise an impossible exact outcome. | H · S-M · None/Tiny · Now |
| **Lead-change pulse** | A small, accessible cue when the Clash lead changes. It makes live play feel connected. | Debounce it; no flashing; optional sound/haptic; do not distract from a strike. | M · S · Tiny · Next |
| **Skill handicap presets** | Family members can voluntarily choose head starts, extra lives, wider zones, or asymmetric targets. It makes mixed-skill play enjoyable. | Party-only label; both players see and accept the handicap; no ordinary leaderboard submission. | H · M · Tiny · Next |
| **Hidden target challenge** | The challenger can hide their score until the result, which already works for Ghost; extend the same suspense to other private events. | Never leak through metadata, cards, API state, or progress messages. | M-H · S-M · Tiny · Next |
| **Closest-wins target** | Everyone tries to finish nearest a chosen score without exceeding it. Precision matters more than raw speed. | Fixed-length party run; reveal target; no score multiplier exploits; private only. | M-H · M · None/Tiny · Later |
| **Consistency winner** | In a series, optionally award a side badge for smallest accuracy variance or fewest misses. It lets more than one person celebrate. | Cosmetic recognition only; series winner remains clear. | M · S · Tiny · Next |
| **Adaptive training—not adaptive competition** | Practice can widen zones or slow speed after repeated misses, then gradually remove assistance. | Never change ranked/ghost/Clash odds secretly; label training assists. | H for learners · M · None · Next |

---

## 6. Multiplayer and family-social catalogue

### 6.1 Strong additions

| Idea | Why it fits the game | Implementation / caution | Rating |
|---|---|---|---|
| **Best-of-three / five series** | Turns a single Clash into an evening’s rivalry and reuses rematch infrastructure. | Cap at five games and retain summaries only. | H · M · Tiny · Now |
| **Ghost Gauntlet** | Up to eight relatives compete asynchronously without accounts or schedules. | Private, capped, expiring, capability-based. | H · L · Moderate · Next |
| **Weekly Family Rift** | One challenge lasts long enough for different time zones and work schedules. | One official attempt plus optional local practice. | H · M · Tiny · Next |
| **Pass-the-phone Party Relay** | Provides immediate local group play and costs no cloud quota. | Session storage recovery, privacy handover, no public boards. | H · M · None · Next |
| **Private Family Cup** | Creates a multi-week group story without a public social network. | Capped groups/weeks; delete automatically; creator controls. | H · L · Moderate · Later |
| **Local tournament bracket** | A phone can generate a 4- or 8-player knockout using pass-the-phone or separate challenge links. | Bracket logic can remain local; remote results are imported by code. | M-H · M · None/Tiny · Next |
| **Asynchronous team relay** | Each person completes one leg; combined score races another team. Good for relatives in different places. | Freeze legs and order, cap team size, expire after seven days. | H · L · Moderate · Later |
| **Co-op boss raid** | Two players contribute resolved hits to a shared boss health bar. Cooperation changes the emotional tone. | New room state and balance; send outcomes only; hibernate between messages. | H · XL · Moderate · Later |
| **Revenge / run-it-back link** | A result card contains one safe action to challenge the winner under the same settings. | Create a fresh invite; never copy private seat capabilities into the result URL. | H · S-M · Tiny · Now |
| **Private group code** | A reusable, expiring family code opens current Cups/Gauntlets without public discovery. | This starts to resemble identity; keep it capability-based, bounded, and removable. | M-H · L · Moderate · Later |

### 6.2 Social warmth without moderation burden

| Idea | Why it fits | Implementation / caution | Rating |
|---|---|---|---|
| **Preset reactions** | “Nice!”, “Again!”, “Too close!”, and a few emojis add presence without free-text abuse. | Fixed allowlist, per-second cap, ephemeral, mute toggle. | M-H · M · Moderate · Next |
| **Deterministic avatars** | A name/seed creates a colourful clock-face avatar. It adds identity without photo uploads. | Client-generated SVG/CSS; accessibility-safe palette; no biometric/personal media. | M · S · None · Next |
| **Compact rematch stories** | “Lost by 28,” “3 lead changes,” or “Sudden-death win” makes a result memorable. | Derive locally or from compact summary; pair with rematch. | H · S-M · None/Tiny · Now |
| **Family titles** | Optional local labels such as “Boss Slayer” or “Comeback Kid” appear on private result cards. | Earned from explainable stats; no public profile dependency. | M · S-M · None · Next |
| **Shared-device profiles** | A household phone offers several local names and separate personal progress. | Local-only profile picker; explicit switch; do not confuse with secure accounts. | M-H · M · None · Next |
| **Celebration podium** | Party/series results show first place plus fun side awards, allowing multiple positive moments. | Avoid patronising awards; stats must be genuine. | M · S · None/Tiny · Next |
| **Family-safe nickname announcer** | Optional local speech synthesis announces a winner or boss. It can be funny in a room. | Web Speech support/voices vary; opt-in, local-only, never upload audio. | L-M · M · None · Later |

### 6.3 Features to avoid or treat cautiously

| Idea | Why it is not recommended now |
|---|---|
| **Public random matchmaking** | Requires identity, queue fairness, abandonment handling, abuse controls, moderation, and substantially more always-available infrastructure. It does not match a private family game. |
| **Free-text chat** | Creates moderation, harassment, privacy, retention, and reporting obligations for little gameplay value. Preset reactions are safer. |
| **Live spectator rooms** | Multiplies connections and room traffic while encouraging capability and privacy mistakes. A post-match summary is enough for now. |
| **Eight-player real-time battles** | Mobile UI, fairness, reconnect, traffic, and testing complexity grow sharply. Prefer asynchronous Gauntlets or a local bracket. |
| **Permanent friend graph** | Accounts and identity recovery would become unavoidable. Share links and expiring private groups fit better. |

---

## 7. Progression, collection, and return-play catalogue

| Idea | Why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **Mechanic mastery tracks** | Rewards learning Phantom, Reverse, bosses, Hardcore, and accuracy rather than only huge totals. | Versioned local counters, Bronze/Silver/Gold, cosmetic rewards. | M-H · M · None · Next |
| **Expanded achievements** | Adds goals for Clash, Ghost, Daily, recovery, consistency, and practice. | Avoid impossible or cheat-revealing conditions; evaluate locally. | M-H · M · None · Next |
| **Chronicle / personal stats** | Shows bests by mode, accuracy trend, favorite modifier, bosses cleared, and closest rivalry. | Keep last 20–50 summaries locally, allow delete/export, no hidden tracking. | H · M · None · Next |
| **Personal goal pinning** | Player chooses one goal such as “reach 80% accuracy” and sees progress at results. | User-selected, local, removable; no nagging. | M-H · S-M · None · Next |
| **Participation calendar** | A gentle calendar records days played without a fragile streak counter. | Never shame gaps or remove rewards; local-only. | M · S · None · Later |
| **Daily mission trio** | Date-derived local goals offer direction: one easy, one skill, one playful. | No cloud calls; completion unlocks cosmetic progress, not competitive score. | M-H · M · None · Next |
| **Weekly quest card** | A longer version of missions that can be completed across modes at any time that week. | Make it optional and non-punitive; avoid grind quantities. | M · M · None · Later |
| **More cosmetic categories** | Clock face, arena background, trail, result-card frame, sound cue, and celebration offer expressive rewards. | Use small CSS/SVG/local assets; respect reduced motion/audio; monitor static bundle size. | M-H · M-L · None · Next |
| **Cosmetic loadouts** | Save “Classic,” “Hardcore,” or favorite visual combinations. | Local-only; a simple three-slot system is sufficient. | L-M · S · None · Later |
| **Titles on private cards** | Achievement-backed titles make shares feel personal without accounts. | Render locally; sanitize names; no gameplay advantage. | M · S · None · Next |
| **Milestone recap** | Every 10 or 25 runs, show genuine progress such as improved accuracy or new boss record. | Compare bounded local aggregates; do not interrupt active play. | M · M · None · Later |
| **Local memory album** | Saves selected result cards and memorable rivalry summaries on-device. | Opt-in, cap count/storage, export/delete controls; avoid storing generated blobs indefinitely. | M · M · None · Later |
| **Favorites / quick launch** | Pin up to three modes or recipes to reduce home-menu friction. | Local setting; PWA shortcuts can mirror it where supported. | M · S · None · Now |
| **New-player journey** | First five sessions progressively introduce targets, modifiers, powers, bosses, and social play. | Skippable, local completion, never lock the full game from returning users. | H for onboarding · M · None · Next |

### Progression mechanics that should not be added

- No energy, lives that refill with real time, or pay-to-continue design.
- No loot boxes, random paid cosmetics, ads, sponsored rewards, or in-game currency store.
- No destructive daily streak that resets because someone missed a day.
- No fake scarcity, “last chance” pressure, or red notification badges with no useful action.
- No gameplay power locked behind grinding. Progression rewards should be visual, expressive, or educational.

---

## 8. Training, accessibility, and mobile catalogue

### 8.1 Skill and onboarding

| Idea | Why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **Practice from mistakes** | Converts a result into three targeted drills and makes improvement concrete. | Local transcript diagnostics; no cloud required. | H · M · None · Now |
| **Reaction calibration** | A short setup estimates comfortable timing and recommends sound/haptic/display settings. | It may tune practice, never secretly tune competition. | H · M · None · Now |
| **Modifier dojo** | Select one modifier or boss and practise it repeatedly. | Reuse deterministic engine; no score-board mixing. | M-H · M · None · Next |
| **Early/late coach** | Shows direction and magnitude after a practice strike. | Text + shape + colour; avoid clutter during ranked play. | H · S-M · None · Now |
| **Replay scrubber** | Results allow stepping through decisive strikes with target/hand position. | Render a bounded schematic, not a stored video. | M-H · M · None · Next |
| **Ghost delta drill** | Practice only the rounds where a selected ghost gained most of its lead. | Use already-authorized replay data; respect challenge expiry. | M-H · M · Tiny · Later |
| **Warm-up button** | Three unscored strikes before a serious run reduce accidental first-round misses. | Optional; ranked timer starts afterwards; no RNG consumption from official stream. | M · S · None · Now |
| **Contextual help** | First encounter with a boss/modifier shows a one-sentence hint, then remembers dismissal. | Local flag; never cover the strike zone or count down underneath the hint. | H for newcomers · S-M · None · Now |

### 8.2 Mobile comfort and accessibility

> **Implementation update — Phase 28:** gameplay-only double-tap and pinch zoom protection is complete locally in shell revision 15. Browser zoom remains available on menus, results, boards, and dialogs. See `MOBILE_GAMEPLAY_GESTURE_LOCK.md`.

| Idea | Why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **One-thumb layout presets** | Moves secondary controls and HUD away from the preferred strike area. | Build on left-handed mode; test common small screens and safe areas. | H · M · None · Now |
| **Input-zone calibration** | Lets players choose whole-screen tap, clock-only tap, or a large dedicated strike pad. | Prevent tap-through on overlays and scroll gestures; same hit semantics. | H · M · None · Next |
| **Haptic language** | Distinct optional pulses for Perfect, miss, countdown, lead change, and boss arrival. | Feature-detect; global toggle; reduced-haptic option; browser support varies. | M-H · M · None · Next |
| **Battery saver** | Reduces particles, glow, animation frequency, and background work on low-power phones. | Keep hand timing accurate; never reduce rules-engine frequency. | H · M · None · Now |
| **Data saver** | Defers share-card images, music, and optional previews while keeping play functional. | Local preference and network hints; never block core assets needed offline. | M · S-M · None · Next |
| **Orientation recovery** | Pauses safely during rotation, recalculates geometry, and resumes after confirmation. | Ranked/live policy must be deterministic; test iOS Safari and Android Chrome. | H · M · None/Tiny · Now |
| **Safe-area and large-text pass** | Ensures notches, browser bars, and 200% text do not hide controls. | Physical-device and browser zoom testing required. | H · M · None · Now |
| **Audio balance panel** | Separate music, cues, voice, and haptic settings. | Persist locally; do not play audio before user gesture. | M · S-M · None · Next |
| **High-contrast theme refinements** | Adds stronger outlines and pattern redundancy to all modifiers/bosses. | Test colour-vision simulations and sunlight contrast. | H · M · None · Now |
| **Reduced cognitive-load preset** | Disables nonessential popups/effects while keeping rules unchanged. | Accessibility setting, not cheat; record only if competition fairness actually changes. | H · M · None · Next |
| **Optional wake lock** | Keeps screen awake during a series or party relay. | Explicit opt-in, feature-detect, release on exit/background, always recover. | M-H · S-M · None · Next |
| **Touch-latency diagnostic** | A local tool identifies delayed audio/display/input and suggests settings. | Do not claim laboratory precision; results stay local. | M · L · None · Later |

---

## 9. Sharing, discovery, and app-quality catalogue

| Idea | Why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **QR invites** | Fastest way to join when players are physically together; fully client-side. | Encode only public invite URL, never private capability. | M-H · S · None · Now |
| **One-tap revenge card** | Turns the emotional result moment directly into the next challenge. | Fresh bounded invite; safe result URL. | H · S-M · Tiny · Now |
| **Share-card themes** | Different visual frames for bosses, Hardcore, Daily, victory, close loss, and Family Cup make shares less repetitive. | Compose locally from existing SVG/CSS/canvas assets; cap image size. | M-H · M · None · Next |
| **Three-moment story card** | A static multi-panel image shows final score, biggest swing, and clutch strike. More expressive than video at far lower cost. | Generate locally; no remote replay upload; readable at messaging-app thumbnail size. | M-H · M · None · Next |
| **Challenge preview screen** | Before entering a room, show host, mode, duration, expiry, target visibility, and expected data use. | Sanitize remote text and keep private target hidden. | H · S-M · Tiny · Now |
| **Deep-link recovery** | If the app reloads or is installed mid-invite, preserve the safe public challenge code and resume joining. | Store short-lived intent locally; never persist seat secrets in URL/history. | H · M · None/Tiny · Now |
| **Install guidance** | Contextual, dismissible help for installing on Android/iOS. | Respect platform differences; never block browser use. | M · S-M · None · Next |
| **Update-ready banner** | Stops old service-worker builds from silently surviving after fixes. | Activate after run, support rollback, test upgrades. | H · M · None · Now |
| **Offline status with retry** | Explains why local play works but cloud actions do not, avoiding confusing generic failures. | Show only when relevant; exponential retry; no request storm. | H · S-M · None · Now |
| **Client-side export/import** | Players can back up settings, achievements, cosmetics, local profiles, and Chronicle as JSON. | Version schema, validate import, redact secrets/capabilities/cheat code. | H · M · None · Next |
| **Diagnostics bundle** | A copyable, privacy-safe report includes app/ruleset version, browser family, connection state, and last error code. | No names, scores, tokens, URLs with capabilities, or raw logs. | H for support · S-M · None · Next |
| **Home-screen shortcuts** | Installed app can expose Play, Daily, and Join. | Progressive enhancement; support varies; no dependency on it. | M · S · None · Later |

### Why not video or animated-GIF sharing yet?

Client-side recording and encoding can consume significant memory, battery, and CPU on the exact lower-end phones the game should support. Uploading/storing generated media would also create new privacy, moderation, bandwidth, and retention burdens. The three-moment static story card captures most of the benefit at effectively zero service cost. A local-only short animation can be reconsidered after performance measurements on physical phones.

---

## 10. Owner and operational enhancements

These items are less visible to players but reduce confusion and make future releases safer.

| Idea | Why it is useful | Implementation / caution | Rating |
|---|---|---|---|
| **Private operations dashboard** | One static admin page can show health, feature switches, current ruleset, board counts, room counts, and recent bounded error totals. | Require admin authorization; never embed the code; redact names/tokens; low-frequency reads. | H · M · Tiny · Now |
| **Leaderboard management UI** | Search exact board/name/result ID, remove a bad result, export, or deliberately clear a selected board with confirmation. | Destructive actions need typed board identity, preview, audit summary, and no broad default target. | H · M · Tiny · Next |
| **Feature-switch panel** | Safely disable Clash, Ghost, board submission, or new experimental modes without redeploying the static client. | Server remains authority; cache briefly; admin-only mutation; documented rollback. | H · M · Tiny · Next |
| **Quota sentinel** | Bounded counters estimate room creation, writes, reads, and live activity and warn before free-plan trouble. | Approximate, sampled, and privacy-safe; never log every strike merely for metrics. | H · M · Tiny · Next |
| **Retention and cleanup report** | Shows expiring/expired rooms and confirms alarms are deleting old data. | Sample counts; provide safe manual cleanup scoped by type/date. | H · M · Tiny · Next |
| **Downloadable backup** | Admin exports leaderboard/group summaries before migrations or resets. | Encrypt/store nowhere automatically; export excludes secrets and expired private replays. | H · S-M · Tiny · Now |
| **Ruleset release gate** | Dashboard shows static client revision, Worker ruleset, service-worker cache revision, and accepted board version together. | Health endpoint supplies non-secret versions; block mismatched ranked submissions. | H · M · Tiny · Now |
| **Canary feature flag** | New mode is available only via explicit URL/local toggle before family-wide activation. | Do not expose admin capability; canary players still use production-safe schemas. | M-H · S-M · Tiny · Next |
| **Maintenance message** | Cloud actions show a friendly owner-supplied message while local play continues. | Length-bound plaintext; cached; no remote HTML. | M · S · Tiny · Next |
| **Local-storage migration registry** | Future resets/migrations use versioned, one-time operations with a visible inventory. | Extend the current reset-ID pattern; never call broad `localStorage.clear()`. | H · S-M · None · Now |
| **Physical-device release checklist** | A repeatable two-phone matrix covers cache upgrade, rotation, backgrounding, poor network, share flow, and touch targets. | Keep expected evidence and actual pass date in the repo. | H · S · None · Now |

Cloudflare Workers Logs currently documents a Free allowance and limited retention, but operational design should not depend on retaining large volumes of logs. See [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/). Analytics Engine also has free allowances, but its documentation notes that future pricing may be introduced with advance notice; it is therefore optional rather than a strict zero-cost dependency. See [Workers Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/).

---

## 11. Creative “chaos” ideas for private play

These deliberately playful ideas suit family trolling, but should live in Party/custom/private modes and remain readable, reversible, and accessible.

| Idea | Experience | Guardrail | Rating |
|---|---|---|---|
| **Chrono Roulette** | Every five rounds, the game reveals one shared strange rule from a curated deck. | Seeded, telegraphed, capped; exclude unsafe flashing/disorientation. | M-H · M · None/Tiny · Later |
| **Secret mission** | Each player privately receives a side objective such as “land two Reverse Perfects.” | Side badge only; no hidden score manipulation; reveal after match. | M-H · M · Tiny · Later |
| **Sabotage shard** | A skilled streak earns one playful effect to send to the opponent. | One per game, advance warning, server-recorded, mute/accessible alternatives. | H · L · Moderate · Later |
| **Clock swap** | In a team relay, players unexpectedly inherit the next leg’s selected modifier. | Handover screen explains it; deterministic; party-only. | M · M · None · Later |
| **Everyone versus the boss** | A local party passes the phone, contributing to one shared boss bar. | Local first; no online raid infrastructure required. | H · M · None · Next |
| **Mystery power gift** | After a relay leg, choose one of two face-down power gifts for the next player. | Curated, no punitive trap by default, reveal source for laughs. | M · M · None · Later |
| **Family rule card** | Before play, generate a harmless real-world rule: non-playing hand behind back, use one thumb, or silence round. | Optional, clearly outside score validation, avoid exclusionary/unsafe prompts. | M · S · None · Later |
| **Name-made arena** | A deterministic colour/clock theme derives from the two player names. | Local rendering only; sanitise text; preserve contrast. | M · S-M · None · Next |
| **Clutch camera—without video** | On results, reconstruct the decisive strike as a dramatic static clock diagram. | Use transcript geometry, not screen recording; label it a reconstruction. | M-H · M · None · Next |
| **Winner sets the next Rift** | The winner chooses from three safe recipes for the rematch. | Both players see/accept; fresh run context; no arbitrary numeric configuration. | H · M · Tiny · Next |

---

## 12. Explicitly deferred under a zero-cost cap

The following may sound impressive but are poor choices for this game now.

| Feature | Why it should be deferred |
|---|---|
| Native App Store / Play Store release | Store accounts, signing, ongoing platform compliance, device testing, and possible fees move beyond a simple zero-cost web deployment. PWA polish should come first. |
| SMS, email, or WhatsApp automation | Messaging APIs and templates introduce cost, account verification, personal data, and abuse controls. Native share sheets already let players invite through their chosen app. |
| Push-notification campaign | Requires permission UX, subscription storage, delivery infrastructure, expiry handling, and privacy policy work. Family links and in-game reminders are enough for now. |
| AI-generated coaches, challenges, or cards | External AI APIs create unpredictable cost and privacy concerns. Deterministic coaching rules and curated recipes are more reliable here. |
| User-uploaded avatars, photos, audio, or video | Requires object storage, content moderation, malware/media validation, privacy controls, and deletion tooling. Deterministic avatars avoid all of it. |
| Permanent full replays for every run | Storage and privacy grow forever. Retain bounded local history and short-lived challenge transcripts instead. |
| High-frequency telemetry for every tap | It spends write/log quota, collects unnecessary behavior data, and complicates privacy. Aggregate locally and send only coarse opt-in diagnostics if ever needed. |
| Public profiles, accounts, passwords, or social graph | Identity recovery, security, data deletion, and moderation would dominate development. Capability links and local profiles match the audience. |
| Public chat, voice chat, or video | Moderation and safety obligations are disproportionate. Fixed reactions provide warmth at far lower risk. |
| Large live rooms or mass spectators | Connection, hibernation, reconnect, mobile UI, and abuse complexity threaten free-tier reliability. Use Gauntlets and local brackets. |
| Paid maps, skins, currencies, battle passes, or ads | They contradict the family purpose and zero-cost requirement. Cosmetic progression should be earned locally and remain free. |
| Blockchain / token rewards | Adds no useful gameplay value and introduces cost, security, and trust problems. |
| Moving static hosting merely for novelty | GitHub Pages already serves the app. Backend data is already off Gist and on Cloudflare; a hosting migration has little player value. |

---

## 13. UI cleanup and navigation redesign

> **Decision:** complete this work before adding another major gameplay enhancement.
>
> **Current state:** UI-0 through UI-6 are complete locally. The implementation uses four stable destinations, shell revision 16, and a tested mobile-first release handoff; see `UI_CLEANUP_IMPLEMENTATION.md` and `OWNER_ACTIONS.md`.
>
> **Scope:** the `GameMode/` menu and its navigation surfaces. The clock gameplay, scoring, powers, cheats, multiplayer protocols, Worker API, leaderboards, ghosts, sharing, and result flows are protected behavior and are not being redesigned in this phase.

### 13.1 Why the current menu needs structural work

The menu has grown by appending each successful feature to one vertical page. Every individual feature is useful, but the combined page no longer communicates priority. A new or returning player has to scan branding, identity, statistics, a large Daily Rift card, difficulty, three mode cards, Clash, leaderboard, achievements, cosmetics, accessibility, installation, connectivity, help, and the Clock Quest link before they understand the whole surface.

The 1 August 2026 local audit found:

| Viewport | Menu height | Approximate screens | Visible actions | Horizontal overflow |
|---|---:|---:|---:|---|
| 390 × 844 | 2,467 px | 2.9 | 15 | None |
| 320 × 568 | 2,617 px | 4.6 | 15 | None |

The first 390 × 844 viewport is dominated by the logo, identity, personal statistics, and Daily Rift. The ordinary mode choices and several high-value destinations are below the fold. The problem is therefore not broken responsiveness or horizontal clipping. It is **information architecture**: too many unrelated actions share the same level and the primary task—starting a game—does not dominate the screen.

### 13.2 Design outcome

The redesigned menu should feel like a small game application rather than a settings catalogue:

1. A player can select a mode, select Normal or Hardcore, and start within the first phone viewport.
2. Returning players can start the last selected local mode with one prominent tap.
3. Competition, progress, and configuration remain permanently discoverable through labelled top-level navigation.
4. No existing feature disappears, becomes dependent on cloud availability, or receives a second implementation.
5. The phone layout is the design authority; tablet and desktop layouts adapt the same hierarchy rather than expose a different product.
6. New features must be assigned to an existing destination instead of adding another full-width row to the menu root.

This is a reorganization and presentation layer, not a visual-effects reskin. Colour, typography, animation, and decorative polish follow only after the interaction hierarchy is proven.

### 13.3 Proposed top-level architecture

Use four stable, labelled destinations on the menu screen:

| Destination | Purpose | Existing content moved here | Primary action |
|---|---|---|---|
| **Play** | Start a local run immediately | Classic, Endless, Zen / Precision Lab, Normal / Hardcore, compact Daily Rift preview | Start selected mode |
| **Compete** | Play with or against other people | Daily Rift detail, Chrono Clash, Ghost / Rival challenge, Hall of Time | Resume or create the most relevant competition |
| **Progress** | Review accomplishments and personalize rewards | Personal best / combo / round, achievements, cosmetics | View next achievement or equip a reward |
| **Settings** | Identity, comfort, app, and support controls | Player identity, accessibility/display, install/update state, connection diagnostics, keyboard help, back to Clock Quest | Save/apply the selected preference |

On phones, these destinations use a fixed bottom navigation bar with an icon **and** a short text label. On wider screens, the same four destinations can become a compact side rail or centred tab row. The labels and grouping must not change by viewport.

The bottom bar performs navigation only. Starting a run, creating a Clash, joining a ghost, or opening a leaderboard remains an action inside a destination. This distinction prevents the navigation bar from becoming another crowded action strip.

Apple's current guidance recommends a stable tab bar for top-level sections, fewer tabs that remain visible, concise labels, and deliberate prioritization of toolbar actions. WCAG 2.2 requires a minimum 24 × 24 CSS-pixel target at Level AA; this design will retain a more comfortable **44 × 44 CSS-pixel minimum design target** for primary mobile controls.

Primary references:

- [Apple Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple Human Interface Guidelines: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- [Apple Human Interface Guidelines: Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Apple Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/TR/WCAG22/#target-size-minimum)
- [WCAG 2.2 — Focus Order](https://www.w3.org/TR/WCAG22/#focus-order)

### 13.4 Mobile-first Play destination

The Play destination should contain only what a player needs for an ordinary run, plus one compact route into today's event:

```text
┌──────────────────────────────────┐
│ CHRONOS STRIKE       ● online  RA│
├──────────────────────────────────┤
│ PLAY                             │
│ [ Classic ] [ Endless ] [ Zen ] │
│                                  │
│ Difficulty  [ Normal | Hardcore ]│
│                                  │
│        START CLASSIC             │
│                                  │
│ Today's Rift · New challenge   > │
├──────────────────────────────────┤
│ Play  Compete  Progress Settings │
└──────────────────────────────────┘
```

Detailed behavior:

- The header uses a compact wordmark after entry instead of reserving a large block for the full logo.
- The existing player identity becomes a small profile control in the header; editing it opens the existing identity flow from Settings.
- Classic, Endless, and Zen use one compact selector. The selected option provides a one- or two-line description below the selector, avoiding three permanently expanded cards.
- Normal / Hardcore remains a labelled two-option segmented control. The existing selection and hint text remain the state authority.
- A single high-emphasis Start button reflects the selection, for example **Start Classic** or **Start Endless — Hardcore**.
- The most recently selected local mode and difficulty can remain selected using the existing persistence behavior. This must never auto-start a run.
- Daily Rift becomes one concise preview row on Play: status, availability, and a chevron/action. Its full description and social actions live in Compete.
- No statistics, rivalry input, utility rows, or secondary collection controls appear before the Start action.

The large Daily Rift card is not deleted. It moves to Compete, where its challenge, sharing, rival, and ranking context is easier to understand. This also stops an online event from visually outranking offline local play.

### 13.5 Feature-to-destination map

Every current root-menu element has a defined home. Nothing is silently dropped.

| Current element | New location and presentation |
|---|---|
| Large logo and tagline | Compact Play header; full brand treatment remains available on first visit/loading and share surfaces |
| Player identity | Header profile control; full edit panel in Settings |
| Best score, combo, and round | Progress summary card |
| Daily Rift card | Compact Play preview; complete Daily panel in Compete |
| Legacy Rival Code input | Compete → Ghost / Rival panel, revealed only when that panel is opened |
| Difficulty selector and explanation | Play, directly above Start; concise selected-mode help |
| Three expanded mode cards | Compact three-option selector plus one changing description |
| Chrono Clash row | Compete hero card with create/join/resume states |
| Hall of Time | Compete; all existing Classic, Endless, Daily, Normal, and Hardcore boards remain switchable without first publishing a score |
| Achievements | Progress, with completion count and nearest goals |
| Cosmetics | Progress, with equipped preview and collection count |
| Accessibility / display | Settings; always reachable outside active gameplay and from the existing in-game controls where currently supported |
| Install app | Settings → App; header badge/banner only when installation needs attention |
| Connection status | Compact header status plus Settings diagnostics; an explanatory banner appears only for a meaningful offline/degraded transition |
| Keyboard instructions | Settings → Controls / Help; shown contextually on keyboard-capable devices |
| Back to Clock Quest | Settings → About / More, retained as a clear external navigation action |

Future features already proposed in this document also have homes:

- Quick Strike and Pure Skill: Play.
- Best-of-three / best-of-five Clash and live reactions: Compete.
- Weekly Rift, Ghost Gauntlet, Family Cup, and private events: Compete.
- Practice from mistakes: result screen first, then Play → Practice when available.
- Mastery, Chronicle, and additional cosmetics: Progress.
- Operations tools remain owner-only and do not enter the player menu.

### 13.6 Compete, Progress, and Settings behavior

**Compete** may scroll because it contains multiple distinct social systems, but it should start with active or resumable activity rather than an equal list of buttons. Recommended order:

1. active Clash / Ghost invitation or reconnection card, when one exists;
2. today's Daily Rift;
3. Chrono Clash create/join;
4. Ghost / Rival challenge create/join;
5. Hall of Time.

Inactive systems use compact cards with a short description and one primary action. Opening a card reveals its secondary controls in place or in the existing modal. A room or challenge deep link must land directly in the relevant existing join flow, with Compete selected behind it.

**Progress** begins with a compact personal summary and then two collection cards: Achievements and Cosmetics. It should show useful summaries—completion count, next target, and equipped style—without rendering every achievement or cosmetic on the root. Detailed existing panels remain the place for browsing and selection.

**Settings** groups controls rather than mixing them with play:

- Profile: identity and locally stored player name.
- Comfort and accessibility: motion, flash, contrast, sound/display options, and control guidance.
- App: installability, update readiness, cache/offline explanation, and connection diagnostics.
- About: keyboard help, version/ruleset information, and Back to Clock Quest.

Critical offline/update/connection messages may still surface as compact banners anywhere in the menu when player action is actually required. Normal status should not consume a full permanent row.

### 13.7 Responsive behavior

The information architecture is constant; only its placement adapts.

| Width/context | Navigation | Content layout |
|---|---|---|
| 320–599 px phone portrait | Fixed bottom bar, safe-area padded | One column; Start and current selection above fold |
| Short phone / landscape | Compact bottom bar or left rail based on available height | Reduced header; scroll only the active destination, never the whole app shell |
| 600–899 px tablet | Bottom bar or compact side rail | One wide column or two related cards per row |
| 900 px+ desktop | Left rail or top tab row | Centred two-column content where relationships benefit; no stretched full-width buttons |
| Installed PWA | Same hierarchy | Respect display-mode and safe-area insets; no browser-specific missing controls |

The gameplay surface retains the deliberate Phase 28 zoom lock. Menu, help, settings, leaderboard, results, and other information-heavy surfaces keep browser zoom and text scaling available.

### 13.8 Protected behavior and implementation boundaries

The safest implementation is a menu-shell refactor around existing behavior, not a rewrite of `game.js`.

The following are frozen during the initial UI phases:

- scoring, combo, multiplier, modifier, boss, power, timer, and random-seed rules;
- Classic, Endless, Zen, Normal, and Hardcore run construction;
- cheat availability, persistence, values, and in-game toggling;
- Daily seed and result behavior;
- Ghost, Rival Code, Clash, WebSocket, reconnection, rematch, and forfeit protocols;
- leaderboard categories, publishing, ruleset partitioning, and board switching;
- result, sharing, challenge-card, and social-preview behavior;
- Worker routes, Durable Object schemas, bindings, secrets, and retention;
- local-storage keys and the versioned one-time stat reset mechanism;
- service-worker update safety, especially the rule that an active run is never reloaded.

Implementation rules:

1. Preserve existing element IDs and handler entry points in the first structural phase wherever practical.
2. Keep one source of truth for selected mode, difficulty, identity, cloud status, and active invitations. The new views render that state; they do not maintain parallel copies.
3. Move or wrap controls before changing their behavior. Do not simultaneously redesign a flow and relocate it.
4. Namespace new styles under a menu-shell boundary so gameplay and result CSS cannot be changed accidentally.
5. Keep the previous menu available behind a temporary local/static rollback switch until all behavior gates pass. The switch must not be a remotely billed service or a player-facing setting.
6. Hidden destination content must be removed from keyboard and assistive-technology navigation, not merely moved off-screen.
7. Continue to use the existing modals for complex focused tasks until a later phase explicitly proves a replacement is better.
8. Do not bump leaderboard/ruleset identity because of menu-only presentation changes.

### 13.9 Accessibility and mobile interaction requirements

- Maintain at least a 44 × 44 CSS-pixel design target for primary buttons, tabs, close controls, and segmented options.
- Provide icon plus visible text for every top-level destination; do not rely on icon recognition.
- Apply `aria-current` or an equivalent selected-state announcement to the active destination.
- Keep heading order, focus order, and screen-reader reading order aligned with what is visible.
- When changing destinations, place focus predictably at the destination heading without causing the page to jump during pointer use.
- Preserve visible focus indicators and keyboard access on desktop.
- Avoid swipe-only navigation. Taps, keyboard activation, and browser history/deep-link recovery remain sufficient.
- Keep reduced-motion and reduced-flash preferences effective during menu transitions.
- Use colour and text/icon state together for online, offline, selected, locked, and completed states.
- Test 200% text scaling and long player names without covering Start or the bottom navigation.
- Keep bottom navigation above `env(safe-area-inset-bottom)` and ensure scroll content has enough trailing padding not to hide its last action.
- Prevent double-tap zoom only on the gameplay surface; informational destinations must remain zoomable.

### 13.10 Phased implementation approach

Each phase is committed only after its automated and manual gates pass. Documentation and screenshots are updated in the same phase commit. No phase is pushed or synchronized by Codex.

#### Phase UI-0 — Characterization and interaction contract

- Capture baseline screenshots at 320 × 568, 390 × 844, phone landscape, tablet, and desktop.
- Inventory every menu element, DOM ID, event handler, deep-link entry, local-storage dependency, modal, and conditional state.
- Add characterization tests for mode/difficulty selection, run start, Daily, Clash, Ghost/Rival, leaderboard, progress panels, settings, PWA status, and Clock Quest navigation.
- Record keyboard order and screen-reader names before moving elements.
- Define the temporary rollback switch and deletion criterion.

**Gate:** the inventory accounts for every row in section 13.5, and tests fail if a protected action is disconnected. This phase may add tests and documentation but makes no player-facing layout change.

#### Phase UI-1 — Menu shell and navigation foundation

- Add the compact header, four destinations, mobile bottom navigation, and responsive desktop container.
- Move existing blocks into destination containers without redesigning their internal controls.
- Preserve element IDs, modal ownership, URL parsing, and event entry points.
- Keep the previous menu selectable with the temporary rollback switch.
- Ensure inactive destinations are inert and absent from the accessibility tree.

**Gate:** every existing action produces the same transition or modal as the baseline; no duplicate IDs; no horizontal overflow from 320 px upward; browser Back and deep links recover correctly.

#### Phase UI-2 — Play destination compression

- Replace the three expanded mode cards with the compact mode selector and one contextual description.
- Place Normal / Hardcore and the prominent Start button in the first viewport.
- Add the compact Daily Rift preview.
- Retain current selection persistence and existing run-construction functions.

**Gate:** each mode × difficulty combination starts with the same run context as the baseline; Daily uses the same seed; Start is fully visible at 390 × 844 and reachable without more than one short scroll at 320 × 568; offline local play is unchanged.

#### Phase UI-3 — Compete destination

- Relocate and compact Daily Rift, Chrono Clash, Ghost/Rival, and Hall of Time.
- Prioritize active/reconnectable sessions and collapse inactive secondary forms.
- Route invitation/deep links to the correct panel without exposing secret capabilities in display URLs.
- Retain the complete leaderboard mode and difficulty navigation at all times.

**Gate:** two-browser create/join/reconnect/rematch tests pass; hidden-target and sharing behavior is unchanged; all boards can be opened without first publishing; Worker-offline states remain graceful.

#### Phase UI-4 — Progress and Settings destinations

- Move statistics, achievements, and cosmetics to Progress with compact summaries.
- Move identity, accessibility, app/install/update/connectivity, help, and Clock Quest actions to grouped Settings sections.
- Show status banners only when attention is needed.
- Preserve all existing storage and one-time migration semantics.

**Gate:** identity, cheat preferences, accessibility, cosmetics, achievements, install UI, update readiness, offline state, and one-time stat reset survive reloads exactly as before; 200% text and keyboard-only navigation pass.

#### Phase UI-5 — Visual and responsive polish

- Refine spacing, hierarchy, compact cards, selected states, transitions, empty states, and wide-screen composition.
- Validate dark/light browser chrome, safe areas, notches, installed PWA display, landscape, low-height phones, and slow/offline transitions.
- Use restrained motion and existing Chronos visual language; do not introduce large asset downloads.
- Bump the service-worker shell revision only when the new shell is release-ready.

**Gate:** automated suite, mobile viewport suite, Lighthouse/PWA smoke checks, and physical Android/iOS checks pass; no active run is interrupted by an update; screenshots and owner notes reflect the shipped UI.

#### Phase UI-6 — Rollout closure

- Run a short family usability check focused on starting a normal game, finding Clash, viewing a board, changing accessibility, and installing/updating.
- Fix only demonstrated navigation problems; avoid adding root actions as shortcuts.
- Remove the legacy menu and rollback switch after the agreed observation period.
- Mark this roadmap and the implementation/status documents complete.

**Gate:** representative players can complete the five tasks without coaching, no protected-behavior regression remains, and rollback instructions have been exercised before legacy removal.

**Local completion note (1 August 2026):** the production-independent browser audit completes all five tasks at 390 × 844, and the owner checklist carries the remaining real-device/family acceptance. No duplicate legacy runtime was introduced, so there is no stale menu or flag to remove; commits UI-0 through UI-6 provide smaller, safer rollback boundaries.

### 13.11 Verification matrix

| Area | Required checks |
|---|---|
| Local play | All 3 modes × 2 difficulties; restart; quit; background/resume; offline start |
| Daily | Available/completed states, deterministic seed, challenge/share, offline fallback |
| Multiplayer | Clash create/join/ready/countdown/play/reconnect/forfeit/rematch on two phones/browsers |
| Ghosts | Create, hidden/visible target, open deep link, complete, expired/invalid challenge |
| Leaderboards | Open without submission; Classic/Endless/Daily and Normal/Hardcore switching; publish return flow |
| Results/sharing | Score card, challenge card, native share/save fallback, return from publishing |
| Private cheats | Persistent master state and individual toggles in every mode; no remote labelling or rejection changes |
| Persistence | Identity, mode, difficulty, achievements, cosmetics, accessibility, cheats, PWA state, one-time stat-reset version |
| Accessibility | Keyboard, focus visibility/order, screen-reader names/states, 200% text, reduced motion/flash, colour-independent status |
| Mobile | 320/360/390/430 widths, short-height phone, portrait/landscape, safe areas, one-thumb reach, browser and installed PWA |
| Resilience | Offline boot, cloud loss during menu use, cached old revision upgrade, update during active run, corrupted optional local state |
| Static quality | Existing test suite, syntax/type checks where available, no duplicate IDs, link checks, `git diff --check` |

### 13.12 Release acceptance criteria

The cleanup is complete only when all of these are true:

1. At 390 × 844, mode, difficulty, and the complete Start control are visible in the initial Play viewport.
2. At 320 × 568, Start requires no more than one short intentional scroll and is never obscured by the bottom bar or browser chrome.
3. The four labelled destinations remain stable across phone, tablet, desktop, and installed PWA layouts.
4. No horizontal overflow exists from 320 px through desktop widths.
5. Every current menu action is either visible in its mapped destination or conditionally surfaced under the same conditions as before.
6. All leaderboard categories are accessible without first playing or publishing a matching run.
7. Active invitations, reconnections, update readiness, and meaningful offline state are noticeable without permanently occupying root-menu space.
8. Informational screens remain zoomable while the active gameplay surface remains fixed.
9. No protected gameplay/network/storage behavior changes, and the full verification matrix passes before each phase commit.
10. The final design adds no paid service, remote configuration dependency, new account, analytics collection, or additional Worker traffic during normal menu navigation.

### 13.13 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Players think a moved feature was removed | Four visible labels, complete feature map, contextual summaries, and usability checks with existing players |
| New navigation duplicates state and drifts | One existing state authority; views call existing handlers; characterization tests around every entry point |
| Fixed bottom bar covers content or browser UI | Safe-area padding, trailing scroll space, short-height/landscape tests, physical-device validation |
| Hidden panels remain focusable | `hidden`/`inert` and accessibility-tree checks, not off-screen CSS alone |
| Deep links open the wrong destination | Central URL-to-destination routing with invitation and result regression fixtures |
| Large refactor breaks gameplay indirectly | Menu-only style namespace, frozen engine/protocol boundary, phases that move before redesigning |
| PWA update logic no longer recognizes a safe menu state | Retain the existing menu screen as the shell authority and add update-during-each-destination tests |
| Four destinations later become another crowded hierarchy | New-feature placement rule; no fifth destination or root shortcut without a documented navigation review |
| Visual polish reduces performance | CSS-first visuals, existing assets, no animation required for understanding, reduced-motion path, low-end phone check |

### 13.14 Recommendation

Proceed with UI-0 through UI-2 before Best-of-three / Best-of-five Clash. Those phases solve the immediate mobile problem and establish the stable shell into which the later Clash-series controls can fit. Then implement UI-3 as the Compete home and use it as the presentation boundary for the Clash-series enhancement. Complete Progress, Settings, and visual polish before starting another large feature family.

This order minimizes risk: first lock current behavior with tests, then establish navigation, then compress only the Play surface. Gameplay remains untouched until the new menu has proved it can start every existing run correctly.

---

## 14. Suggested implementation programme

This is a recommendation for sequencing, not permission to begin.

### Phase FE-0 — Measurement and selection

Choose no more than three player-facing features for the first slice. Record baseline physical-device load time, first-input delay, average run length, and subjective feedback from a small group. Do not add cloud telemetry merely to collect this; a short family feedback sheet is enough.

**Decision gate:** selected items have a named player problem, separate board/ruleset identity where required, mobile acceptance criteria, and a clear deletion/expiry rule.

### Phase FE-1 — Mobile reliability and useful results

Recommended bundle:

1. update-ready and offline-status UI;
2. orientation/safe-area/one-thumb audit;
3. results coach;
4. practice from mistakes;
5. QR invites and deep-link recovery.

This bundle is almost entirely local, improves every existing mode, and makes later experiments safer.

**Acceptance gate:** physical Android and iOS browser tests; upgrade from two old cache revisions; no active-run reload; no layout obstruction at 200% text; all practice diagnostics are local.

### Phase FE-2 — Fast replayable modes

Recommended bundle:

1. Quick Strike;
2. Pure Skill preset;
3. Party Rift recipe schema and four curated presets;
4. one-tap revenge/rematch story.

**Acceptance gate:** deterministic simulation, independent board/category labels, background-time policy, multiplier/exploit soak tests, and 1,000 generated-run checks per preset.

### Phase FE-3 — Better family sessions

Recommended bundle:

1. Best-of-three Clash;
2. pass-the-phone relay;
3. local bracket;
4. preset reactions or winner-sets-next-Rift.

**Acceptance gate:** two-phone reconnect/background/rotation testing, five-game room cap, no capability leakage, local party recovery, and graceful Worker-offline behavior.

### Phase FE-4 — Asynchronous private events

Recommended bundle:

1. Weekly Family Rift;
2. Ghost Gauntlet capped at eight;
3. private result reveal and share card;
4. owner cleanup/export support.

**Acceptance gate:** participant idempotency, expiry alarms, rate limits, hidden-target privacy, quota estimate, admin deletion, and a verified zero-entry cleanup after a staging lifecycle test.

### Phase FE-5 — Progression and optional Family Cup

Recommended bundle:

1. mechanic mastery and Chronicle;
2. visual-only reward expansion;
3. Family Cup only if Gauntlet usage remains safely bounded;
4. private operations dashboard and quota sentinel.

**Acceptance gate:** progress export/import, additive local migration, no streak punishment, no competitive advantage, group caps/expiry, and an owner rollback runbook.

---

## 15. Recommended combinations by desired outcome

### “Make it more fun immediately”

- Quick Strike
- Best-of-three Clash
- pass-the-phone Party Relay
- Party Deck / winner sets next Rift
- compact rematch stories

### “Help everyone improve”

- practice from mistakes
- early/late coach
- modifier dojo
- replay scrubber
- reaction calibration
- personal goal pinning

### “Keep the family talking all week”

- Weekly Family Rift
- Ghost Gauntlet
- hidden result reveal
- private share cards
- later, a bounded Family Cup

### “Make mobile feel finished”

- four-destination, play-first menu architecture
- update-ready banner
- install guidance
- one-thumb layout
- orientation recovery
- battery/data saver
- QR invites
- deep-link recovery

### “Add variety without building many permanent modes”

- Custom Party Rift builder
- curated presets
- Party Deck
- Power Draft
- Bank or Overclock
- objective cards

### “Make ownership and releases less confusing”

- private operations dashboard
- ruleset release gate
- leaderboard management UI
- backup/export
- quota sentinel
- retention report
- privacy-safe diagnostics bundle

---

## 16. Selection worksheet

Copy this table into a new implementation issue/plan and mark the desired items. Selecting an item does not mean every related idea must be built.

| Select | Enhancement | Main reason | Suggested phase |
|:---:|---|---|---|
| [x] | Mobile menu and UI information architecture | **UI-0 through UI-6 complete locally; owner publish/device acceptance pending** | UI-0 to UI-6 |
| [ ] | Practice from mistakes | Skill improvement | FE-1 |
| [ ] | Results coach / rival comparison | Meaningful results and rematches | FE-1 |
| [ ] | QR invites / deep-link recovery | Easier mobile joining | FE-1 |
| [x] | PWA update / offline polish | **Complete locally; see `PWA_IMPLEMENTATION.md` for owner publish and device checks** | FE-1 |
| [ ] | One-thumb / orientation / battery pass | Mobile comfort | FE-1 |
| [ ] | Quick Strike | Short repeatable play | FE-2 |
| [ ] | Pure Skill | Clean skill benchmark | FE-2 |
| [ ] | Custom Party Rift builder | Player-created variety | FE-2 |
| [ ] | Best-of-three / five Clash | Better live sessions | FE-3 |
| [ ] | Pass-the-phone Relay | Same-room group fun | FE-3 |
| [ ] | Local tournament bracket | Family event structure | FE-3 |
| [ ] | Preset reactions | Lightweight social warmth | FE-3 |
| [ ] | Weekly Family Rift | Asynchronous recurring event | FE-4 |
| [ ] | Ghost Gauntlet | Private group competition | FE-4 |
| [ ] | Mechanic mastery / Chronicle | Long-term local goals | FE-5 |
| [ ] | More visual-only cosmetics | Expressive rewards | FE-5 |
| [ ] | Private Family Cup | Multi-week private competition | FE-5 |
| [ ] | Operations dashboard | Easier ownership | FE-1 to FE-5 |
| [ ] | Leaderboard management / backup | Safer maintenance | FE-1 to FE-5 |
| [ ] | Other: | | |

For each selected enhancement, decide:

1. What exact player problem does it solve?
2. Is it local, private-cloud, or public competition?
3. Does it need a new board/category, or no board at all?
4. What happens offline or when a free limit is reached?
5. What remote data is created, who can read/delete it, and when does it expire?
6. What is the smallest mobile interface that works one-handed?
7. How are reduced motion, reduced flash, colour blindness, sound-off, and large text handled?
8. Can cheats remain fully private and available without contaminating the feature protocol?
9. Which automated, two-browser, and physical-phone tests prove it is ready?
10. What existing feature can be reused instead of creating another parallel system?

---

## 17. Gameplay enhancement recommendation

After the UI cleanup in section 13, the best gameplay investment is **not** a large new backend or public social network. It is this sequence:

1. **Practice from mistakes + results coaching** so every run teaches or motivates a rematch.
2. **Quick Strike** so starting a game on mobile feels effortless.
3. **Best-of-three Clash + pass-the-phone Relay** so live family play has a proper session shape both online and in the same room.
4. **Custom Party Rifts** so the existing mechanics generate far more variety.
5. **Weekly Family Rift + Ghost Gauntlet** so relatives can participate on their own schedules.
6. **Mastery and Chronicle** so progress feels meaningful without purchases, accounts, or unhealthy attendance pressure.

That combination makes Chronos Strike deeper, friendlier, and more replayable while preserving its most valuable properties: instant browser access, private family play, good mobile behavior, offline single-player, private cheats, and a genuinely zero-cost operating boundary.
