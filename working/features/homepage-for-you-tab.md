# Homepage For You Tab

**Status:** Proposal · base case
**Scope:** Hackathon prototype on the Wanderlust mockup. Not production code.

## Context

The original spec's principle — *"cross-page events surface on the current page"* — is most directly delivered by populating a **For You tab on the homepage** with items scored against the cross-page intent profile. This is the base case and the literal answer to the spec.

Most of the wiring already exists in the repo.

## What's already built

- **`lib/dist/intent-tracker.js`** plugin with cross-page profile via shared `localStorage` keys (`ik_profile`, `ik_journey`). `tracker.recommend(N)` already returns items scored against `tagWeights` accumulated across every page the user has visited.
- **`onRecommendations` callback** in the plugin contract — fires on every flush and on init for returning visitors.
- **`js/app2.js`** — the intended next-gen homepage bootstrap. Uses the plugin, maps recs back to full destination objects via `destMap`, calls `showForYouTab(mapped)`. Already written. Currently orphaned because `index.html` still loads the old `js/app.js` and the UI module that `app2.js` imports doesn't exist yet.

## What's missing

- **`js/ui/tabbed-grid.js`** — referenced by `app2.js` as `initTabs`, `showForYouTab`, `setSearchFilter` but the file doesn't exist. This is the only substantial new code.
- **`index.html` updates** — swap `<script type="module" src="js/app.js">` for the dist + `app2.js`, add a `<div id="tab-bar">` mount point. (Optionally add `<div id="continue-search-section">` for the journey-prediction UI that `app2.js` imports but has commented out.)
- **Decision: what tabs?** Minimum is *Popular* (current default grid) and *For You*. Possibly an *Explore* placeholder for future themed tabs.

## Proposal

A tabbed grid on `index.html`:

- **Popular** — the current Popular Destinations grid. Default tab. Static / curated.
- **For You** — populated by the `onRecommendations` callback from the plugin. Cards rendered by reusing `recommendation-section.js` layout or a thin variant.

Tab gating:

- **For You tab hidden until profile has signal.** First-time visitors only see Popular. Once any cross-page activity crosses the threshold, the For You tab appears.
- **No auto-switch.** Let the user notice the tab. Auto-switching is the "moving target" UX pattern we rejected earlier. A subtle "new" indicator on the tab is fine.

## How it works

```
[ User visits hotels.html, clicks 3 luxury hotels ]
       ↓
[ Plugin updates ik_profile.tagWeights cross-page ]
       ↓
[ User returns to index.html ]
       ↓
[ IntentTracker.create fires onRecommendations on init for returning visitor ]
       ↓
[ app2.js calls showForYouTab(mapped) ]
       ↓
[ tabbed-grid.js reveals the For You tab + renders cards ]
```

## Pros

- **Highest leverage for least new code.** Engine, plugin, profile, and bootstrap are all there. Effort is one UI module + a small HTML edit.
- **Literal answer to the spec.** Cross-page events surfacing on the current page (homepage), exactly as described.
- **Returning-visitor fast path already works.** The plugin fires `onRecommendations` on init when a profile exists — so the For You tab populates immediately on page load, no waiting for new events.
- **Unlocks downstream features.** `tabbed-grid.js` is reusable by the For You page (feature 3). No catalog-manifest dependency here.

## Cons

- **Switching `index.html` from `app.js` to `app2.js`** means the search path changes (goes through `setSearchFilter` on `tabbed-grid.js` instead of the old `destination-grid.js` filter). Modal + debug-panel wiring survive because `app2.js` already imports them.
- **Cold start.** New visitors see no For You tab. Solved by the persona-seed prereq.
- **Tab choice is a commit.** Just Popular + For You is simplest; Explore later. Decide before building.

## Prerequisites

1. **`js/ui/tabbed-grid.js`** — new module. Must export `initTabs(tabBarEl, gridContainer, destinations, onCardClick)`, `showForYouTab(recs)`, `setSearchFilter(query)` matching the API `app2.js` already calls.
2. **`index.html` markup updates** — script tag swap, `<div id="tab-bar">`.
3. **Persona seed** (see `persona-seed.md`) — demo enabler.
4. **Decision: cold-start behavior.** Hide For You tab until signal vs. show always with empty-state copy. Lean: hide.

## Decisions still to make

- **Tab set for v1.** Popular + For You only? Add Explore placeholder?
- **For You tab — show always with empty state, or hide until signal?** Lean: hide.
- **Card layout in For You tab.** Reuse `recommendation-section.js` markup, or match the Popular grid card layout? Lean: match Popular for visual consistency; the tab header explains *why* these were chosen.
- **Journey predictions UI** (`continue-search-section`). Build now or defer? Lean: defer to v1.5.

## Out of scope

- Themed tabs on the homepage (Beaches, Romantic, etc.) — that's the For You page (feature 3).
- For You strip on vertical pages — separate feature.
- Personalizing the Popular tab order. Stays curated.

## Verification (demo script)

1. Clear all data (`localStorage.clear()`). Visit `index.html`. Only Popular tab visible.
2. Trigger persona seed ("Demo: Luxury Beach" button). Profile populates.
3. Refresh `index.html`. For You tab now visible. Click it. Cards reflect the seeded persona's tags.
4. Visit `hotels.html`; click a few budget hotels for ~10s each.
5. Return to `index.html`. For You tab updates to reflect new affinity (budget items mix in).
6. Open debug panel; show `tagWeights` driving the For You order.

## Effort

~2–4 hours. The bulk is `tabbed-grid.js` (~150–200 LOC: tab UI, render, search filter pass-through). HTML edits are ~10 LOC.

## Dependencies on other features

- **No hard deps.** Foundational feature.
- **Soft dep on persona-seed** for demo readiness — build that first.
- **Unblocks** `tabbed-grid.js` reuse by feature 3 (for-you-page).
