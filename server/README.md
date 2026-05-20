# Analytics backend

Express + SQLite (better-sqlite3) backend for IntentTracker. Ingests signals
and profile snapshots from the tracker (keyed by the existing `userId` GUID
from `lib/src/intent-store.js`) and powers `/dashboard.html`.

## Run

```sh
cd server
npm install           # one-time
npm start             # listens on :8090
```

Then open:
- **http://localhost:8090/** — the Wanderlust demo (index/hotels/vacations/etc.)
- **http://localhost:8090/dashboard.html** — the business analytics view

The server also serves the static repo root, so demo pages and the dashboard
share the same origin as `/api/*` (no CORS).

## How emission works

`lib/src/emitter.js` is wired into `lib/src/index.js`. When a page passes
`emit: '/api/ingest'` to `IntentTracker.create({ ... })`, the tracker batches
signals and the latest profile snapshot, then ships them via
`navigator.sendBeacon` every ~3s (and on `pagehide`). Each payload carries the
`userId` (e.g. `user-a1b2c3d4`) read from the local `IntentStore`, so the
server can aggregate across users.

The demo pages (`hotels.html`, `vacations.html`, `resorts.html`, `dining.html`,
and `js/app2.js` for `index.html`) already pass `emit: '/api/ingest'`.

## Endpoints

| Method | Path                              | Purpose                                              |
|-------:|-----------------------------------|------------------------------------------------------|
| POST   | `/api/ingest`                     | Batch ingest: `{userId, sessionId, pageUrl, signals[], profile?}` |
| GET    | `/api/analytics/summary`          | Totals: signals, unique users, profiles, last event  |
| GET    | `/api/analytics/top-tags?limit=N` | Sum of `tagWeights` across all profiles              |
| GET    | `/api/analytics/signal-volume?hours=N&bucketMs=M` | Time-bucketed counts per signal type |
| GET    | `/api/health`                     | Health check                                         |

## Storage

SQLite file at `server/data/analytics.db` (WAL mode). Three tables:

- `signals(user_id, session_id, type, item_id, dwell_ms, query, page_url, ts, received_at)`
- `profiles(user_id PK, profile_json, updated_at)`
- `profile_tag_weights(user_id, tag, weight)` — flattened from profile snapshots
  for fast `GROUP BY tag` rollups.

To wipe and start over: `rm -rf server/data/`.

## Rebuilding the tracker

If you modify anything in `lib/src/`, rebuild the bundle the demo pages load:

```sh
cd lib && node build.js
```
