# For You Destination Page

**Status:** Proposal
**Scope:** Hackathon prototype on the Wanderlust mockup. Not production code.

## Context

The homepage For You tab (feature 1) shows cross-page items in a single ranked list. This feature extends that with a **dedicated destination page (`for-you.html`)** organized by **themed tabs** (Beaches, Romantic, Urban, Adventure, Budget, Luxury), each containing items scored against the profile within that theme. A **journey pill** on vertical pages drives traffic to this page.

This is feature #3 in the roadmap. It depends on the homepage For You tab (feature 1) for the `tabbed-grid.js` module and on the catalog manifest (shared with the strip, feature 2).

## Proposal

Two coupled additions:

1. **For You page (`for-you.html`)** — themed tabs (Beaches, Romantic, Urban, Adventure, Budget, Luxury). Each tab's contents are personalized using `tagWeights`. The tab order itself can be personalized (top-affinity tab opens first). A header explains the reasoning ("Based on your recent browsing — beaches, luxury").
2. **Journey pill on vertical pages** — appears on hotels/vacations/resorts/dining (never on `index.html`). Links to `for-you.html?tab=<dominantTag>`. Gated on profile threshold.

The pill and page are bundled because the pill exists specifically to drive traffic to the page.

## How it works

- `for-you.html` reuses `js/ui/tabbed-grid.js` (built for feature 1) configured for theme tabs instead of Popular/For You.
- Each theme tab is a catalog slice (e.g., items where tags include "beach") scored against the profile.
- The catalog manifest provides cross-vertical items per theme.
- The pill on vertical pages reads `tracker.getProfile().tagWeights`, picks the top non-current-page tag, renders `<a href="for-you.html?tab=<tag>">`.

## Pros

- **Themed exploration surface** beyond the homepage's flat For You list.
- **Strong demo story.** Pill on hotels.html → "Beach picks for you" → For You page with Beaches tab pre-selected and personalized.
- **No surprise UX.** Personalization is a destination, not a mode toggle. Back button works correctly.
- **Reuses infrastructure.** `tabbed-grid.js` from feature 1, manifest from feature 2.
- **Respects the booking funnel.** Pill only off-homepage; routes users to a richer brand destination rather than sideways into another vertical mid-funnel.

## Cons

- **Layered dependencies.** Depends on feature 1 (tabbed-grid) and feature 2 (manifest). Can't ship before both.
- **Cold-start dead time.** Pill hidden until profile crosses threshold. Mitigated by persona seed.
- **Empty-tab risk.** "Beach" theme tab needs ≥5 beach items across verticals or it looks thin.
- **Tab-order personalization is subtle.** Audience may not notice without prompting. Optional polish.

## Prerequisites

1. **Homepage For You tab built first** (feature 1) — provides `tabbed-grid.js`.
2. **Shared catalog manifest** (feature 2 also uses this) — provides cross-vertical items per theme.
3. **Theme taxonomy decision.** Fix the set of theme tabs and map each to taxonomy tags. ≥5 items per theme across verticals.
4. **Profile-threshold rule.** Concrete numeric gate for the pill. Starting proposal: ≥3 distinct non-`price:*` tags with weight ≥ 1.0.
5. **Persona seed** (see `persona-seed.md`).
6. **Hash/query routing on `for-you.html`.** Read `?tab=X`, pre-activate, scroll into view.

## Decisions still to make

- **Pill copy.** Theme-specific ("Beach picks for you →") vs. generic ("Made for you →"). Theme-specific is more compelling but couples the pill to the destination tab.
- **Personalize tab order on For You, or only contents within tabs?** Lean: contents only for v1; tab-order in v1.5.
- **"You got here because…" header on For You.** Include in v1. ~5 LOC.
- **Profile-threshold concrete numbers.** Calibrate against persona seed.
- **Pill placement.** Inside `.nav-links`, as a sibling, or floating below the nav?

## Out of scope (rejected during design)

- **In-place reshuffling inside a tab when the user engages.** Moving-target antipattern.
- **`?personalized=true` URL flag flipping mid-page-session.** Demo theater dressed up as UX.
- **Back-button-as-undo-toggle.** Misuses the back button.
- **Personalizing the homepage itself.** Homepage stays brand-owned static; the For You tab (feature 1) is the personalized surface there.

## Verification (demo script)

1. Clear profile / pick persona seed.
2. Visit `hotels.html`; browse 3 beach-tagged hotels.
3. Pill appears in nav: "Beach picks for you →".
4. Click pill → land on `for-you.html?tab=beaches`. Verify:
   - Beaches tab active and reordered by profile.
   - Header reads something like *"Based on your recent browsing — beach, luxury."*
5. Hit back → return to `hotels.html` cleanly.
6. Debug panel shows `tagWeights` driving the order.

## Effort

~3–5 hours, assuming features 1 and 2 are already built. Mostly: `for-you.html` shell, `tabbed-grid.js` reuse with theme-tab config, pill component, hash routing.

## Dependencies on other features

- **Hard dep on feature 1** (homepage For You tab) — reuses `tabbed-grid.js`.
- **Hard dep on feature 2** (strip) — shares the catalog manifest. If features 2 and 3 might ship in either order, split the manifest into its own prereq ticket.
- **Shares profile-threshold and persona-seed mechanisms.**
