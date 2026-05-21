# STATE — Live work tracker

Last update: 2026-05-21

## Shipped (on `henry`)

| Item | Commit | Notes |
|---|---|---|
| Initial Wanderlust clone | `7eae547` | Static demo site |
| Analytics backend + dashboard | `e0978d4` | `server/` + `dashboard.html` |
| Working agent docs (gitignored folder) | `32cc224` | `working/` force-added |
| **Foundation (sign-in + persona seed + navbar)** | `593e261` | Sarah Chen / Luxury Beach persona |

## Planning artifacts (in `working/`)

| Artifact | Location | Status |
|---|---|---|
| Foundation plan | `working/plans/foundation-signin-persona-seed.md` | Executed |
| F1 plan (Homepage For You Tab) | `working/plans/homepage-for-you-tab.md` | Reviewed + revised; ready to execute |
| F2 plan (For You Strip) | `working/plans/for-you-strip.md` | Reviewed + revised; ready to execute |
| F3 plan (For You Page) | `working/plans/for-you-page.md` | Reviewed + revised; ready to execute (waits on F1 + F2) |
| F4 plan (For You Search) | `working/plans/for-you-search.md` | Reviewed + revised; ready to execute |
| F1 reviews | `working/reviews/homepage-for-you-tab-{technical,execution}.md` | PROCEED |
| F2 reviews | `working/reviews/for-you-strip-{technical,execution}.md` | PROCEED |
| F3 reviews | `working/reviews/for-you-page-{technical,execution}.md` | tech REVISE → revised; exec PROCEED |
| F4 reviews | `working/reviews/for-you-search-{technical,execution}.md` | tech PROCEED; exec REVISE → revised |
| Handoff playbook | `working/HANDOFF.md` | Source of truth for how to execute |

## In flight

_(none — next agent picks up Phase A)_

## Open (priority order, ready to execute)

### Phase A (run in parallel — three worktrees)

| # | Feature | Plan | Branch (to create) | Status |
|---|---|---|---|---|
| 1 | Homepage For You Tab | `working/plans/homepage-for-you-tab.md` | `feature/homepage-for-you-tab` | Not started |
| 2 | For You Strip | `working/plans/for-you-strip.md` | `feature/for-you-strip` | Not started |
| 4 | For You Search | `working/plans/for-you-search.md` | `feature/for-you-search` | Not started |

### Phase B (after Phase A merges to `henry`)

| # | Feature | Plan | Branch (to create) | Blocking on |
|---|---|---|---|---|
| 3 | For You Page | `working/plans/for-you-page.md` | `feature/for-you-page` | F1 + F2 merged to `henry` |

## Open questions for the next agent

_(none — all plan-level decisions are locked. Plans contain the answers.)_

## Known caveats

- `working/` is `.gitignore`d. Any update to plans/reviews/state needs `git add -f`.
- The foundation has a minor inconsistency: `vacations.html` declares `pageMeta.category: 'all-inclusive'`, but the seeded persona journey uses `category: 'vacations'`. Doesn't break anything — journey graph keys on page name, not category. Worth a one-line fix later if you're touching that file.
- `js/storage/intent-store.js` (legacy) writes to `wanderlust_intent_profile`. Foundation `js/auth/persona-seed.js` writes to `ik_profile`. Don't conflate these. F4's revised plan handles this with a direct localStorage helper.
- F1's plan removes the static `#debug-panel` block from `index.html` (the dist injects its own panel). Don't reinstate.

## Update protocol

When you complete or progress something:
1. Edit this file
2. `git add -f working/STATE.md`
3. `git commit -m "STATE: <what changed>"`
4. Update the "Last update" date at the top
