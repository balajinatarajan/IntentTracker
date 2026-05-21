# HANDOFF — Agentic Execution Playbook

You're picking up a hackathon POC mid-flight. Foundation is shipped. Four "For You" features have been planned, reviewed, revised, and are ready to execute. Your job is to ship them, maximizing parallelism.

This document is the single source of truth for HOW to work. **Read this first.**

---

## TL;DR

- **Repo:** `/Users/hh/Projects/Repos/IntentTracker-henry`
- **Base branch:** `henry`
- **What's done:** Foundation (sign-in, persona seed, navbar) at commit `593e261`. Four plans + 8 reviews + 4 revisions in `working/`.
- **What's open:** Execute F1, F2, F3, F4 (see §3 below).
- **Strategy:** F1 + F2 + F4 in parallel on three sub-branches; F3 after F1 + F2 merge.

---

## 1. Read these first (cold-start, ~10 min)

In this order:

1. **`working/STATE.md`** — current state (shipped / in-flight / open). **Always start here.**
2. **`working/features/README.md`** — feature inventory.
3. **`working/plans/foundation-signin-persona-seed.md`** — the format gold standard (do not deviate from this structure for new plans).
4. **The plan for the feature you're picking** — `working/plans/<feature>.md`.
5. (Skim) The two reviews for that feature — `working/reviews/<feature>-{technical,execution}.md` — for context on what got fixed.

---

## 2. State conventions

### Branches

- `henry` — base. Foundation lives here. Plans live here (in gitignored `working/`).
- `feature/<feature-name>` — one per feature. Branched off `henry`. Implementation work happens here. Merged back to `henry` when verification passes.
- Sub-branches may optionally use worktrees: `git worktree add ../IntentTracker-<name> feature/<name>` for true isolation. Otherwise plain branch checkout is fine — the streams write to different files.

### Commits

- Commit on the sub-branch, **not on `henry` directly** during feature work.
- Commit message: subject (≤72 chars) + body explaining intent. Foot with:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- Merge back to `henry` with `--no-ff` to preserve the feature branch history.

### Files

- `working/` is `.gitignore`d on `henry`. Plans/reviews/state are force-added on commits that intentionally update them: `git add -f working/...`.
- All implementation files (`js/`, `styles/`, `*.html`) commit normally.

---

## 3. Open features (priority order)

| # | Feature | Plan path | Hard deps | Effort (parallel) | Sub-branch |
|---|---|---|---|---|---|
| 1 | Homepage For You Tab | `working/plans/homepage-for-you-tab.md` | none | ~2.25h | `feature/homepage-for-you-tab` |
| 2 | For You Strip | `working/plans/for-you-strip.md` | none | ~2h | `feature/for-you-strip` |
| 3 | For You Page | `working/plans/for-you-page.md` | **F1 + F2** | ~2.5h | `feature/for-you-page` |
| 4 | For You Search | `working/plans/for-you-search.md` | none | ~1h50m | `feature/for-you-search` |

**Parallelism plan:**
- **Phase A** (parallel): F1 + F2 + F4 — three sub-branches running concurrently.
- **Phase B** (after A merges): F3.

Total wall-clock with full parallelism: ~2.5h (Phase A, limited by slowest) + ~2.5h (Phase B) = ~5h.

---

## 4. The 5-phase recipe (per feature)

### Phase 1 — Plan (DONE for current features; skip unless adding new)

If `working/plans/<feature>.md` doesn't exist:
- Spawn **ONE** planning agent (`general-purpose`).
- Briefing: feature proposal at `working/features/<feature>.md`, format reference at `working/plans/foundation-signin-persona-seed.md`, locked decisions, required sections (12 sections, see foundation plan TOC).
- Output: `working/plans/<feature>.md`.

### Phase 2 — Review (DONE for current features; skip unless plan changed)

If `working/reviews/<feature>-technical.md` and `<feature>-execution.md` don't exist:
- Spawn **TWO** review agents in **PARALLEL** (in one Agent tool call with two invocations).
- Lens 1 (technical): architecture, contract completeness, integration risk, codebase fit.
- Lens 2 (execution): could a stream agent build from this? Are ACs concrete? Pitfalls real? Effort realistic?
- Each writes findings to `working/reviews/<feature>-<lens>.md` and returns a brief inline summary.

### Phase 3 — Revise (DONE for current features; skip unless plan changed)

If either review returned REVISE, or Critical findings exist:
- Spawn **ONE** revision agent.
- Briefing: plan to edit in place, the two reviews, address rules ("Critical: fix; Important: fix or justify; Nits: optional"), constraint to preserve locked decisions unless reviewers demand it.
- Output: revised plan in place.

### Phase 4 — Execute (THIS IS WHERE THE WORK IS)

For each feature:

**4a. Setup (~1 min)**
```bash
cd /Users/hh/Projects/Repos/IntentTracker-henry
git checkout henry && git pull   # if applicable
git checkout -b feature/<name>
```

Verify cross-feature deps shipped:
- F3: confirm `js/ui/tabbed-grid.css` (from F1) and `js/data/catalog-manifest.js` (from F2) exist on `henry`. Pull/rebase if needed.

**4b. Fire stream agents in PARALLEL** (use Agent tool, all invocations in one message)

For a plan with N streams, fire N agents in one Agent block. Each gets:
- Working directory
- The feature plan path
- Which stream (§6.X) they own
- Instruction to read the plan's §5 (contracts) AND their stream section ONLY
- The constraint "Do NOT commit. Integration phase will commit."

Use `general-purpose` subagent type for all stream work (needs Read/Write/Bash).

**4c. Integration (~15–30 min)**

After all stream agents return:
- Verify all expected files exist (one `ls` / `find`)
- Read each new file briefly to sanity-check shape vs. contract
- Wire any inline scripts the plan requires (per plan's §7 integration steps)
- Run plan's §8 verification matrix
- Commit on the sub-branch with subject `<feature>: implement`

Integration can either be done by the main agent (with full context) OR a single integration agent. Either works.

**4d. Sanity review** (optional, recommended for F3)
- Spawn ONE review agent to verify the implementation matches the plan.
- Compares produced files against §8 verification matrix.
- If issues: fix and re-commit.

**4e. Merge to `henry`**
```bash
git checkout henry
git merge --no-ff feature/<name> -m "Merge feature/<name>"
```

Then update `working/STATE.md` and force-add the update:
```bash
git add -f working/STATE.md
git commit -m "STATE: <feature> shipped"
```

### Phase 5 — Cross-feature parallel execution

You CAN run multiple independent features simultaneously. The current candidates (F1 + F2 + F4) are all independent of each other.

Mechanics:
- Open 3 worktrees, one per feature, each on its own sub-branch.
- OR: use a single working tree but check out branches sequentially. This serializes the work; defeats the point.
- **Worktrees are the right approach for true parallelism.**

```bash
# From the henry worktree
git worktree add ../IntentTracker-F1 feature/homepage-for-you-tab
git worktree add ../IntentTracker-F2 feature/for-you-strip
git worktree add ../IntentTracker-F4 feature/for-you-search
```

Then fire stream agents in EACH worktree as separate Agent batches. Or one giant Agent batch with mixed-target prompts — every agent prompt specifies its working directory absolute path.

**Coordination:** none required during execution. Each feature is in its own files. The only coupling is at merge time — if two features touched the same file (rare; check §9 file inventory in each plan), resolve at merge. Plans were specifically designed to minimize file overlap.

---

## 5. Agent prompt templates

Copy-paste these. Fill in `<…>` placeholders.

### Stream agent (Phase 4b)

```
You're implementing Stream <X> of feature <name> for a hackathon POC.

Working directory: /Users/hh/Projects/Repos/IntentTracker-henry (or /Users/hh/Projects/Repos/IntentTracker-<F>)
Current branch: feature/<name>

Read first:
1. working/plans/<feature>.md — focus on §5 (contracts) and §6.<X> (your stream). You do NOT need to read other streams' sections.
2. working/plans/foundation-signin-persona-seed.md — style and idiom reference only.
3. Any source files your stream explicitly references.

Your deliverable: <files from §6.<X> "Owner output">
Acceptance criteria: <copy from §6.<X> "Acceptance criteria">

Constraints:
- ES modules. Vanilla DOM. No framework.
- POC scope — no extra features or polish beyond the plan.
- Match foundation patterns: double-quoted strings, semicolons, ES modules, single-line header comments.
- Do NOT commit. Do NOT modify files outside your stream's scope.
- Do NOT touch foundation files (js/auth/, js/data/personas.js, js/data/users.js, js/ui/signin-control.js, styles/navbar.css).
- Cross-stream files are owned by other agents; do not edit them.

Report back briefly with: (1) files written/modified (full paths), (2) the contract points from §5 that you implemented, (3) anything you skipped from the steps and why.
```

### Review agent — technical lens (Phase 2)

```
You're doing a TECHNICAL review of a hackathon POC execution plan.

Working directory: /Users/hh/Projects/Repos/IntentTracker-henry

Plan to review: working/plans/<feature>.md
Reference plan (gold standard): working/plans/foundation-signin-persona-seed.md
Feature proposal: working/features/<feature>.md

Read the plan thoroughly. Spot-check by actually reading every source file the plan references.

Evaluate:
1. Architecture soundness — does the design fit the existing codebase cleanly?
2. Contract completeness — are §5 contracts specific enough that a stream agent can implement against them with zero ambiguity? Verify function signatures, data shapes, DOM IDs match what the plan claims consumers expect.
3. Integration risk — what could fail in the integration phase? Any runtime side-effects from orphaned markup or removed sections?
4. Codebase fit — do referenced file paths and exports actually exist?
5. Consistency with foundation patterns.

Write findings to working/reviews/<feature>-technical.md with this structure:

# Technical Review — <feature>
**Verdict:** PROCEED | REVISE | RECONSIDER
## Summary
## Critical (must fix before execution)
## Important (should fix; plan can proceed if not)
## Nits (optional polish)
## Missing entirely
## Spot-check notes

Return inline: verdict, counts of critical/important/nit findings, top 1-2 concerns.

Do NOT redesign. Do NOT add scope. Do NOT commit.
```

### Review agent — execution lens (Phase 2)

```
You're doing an EXECUTION review. Imagine you're a stream agent — could you build it from only the plan?

Working directory: /Users/hh/Projects/Repos/IntentTracker-henry
Plan: working/plans/<feature>.md
Reference: working/plans/foundation-signin-persona-seed.md

Read the plan. For EACH parallel stream:
1. Could I implement this from only this stream's section + §5 contracts? If no, what's missing?
2. Are acceptance criteria concrete enough to verify done?
3. Are pitfalls real warnings or just restated steps?
4. Is the effort estimate realistic given the steps listed?

Then evaluate the plan as a whole:
- Stream independence (truly parallel?)
- Integration phase clarity
- Verification matrix realism (≤10 min walkable?)
- Open decisions: should be ZERO.

Write findings to working/reviews/<feature>-execution.md with the same severity structure as technical review, plus a "Per-stream notes" section with one paragraph per stream.

Return inline: verdict, counts, top concerns.

Do NOT redesign. Do NOT commit.
```

### Revision agent (Phase 3)

```
You're revising a hackathon POC plan based on two reviews.

Working directory: /Users/hh/Projects/Repos/IntentTracker-henry

Plan to edit in place: working/plans/<feature>.md
Technical review: working/reviews/<feature>-technical.md
Execution review: working/reviews/<feature>-execution.md
Format reference: working/plans/foundation-signin-persona-seed.md

Address findings:
- Critical: MUST fix.
- Important: fix unless you can justify in a brief note why not.
- Nits: optional; pick the ones that clearly improve clarity.
- Missing entirely: add if relevant to plan correctness.

Editing rules:
- Edit the plan in place. Preserve §1–§12 ordering.
- Don't regress locked decisions unless reviewers specifically demand it.
- Keep POC scope. Don't add features.
- Maintain "executable by parallel stream agents" property.

Report back with: (1) confirmation file updated, (2) bulleted change list grouped by severity, (3) anything skipped with a one-line reason.

Do NOT commit.
```

### Implementation-review agent (Phase 4d, optional)

```
You're reviewing an IMPLEMENTATION against its plan.

Working directory: /Users/hh/Projects/Repos/IntentTracker-henry
Branch: feature/<name>
Plan: working/plans/<feature>.md
Files to check: <list from plan's §9 file inventory>

For each file in §9: verify it exists and conforms to the plan's contracts in §5.

Walk through the verification matrix in §8. For each row, run the check and record pass/fail.

Write findings to working/reviews/<feature>-impl.md with:
- Pass/fail per §8 row
- Any contract violations found in source
- Verdict: SHIP | FIX | REGRESS

Do NOT modify source files. Do NOT commit.
```

---

## 6. Multi-agent strategy summary

| Step | # Agents in parallel | Why |
|---|---|---|
| Planning a new feature | 1 | One brain per plan; sequential reviews catch issues |
| Reviewing a plan | 2 | Technical + Execution lenses; independent angles |
| Revising a plan | 1 | One brain consolidates feedback consistently |
| Executing streams within a feature | N (one per stream from §6) | Streams are independent by design |
| Implementation review | 1 | One brain compares §8 matrix end-to-end |
| Cross-feature execution | 3 (max) | F1 + F2 + F4 truly independent; F3 waits |

When in doubt: prefer one agent owning a coherent chunk over many micro-agents. Coordination cost grows fast.

---

## 7. Cross-feature contract risk

F3 has hard deps on F1 (`tabbed-grid.css` + `.tab-pill` CSS classes) and F2 (`catalog-manifest.js`). F3's revised plan committed to **Plan B** — F3 ships its own themed-tab renderer and only consumes F1's CSS (not F1's `initTabs` JS), so the dep is just stylesheet + class names.

F1 and F2 are independent of each other and of F4. Safe to ship in any order.

If a Phase A merge changes a shared contract (unlikely but possible), F3's plan §10 documents reconciliation steps.

---

## 8. Failure modes and recovery

### Stream agent produces wrong contract shape

- Re-read plan §5 to identify the violated contract.
- Spawn a fix agent: give it the exact contract clause and the file to fix. ~5 min.

### Integration verification fails (plan §8 row red)

- Map failure to specific stream owner (plan §6 cross-reference).
- Spawn a fix agent scoped to that stream's files.

### Cross-feature drift discovered at merge

- Stop. Read the conflicting plans' §5.
- Decide whether to update the plan (preferred — plan is source of truth) or both implementations.
- If plan changes: re-run Phase 3 (revise), then re-do affected streams.

### Plan ambiguity discovered mid-execution

- Don't guess. Update the plan to lock the ambiguity, then continue.
- If lock can wait, surface the ambiguity in your agent's report and let the main agent decide.

---

## 9. Drop-in checklist for a fresh session

```
1. cd /Users/hh/Projects/Repos/IntentTracker-henry
2. git status; git log --oneline -10            # situational awareness
3. Read working/STATE.md                         # what's done, what's open, open questions
4. Pick a feature (respecting deps)
5. Read its plan + reviews
6. git checkout -b feature/<name>                # or git worktree add ... feature/<name>
7. Fire stream agents in parallel (one Agent call, N invocations)
8. After agents return: integration + smoke test
9. Commit on sub-branch
10. Merge to henry (--no-ff)
11. Update working/STATE.md; force-add and commit
12. Move to next feature or wrap up
```

---

## 10. Don'ts

- Don't commit to `henry` directly during feature work.
- Don't modify foundation files (`js/auth/*`, `js/data/personas.js`, `js/data/users.js`, `js/ui/signin-control.js`, `styles/navbar.css`).
- Don't reach across feature boundaries — each plan owns its files.
- Don't skip the review phase when planning a new feature. Reviews are cheap insurance.
- Don't use `--no-verify` on commits. If a hook fails, fix the cause.
- Don't push to remote unless explicitly asked.
- Don't auto-stage everything with `git add .` or `git add -A` in `working/` (it's gitignored; would require `-f` per file anyway).
- Don't introduce a framework. Vanilla DOM + ES modules.
- Don't add `console.log` debug output to shipped code.
- Don't widen scope beyond what the plan says, even if you think it'd be better. Open a follow-up note in STATE.md instead.
