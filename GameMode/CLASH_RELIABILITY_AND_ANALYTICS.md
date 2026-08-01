# Chrono Clash reliability correction and analytics decision

> Status: reliability correction implemented locally on 2 August 2026. Analytics is a proposal only; no tracking, binding, cookie, identifier, or retention job has been enabled.

## What was actually wrong

Two independent server/client rules explain the reports from live play:

1. Clash was deliberately frozen at 10 rounds even though Classic uses 40. The Worker created 10-round rooms and the browser also clamped every received Clash limit to 10.
2. A closed WebSocket started a silent 30-second forfeit timer. Progress generated while reconnecting was discarded, and every active room also had a fixed 20-minute expiry even when both players were still sending heartbeats.

These were product rules rather than random engine failures, but together they looked like an unexplained premature ending.

## Implemented correction

- New revision-26 clients create full 40-round Clash rooms. The browser accepts the full Classic limit and every lobby/share surface reports the authoritative room length.
- Rolling deployment remains safe: a previous client creates a legacy 10-round room; a current client can join it and follows the server's 10-round value. A previous guest cannot enter a new 40-round room and receives `client_update_required` instead of playing a mismatched length.
- Active-room lifetime is now a rolling 45-minute inactivity window. A valid heartbeat, progress update, or reconnect refreshes it; a final result starts the normal short result-retention window. A live room therefore does not expire while the players remain active.
- The disconnect grace is two minutes. A transient mobile network handoff therefore has time to recover before the Durable Object declares a forfeit.
- The browser keeps the most recent unsent progress or final result in memory and flushes it immediately after reconnection. A final result supersedes an older progress update.
- During recovery the live HUD says that the run continues and displays the grace length. A restored connection confirms that buffered progress was sent. A disconnect result now identifies whether the local or rival connection missed the window.
- No tap-by-tap timeline, player identity, or extra permanent room history was added.

## Reliability acceptance gate

- A new room shows `40 ROUNDS` and reaches round 11 rather than ending at round 10.
- A rematch retains its negotiated format; sudden death remains one round.
- Disconnect one test phone for 60-90 seconds, keep playing, reconnect, and confirm the run and score continue.
- Finish locally while disconnected, reconnect inside two minutes, and confirm the buffered final result reaches the rival.
- Leave one connection down beyond two minutes and confirm the result explains the disconnect rather than presenting it as an ordinary score finish.
- Keep both phones connected beyond the previous 20-minute boundary and confirm heartbeats keep the room alive.
- A deliberately stale client cannot join a new 40-round room; after accepting the PWA update it can join normally.

## Analytics recommendation

Use two deliberately separate layers:

1. **Cloudflare Web Analytics** for aggregate page use and Web Vitals. It is privacy-first and does not need a client identity or product-event payload.
2. **Workers Analytics Engine** for server-authoritative Clash reliability and funnel events. Emit from the Match API/Durable Object, not from gameplay taps, so ad blockers, refreshes, and local manipulation do not become the source of truth.

Do not add Google Analytics, advertising IDs, cookies, browser fingerprinting, player profiles, or a general-purpose event warehouse at this stage.

### Minimal event set

| Event | When | Allowed dimensions | Allowed numbers |
|---|---|---|---|
| `clash_created` | Room is created | schema, deployment revision, difficulty, 10/40 format | 1 |
| `clash_started` | Both players ready | schema, difficulty, format, handicap-present boolean | wait-time bucket |
| `clash_reconnected` | A disconnected seat returns | schema, match state, format | disconnected seconds |
| `clash_finished` | Ordinary or sudden-death result | schema, difficulty, format, result reason | duration seconds, score-gap bucket, lead-change count |
| `clash_forfeit` | Voluntary or grace-expiry result | schema, reason, format | duration seconds, disconnect seconds |
| `clash_expired` | Inactive room is removed | schema, last room state, format | age seconds |

Use fixed allowlists and coarse buckets. Do not write player names, room codes, invite URLs, capability tokens, IP addresses, user-agent strings, exact clock targets, exact scores, cheat settings, reaction contents, or per-round/tap timelines. Cloudflare may use the connecting IP transiently for the existing rate limiter, but analytics must not copy or retain it.

### Retention decision

| Data | Recommended retention | Reason |
|---|---:|---|
| Detailed server event points | 90 days | Analytics Engine currently retains data for three months; enough to compare releases and diagnose recurring disconnect patterns. |
| Unsampled Web Analytics detail | Cloudflare-managed 7-day window | Suitable for recent traffic and performance investigation; older Web Analytics reporting is sampled/aggregated by the platform. |
| Monthly aggregate counts/rates | 13 months, optional | Retains seasonality without retaining match-level rows. Store only totals such as starts, completion rate, disconnect-forfeit rate, and p50/p95 duration. |
| Player-identifying or invitation data | 0 days | It is unnecessary for the stated questions and creates avoidable privacy/security risk. |

At day 90, review whether any event has informed a decision. Remove unused fields/events. Do not extend detailed retention by exporting raw data elsewhere.

## Proposed implementation phases

### A1 — approve the data contract

- Confirm the event table, forbidden fields, 90-day detail, and optional 13-month aggregates.
- Record one owner and one deletion/disable procedure.
- Confirm that expected usage stays within the intended zero-cost Cloudflare allocation before creating a binding.

### A2 — aggregate web measurement

- Enable Cloudflare Web Analytics once on the GameMode content page, not on redirect pages.
- Verify no duplicate beacon and no query-string/invite capability collection.

### A3 — server event measurement

- Add one Analytics Engine binding and a small allowlisted event writer.
- Make analytics best-effort: a failed data point must never fail room creation, progress, reconnect, or result settlement.
- Add tests proving forbidden values never appear in a data point and every terminal reason maps to a fixed value.

### A4 — dashboard and deletion drill

- Start with four views only: rooms started, completion rate, disconnect-forfeit rate, and p50/p95 match duration by deployment revision and 10/40 format.
- Run one deletion/disable drill and document how to remove the binding and beacon without affecting multiplayer.
- Decide after 90 days whether monthly aggregate retention is useful; do not create it pre-emptively.

## Sources used for the proposal

- Cloudflare Web Analytics overview: <https://developers.cloudflare.com/web-analytics/about/>
- Cloudflare Web Analytics retention FAQ: <https://developers.cloudflare.com/web-analytics/faq/>
- Analytics Engine data-point setup: <https://developers.cloudflare.com/analytics/analytics-engine/get-started/>
- Analytics Engine limits and three-month retention: <https://developers.cloudflare.com/analytics/analytics-engine/limits/>
- Durable Object WebSocket Hibernation guidance: <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>
