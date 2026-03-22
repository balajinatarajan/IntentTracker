# Prompt: Clone "Context Tracking at Edge" for a New Industry Vertical

> Copy everything below this line and paste it into a new Claude conversation, filling in `[YOUR INDUSTRY HERE]` and `[FILL IN]` at the end.

---

I have an existing client-side prototype called **Wanderlust** — a travel recommendation app that uses **intent-based context tracking at the edge** (zero backend, all computation in the browser). I want to recreate the same architecture and documentation pattern for **[YOUR INDUSTRY HERE]** (e.g., e-commerce, real estate, job board, restaurant discovery, online learning, etc.).

Here's exactly how the original system works. Replicate this pattern with domain-appropriate data:

---

## 1. Core Architecture (Client-Side Only)

**Event Tracking → Intent Summarization → Profile Construction → Recommendations**

Everything runs in the browser using vanilla JS (ES modules), localStorage for persistence, and no frameworks or backend.

---

## 2. Data Model

Create a catalog of **24 items** (destinations in the original; adapt to your domain — e.g., products, listings, courses, restaurants). Each item has:

- `id`, `name`, `image` (use placeholder URLs or emoji)
- **Category fields** that map to your domain's taxonomy (original had: `region`, `country`, `priceTier`, `tripTypes[]`, `tags[]`)
- `shortDesc`, `fullDesc`, `highlights[]`
- A numeric field like `price` with tier bucketing

**Tag Taxonomy** — define 4 category groups with ~3–10 values each:
- Group 1: **Location/Region** (e.g., regions, neighborhoods, departments)
- Group 2: **Type/Style** (e.g., trip types → product categories, cuisine types, skill levels)
- Group 3: **Price/Tier** (e.g., budget/mid/premium with numeric thresholds)
- Group 4: **Activity/Feature Tags** (e.g., beach/city/nature → features, amenities, topics)

Each taxonomy value needs a `keywords[]` array for fuzzy search matching (e.g., "romantic" matches ["romantic", "honeymoon", "couples", "anniversary"]).

---

## 3. Event Tracking System

Track these user interactions on the catalog grid:

| Event | Trigger | Weight |
|-------|---------|--------|
| **Click** | User clicks an item card | 3× |
| **Hover** | Mouse dwells on card ≥ 1 second | 2× |
| **Search** | User types ≥ 2 chars in search bar (debounced) | Tagged (maps query → taxonomy via keyword matching) |
| View | Card appears in viewport | **Disabled** (too noisy) |

**Event buffer**: Queue events in memory, flush every 5 seconds + on `beforeunload`.

---

## 4. Intent Summarization Pipeline

`IntentSummarizer.summarize(events)` processes the event buffer:

- **Base weight**: click = 3 (2 for secondary tags), hover = 2 (1.5 for secondary), view = 1
- **Recency multiplier**: `0.5 + 0.5 × (eventTime - sessionStart) / sessionSpan` → newer events count more (0.5× to 1.0×)
- **Frequency bonus**: `log₂(n)` for repeat interactions with the same item (5 clicks → +2.32 bonus)
- **Output**: Weighted counts for each taxonomy dimension — `regionCounts`, `typeCounts`, `tierCounts`, `tagCounts`, plus `clickedIds[]`, `hoveredIds[]`, `searchQueries[]`
- **Hover clustering**: Group multiple hovers in the same category as a "browsing cluster" signal

---

## 5. Profile Construction

`IntentStore` manages the persistent user profile in `localStorage`:

- Merge new intent summaries additively into the stored profile
- **Cross-session decay**: Apply 0.8× multiplier to all existing scores when a new session starts
- Profile is a flat object of `{ tagName: weightedScore }` pairs

---

## 6. Recommendation Engine

`RecommendationEngine.getRecommendations(profile, catalog)`:

- Score each catalog item by summing the user's profile weight for each of the item's tags
- Apply frequency bonuses for previously clicked/hovered items
- Sort by score descending, return top N with score and reasoning
- Display in a "Recommended for You" section (hidden for first-time visitors with no profile)

---

## 7. UI Components

Build these with vanilla HTML/CSS/JS:

- **Hero section** with search bar (icon + input + autocomplete off)
- **Card grid** showing all catalog items (image, name, category badge, price, tags)
- **Detail modal** (click a card → full info overlay)
- **Debug panel** (gear icon FAB → slide-out panel with 4 tabs: Events, Intents, Profile, Recs) — this is critical for demonstrating the system
- **Recommendations section** (appears after user builds a profile)

**Design system**: Light theme, `DM Sans` font from Google Fonts, accent color `#ff8d6b`, background `#f7f7f8`, white cards with subtle shadows, 12px border radius.

---

## 8. Documentation Assets (Create These Too)

### `use-case-flows.html` — Single-file interactive HTML
- 5 tabbed persona-based scenarios showing the full pipeline
- Each scenario: persona description → event badges (color-coded by type) → intent pills with confidence % → animated profile bars → recommendation cards with scores and reasons → insight box
- For multi-session scenarios, show session separators with "0.8× decay" badges
- Staggered CSS animations for each pipeline stage
- Same light theme with dark gradient header

### `content-catalog.html` — Single-file interactive HTML
- Tab 1: **Sortable/filterable table** of all 24 items with region badges, tier badges, type badges, tag pills
- Tab 2: **Tag Taxonomy** — 4 category group cards with mini bar charts showing item coverage per tag + keyword lists
- Tab 3: **Cross-reference matrix** — Category Group 1 × Category Group 2 with heat-mapped cells (darker = more items) and row/column totals
- Tab 4: **Dot-matrix heatmap** — Tags × Items with filled/empty dots and count totals
- All 24 items embedded as inline JS data

### `index.html` — Landing page
- Simple centered card layout linking to the two documentation pages
- "All computation runs client-side — zero backend required" footer

---

## 9. File Structure

```
/
├── index.html              ← Main app
├── use-case-flows.html     ← Documentation: use case flows
├── content-catalog.html    ← Documentation: content catalog
├── styles/
│   ├── main.css
│   ├── cards.css
│   ├── modal.css
│   ├── recommendations.css
│   └── debug-panel.css
└── js/
    ├── app.js              ← Main orchestrator (ES module)
    ├── data/
    │   └── destinations.js ← Catalog data (rename per domain)
    ├── components/
    │   ├── destination-grid.js
    │   ├── detail-modal.js
    │   ├── search-bar.js
    │   ├── debug-panel.js
    │   └── recommendation-section.js
    ├── tracking/
    │   ├── event-collector.js
    │   └── intent-summarizer.js
    └── utils/
        ├── categories.js   ← Tag taxonomy + keyword matching
        ├── intent-store.js ← localStorage profile manager
        └── recommendation-engine.js
```

---

**My target vertical is: [FILL IN]**

Please start by proposing the domain-specific data model (what are the 24 items, what are the 4 taxonomy groups, what tags and keywords map to each), then build out the full prototype following the architecture above.
