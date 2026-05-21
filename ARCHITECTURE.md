# IntentTracker — Architecture Notes

## Library vs Demo App Separation

The codebase has two distinct layers:

### 1. IntentTracker Library (`lib/src/`)

A self-contained, UI-agnostic intent tracking engine. Built as an IIFE bundle (`lib/dist/intent-tracker.js`) that exposes `window.IntentTracker`.

```
lib/src/
├── index.js                 — Orchestrator, exposes create() public API
├── catalog.js               — DOM scanner, reads data-ik-* attributes
├── event-collector.js       — IntersectionObserver + mouse/click/hover listeners
├── intent-summarizer.js     — Stateless pattern detection: events[] → intents[]
├── intent-store.js          — localStorage persistence with cross-session decay
├── recommendation-engine.js — Scores catalog items by profile tag weights
├── journey-tracker.js       — Cross-page navigation tracking and prediction
└── debug-panel.js           — Opt-in overlay panel (only UI piece in the lib)
```

**Integration contract:** The library connects to any UI through `data-ik-*` HTML attributes:
- `data-ik-id` — unique item identifier
- `data-ik-tags` — comma-separated tags
- `data-ik-group` — grouping category (e.g. region)
- `data-ik-name` — display name
- `data-ik-price` — price tier (auto-prefixed as `price:` tag)

### 2. Demo App (`js/`, `styles/`, `*.html`)

A travel destination browser ("Wanderlust") that consumes the library. The demo app imports nothing from `lib/src/` — it uses the IIFE bundle via `window.IntentTracker`.

```
js/
├── app2.js                  — Main entry point, wires tracker to UI
├── data/destinations.js     — Static destination catalog (24 entries)
├── ui/tabbed-grid.js        — Tab bar + filtered card grid
├── ui/continue-search.js    — Journey prediction links
├── ui/recommendation-section.js — Recommendation cards
├── ui/detail-modal.js       — Destination detail modal
├── ui/search-bar.js         — Search input handler
├── tracker-dashboard.js     — Standalone dashboard (reads localStorage)
└── utils/categories.js      — Tag taxonomy and search matching
```

### Coupling Matrix

| Library Layer          | Depends on UI? | Integration Point                     |
|------------------------|---------------|---------------------------------------|
| Catalog                | DOM only      | Any element with `data-ik-*` attrs    |
| Event Collector        | DOM only      | Attaches observers to catalog elements |
| Intent Summarizer      | No            | Pure function: `events[] → intents[]` |
| Intent Store           | No            | `localStorage` read/write only        |
| Recommendation Engine  | No            | Pure function: `profile → scored[]`   |
| Journey Tracker        | No            | Tracks page names/URLs, no DOM        |
| Debug Panel            | Yes (opt-in)  | Self-contained, injects own DOM/CSS   |

---

## Data Flow Pipeline

```
User Interactions (click, hover, tab_view, search)
        │
        ▼
  Event Collector (buffers events, fires onEvent callback)
        │
        ▼ every 5s (only if new events)
  Intent Summarizer (pattern detection with thresholds)
        │
        ▼
  Intent Store (merge + gradual confidence decay + cross-session decay)
        │
        ▼
  Recommendation Engine (score by tag weight match)
        │
        ▼
  Callbacks: onIntentsChanged, onRecommendations
```

---

## Event Types and Weights

| Event       | Tag Weight | Group Weight | Source                    |
|-------------|-----------|-------------|---------------------------|
| `view`      | 1.0       | 1.0         | IntersectionObserver (opt-in via `trackViews`) |
| `hover`     | 1.5       | 2.0         | mouseenter/mouseleave (≥1s) |
| `tab_view`  | 1.5       | 2.0         | Manual call from UI on tab switch |
| `click`     | 2.0       | 3.0         | Click on tracked element  |
| `search`    | N/A       | N/A         | Manual call, creates search_intent |
| `page_view` | N/A       | N/A         | Auto on init, feeds journey tracker |

---

## Intent Fading Model

### Within Session — Gradual Confidence Decay
- Each 5s flush cycle, intents not re-detected lose 20% confidence (`× 0.8`)
- Intent stays active and contributes to tag weights at diminishing strength
- Below 5% confidence threshold → `active = false`, excluded from weights
- Idle periods (no new events) → no flush → no decay

### Across Sessions — Temporal Decay
- Tag weights computed with exponential decay: `0.8 ^ sessionsAgo`
- Current session: `1.0×`, 1 ago: `0.8×`, 5 ago: `0.33×`, 10 ago: `0.11×`
- Only active intents contribute

---

## Storage Keys

| Data           | Storage        | Key                  |
|----------------|---------------|----------------------|
| Events log     | `localStorage` | `__ik_debug_events`  |
| Intents log    | `localStorage` | `__ik_debug_intents` |
| Recommendations| `localStorage` | `__ik_debug_recs`    |
| User profile   | `localStorage` | `ik_profile`         |
| Journey state  | `localStorage` | `ik_journey`         |

All keys use `localStorage` for cross-tab access (standalone dashboard reads the same data).

---

## Feature Toggles

| Option         | Default | Effect                                    |
|----------------|---------|-------------------------------------------|
| `debug`        | `false` | Enables overlay debug panel               |
| `trackViews`   | `false` | Enables IntersectionObserver view events  |
| `flushInterval`| `5000`  | Milliseconds between flush cycles         |
