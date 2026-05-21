# For You Strip — Cross-Vertical Inline Recommendations

**Status:** Proposal
**Scope:** Hackathon prototype on the Wanderlust mockup. Not production code.

## Context

Vertical pages today (`hotels.html`, `vacations.html`, `resorts.html`, `dining.html`) initialize `IntentTracker.create` with the cross-page profile, but **don't subscribe to `onRecommendations`** and **don't render a rec surface**. Even when a user has strong cross-vertical intent (e.g., "romantic + luxury" built from browsing hotels and resorts), nothing surfaces it on the current vertical page.

This feature adds an inline horizontal row on each vertical page that surfaces cross-vertical content matched to the user's profile — **without leaving the page**. It is the in-page counterpart to the homepage For You tab and the For You page: same engine, different surface.

## What's already built

- **`IntentTracker.create`** is initialized on every vertical page with the shared cross-page profile (`ik_profile`).
- **`tracker.recommend(N)`** returns items scored against `tagWeights`.
- **`onRecommendations` callback** is supported by the plugin; just not subscribed on vertical pages.

## What's missing

- **`onRecommendations` wiring** in each vertical page's bootstrap (4 pages).
- **A strip render component** (new `js/ui/for-you-strip.js`).
- **A `<section id="for-you-strip">` mount point** in each vertical page's HTML, below the hero.
- **Shared catalog manifest** so the rec engine has *items from other verticals* to score. Today the engine on `hotels.html` only sees hotels.
- **Cross-vertical card variant** with a "From {Vertical}" badge.

## Proposal

Add a For You strip to each vertical page:

- Horizontal row of 4–6 cards.
- Pulls items from *other* verticals (excludes the current page's `group`).
- Scored by `profile.tagWeights` via the existing engine.
- Sits below the page hero, above the main vertical grid.
- Each card shows a "From {Vertical}" badge.
- Gated on the same profile threshold as other surfaces — hidden when there's no signal.
- Optionally ends with a "See all your picks →" CTA to `for-you.html` (feature 3).

## How it works

The engine needs to see cross-vertical items. Two paths:

- **A. Hidden `<template>` injection.** Inject off-page items as hidden DOM nodes inside the page so `catalog.scanItems` picks them up naturally. Zero rec-engine changes; works with the existing dist.
- **B. Rec-engine extension.** Extend `RecommendationEngine.recommend` to accept an explicit catalog (the manifest) instead of only reading from `catalog.getAllItems()`. Cleaner architecturally; requires a lib rebuild.

Either way, the strip calls `tracker.recommend(N)` filtered to exclude the current page's `group`, then renders.

## Pros

- **In-page surfacing.** No navigation required — cross-vertical content reaches users mid-flow.
- **Concrete cross-vertical proof.** On `hotels.html`, the audience literally sees resort and dining cards in a labeled strip — they don't have to imagine cross-vertical surfacing.
- **Composable.** Same manifest as the For You page; same engine as the homepage tab.
- **Main grid is unaffected.** The vertical's own catalog stays in its native order; the strip is a clean additive surface.
- **Edge-only.**

## Cons

- **Adds a row above the main grid.** Competes for scroll attention; needs careful styling.
- **Cold-start dead space.** Hidden until profile signal exists.
- **Cross-vertical card design effort.** "From X" badges + a variant of the card chrome.
- **Click destination ambiguity.** Click a resort card on hotels.html — open modal in place, or navigate to resorts.html? Decision needed.
- **Possible overlap with the homepage For You tab and the For You page.** All three surfaces tell the same story; intentional redundancy for the demo but worth being deliberate about.
- **Path A (template injection) inflates page DOM.** Path B (rec-engine extension) is cleaner but costs a lib rebuild.

## Prerequisites

1. **Shared catalog manifest** (`js/data/catalog-manifest.js`). Single JS module listing every trackable item across verticals with `id`, `name`, `image`, `tags`, `group`, `priceTier`, `vertical`, and a deep-link URL. *Shared with the For You page (feature 3) — build once.*
2. **Implementation choice: template-injection vs rec-engine extension.** Decide before building.
3. **Profile-threshold rule.** Shared with other features.
4. **Persona seed** (see `persona-seed.md`).
5. **Cross-vertical card variant.** CSS + small JS variant of the existing card.
6. **Click-destination rule.** In-place modal vs. navigate-to-source.

## Decisions still to make

- **Placement.** Below hero (high visibility, can feel intrusive) vs. below main grid (low intrusion, low attention). Lean: below hero.
- **Filter rule.** Strict exclude-current-group vs. allow current-group if it outscores. Strict is cleaner.
- **Card count.** 4 vs 6. Lean: 4 with horizontal scroll for overflow.
- **Click behavior.** Modal vs. navigate. Navigate is more honest about cross-vertical; modal is less disruptive mid-demo.
- **CTA at strip end.** Include only if For You page (feature 3) also exists.

## Out of scope

- Personalizing the main grid on the current vertical.
- A sidebar variant of the strip.
- Mixing in current-vertical items.

## Verification (demo script)

1. Clear profile / pick a persona seed (e.g., "Romantic Luxury").
2. Visit `hotels.html`. Browse 2–3 boutique/luxury hotels.
3. Strip appears below the hero, populated with non-hotel items (resort suites, dining, vacation packages) tagged "romantic" and/or "luxury".
4. Each card has a "From {Vertical}" badge.
5. Open debug panel; tags on strip items align with top `tagWeights`.
6. Clear data; refresh; strip is hidden (cold-start gating works).
7. If CTA enabled: click "See all your picks →" → lands on `for-you.html` with dominant tab pre-selected.

## Effort

~4–8 hours. Longest piece is the shared catalog manifest (~1–2h building it, ~1h consistency-checking against the existing `data-ik-*` attributes on each page). Strip render is small (~80 LOC). Card variant + each page's bootstrap edit is ~30 min × 4 pages.

## Dependencies on other features

- **Shares the catalog manifest with the For You page** (feature 3). Build once, consume in both.
- **Shares the profile-threshold rule and persona-seed mechanism** with all other features.
- **Independent of the homepage For You tab.** Strip can ship without the tab and vice versa.
