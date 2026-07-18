# 3. Backend, data, security, and sync

## Backend recommendation

Use one Supabase project per environment:

- local development: Supabase CLI containers;
- staging/preview: free project while practical;
- production: a separate project, initially Free for a very small closed beta or Pro before a public release requiring reliable availability/backups.

Supabase provides managed Postgres, Auth, APIs, Edge Functions, Storage, and Realtime in one operational unit. This keeps cost and maintenance low while retaining normal Postgres portability.

All database migrations, function source, generated contracts, seed data, and authorization tests live in the standalone `chronos-strike` repository beside the clients that consume them. Supabase Dashboard changes must be captured back into migrations; `TheClockGame` CI and maintainers receive no implicit access to Chronos production environments.

Do not start with a VM, Kubernetes, Redis, Kafka, or separate Node API. None is justified for fewer than 50 expected players.

## Identity strategy

### Guest-first, account-optional gameplay

The game should launch without forcing a login. Create a local guest profile and allow all offline modes. Explain that an account enables cross-device sync, global leaderboards, Daily history, account recovery, and server-backed rewards.

This satisfies a better game funnel and reduces unnecessary personal-data collection.

### Sign-in methods for release

Recommended order:

1. Sign in with Apple on iOS.
2. Google Sign-In on iOS and Android.
3. Email magic link or OTP as an account-recovery/fallback method after custom SMTP is configured.

Avoid a home-grown password system. Store sessions in device secure storage, not plain AsyncStorage/SQLite. Request the fewest OAuth scopes possible.

### Public identity

Separate these concepts:

- `user_id`: private immutable UUID from Auth;
- `handle`: unique public game name, case-insensitive, mutable with cooldown;
- `display_name`: optional cosmetic name, not guaranteed unique;
- provider email/name: private account data, never displayed on leaderboards by default;
- avatar: optional and moderated/controlled.

Do not require first and last legal names. Import an existing web name as a suggested handle only after the player reviews it.

### Guest upgrade and account linking

On sign-in:

1. authenticate provider;
2. create/fetch server profile;
3. upload a signed local snapshot and pending commands;
4. merge monotonic progress (max bests, union achievements, sum only idempotent run-derived totals);
5. show a conflict screen only for non-mergeable preferences/equipped cosmetics;
6. mark the local guest profile as linked;
7. keep an encrypted local backup until server confirmation.

Never identify accounts solely by email because provider email behavior and Apple private relay can change.

## Proposed data model

All tables use UUID primary keys unless a natural composite key is explicitly listed. Store `created_at`, `updated_at`, and an integer `version` where optimistic concurrency is useful.

### Account and profile

#### `profiles`

| Column | Notes |
|---|---|
| `user_id` | PK/FK to `auth.users`; private ownership key. |
| `handle` | Public, normalized, unique on `lower(handle)`. |
| `display_name` | Optional, length/character limited. |
| `avatar_path` | Optional Storage path, not arbitrary external URL. |
| `country_code` | Optional and user-selected; do not infer/store precise location. |
| `profile_schema_version` | Migration/reconciliation version. |
| `created_at`, `updated_at`, `deleted_at` | Soft-delete only during a short deletion grace period if policy permits. |

#### `user_settings`

One row per user: music/SFX/haptics, accessibility/display, control layout, privacy/consent pointers, locale, and last selected mode/difficulty. Sensitive consent history belongs in its own append-only table.

#### `devices`

Hashed installation ID, user ID, platform, app/native/runtime versions, push token reference, last seen, and revoked timestamp. Never treat a device ID as proof of identity.

### Progression

#### `player_stats`

One row per `(user_id, ruleset_version, mode, difficulty, assist_category)` containing derived best score, best combo, best round/wave, run count, perfect count, boss clears, and last run timestamp.

These are server-derived from accepted runs. The client may cache but not authoritatively overwrite them.

#### `achievement_unlocks`

Composite unique key `(user_id, achievement_id, ruleset_version)` with source run, unlocked timestamp, and verification state.

#### `cosmetic_inventory`

Composite unique key `(user_id, cosmetic_id)` with source achievement/purchase/promotion and granted timestamp. Server inventory is authoritative for remotely earned items.

#### `cosmetic_loadouts`

One row per `(user_id, loadout_slot)` or a validated JSON document with an optimistic `version`. Only owned/unlocked cosmetics can be equipped.

### Runs and competition

#### `runs`

| Column | Notes |
|---|---|
| `id` | Server UUID. |
| `user_id` | Auth owner. |
| `client_run_id` | UUID created at run start; unique with user for idempotency. |
| `ruleset_version`, `game_version`, `app_version` | Compatibility identity. |
| `mode`, `difficulty`, `run_category` | Enums/check constraints. |
| `seed`, `daily_date` | Validated identity fields. |
| `assists` | Schema-validated flags, not arbitrary trusted JSON. |
| `started_at_client`, `duration_ms` | Diagnostic; server timestamps remain authoritative for receipt. |
| `claimed_summary` | Optional raw client claim for diagnostics. |
| `verified_summary` | Derived score/round/combo/accuracy/perfect counts. |
| `status` | `pending`, `accepted`, `rejected`, `quarantined`, `unranked`. |
| `rejection_code` | Stable non-sensitive reason. |
| `replay_hash`, `replay_path` | Integrity and optional blob reference. |
| `created_at`, `validated_at` | Server time. |

Suggested `run_category` values:

- `standard`
- `assisted_accessibility`
- `ad_assisted`
- `daily_standard`
- `daily_assisted`
- `rival_unranked`
- `zen_unranked`
- `custom_unranked`
- `admin_demo`
- `legacy_import`

#### `run_events` or replay blob

At this scale, normalized events are easy to inspect. A compact replay can also be stored as compressed versioned bytes in Storage with a small metadata row. Start with a bounded JSON/JSONB payload if it remains below the set limit; migrate large blobs to Storage without changing the submission contract.

Replay includes:

- schema/ruleset version, seed identity, category, assists, device timing metadata;
- monotonic run/round starts;
- strike event ID, round, elapsed time, captured angle/input timestamp;
- pause/background/ad interruptions;
- power events if not fully derivable from RNG/state;
- final client summary and checksum.

Do not trust client-provided judgment, awarded points, or final score; rederive them.

#### Leaderboard views

Expose read-only views/materialized views rather than a client-writable `leaderboard` table:

- best run per user per ruleset/mode/difficulty/category;
- Daily best per user/date/category;
- optional country/friends boards later;
- legacy archive view.

Use deterministic tie-breakers: score descending, accuracy descending, round descending where relevant, duration ascending only where meaningful, then earliest accepted server timestamp.

### Daily and rival

#### `daily_rifts`

Composite key `(date_utc, ruleset_version)`, seed identity, generated public metadata, enabled state, and optional featured configuration. Generate ahead or deterministically on read.

#### `rival_challenges`

Opaque challenge ID, owner, source accepted/unranked run, expiry, visibility, share token hash, and metadata. A signed/opaque link is shorter and safer than placing the full replay in a URL. Retain the offline Rival Code as an unranked fallback.

### Ads and economy

#### `ad_opportunities`

Server-issued opportunity ID, user, run, placement, reward type/amount, expiry, state, and nonce. This freezes what was promised before the ad starts.

#### `ad_reward_transactions`

Unique network transaction ID, opportunity ID, user/run, verification payload hash, state, granted timestamp, and reversal reason. A unique constraint makes callbacks idempotent.

#### `wallet_ledger` (only if soft currency is introduced)

Append-only debit/credit entries with balance derived by query/materialized summary. Never store only a mutable client-controlled balance.

Do not create a currency just to justify ads. A one-run revive token can be represented directly as a run event/opportunity.

### Privacy and operations

- `consent_events`: append-only consent version, region/audience state, purposes, source, timestamp.
- `account_deletion_requests`: state machine and audit timestamps, without retaining deleted personal data indefinitely.
- `admin_audit_log`: actor, action, target, reason, before/after hash, timestamp.
- `feature_flags`: environment/ruleset/platform targeting with safe defaults.

## API/function surface

The app can read its own RLS-protected profile/settings directly where safe. Use Edge Functions for commands that require service credentials, multi-table transactions, rate limits, or authoritative derivation.

### Public/read operations

- `GET leaderboard?ruleset=&mode=&difficulty=&category=&cursor=`
- `GET daily-rift?date=&ruleset=`
- `GET rival-challenge/{opaqueId}`
- `GET bootstrap` for public flags/minimum versions/rulesets

### Authenticated self-service operations

- `GET/PUT my profile` (RLS and constrained RPC for handle changes)
- `GET/PUT my settings` with version/ETag
- `GET my progress/history` paginated
- `POST sync-profile` with command IDs and base version
- `POST submit-run`
- `POST create-rival-challenge`
- `POST request-ad-opportunity`
- `POST claim-ad-reward` for client callback fallback
- `POST export-account`
- `POST delete-account`

Every mutating request carries:

- authenticated user JWT;
- schema/app/ruleset versions;
- UUID idempotency key;
- server-issued nonce/opportunity where relevant;
- bounded payload with strict validation;
- trace/request ID.

Return stable error codes, not database internals.

## Server-side run validation

### Validation pipeline

1. Authenticate user and verify account state.
2. Enforce per-user/device/IP/ruleset rate limits.
3. Claim idempotency key; return previous result on retry.
4. Validate payload schema, size, version support, seed format, mode/category, event order, and monotonic timestamps.
5. Reconstruct initial state with the shared `game-core` ruleset.
6. Replay semantic events.
7. Derive judgments, RNG power drops, score, combo, accuracy, round, assists, pauses, and completion.
8. Compare derived and claimed summary.
9. Apply sanity checks for impossible event rates, malformed lifecycle transitions, unsupported client versions, and replay duration.
10. In a database transaction, insert run, update derived stats/achievements/inventory, and make it visible to the correct leaderboard.
11. Return accepted/rejected/quarantined plus verified summary.

### Trust levels

No mobile client is perfectly cheat-proof. Use explicit trust tiers:

- `verified_replay`: full replay accepted by shared validator;
- `integrity_attested`: optional Play Integrity/App Attest signal also passed;
- `legacy_unverified`: imported Gist result;
- `unranked`: local/rival/Zen/admin/ad category not eligible for the selected board;
- `quarantined`: plausible but needs review.

Device attestation is defense-in-depth, not the source of score truth.

### Leaderboard rules

- One best accepted run per user in a board.
- Never mix ruleset versions.
- Never mix Standard, accessibility-assisted, and ad-assisted categories.
- Never allow Admin/QA builds or internal account roles into production boards.
- Remove the current ranked Cheat feature. Preserve a debug modifier only in internal builds using build-time gating and test accounts.
- Keep rejected replay data briefly for debugging/appeal, then expire it according to privacy policy.

## Row Level Security and permissions

Enable RLS on every exposed table.

Policy intent:

| Resource | Anonymous | Authenticated player | Edge Function/service role |
|---|---|---|---|
| Public leaderboard view | Read | Read | Manage derived source rows. |
| Public handles/avatars | Read minimal public fields | Read minimal public fields | Moderate/update by command. |
| Own profile/settings | None | Read/update constrained own row | Delete/merge/admin workflows. |
| Runs/replays | None | Read own rows; no direct insert/update | Validate and write. |
| Achievements/inventory/stats | None | Read own rows | Derive and write. |
| Ad transactions/opportunities | None | Read own status only | Create/verify/grant. |
| Consent/deletion/audit | None | Read relevant self-service status | Append/process. |

Never expose the service-role key in the app. Public/publishable keys are safe only when RLS and function authorization are correct. Add database tests proving cross-user access fails.

## Local persistence

Use:

- SecureStore/Keychain/Keystore for Supabase refresh/session secrets;
- SQLite for profile cache, settings, runs, replays, Daily history, inventory, and sync queue;
- in-memory game state with periodic/checkpoint persistence;
- app asset system/cache for music and visuals.

### Local schema

Mirror concepts but optimize for offline use:

- `local_profile`
- `local_settings`
- `local_progress`
- `local_runs`
- `local_replays`
- `sync_commands`
- `sync_cursor`
- `cached_leaderboards`
- `cached_daily_rifts`
- `local_migration_log`

Every row that syncs has `local_id`, `server_id`, `updated_at`, `version`, and `sync_state` where relevant.

### Migration from web localStorage

A native app cannot automatically read Safari/Chrome localStorage. Provide an explicit migration bridge:

1. add **Create Mobile Transfer Code** to the GitHub Pages game;
2. package only supported progress/settings plus schema version, issue time, and random nonce;
3. sign/encrypt it through a server endpoint when online, returning a short-lived one-use code/QR;
4. mobile app redeems the code into the authenticated or guest profile;
5. server records redemption and invalidates the code;
6. imported scores are labeled legacy/unverified and do not enter verified boards;
7. achievements/cosmetics may transfer after validation against conservative rules, or be marked legacy-earned.

An offline export file is possible, but should be treated as untrusted and never grant competitive server state without verification.

## Sync protocol

### Principles

- Gameplay writes locally first.
- Sync submits commands, not a giant last-write-wins profile blob.
- Commands have UUIDs and are idempotent.
- Server owns derived totals, inventory, ad rewards, and accepted scores.
- Preferences use optimistic versioning.
- The app shows sync state without blocking play.

### Conflict rules

| Data | Merge rule |
|---|---|
| Best score/combo/round | Server-derived maximum from accepted runs. |
| Achievements/inventory | Set union of valid grants. |
| Lifetime counters | Derived from unique run IDs, never client-added totals. |
| Settings/accessibility | Latest explicit user change per field, with device timestamp bounded by server receipt; prompt if ambiguous. |
| Equipped cosmetic | Latest valid selection whose cosmetic is owned. |
| Daily attempts/history | Unique run records; server groups by UTC date/ruleset. |
| Replays | Immutable by run ID; replace only a pointer to the preferred best. |
| Public handle | Server transaction/unique constraint wins. |

### Offline queue

- queue normal/rival/Zen runs for history;
- queue competitive submissions with replay until connectivity returns and ruleset submission window permits;
- do not show a queued score as globally ranked;
- exponential retry with jitter and maximum backoff;
- stop retry on permanent version/schema rejection;
- surface recoverable account/auth errors;
- retain failed local run history even when it cannot rank.

## Rewarded-ad verification

For durable or competitive-impacting rewards, use AdMob server-side verification (SSV):

1. app requests an `ad_opportunity` with run and placement;
2. server returns opportunity ID, exact reward, expiry, and custom data token;
3. app loads/shows the rewarded ad and pauses the run state;
4. AdMob calls the SSV endpoint;
5. endpoint verifies signature, timestamp, ad unit, custom data, and unique transaction ID;
6. database transaction marks opportunity granted and applies exactly one reward;
7. app polls/subscribes for grant or uses the client earned callback as a temporary UI signal;
8. if SSV is delayed, show “reward confirming” and reconcile later.

For a revive that must continue immediately, choose one of these policies and test it:

- grant provisionally on the SDK earned callback, mark the run `ad_assisted`, and reconcile SSV later; or
- require confirmed SSV before resume, accepting a potentially slower UX.

The first is more playable and safe because ad-assisted runs do not enter the standard board.

## Privacy, age, and deletion

Before SDK integration, document the intended audience.

If children or users of unknown age are in scope:

- apply child-directed ad treatment and maximum content rating where required;
- avoid behavioral tracking/personalized ads unless a compliant consent model explicitly permits it;
- minimize personal fields and consider parental flows;
- review Apple Kids Category and Google Families obligations before launch;
- do not infer age from gameplay.

Account deletion must:

- be discoverable in app settings;
- revoke provider/session tokens where applicable;
- delete/auth-anonymize profile, private runs/replays, devices, push tokens, and ad identifiers according to policy;
- retain only narrowly justified fraud/financial audit data, de-identified where possible and disclosed;
- offer a public web deletion request path for Google Play requirements;
- be idempotent and report status.

Provide downloadable account export and versioned Privacy Policy/Terms links.

## Backup and disaster recovery

During Free development/beta:

- automated scheduled logical `supabase db dump` to encrypted off-site storage;
- schema and seed entirely reproducible from migrations;
- quarterly restore drill.

For production:

- use a paid plan with managed daily backups when uptime/data recovery matter;
- keep independent logical exports for portability;
- document recovery point/time objectives;
- test restore into staging, never for the first time during an incident;
- keep Storage object inventory/backups aligned with database references.

## Scaling triggers

Upgrade or rework based on measured thresholds:

| Signal | First action |
|---|---|
| Free project pause risk/public uptime requirement | Move production to Pro. |
| Database approaches 70% of quota | Retention cleanup, indexes/data review, then plan/disk upgrade. |
| Validation p95 exceeds target | Profile shared core/function; make validation asynchronous if needed. |
| Leaderboard reads dominate | Cached view/materialized view and CDN/edge cache. |
| Connections approach pool limit | Fix connection usage and pool configuration before more compute. |
| Replay storage grows | Lifecycle policy and move payloads to compressed Storage objects. |
| Abuse rises | Stronger rate limits, attestation, quarantine tooling. |
| Regional latency is material | Edge caching/read strategy; only then consider regional services. |

These steps preserve mobile APIs and shared game-core contracts.
