# 4. Mobile product, UX, and rewarded ads

## Product principle

Chronos Strike should feel like a native arcade game that happens to sync, not a database client wrapped around a game.

The network, login, ads, and sync indicators stay outside the active timing loop. A dropped connection must not make the hand stutter. The player always knows whether a run is Standard, accessibility-assisted, ad-assisted, Daily, Rival, practice, or unranked.

The standalone `chronos-strike` repository owns the mobile UI, web parity app, shared design tokens, localized strings, assets, deep-link landing behavior, and store-facing product documentation. This allows web and mobile to share the Chronos brand without coupling either to Clock Quest releases.

## Screen and flow plan

### First launch

1. Animated but skippable brand intro.
2. Audience/privacy/consent flow appropriate to the chosen age positioning and region.
3. Guest profile creation with a generated local name.
4. Optional sign-in explanation: “sync progress and compete globally”; allow **Not now**.
5. Minimal controls tutorial with a live calibration strike.
6. Home screen.

Do not request notifications, tracking, or sign-in on the first frame. Ask at the moment the benefit is clear.

### Home

- Continue/Quick Play primary action.
- Daily Rift card with countdown, personal best, and sync state.
- Classic, Endless, and Precision Lab mode cards.
- Difficulty selector.
- compact bests/achievement progress;
- Leaderboards, Profile, and Settings navigation.
- offline/queued status shown quietly when relevant.

Keep the current neon-cosmic identity, but reduce menu density on a phone by progressive disclosure. The current web menu's identity, stats, Daily, Rival input, difficulty, three mode cards, four navigation buttons, controls hint, and back link should not all compete in one viewport.

### Game

Portrait default:

- top HUD: score, round/wave, combo, lives, pause;
- large centered clock canvas;
- accessible Strike target in the lower thumb zone;
- active powers as compact chips outside the clock;
- judgments and boss telegraphs with motion/flash-safe variants;
- no banners or ads.

Landscape/tablet:

- clock left/center;
- Strike and powers on the dominant-hand side;
- Precision Lab panel on the remaining side;
- safe areas and fold/cutout posture respected.

### Pause/interruption

- Resume, Restart, Settings, Quit.
- Show the run category and whether it can rank.
- Incoming call/background/headphone interruptions auto-pause.
- Returning to a competitive run uses a short re-entry countdown.
- An ad is considered an interruption with its own transition and replay event.

### Results

- verified local summary appears instantly;
- clear `Submitting…`, `Verified`, `Queued offline`, `Unranked`, or `Rejected` status;
- final score, accuracy, perfects, best combo, round/wave, rank letter;
- personal best and achievement/cosmetic unlocks;
- Standard/Daily board placement only after server validation;
- Retry, Challenge, Share, Leaderboard, Home;
- rewarded option only if an eligible placement exists and the reward is still useful.

Never delay the result screen while waiting for a leaderboard request.

### Profile

- public handle/avatar;
- provider/account management kept in a private section;
- stats partitioned by mode/difficulty/ruleset/category;
- achievements, cosmetics, Daily history, run/replay history;
- sync health and last synced time;
- sign in/link account for guests;
- export/delete/sign out controls.

### Leaderboards

Filters:

- Standard / accessibility-assisted / ad-assisted;
- Classic / Endless / Daily;
- Normal / Hardcore;
- current ruleset by default, archived rulesets available;
- global and later friends/country.

Show the player's row even when outside the top 20, nearby rivals, verification badge, and pagination. Do not expose email, legal name, or internal IDs.

## Native interaction enhancements

### Haptics

Map deliberately:

- Strike input: light impact;
- Good/Great/Perfect: distinct rising patterns;
- Miss/life loss: warning pattern;
- boss start and Overdrive: stronger but optional;
- countdown and metronome: subtle pattern if enabled.

Respect system settings and a separate in-game toggle. Reduced motion does not automatically mean reduced haptics; let the player choose.

### Motion and visual effects

- Skia particles and glows have strict count/lifetime pools.
- Reduce Motion replaces scale/warp/glitch travel with fades/state changes.
- Reduce Flash caps luminance delta and removes full-screen strobing/hue cycles.
- Color-blind modes use shape/pattern redundancy, not only alternate palettes.
- High contrast and large HUD use token sets that remain layout-tested.

### Audio

- separate music, effects, and haptics;
- stop/pause cleanly on ads and lifecycle changes;
- respect other audio according to documented app behavior;
- avoid requiring microphone permission—the game does not need it;
- normalize loudness and prevent stacked effect clipping;
- subtitle/visual equivalent for important audio cues.

### Accessibility

Native accessibility labels/actions for menu, results, settings, and controls. The high-speed animated clock is primarily visual, so provide:

- one-button accessible play mode;
- visual beat and haptic beat assists;
- narrated/static summaries outside active play;
- focus order and larger targets;
- switch-control compatible Strike action;
- configurable judgment duration;
- assist categories visible and celebrated rather than described as cheating.

Test with VoiceOver and TalkBack on real devices.

## Rewarded-ad strategy

Use **Google AdMob rewarded ads**, not website AdSense. Start with one network and one or two placements. Add mediation only after enough impressions exist to measure fill and revenue.

### Principles

- completely opt-in;
- exact reward explained before the ad;
- a clear No thanks/close path;
- no punishment for declining or ad load failure;
- no ad during active timing;
- no auto-popup interstitials in the first release;
- frequency caps and cool-downs enforced client and server side;
- test ad unit IDs in every non-production build;
- consent resolved before initializing/requesting ads where required;
- promised reward delivered exactly once.

### Recommended MVP placement: revive

Offer after the run would otherwise end:

> Watch a rewarded ad to return with 1 life. This run continues as Ad-assisted and is ranked only on the Ad-assisted board.

Rules:

- Classic/Endless only;
- maximum once per run;
- not offered on Daily Standard, Rival, Zen, admin, or already ad-assisted-ineligible flows unless a separate category exists;
- resume at a stable round boundary with a countdown, never mid-frame;
- preserve score/combo rule exactly as product decides and record the revive event;
- if no ad is available, show a neutral unavailable state and let the run finish;
- server-issued opportunity and idempotent reward transaction.

### Score multiplier proposal

Do **not** apply “1.5x final score” to a Standard leaderboard result. It converts an ad view into competitive advantage and undermines the verified board.

Safe options:

1. **Recommended:** 1.5x a future soft-currency/XP payout, while competitive score remains unchanged.
2. 1.5x score only in an explicitly separate Ad-assisted board.
3. 1.5x score in a solo/event mode with no competitive board.

Do not create a currency in v1 solely for monetization. Add this placement after a meaningful, non-transferable progression reward exists.

### Other later placements

- reroll one post-run cosmetic/XP reward;
- one extra Daily practice attempt that cannot affect the Standard Daily entry policy;
- temporary cosmetic trial;
- double noncompetitive mission progress.

Avoid “watch to remove a miss” during the active round because it breaks flow and complicates replay validation.

### Reward state machine

```text
unavailable
  -> loading
  -> ready
  -> opportunity_reserved
  -> showing
  -> sdk_reward_earned
  -> confirming_server
  -> granted | failed_retryable | expired
```

Dismissal before reward returns to the result screen without penalty. Duplicate callbacks return the already-granted transaction.

### Consent and audience handling

At startup, before ad requests:

1. load locally stored audience/consent state;
2. refresh consent requirements through Google's User Messaging Platform where applicable;
3. expose a persistent Privacy choices entry point when required;
4. configure child-directed treatment and content rating from the declared audience policy;
5. request iOS tracking permission only if the product actually needs tracking and only after an explanatory pre-prompt; contextual/nonpersonalized ads should remain a viable path;
6. initialize/load ads after the lawful configuration is known.

The legal/audience decision must be made with qualified policy/legal review before production. The code should model it as configuration rather than scattered flags.

## Ads and game lifecycle

- pause game and audio before opening full-screen ad;
- persist run checkpoint and opportunity ID;
- ignore game input while ad owns the screen;
- handle app background, process death, and ad callback order variations;
- restore audio focus and show a ready countdown;
- do not assume dismissal and reward callbacks arrive in a fixed order across mediated networks;
- queue server reconciliation if offline after reward;
- capture only necessary diagnostic events.

## Sharing and deep links

Replace full pasted Rival Codes as the primary mobile path with Universal Links/App Links:

```text
https://chronosstrike.example/r/{opaqueChallengeId}
```

Behavior:

- app installed: open challenge preview;
- app absent: landing page explains game and links to stores;
- expired/invalid: friendly error without revealing database state;
- offline: allow paste/import of legacy offline Rival Code as unranked.

Generate score cards from a stable 1080x1350 template or responsive share templates using a native/offscreen renderer. Include verified/unranked category and ruleset so cards cannot imply a false global rank.

## Notifications

Defer notification permission until the player opts into a useful reminder:

- Daily Rift available;
- friend challenge received (later);
- sync/account action requiring attention.

No generic “come back” spam. Respect quiet hours and per-category toggles. Push tokens belong to device records and are deleted/revoked with the device/account.

## Analytics and observability events

Collect product events only after the audience/privacy decision and consent configuration. Use opaque user/install IDs and avoid names/emails in event properties.

Minimum event taxonomy:

```text
app_opened
onboarding_completed
auth_started / auth_completed / auth_failed
run_started
round_completed
run_finished
run_submission_queued / accepted / rejected
daily_started / daily_completed
rival_opened / rival_completed
achievement_unlocked
cosmetic_equipped
ad_opportunity_shown
ad_started / earned / dismissed / failed
ad_reward_confirmed
sync_started / completed / conflicted / failed
account_export_requested
account_deletion_requested
```

For run analytics, send aggregate outcome and version/category—not every raw frame. Raw replay stays in the run-validation system with tighter retention/access.

Core health metrics:

- crash-free users/sessions;
- ANR/hang rate;
- p50/p95 startup and game route ready time;
- frame-time/jank and input-to-feedback on sampled devices;
- run completion/retention by mode;
- submission acceptance/rejection/queue age;
- auth and sync failure rates;
- ad availability, opt-in, completion, reward-confirmation, and revenue per active user;
- consent-state and audience configuration errors.

## Content and progression guardrails

- Cosmetics stay visual and cannot alter target geometry.
- Reward offers never obscure the free continue/finish path.
- Taunts should be reviewed for age rating, tone, localization, and accessibility; “Delete the app”/“Pathetic” may be inappropriate for a young or mixed audience.
- Localize strings from day one; never bake copy into domain rules.
- Time zones: Daily resets are UTC and the UI should say so or present the local equivalent clearly.
- Avoid dark patterns: no fake close buttons, countdown pressure on purchases/ads, or mislabelled rewards.

## Mobile parity checklist

- Classic, Endless, Zen/Precision Lab.
- Normal and Hardcore.
- nine current modifiers.
- four current bosses.
- all 15 powers.
- combo, streak, Overdrive, ranks, acts, lives, decoy penalties.
- Daily deterministic seed/preview/history.
- ghost and Rival race behavior.
- 15 achievements and all current cosmetics.
- score card and native sharing.
- music/SFX/procedural or replacement music behavior.
- pause/quit/retry.
- all current accessibility/comfort options.
- offline normal play.
- legacy behavior fixtures passing.

Native improvements such as haptics, account sync, verified boards, server rewards, deep links, and richer profiles are additive around that baseline.
