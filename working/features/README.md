# Working Features

Hackathon feature roadmap for cross-page intent surfacing on the Wanderlust mockup. All proposals.

## Features (priority order)

1. **[homepage-for-you-tab.md](homepage-for-you-tab.md)** — base case. A For You tab on `index.html` populated by cross-page intent. Most plumbing already exists; needs one UI module (`tabbed-grid.js`) and an `index.html` edit. **Effort: ~2–4h.**
2. **[for-you-strip.md](for-you-strip.md)** — inline cross-vertical strip on hotels/vacations/resorts/dining. Engine wiring already on each page; needs a render component + the shared catalog manifest. **Effort: ~4–8h.**
3. **[for-you-page.md](for-you-page.md)** — themed-tab destination (`for-you.html`) with a journey pill on vertical pages driving traffic to it. Reuses tabbed-grid + manifest. **Effort: ~3–5h.** Hard deps on features 1 and 2.
4. **[for-you-search.md](for-you-search.md)** — user picks a destination; engine returns destination-filtered results ranked by intent profile. Most independent feature. **Effort: ~4–6h.**

## Prerequisites

- **[persona-seed.md](persona-seed.md)** — cross-cutting demo enabler. Synthesizes a fake journey on one click so every For You surface is demo-visible from a clean state. Build early. **Effort: ~1–2h.**

## Shared infrastructure (referenced across features)

- **Shared catalog manifest** (`js/data/catalog-manifest.js`) — needed by features 2 and 3. Lists every trackable item across verticals. ~1–2h to build.
- **Profile-threshold rule** — single numeric gate used by all gated surfaces. Calibrate against persona seed.

## Recommended build sequence

1. **persona-seed** (~1–2h) — unlocks demoability of everything else.
2. **homepage-for-you-tab** (~2–4h) — base case; ships `tabbed-grid.js` for reuse.
3. **for-you-strip** (~4–8h) — builds the catalog manifest; reuses persona seed.
4. **for-you-page** (~3–5h) — reuses tabbed-grid + manifest.
5. **for-you-search** (~4–6h) — slots in anywhere after persona-seed; no hard deps.

Total rough budget: ~15–25h.

## Already in the repo (don't rebuild)

- `lib/dist/intent-tracker.js` — cross-page profile, journey graph, `recommend(N)`, `predictNext(N)`, `onRecommendations` callback.
- `js/app2.js` — orphaned but written; the intended homepage bootstrap that feature 1 wires up.
- Vertical pages already initialize `IntentTracker.create` with cross-page profile — just don't subscribe to `onRecommendations` yet.
