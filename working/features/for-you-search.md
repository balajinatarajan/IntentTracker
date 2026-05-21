# For You Search

**Status:** Proposal
**Scope:** Hackathon prototype on the Wanderlust mockup. Not production code.

## Context

A user has a destination in mind ("Paris", "the Caribbean") and wants Wanderlust's recommendations *for that destination* shaped by their intent profile. Where existing search is a literal text filter against names/regions/tags, **For You search** combines:

- An explicit destination filter (region, city, or theme)
- The user's accumulated cross-page intent profile (`tagWeights`)

…and returns a ranked list of items matching the destination filter, ordered by profile affinity.

This is feature #4 in the roadmap. It is the most independent of the four feature ideas — no dependency on the homepage tab, strip, or destination page.

## Proposal

A **For You search** surface (UI placement TBD — likely a section on the homepage or a separate `for-you-search.html`) that:

1. Lets the user pick a destination via a typeahead or curated dropdown, backed by the existing taxonomy in `js/utils/categories.js` (or extended with finer granularity).
2. Optionally adds filter constraints (date range, trip length — minimal scope for v1).
3. Calls the rec engine with `(catalog filtered by destination)` × `(profile.tagWeights)` → ranked results.
4. Renders results in a grid with a header explaining the personalization.

## How it works

`RecommendationEngine.recommend(profile, max)` scores `catalog.getAllItems()` against the profile. For this feature, two options:

- **A.** Filter the catalog by destination *before* calling `recommend` (compose a temporary catalog). Cleaner.
- **B.** Score against the full catalog and post-filter results. Worse — limits to N pre-filtered results.

Path A is the right call. Either pass a filter predicate to the engine (~10 LOC change in the dist) or feed it a pre-filtered manifest slice.

## Pros

- **Most independent feature.** No hard dep on tabs, strip, or destination page.
- **Combines explicit intent (search) with implicit intent (profile).** Most novel of the surfaces.
- **Natural demo story.** "I told the system I'm planning Paris; it knew I also like luxury and romantic from my browsing history; here are picks matching both."
- **Graceful cold-start fallback.** With no profile, results devolve into plain destination filter — which is just regular search. Doesn't fail, just doesn't personalize.
- **Edge-only.**

## Cons

- **Catalog filtering needs a destination taxonomy.** The existing `regions` map in `categories.js` is continent-level. City/country granularity may need new metadata on each item.
- **Cold-start tells a weaker story.** Until profile has signal, results don't differ from a plain filter, so the demo of this feature needs the persona seed loaded first.
- **Surface placement.** Adding a new search UI alongside the existing hero search may be confusing. Consider replacing existing search vs. adding a dedicated "Plan a trip" entry point.

## Prerequisites

1. **Destination taxonomy granularity decision.** Use existing `regions` from `categories.js`, or extend each item with `country` / `city` fields. Likely the latter for a richer demo.
2. **Rec-engine filter support.** Either accept a filter predicate, or accept a pre-filtered catalog slice.
3. **Persona seed** (see `persona-seed.md`) — needed to demo personalization vs. plain filter.
4. **UI placement decision.** Standalone page, hero variant, or new section on homepage?
5. **Result rendering.** Reuse `recommendation-section.js` or build a variant.

## Decisions still to make

- **Where does it live?** Standalone `for-you-search.html`, a section on `index.html`, or a variant of the existing hero search that activates when the user picks a destination?
- **Destination picker UX.** Typeahead text input vs. curated dropdown vs. region map.
- **What filters beyond destination?** Date range, price tier, trip length — or keep v1 to destination only?
- **Cold-start fallback copy.** Empty profile: plain results silently, or banner reading "We'll personalize this once we know more about you."

## Out of scope

- Booking-flow integration.
- Map-based search.
- Persistent saved searches.

## Verification (demo script)

1. Pick persona seed (e.g., "Romantic Luxury").
2. Open For You search. Pick "Paris" (or a region containing Paris) as the destination.
3. Results show items in Paris (or Europe) ranked by profile affinity — luxury suites and romantic boutiques surface first.
4. Clear data; refresh; pick Paris again. Results return to default (non-personalized) order.
5. Debug panel shows the rec engine scoring trace.

## Effort

~4–6 hours, depending on placement choice. Bulk: rec-engine filter support + UI surface. If the catalog manifest (feature 2) is in place, the filter step is trivial.

## Dependencies on other features

- **Can ship alone.** No hard deps on features 1/2/3.
- **Composes with the catalog manifest** if/when feature 2 ships — gives a larger universe to filter against.
- **Shares persona-seed.** Don't gate the surface on profile threshold — degrades gracefully to plain filter when profile is empty.
