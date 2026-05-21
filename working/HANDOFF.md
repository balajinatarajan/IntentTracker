# HANDOFF — Current state

You're picking up a Wanderlust personalization POC. Most of the original 4-feature roadmap has been built, retired, or merged into the upstream codebase. This document is the **current state**, not the historical playbook. For commit history, see `git log --oneline`. For shipped/retired details, see `working/STATE.md`.

---

## TL;DR

- **Repo:** `/Users/hh/Projects/Repos/IntentTracker-henry` (worktree on branch `henry`)
- **Active feature:** F3 (For You themed-tab page) + journey-pill chip in nav
- **PR open:** https://github.com/balajinatarajan/IntentTracker/pull/34 — `henry` → `main`. The branch incorporates upstream's `45fa99a` (lifestyle tabs, continue-search, dashboard, legacy tracker, lib sources, docs).
- **Server:** `cd server && node server.js` → `http://localhost:8090`. If 8090 is busy: `PORT=8091 node server.js`. Express static-serves the repo root.

---

## 1. The surface, page by page

| Page | What's there |
|---|---|
| `index.html` | Main's 6 lifestyle tabs (Explore / Adventure / Romantic / Family / Solo / Culture). Dynamic "For You ✦" tab appears when the IntentTracker plugin fires `onRecommendations` for a returning visitor. Sign-in button + journey pill in the nav. |
| `hotels.html`, `vacations.html`, `resorts.html`, `dining.html` | Static category page from the original clone. Sign-in button + journey pill in the nav. **No** F2 strip, **no** F4 search link. |
| `for-you.html` | F3 themed-tab page (Beaches / Romantic / Urban / Adventure / Budget / Luxury). Reads `js/data/catalog-manifest.js` + `localStorage.ik_profile.tagWeights`, applies a thin inline scorer. Reached via the journey pill. |
| `dashboard.html` | Main's analytics dashboard (untouched). |
| Various other test/scanner/legacy pages | Inherited from main's merge. Not part of the personalization surface. |

---

## 2. Foundation (untouched since `593e261`)

- `js/auth/auth-state.js` — `signIn(userId)`, `signOut()`, `isSignedIn()`, `getCurrentUser()`. Single-user POC.
- `js/auth/persona-seed.js` — writes `ik_profile` + `ik_journey` to localStorage from a persona's intents.
- `js/data/personas.js` — only persona shipped is `luxury-beach` (Sarah Chen). Intents → `tagWeights`.
- `js/data/users.js` — single user entry.
- `js/ui/signin-control.js` — mounts the sign-in dropdown.
- `styles/navbar.css` — now only the `.nav-signin-slot` + `.signin-*` rules (after the dark-nav merge, main.css owns `.site-nav` / `.nav-brand` / `.nav-links`).

**Do not modify foundation files** unless the bug is provably in the foundation. Everything else (F3 + pill) is the editable surface.

---

## 3. F3 / journey pill — current architecture

```
                ┌─────────────────────────────────────────┐
                │  js/data/catalog-manifest.js (24 items) │
                │  (originally F2 owned, kept for F3)     │
                └─────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────────────┐
                │  js/ui/for-you-themes.js                │
                │    THEMES, PILL_THEME_LOOKUP,           │
                │    PILL_TAG_BLACKLIST                   │
                │  (pure constants, zero side effects —   │
                │   safe to import on any page)           │
                └─────────────────────────────────────────┘
                       │                            │
       ┌───────────────┘                            └───────────────┐
       ▼                                                            ▼
┌──────────────────────────┐                          ┌──────────────────────────────┐
│  js/ui/for-you-page.js   │                          │  js/ui/journey-pill.js       │
│   IIFE auto-runs on      │                          │   mountJourneyPill()         │
│   for-you.html only      │                          │   - inserts before           │
│   (guard: needs #tab-bar │                          │     #signin-mount in nav     │
│    + #destination-grid)  │                          │   - reads tagWeights from    │
│   - imports catalog      │                          │     localStorage             │
│     manifest             │                          │   - picks top theme          │
│   - renders themed tabs  │                          │     (no exclusion)           │
│     + ranked card grid   │                          │   - hysteresis: 1.20× margin │
│   - hero reason header   │                          │     via ik_pill_tag          │
└──────────────────────────┘                          └──────────────────────────────┘
```

**Loaded per page:**
- `for-you.html` → `for-you-page.js` (direct script tag) — runs the bootstrap.
- All 5 main pages (index + 4 verticals) → `journey-pill.js` via inline module. Imports `for-you-themes.js`. **Does not** import `for-you-page.js`, so the F3 bootstrap can't accidentally run on the homepage.

**Stylesheets:**
- `styles/tabs.css` — `.tab-btn` / `.tab-btn.active` / `.tab-btn.for-you-btn`. Used by both `index.html` (main's homepage tabs) and `for-you.html` (F3 themed tabs render the same class).
- `styles/for-you.css` — `.journey-pill`, `#for-you-reason`, `.card-reason`, `.tab-empty-placeholder`. Loaded on every page that mounts the pill.

---

## 4. Locked behaviors

| Behavior | Where |
|---|---|
| Pill gated on `isSignedIn()` AND `tagWeights` non-empty AND max weight ≥ 0.5 | `journey-pill.js` step 1-3 |
| Pill always picks the absolute top theme (no per-page exclusion) | `journey-pill.js` step 4 |
| Hysteresis: new top tag must beat stored tag's weight by 1.20× to flip | `journey-pill.js` step 5 |
| Hysteresis state: single global `localStorage.ik_pill_tag` | same |
| Deterministic tie-break: `(b.weight - a.weight) \|\| a.tag.localeCompare(b.tag)` | `journey-pill.js` step 4 |
| Pill text: `"{ThemeLabel} picks for you →"`, href: `for-you.html?tab={themeId}` | `journey-pill.js` step 7 |
| Themed tabs use main's `.tab-btn` class (not F1's `.tab-pill`) | `for-you-page.js` `paintTabBar` |
| F3 inline scorer deliberately omits the dist's `score<=0` drop AND `maxPerGroup` cap | `for-you-page.js` `scoreItems`, see plan §5.5 |

---

## 5. Known issues / open follow-ups

1. **tagWeights pollution** — the IntentTracker plugin records pageMeta categories (e.g., `hotels`, `all-inclusive`, `dining`, `resorts`, `for-you`) as tags. Real user profiles end up with these dominating the weights (5.0+) vs theme tags (0.01–0.05). Doesn't break the pill (those tags aren't in `PILL_THEME_LOOKUP`), but the profile is noise-polluted. Fix would live in `lib/dist/intent-tracker.js` or the lib's source under `lib/src/`. Not yet investigated.

2. **No cache-busting on `journey-pill.js` etc.** — script tag has no `?v=N`. After a code change, users need to hard-reload. If this becomes a problem, add `?v=` query strings (main already does this on `app2.js?v=5` and `intent-tracker.js?v=9`).

3. **Stale per-page hysteresis keys** — previous versions used `ik_pill_tag_<group>` keys (per page-group). Now consolidated to a single `ik_pill_tag` key. Old keys remain in users' localStorage but nothing reads them. Self-cleanup snippet for any user who wants it:
   ```js
   Object.keys(localStorage).filter(k => k.startsWith('ik_pill_tag_')).forEach(k => localStorage.removeItem(k));
   ```

4. **`getItemsForVertical` in `catalog-manifest.js` is unused.** F2 strip was its only consumer. Could be removed for cleanup; doing so is purely cosmetic.

5. **Continue-search section is commented out** in `index.html` (inherited from main's intent). The renderer `js/ui/continue-search.js` is the real implementation. Uncomment the `<section id="continue-search-section">` block to enable.

6. **`chore/local-settings` branch** lives in the primary worktree at `/Users/hh/Projects/Repos/IntentTracker` (one-commit `gh label/issue` permissions tweak). Not relevant to the PR.

---

## 6. How to test locally

```bash
# Start server (from repo root)
cd /Users/hh/Projects/Repos/IntentTracker-henry
node server/server.js   # → http://localhost:8090
# Or:  PORT=8091 node server/server.js   if 8090 is taken

# Open in browser
open http://localhost:8090/

# Sign in via the nav button → seeds the luxury-beach persona
# Browse pages; journey pill appears in the nav (after sign-in)
# Click the pill → lands on for-you.html?tab=<top-theme>

# Reset state in DevTools console:
localStorage.clear()
location.reload()
```

---

## 7. Git / push notes

- **Push uses HTTPS via gh credential helper.** The active gh account flips between `hedgesdigital` and `henryhedges` for unclear reasons. If `git push` returns 403 `Permission to balajinatarajan/IntentTracker.git denied to hedgesdigital`, switch:
  ```bash
  gh auth switch -u henryhedges
  gh auth setup-git
  git push origin henry
  ```
- **Branches:**
  - `henry` — active feature branch, tracks `origin/henry`. The PR is from here.
  - `main` — upstream. `origin/main` is what the PR targets.
  - `chore/local-settings` — local-only on the primary worktree.
  - `feature/homepage-for-you-tab`, `feature/for-you-strip`, `feature/for-you-search`, `feature/for-you-page` — historical, all merged into `henry`. Safe to delete with `git branch -d <name>`.
- **Worktrees** (`git worktree list`):
  - `/Users/hh/Projects/Repos/IntentTracker` → primary, on `chore/local-settings`
  - `/Users/hh/Projects/Repos/IntentTracker-henry` → where work happens

---

## 8. PR #34 — what to know

- Open against `balajinatarajan/IntentTracker` `main`.
- Title: "Personalization stack: foundation + For You tabs/strip/page/search"  *(stale — F2 strip and F4 search were removed after PR creation; description body in github will need a small follow-up edit if you want it to match the current branch)*.
- No reviews requested yet. CI status unknown.
- Mergeable status auto-recomputes after each push.

---

## 9. Don'ts

- Don't reintroduce F1's `js/ui/tabbed-grid.js` or `js/ui/continue-search.js` — those names exist now as main's versions and are wired into main's `app2.js`.
- Don't make `journey-pill.js` import `for-you-page.js` — would re-trigger the IIFE bootstrap on every page and clobber the homepage tabs. Import from `for-you-themes.js` for constants.
- Don't add a `.site-nav` / `.nav-brand` / `.nav-links` rule to `styles/navbar.css` — main.css owns those and load-order would silently override.
- Don't commit `--no-verify` or skip hooks.
- Don't push to `main` directly; merge via PR #34.

---

## 10. Quick reference

```
working/STATE.md           — shipped/retired ledger
working/HANDOFF.md         — this file
working/plans/             — historical execution plans for F1–F4 + foundation
working/reviews/           — historical reviews from the planning phase
js/ui/journey-pill.js      — the chip
js/ui/for-you-themes.js    — theme constants
js/ui/for-you-page.js      — for-you.html bootstrap (only loaded there)
js/data/catalog-manifest.js — 24 cross-vertical items (F3 reads this)
```
