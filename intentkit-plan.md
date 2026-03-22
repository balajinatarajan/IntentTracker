# IntentKit: Extract Intent Tracker as a Drop-in Library

## Context

Wanderlust has a powerful intent-based context tracking system that infers user intent from interactions (clicks, hovers, searches), builds a persistent profile, and generates recommendations — all client-side with zero backend. This plan extracts that system into a standalone library (`IntentKit`) that can be dropped onto any website with a single `<script>` tag.

## Public API

```js
const tracker = IntentKit.create({
  items: [                              // Required: your catalog
    { id: 'item-1', tags: ['electronics', 'budget'], name: 'Widget', group: 'gadgets' },
    ...
  ],
  taxonomy: {                           // Optional: for search query → tag matching
    electronics: { label: 'Electronics', keywords: ['tech', 'gadget', 'device'] },
    budget:      { label: 'Budget', keywords: ['cheap', 'affordable', 'deal'] },
  },
  storageKey: 'myapp_intent',           // Optional (default: 'intentkit_profile')
  debug: true,                          // Optional: show debug panel
  onIntentsChanged: (intents, profile) => { ... },
  onRecommendations: (recs) => { ... },
});

// Auto-observe DOM (viewport + hover tracking)
tracker.observe(document.getElementById('grid'), {
  itemSelector: '.product-card',
  itemIdAttribute: 'data-product-id',
});

// Manual tracking
tracker.trackClick('item-1');
tracker.trackSearch('cheap gadgets');

// On-demand queries
tracker.recommend(6);    // → [{ itemId, item, score, reason, matchedTags }]
tracker.getProfile();    // → { userId, sessions, tagWeights }

// Lifecycle
tracker.reobserve();     // Re-attach after DOM re-render
tracker.clear();         // Reset all stored data
tracker.destroy();       // Cleanup timers, observers, listeners
```

## File Structure

```
lib/
  src/
    index.js                  — IntentKit.create() factory + pipeline wiring
    event-collector.js        — Generalized from js/tracking/event-collector.js
    intent-summarizer.js      — Generalized from js/tracking/intent-summarizer.js
    intent-store.js           — Generalized from js/storage/intent-store.js
    recommendation-engine.js  — Generalized from js/recommendations/recommendation-engine.js
    taxonomy.js               — Replaces js/utils/categories.js (user-configurable)
    debug-panel.js            — Self-contained debug UI (injects own HTML/CSS)
    debug-panel.css           — Styles embedded at build time
  dist/
    intent-kit.js             — IIFE build (window.IntentKit)
    intent-kit.esm.js         — ESM build
  build.js                    — esbuild bundler script
```

## Implementation Steps

### Step 1: Create `lib/src/taxonomy.js`
Generalize `js/utils/categories.js`. Instead of hardcoded `regions`/`tripTypes`/`priceTiers`, accept a flat `categories` map from user config.
- `matchQueryToTags(query)` — same fuzzy keyword matching
- `getLabel(tag)` — returns human-readable label or falls back to tag name

### Step 2: Create `lib/src/intent-store.js`
Copy from `js/storage/intent-store.js`. Single change: accept `storageKey` in constructor instead of hardcoded `'wanderlust_intent_profile'`. All session management and temporal decay (0.8×) logic stays identical.

### Step 3: Create `lib/src/intent-summarizer.js`
Generalize from `js/tracking/intent-summarizer.js`. Key changes:
- Constructor: `(items, taxonomy, options)` instead of `(destinations)`
- Rename `destinationId` → `itemId`, `destMap` → `itemMap`
- Replace hardcoded `dest.region`/`dest.priceTier`/`dest.tripTypes` with generic `item.group` and `item.tags`
- **Simplify counting**: Instead of 4 separate counters (region/price/trip/tag), use 2: `groupCounts` (from `item.group`) and `tagCounts` (from `item.tags`). This preserves the group-level intent detection (region_interest → group_interest) and tag-level detection
- Intent categories become: `group_interest`, `tag_affinity`, `search_intent`, `comparison`, `hover_interest`
- Use `taxonomy.getLabel(tag)` for summary text instead of `regions[tag]?.label`
- Use `taxonomy.matchQueryToTags(query)` instead of imported function
- All weights, recency, frequency bonus, dedup logic stays identical

### Step 4: Create `lib/src/recommendation-engine.js`
Copy from `js/recommendations/recommendation-engine.js`. Changes:
- Constructor: `(items, options)` — `options.maxPerGroup` (default 3)
- Diversity filter uses `item.group` instead of `dest.region`
- Use taxonomy for tag labels in reason text

### Step 5: Create `lib/src/event-collector.js`
Generalize from `js/tracking/event-collector.js`. Changes:
- `observe(container, { itemSelector, itemIdAttribute })` instead of hardcoded `.destination-card` / `data-destinationId`
- Rename `destinationId` → `itemId` in event schema
- Return `{ trackClick, trackSearch, trackHover, reobserve, getEvents, clearBuffer, destroy }` — `reobserve()` replaces `window.__reattachObserver`, `destroy()` cleans up interval + observer + listeners
- Accept thresholds in options with current defaults: `flushInterval=5000`, `minDwellMs=800`, `minHoverMs=1000`, `viewThreshold=0.5`
- `enableViewTracking` from config replaces `FEATURE_TOGGLES` import

### Step 6: Create `lib/src/debug-panel.js`
Adapt from `js/ui/debug-panel.js` + `styles/debug-panel.css`. Changes:
- Self-contained: creates its own DOM and injects scoped CSS (prefix all classes with `__ik-`)
- No dependency on pre-existing HTML elements
- Same 4 tabs: Events, Intents, Profile, Recommendations
- Expose: `{ logEvent, replaceIntents, logProfile, logRecommendations, destroy }`

### Step 7: Create `lib/src/index.js` — the orchestrator
Replaces the wiring in `js/app.js`:
1. Validate config (items required, must have id + tags)
2. Instantiate Taxonomy, IntentStore, IntentSummarizer, RecommendationEngine
3. Create internal EventCollector
4. Wire flush pipeline: events → summarize → store → recommend → callbacks
5. Generate session ID per `create()` call
6. On creation, fire `onRecommendations` if returning visitor profile exists
7. If `debug: true`, instantiate debug panel and wire it into the pipeline
8. Return the public API object

Export as default + named: `export default { create }` and `export { create }`

### Step 8: Build setup
- `lib/package.json` with esbuild as devDependency
- `lib/build.js`: two esbuild passes — IIFE (`window.IntentKit`) and ESM
- `npm run build` script

### Step 9: Refactor Wanderlust app to consume the library
Replace wiring in `js/app.js` with:
```js
import IntentKit from '../lib/dist/intent-kit.esm.js';

const tracker = IntentKit.create({
  items: destinations.map(d => ({ ...d, group: d.region })),
  taxonomy: { ...regions, ...tripTypes, ...priceTiers, ...activityTypes },
  debug: true,
  onRecommendations: (recs) => renderRecommendations(recsSection, recs, handleCardClick),
});

tracker.observe(gridContainer, {
  itemSelector: '.destination-card',
  itemIdAttribute: 'data-destination-id',
});
```

The Wanderlust-specific modules (`categories.js`, `feature-toggles.js`) become unused — the library internalizes all that logic.

## Key Generalizations

| Wanderlust-specific | IntentKit (generic) |
|---|---|
| `destinationId` | `itemId` |
| `dest.region` | `item.group` |
| `dest.priceTier`, `dest.tripTypes` | Subsumed by `item.tags` |
| Hardcoded `regions`, `tripTypes`, etc. | User-provided `taxonomy` config |
| `FEATURE_TOGGLES` import | Config options |
| `window.__reattachObserver` | `tracker.reobserve()` |
| `.destination-card` selector | Configurable `itemSelector` |
| `'wanderlust_intent_profile'` key | Configurable `storageKey` |

## Verification

1. Run `npm run build` in `lib/` — produces `dist/intent-kit.js` and `dist/intent-kit.esm.js`
2. Start the Wanderlust dev server and verify the refactored app works identically:
   - Click destinations → intents appear in debug panel
   - Hover cards ≥1s → hover events tracked
   - Search → search intents generated
   - Recommendations update after interactions
   - Refresh page → returning visitor recommendations load from localStorage
3. Test the IIFE build with a plain `<script>` tag in a minimal HTML page to confirm `window.IntentKit` works
