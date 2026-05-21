# IntentTracker User Guide

A zero-config, drop-in JavaScript library (34KB) that tracks user intent from DOM interactions and builds real-time profiles and recommendations — entirely client-side, no backend required.

---

## Quick Start

### 1. Add the script

```html
<script src="intent-tracker.js"></script>
```

### 2. Annotate your content

```html
<div data-ik-id="product-123"
     data-ik-tags="electronics, wireless, noise-cancelling"
     data-ik-group="audio"
     data-ik-name="Sony WH-1000XM5"
     data-ik-price="premium">
  <!-- your content here -->
</div>
```

### 3. Initialize

```html
<script>
  const tracker = IntentTracker.create({ debug: true });
</script>
```

That's it. The plugin auto-discovers all annotated elements, tracks user interactions, and builds a profile in real time.

---

## Data Attributes

Annotate any HTML element with these attributes to make it trackable:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-ik-id` | Yes | Unique identifier for the item |
| `data-ik-tags` | No | Comma-separated tags (core of intent detection) |
| `data-ik-group` | No | Category/group for diversity filtering in recommendations |
| `data-ik-name` | No | Human-readable name (used in comparison intents and debug panel) |
| `data-ik-price` | No | Price tier (auto-added to tags as `price:{value}`) |

### Example: E-commerce

```html
<div data-ik-id="shoe-1"
     data-ik-tags="running, nike, lightweight"
     data-ik-group="shoes"
     data-ik-name="Nike Air Zoom"
     data-ik-price="mid">
  ...
</div>
```

### Example: Content site

```html
<article data-ik-id="post-42"
         data-ik-tags="javascript, react, tutorial"
         data-ik-group="frontend"
         data-ik-name="Building Custom Hooks">
  ...
</article>
```

### Example: Job board

```html
<div data-ik-id="job-789"
     data-ik-tags="remote, senior, python, backend"
     data-ik-group="engineering"
     data-ik-name="Senior Backend Engineer">
  ...
</div>
```

---

## Using Existing Attributes

If your site already has `data-` attributes, map them instead of adding new ones:

```js
const tracker = IntentTracker.create({
  attributes: {
    id:    'data-product-id',
    tags:  'data-categories',
    group: 'data-department',
    name:  'data-product-name',
    price: 'data-price-tier',
  }
});
```

Your existing HTML works unchanged:

```html
<div data-product-id="SKU-456"
     data-categories="running, nike, lightweight"
     data-department="shoes"
     data-product-name="Nike Air Zoom">
  ...
</div>
```

When both a mapped attribute and a `data-ik-*` attribute exist on the same element, the `data-ik-*` attribute takes precedence.

---

## Configuration

All options are optional:

```js
const tracker = IntentTracker.create({
  // Map existing data attributes to IntentTracker's schema
  attributes: {},

  // localStorage key for profile persistence (default: 'ik_profile')
  storageKey: 'my_site',

  // Milliseconds between intent recalculations (default: 5000)
  flushInterval: 5000,

  // Show the debug panel (default: false)
  debug: true,

  // Scope observation to a container (default: document.body)
  root: document.getElementById('products'),

  // Called when intents are detected or updated
  onIntentsChanged: (intents, profile) => {
    console.log('Intents:', intents);
    console.log('Profile:', profile);
  },

  // Called when recommendations are generated
  onRecommendations: (recs) => {
    renderMyRecommendations(recs);
  },
});
```

---

## API Reference

### `IntentTracker.create(options)`

Creates a new tracker instance. Auto-scans the DOM for annotated elements and begins tracking.

### `tracker.trackClick(itemId)`

Manually record a click event. Use this for custom click handlers where the built-in click listener doesn't apply (e.g., clicking a "Learn More" button that references an item).

```js
document.getElementById('buy-btn').addEventListener('click', () => {
  tracker.trackClick('product-123');
});
```

### `tracker.trackSearch(query)`

Record a search event. Wire this to your search input:

```js
searchInput.addEventListener('input', (e) => {
  if (e.target.value.trim().length >= 2) {
    tracker.trackSearch(e.target.value.trim());
  }
});
```

### `tracker.recommend(maxResults?)`

Get recommendations on demand. Returns an array of scored items:

```js
const recs = tracker.recommend(6);
// [
//   {
//     itemId: 'product-1',
//     item: { id, name, tags, group, element },
//     score: 4.86,
//     reason: 'Based on your interest in electronics',
//     matchedTags: ['electronics', 'premium', 'laptop']
//   },
//   ...
// ]
```

### `tracker.getProfile()`

Get the current user profile:

```js
const profile = tracker.getProfile();
// {
//   userId: 'user-a1b2c3d4',
//   sessions: [...],
//   tagWeights: { electronics: 3.91, laptop: 1.70, ... }
// }
```

### `tracker.getIntents()`

Get the current session's detected intents:

```js
const intents = tracker.getIntents();
// [
//   {
//     id: 'intent-x7k2m9',
//     summary: 'Interested in computers — electronics',
//     tags: ['computers', 'electronics'],
//     confidence: 1.0,
//     category: 'group_interest',
//     sourceEventCount: 13
//   },
//   ...
// ]
```

### `tracker.scan()`

Re-scan the DOM for new `data-ik-*` elements. Useful after manual DOM updates. Note: a `MutationObserver` handles most dynamic content automatically.

### `tracker.clear()`

Reset the user profile and clear localStorage. Removes all session history, intents, and tag weights.

### `tracker.destroy()`

Clean up all observers, listeners, timers, and the debug panel. Call this when removing the tracker from a SPA page.

---

## How Tracking Works

### Signal Types

The plugin tracks four types of user signals:

| Signal | How | Threshold | Weight |
|--------|-----|-----------|--------|
| **View** | IntersectionObserver (50% visible) | 800ms minimum | 1x |
| **Hover** | mouseenter / mouseleave | 1000ms minimum | 2x |
| **Click** | click event on element | Immediate | 3x |
| **Search** | Manual `trackSearch()` call | None | 0.9 confidence |

### Recency

Recent events matter more. Each event gets a recency multiplier from 0.5 (oldest in session) to 1.0 (newest).

### Frequency Bonus

Items with 2+ interactions (clicks or hovers) get a logarithmic bonus: `log2(count)`. This rewards repeat interest without letting it dominate.

### Dynamic Content

A `MutationObserver` watches for new elements added to the DOM. When items appear via AJAX, infinite scroll, or SPA navigation, they're automatically discovered and tracked.

---

## Intent Detection

The plugin detects six types of user intent:

### Group Interest
When a user interacts with 3+ items in the same group.
> "Interested in computers — electronics"

### Tag Affinity
When one tag accounts for 35%+ of all tag events.
> "Interested in laptop"

### Price Preference
When one price tier accounts for 50%+ of price-related events.
> "Looking for premium options"

### Search Intent
From explicit search queries via `trackSearch()`.
> "Searched for 'gaming laptop'"

### Comparison
When a user clicks 2-3 distinct items (decision-making signal).
> "Comparing MacBook Pro and Razer Blade"

### Hover Interest
When a user hovers 2+ items in the same group without clicking (passive browsing signal).
> "Considering electronics options in computers"

Each intent has a **confidence score** (0-100%) based on the strength of the signal.

---

## Profiles and Recommendations

### Cross-Session Persistence

Profiles persist in `localStorage` across page loads and sessions. Each session's intents are stored separately with a temporal decay:

- Current session: full weight (1.0x)
- 1 session ago: 0.8x
- 2 sessions ago: 0.64x
- 3 sessions ago: 0.51x

This lets user interests evolve naturally — recent behavior is weighted more, but long-term preferences still contribute.

### Recommendation Scoring

Each item is scored by summing its matched tag weights, normalized by the square root of its tag count (to avoid bias toward items with many tags):

```
score = sum(tagWeights[tag] for each matching tag) / sqrt(tagCount)
```

A **diversity filter** ensures no more than 3 items from the same group appear in recommendations.

### Returning Visitors

When a user returns to the site, the plugin loads their existing profile from `localStorage` and immediately fires `onRecommendations` — no interaction needed.

---

## Debug Panel

Enable with `debug: true`. A gear icon appears in the bottom-right corner.

### Tabs

1. **Events** — Live stream of tracked events (last 100) with type, item ID, dwell time, and timestamp
2. **Intents** — Current intents sorted by active/inactive then confidence. Active intents have colored borders; faded intents are dimmed
3. **Profile** — Session count and tag weight bars showing relative strength
4. **Recs** — Current recommendations with scores, match reasons, and matched tags

### Clear All Data

The "Clear All Data" button resets the profile, event buffer, and localStorage — useful during development and testing.

---

## Integration Examples

### Vanilla JavaScript

```html
<script src="intent-tracker.js"></script>
<script>
  const tracker = IntentTracker.create({
    debug: true,
    onRecommendations: (recs) => {
      const container = document.getElementById('recs');
      container.innerHTML = recs.map(r =>
        `<div>${r.item.name} — ${r.reason} (${r.score})</div>`
      ).join('');
    }
  });
</script>
```

### ES Module Import

```js
import { create } from './intent-tracker.esm.js';

const tracker = create({
  root: document.getElementById('product-grid'),
  onIntentsChanged: (intents, profile) => {
    updateAnalytics(intents);
  }
});
```

### SPA / React

```jsx
import { create } from 'intent-tracker';
import { useEffect, useRef } from 'react';

function ProductGrid({ products }) {
  const trackerRef = useRef(null);

  useEffect(() => {
    trackerRef.current = create({
      root: document.getElementById('grid'),
      onRecommendations: setRecs,
    });
    return () => trackerRef.current.destroy();
  }, []);

  // After rendering new products, scan for new elements
  useEffect(() => {
    trackerRef.current?.scan();
  }, [products]);

  return (
    <div id="grid">
      {products.map(p => (
        <div key={p.id}
             data-ik-id={p.id}
             data-ik-tags={p.tags.join(',')}
             data-ik-group={p.category}>
          {p.name}
        </div>
      ))}
    </div>
  );
}
```

### Using Existing Attributes (No HTML Changes)

```js
// Your site already has data-product-id, data-categories, etc.
const tracker = IntentTracker.create({
  attributes: {
    id: 'data-product-id',
    tags: 'data-categories',
    group: 'data-department',
  },
  onRecommendations: (recs) => {
    // recs[].item contains the original element reference
    highlightRecommended(recs.map(r => r.item.element));
  }
});
```

---

## Build from Source

```bash
cd lib
npm install
npm run build
```

Produces:
- `dist/intent-tracker.js` — IIFE build for `<script>` tags (exposes `window.IntentTracker`)
- `dist/intent-tracker.esm.js` — ES module build for `import`

---

## Architecture

```
User Interaction
       |
  Event Collector  ──  view (IntersectionObserver)
       |                hover (mouseenter/leave)
       |                click (click listener)
       |                search (manual API)
       |
  [5s flush interval]
       |
  Intent Summarizer  ──  weighted tag counting
       |                   recency multiplier
       |                   frequency bonus
       |                   pattern detection
       |                   deduplication
       |
  Intent Store  ──  session management
       |             temporal decay (0.8x per session)
       |             tag weight computation
       |             localStorage persistence
       |
  Recommendation Engine  ──  tag-weight scoring
       |                      sqrt normalization
       |                      diversity filtering
       |
  Callbacks  ──  onIntentsChanged(intents, profile)
                  onRecommendations(recs)
```

All computation runs in the browser. No data leaves the client. Zero dependencies.
