# IntentTracker: Zero-Config Drop-in Intent Tracking Plugin

## Context

The current Wanderlust intent tracker requires passing an items catalog and taxonomy upfront. This plan takes a different approach: a **zero-config plugin** that discovers items directly from the DOM via prescribed `data-` attributes. Drop a `<script>` tag on any site, add data attributes to your elements, and the plugin automatically tracks views, hovers, clicks, and searches — building a real-time user profile and recommendations with no configuration.

## Prescribed Data-Attribute Schema

The plugin reads metadata from DOM elements. Site owners annotate their content with these attributes:

```html
<div data-ik-id="product-123"
     data-ik-tags="electronics, wireless, noise-cancelling"
     data-ik-group="audio-equipment"
     data-ik-name="Sony WH-1000XM5"
     data-ik-price="budget">
  <!-- any content -->
</div>
```

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-ik-id` | Yes | Unique item identifier |
| `data-ik-tags` | Yes | Comma-separated tags (the core of intent detection) |
| `data-ik-group` | No | Category/group for diversity filtering in recommendations |
| `data-ik-name` | No | Human-readable name (for comparison intents, debug panel) |
| `data-ik-price` | No | Price tier tag (auto-added to tags: `price:budget`, `price:mid`, `price:premium`) |

**Why prescribe the schema rather than let users configure it?** Simplicity. One convention means zero configuration, better docs, and the plugin can be understood by reading the HTML alone.

## Attribute Mapping (Use Existing Data Attributes)

Sites that already have `data-` attributes on their elements can map them to IntentTracker's schema instead of adding new ones:

```js
const tracker = IntentTracker.init({
  attributes: {
    id:    'data-product-id',       // maps to data-ik-id
    tags:  'data-categories',       // maps to data-ik-tags
    group: 'data-department',       // maps to data-ik-group
    name:  'data-product-name',     // maps to data-ik-name
    price: 'data-price-tier',       // maps to data-ik-price
  }
});
```

With this mapping, existing HTML works as-is:
```html
<!-- No changes needed — existing attributes are read directly -->
<div data-product-id="SKU-456"
     data-categories="running, nike, lightweight"
     data-department="shoes"
     data-product-name="Nike Air Zoom">
  ...
</div>
```

**Resolution order**: When both a mapped attribute and a `data-ik-*` attribute exist on the same element, the `data-ik-*` attribute wins. This lets sites progressively migrate.

**Selector derivation**: The plugin auto-generates its query selector from the `id` attribute mapping. If `attributes.id` is `'data-product-id'`, it scans for `[data-product-id]` elements. If not provided, it scans for `[data-ik-id]`.

## How It Works

```html
<!-- 1. Add the script -->
<script src="intent-tracker.js"></script>

<!-- 2a. Option A: Use prescribed attributes -->
<div id="products">
  <div data-ik-id="item-1" data-ik-tags="running, nike, lightweight" data-ik-group="shoes">
    Nike Air Zoom
  </div>
</div>

<!-- 2b. Option B: Map existing attributes (no HTML changes needed) -->
<div id="products">
  <div data-product-id="item-1" data-categories="running, nike" data-department="shoes">
    Nike Air Zoom
  </div>
</div>

<!-- 3. Initialize -->
<script>
  // Option A: zero-config
  const tracker = IntentTracker.init();

  // Option B: with attribute mapping
  const tracker = IntentTracker.init({
    attributes: { id: 'data-product-id', tags: 'data-categories', group: 'data-department' }
  });
</script>
```

That's it. The plugin:
1. Scans the DOM for all `[data-ik-id]` (or mapped `id` attribute) elements
2. Extracts metadata from data attributes into an internal catalog
3. Attaches IntersectionObserver (views), hover listeners, click listeners
4. Watches for DOM mutations (new elements added dynamically)
5. Flushes events → summarizes intents → updates profile → computes recommendations
6. Persists profile to localStorage across sessions

## Public API

```js
// Initialize — auto-discovers all [data-ik-id] elements (or mapped attributes)
const tracker = IntentTracker.init({
  // All optional:
  attributes: {                     // Map existing data attributes (default: data-ik-* schema)
    id: 'data-product-id',
    tags: 'data-categories',
    group: 'data-department',
    name: 'data-product-name',
    price: 'data-price-tier',
  },
  storageKey: 'my_site',          // localStorage prefix (default: 'ik_profile')
  flushInterval: 5000,            // ms between intent recalculations (default: 5000)
  debug: true,                    // show debug panel (default: false)
  root: document.getElementById('products'),  // scope observation (default: document.body)
  onIntentsChanged: (intents, profile) => {},
  onRecommendations: (recs) => {},
});

// Manual tracking (for SPA navigation, custom buttons, etc.)
tracker.trackClick('item-id');
tracker.trackSearch('running shoes');

// Query
tracker.recommend(6);      // → [{ itemId, item, score, reason, matchedTags }]
tracker.getProfile();       // → { userId, sessions, tagWeights }
tracker.getIntents();       // → current session intents

// Lifecycle
tracker.scan();             // Re-scan DOM for new [data-ik-id] elements
tracker.clear();            // Reset profile + localStorage
tracker.destroy();          // Remove all listeners, observers, timers
```

## Event Tracking (All Signals Enabled)

Unlike the original Wanderlust (views disabled), this plugin tracks **all four signal types** by default:

| Signal | Weight | Threshold | How |
|--------|--------|-----------|-----|
| **View** | 1× | ≥800ms visible, ≥50% in viewport | IntersectionObserver |
| **Hover** | 2× | ≥1000ms hover duration | mouseenter/mouseleave |
| **Click** | 3× | Immediate | click listener on `[data-ik-id]` |
| **Search** | 0.9 confidence | Manual call | `tracker.trackSearch(query)` |

**Event schema** (internal):
```js
{ type: 'view'|'hover'|'click'|'search', timestamp, itemId, dwellMs, query }
```

## DOM Auto-Discovery via MutationObserver

The plugin uses a `MutationObserver` on the root element to detect dynamically added `[data-ik-id]` elements. When new items appear (SPA page transitions, infinite scroll, AJAX content), the plugin automatically:
1. Extracts their metadata into the internal catalog
2. Attaches IntersectionObserver + hover/click listeners
3. No manual `scan()` call needed (though available as escape hatch)

## Intent Summarization Pipeline

Preserved from Wanderlust with these adaptations:

### Stage 1: Tag Counting
For each event, look up the item's tags and group from the internal catalog (built from data attributes). Increment weighted counters:
- **`tagCounts`**: All tags from `data-ik-tags` + auto-generated `price:*` tags
- **`groupCounts`**: From `data-ik-group` (replaces Wanderlust's region counting)

Weighting: `click=3×, hover=2×, view=1×` with recency multiplier `(0.5 + 0.5 × age)` — identical to current `intent-summarizer.js:58-76`.

### Stage 2: Frequency Bonus
Items with 2+ interactions get `log₂(count)` bonus — identical to current `intent-summarizer.js:80-101`.

### Stage 3: Pattern Detection
Generates intents from the counters:

| Intent Category | Trigger | Confidence |
|----------------|---------|------------|
| `group_interest` | Top 3 groups with count ≥ 3 | `min(count/10, 1.0)` |
| `tag_affinity` | Top tag with ≥ 35% share of events | `min(ratio, 1.0)` |
| `price_preference` | Top price tag with ≥ 50% share | `min(ratio, 1.0)` |
| `search_intent` | From `trackSearch()` calls | 0.9 fixed |
| `comparison` | 2-3 unique clicked items | 0.85 fixed |
| `hover_interest` | 2+ hovers in same group (unclicked) | `min(totalHoverMs/10000, 0.9)` |

### Stage 4: Dedup
Keep highest confidence intent per `category + sorted tags` — identical to current `intent-summarizer.js:240-249`.

### Summary Text Generation
Uses tag names directly (no taxonomy lookup needed):
- Group interest: `"Interested in {group label} — {top tag}"`
- Tag affinity: `"Interested in {tag}"`
- Comparison: `"Comparing {name1} and {name2}"`
- Search: `"Searched for \"{query}\""`

## Profile & Recommendations (Real-Time)

### Profile Store
Identical to current `intent-store.js`:
- Sessions array with intents (active/inactive tracking)
- Cross-session decay: `0.8^sessionsAgo`
- `tagWeights` recomputed on every flush
- Persisted to `localStorage` under configurable key

### Recommendation Engine
Identical to current `recommendation-engine.js`:
- Score: `Σ(tagWeights[tag]) / √(tagCount)` per item
- Diversity: max 3 per `group` (from `data-ik-group`)
- Reason: `"Based on your interest in {top matched tag}"`
- Returns: `[{ itemId, item, score, reason, matchedTags }]`

**Real-time loop**: Every flush (5s default), the full pipeline runs:
`events → intents → profile → recommendations → callbacks`

## File Structure

```
lib/
  src/
    index.js                  — IntentTracker.init() + MutationObserver + pipeline wiring
    catalog.js                — Scans DOM, resolves attribute mapping, builds item map
    event-collector.js        — IntersectionObserver + hover + click listeners
    intent-summarizer.js      — Weighted tag counting + pattern detection
    intent-store.js           — localStorage profile with session decay
    recommendation-engine.js  — Tag-weight scoring + diversity filter
    debug-panel.js            — Self-contained debug UI (injects own DOM/CSS)
  dist/
    intent-tracker.js         — IIFE build (window.IntentTracker)
    intent-tracker.esm.js     — ESM build
  build.js                    — esbuild script
```

## Implementation Steps

### Step 1: `lib/src/catalog.js` — DOM Scanner with Attribute Mapping (new module)
Scans a root element for trackable elements and extracts metadata:
```js
// attrMap defaults: { id: 'data-ik-id', tags: 'data-ik-tags', group: 'data-ik-group', ... }
export function createCatalog(attrMap)
  → { scanItems(root), scanNewElements(elements), getItem(id), getAllItems(), getSelector() }
```
- `getSelector()` returns `[${attrMap.id}]` — used by MutationObserver and event-collector to find elements
- For each element, reads `attrMap.id`, `attrMap.tags`, etc. (with `data-ik-*` fallback when mapped attr is missing)
- Parses tags (comma-separated, trimmed)
- If price attribute exists, adds `price:{value}` to tags
- Returns items as Map keyed by id
- `scanNewElements(elements)` adds dynamically discovered elements

### Step 2: `lib/src/event-collector.js` — Auto-Attaching Collector
Generalized from `js/tracking/event-collector.js`:
- `observe(elements)` — attaches IntersectionObserver + hover + click to given elements
- `observeNew(elements)` — attach to newly discovered elements (called by MutationObserver)
- Click listener on each `[data-ik-id]` element (new — Wanderlust delegated clicks to app.js)
- **Views enabled by default** (no feature toggle needed)
- Renames `destinationId` → `itemId`
- Returns `{ trackClick, trackSearch, getEvents, clearBuffer, destroy }`

### Step 3: `lib/src/intent-summarizer.js` — Generic Summarizer
Adapted from `js/tracking/intent-summarizer.js`:
- Constructor: `(catalog)` — receives the item Map from catalog.js
- Replaces `dest.region` → `item.group`, `dest.priceTier` / `dest.tripTypes` → subsumed by `item.tags`
- Two counters: `groupCounts` + `tagCounts` (instead of 4 separate travel-specific ones)
- Detects `price:*` tags specially for price_preference intent
- All weights, recency, frequency, dedup logic preserved exactly
- Summary text uses tag/group names directly (no taxonomy labels needed)

### Step 4: `lib/src/intent-store.js` — Profile Store
Minimal adaptation from `js/storage/intent-store.js`:
- Constructor accepts `storageKey` (default `'ik_profile'`)
- All session management, decay (0.8×), tagWeights computation identical

### Step 5: `lib/src/recommendation-engine.js` — Recommender
Adapted from `js/recommendations/recommendation-engine.js`:
- Constructor: `(catalog)` — uses item Map
- Diversity filter on `item.group` instead of `dest.region`
- Reason text: `"Based on your interest in {tag}"` (tag used directly as label)
- Catalog can grow over time as MutationObserver finds new items

### Step 6: `lib/src/debug-panel.js` — Self-Contained Debug UI
Adapted from `js/ui/debug-panel.js` + `styles/debug-panel.css`:
- Creates all DOM + injects scoped CSS (prefix `.__ik-debug-*`)
- FAB button in bottom-right corner
- 4 tabs: Events, Intents, Profile, Recommendations
- Only instantiated when `debug: true`
- `destroy()` removes all injected DOM

### Step 7: `lib/src/index.js` — Orchestrator
The main entry point:
1. Call `scanItems(root)` to build initial catalog
2. Create EventCollector, attach to discovered elements
3. Set up MutationObserver on root:
   - On `childList` additions, check for new `[data-ik-id]` elements
   - Add to catalog via `scanNewElements()`
   - Attach observers via `observeNew()`
   - Update recommendation engine's item set
4. Wire flush pipeline: events → summarize → store → recommend → callbacks
5. On init, check for returning visitor profile → fire `onRecommendations`
6. If `debug: true`, create debug panel and wire into pipeline
7. Return public API

**IIFE wrapper**: esbuild with `globalName: 'IntentTracker'` — works with plain `<script>` tag.

### Step 8: Build setup
- `lib/package.json` with esbuild devDependency
- `lib/build.js`: IIFE + ESM builds
- `npm run build` produces `dist/intent-tracker.js` and `dist/intent-tracker.esm.js`

### Step 9: Refactor Wanderlust to use the plugin
Update `index.html` to add `data-ik-*` attributes to destination cards, then replace `app.js` wiring:
```js
import IntentTracker from '../lib/dist/intent-tracker.esm.js';

const tracker = IntentTracker.init({
  root: document.getElementById('destination-grid'),
  debug: true,
  onRecommendations: (recs) => renderRecommendations(recsSection, recs, handleCardClick),
});

// Wire search bar
initSearchBar(searchInput, (query) => {
  if (query.trim().length >= 2) tracker.trackSearch(query.trim());
});
```

Update `destination-grid.js` to render cards with data attributes:
```html
<div class="destination-card"
     data-ik-id="${dest.id}"
     data-ik-tags="${dest.tags.join(',')}"
     data-ik-group="${dest.region}"
     data-ik-name="${dest.name}"
     data-ik-price="${dest.priceTier}">
```

## Critical Files to Modify/Create

| File | Action |
|------|--------|
| `lib/src/catalog.js` | **New** — DOM scanner |
| `lib/src/event-collector.js` | **New** — adapted from `js/tracking/event-collector.js` |
| `lib/src/intent-summarizer.js` | **New** — adapted from `js/tracking/intent-summarizer.js` |
| `lib/src/intent-store.js` | **New** — adapted from `js/storage/intent-store.js` |
| `lib/src/recommendation-engine.js` | **New** — adapted from `js/recommendations/recommendation-engine.js` |
| `lib/src/debug-panel.js` | **New** — adapted from `js/ui/debug-panel.js` + `styles/debug-panel.css` |
| `lib/src/index.js` | **New** — orchestrator |
| `lib/build.js` | **New** — esbuild config |
| `lib/package.json` | **New** — minimal with esbuild |
| `js/ui/destination-grid.js` | **Modify** — add `data-ik-*` attributes to card HTML |
| `js/app.js` | **Modify** — replace wiring with IntentTracker.init() |

## Verification

1. `cd lib && npm install && npm run build` — produces dist files
2. Start Wanderlust dev server, verify:
   - Scroll through grid → view events appear in debug panel (views now enabled!)
   - Hover cards ≥1s → hover events tracked
   - Click cards → click events + modal opens
   - Search → search intents generated
   - Recommendations update after interactions
   - Refresh → returning visitor recs load from localStorage
3. Test dynamic content: add `[data-ik-id]` elements via JS console, confirm MutationObserver picks them up
4. Test IIFE build: create minimal standalone HTML page with `<script src="intent-tracker.js">` and a few annotated divs — confirm `window.IntentTracker` works end-to-end
