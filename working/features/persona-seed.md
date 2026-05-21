# Persona Seed — Demo Enabler (Prereq)

**Status:** Proposal · cross-cutting prerequisite
**Scope:** Hackathon prototype on the Wanderlust mockup. Demo enabler.

## Context

Most of the For You features (homepage tab, strip, destination page, journey pill, search) are **gated on profile signal**. A brand-new visitor with no `tagWeights` sees:

- No For You tab on the homepage (hidden until signal).
- No strip on vertical pages (hidden until signal).
- No journey pill (hidden until signal).
- No personalization on the destination page or in search (empty/fallback state).

For a live demo this is fine in principle, but bad in practice — you don't want to spend the first two minutes of a hackathon presentation manually clicking through cards to seed the profile while the audience watches.

**Persona seed** is a small mechanism to populate a meaningful `ik_profile` with one click, so every other feature is demo-visible from a clean state.

## Proposal

A small UI control (button group or select) on `index.html` (or in the debug panel) that loads one of several pre-defined personas:

- **Luxury Beach** — weights on `beach`, `luxury`, `tropical`, `relaxing`.
- **Urban Foodie** — weights on `urban`, `food`, `dining`, `nightlife`.
- **Adventure Budget** — weights on `adventure`, `nature`, `budget`, `solo`.
- **Romantic Boutique** — weights on `romantic`, `boutique`, `luxury`, `couples`.

Clicking a persona:

1. Clears the existing profile (`localStorage.removeItem('ik_profile')` + `removeItem('ik_journey')`).
2. Synthesizes a journey by calling `tracker.trackPageView(...)`, `tracker.trackClick(...)`, and `tracker.trackSearch(...)` against a scripted sequence of items matching the persona.
3. Waits for the flush pipeline to run (one tick).
4. Reloads — or fires `onRecommendations` callbacks directly — so every surface picks up the new profile.

## How it works

- New module: `js/dev/persona-seed.js`.
- Exports `seedPersona(name)` and `getAvailablePersonas()`.
- Each persona is `{ name, label, journey: [{ page, itemId, action }, …] }`.
- UI: persona buttons next to the search bar on `index.html`, or as a debug-panel section. Optionally hidden behind `?dev=1` for cleanliness in non-demo mode.

## Pros

- **One-click demo setup.** Click "Luxury Beach", watch every For You surface populate.
- **Reproducible demos.** Same persona = same profile = same surfaces every time. No "well, it doesn't always look like this" disclaimers.
- **Teachable.** Switching personas live shows the audience how every surface reacts to different profiles — strongest single demo move available.
- **Useful for development.** Faster than manual clicking when iterating on features.

## Cons

- **Demo crutch.** This isn't a real user journey; it's a scripted one. Demo audiences are sophisticated enough to wonder if it'd work in the wild. Mitigated by being explicit on stage ("this seeds a fake journey to skip the warm-up; the real engine works the same way").
- **Persona definitions need to align with the actual catalog.** If "Luxury Beach" references items that don't exist or have unexpected tags, the resulting profile is degenerate.
- **Synthetic events may have a timestamp anomaly** (all clicks at the same `Date.now()`). The engine has a recency multiplier that may behave oddly. Mitigate by spreading timestamps across a fake session (e.g., `Date.now() - i * 1000`).

## Prerequisites

1. **Persona definitions.** 3–5 personas with realistic journey scripts (~30 LOC each).
2. **Catalog awareness.** Each persona's items must exist in `js/data/destinations.js` (and the catalog manifest from feature 2 if/when that ships). Cross-check before committing the persona list.
3. **UI placement.** Recommend a small block on the homepage near the hero search, optionally hidden behind `?dev=1`.

## Decisions still to make

- **Persona list.** Which 3–5? Lean: cover beach, urban, adventure, romantic — different enough to show clearly distinct For You surfaces.
- **UI placement.** Homepage hero block vs. debug panel vs. floating control. Lean: homepage hero block with `?dev=1` toggle.
- **Reload vs. live update.** After seeding, full page reload is simpler; in-place update via `onRecommendations` is slicker but needs every surface to subscribe.

## Out of scope

- Server-side persona management.
- User-authored personas.
- Persona portability across browsers.

## Verification

1. Open `index.html` with `?dev=1`. See persona buttons.
2. Click "Luxury Beach". Page reloads (or surfaces update in-place).
3. Profile shows weights on `beach`, `luxury`, `tropical`.
4. For You tab on homepage populates with luxury beach items.
5. Visit `hotels.html`. Strip appears with luxury beach cross-vertical items; pill appears with "Beach picks for you →".
6. Click pill → For You page with Beaches tab pre-selected.
7. Click "Urban Foodie" persona. All surfaces update to urban / food / dining items.

## Effort

~1–2 hours. Persona definitions + UI + synthetic-journey code. Cheap.

## Dependencies on other features

- **Prerequisite for the demo-readiness of every other feature.** Build early in the sequence.
- **No hard code dep on any feature** — uses the plugin's existing API (`trackPageView`, `trackClick`, `trackSearch`, `recommend`).
