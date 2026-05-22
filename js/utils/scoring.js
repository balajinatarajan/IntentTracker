// Shared scoring for the For You surfaces (FY page, homepage For You tab).
//
// Two exports:
//
//   scoreDestinations() — pure score sort. Used by the FY page tag-tabs,
//   which already filter to a single tag (so within-tab variety isn't a
//   concern; pure relevance is what we want).
//
//   pickTopPicks() — MMR + country cap + region serendipity. Used by Top
//   Picks (FY page) and the homepage For You ✦ tab. The Top Picks surface
//   should LOOK different from any single category tab, so we mix in
//   diversity (country cap + Jaccard-based MMR penalty) and serendipity
//   (one destination from each region not yet represented).
//
// Why this lives here and not in the lib: the lib's RecommendationEngine
// reads from its per-tracker DOM-scanned catalog (only items rendered on
// the current page) and caps results with maxPerGroup. Neither is
// compatible with the For You surfaces' "always fill PER_TAB_LIMIT" rule.
// Scoring directly against destinations.js sidesteps both constraints.

function scoreOne(d, weights, clicks) {
  const tagScore = (d.tags || []).reduce((acc, t) => acc + (weights[t] || 0), 0);
  const normalized = d.tags && d.tags.length > 0 ? tagScore / Math.sqrt(d.tags.length) : 0;
  const clickBoost = (clicks[d.id] || 0) * 0.5;
  return normalized + clickBoost;
}

export function scoreDestinations(destinations, tagWeights, clickCounts, limit) {
  const weights = tagWeights || {};
  const clicks = clickCounts || {};
  return destinations
    .map(d => ({ dest: d, score: scoreOne(d, weights, clicks) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.dest);
}

function jaccard(tagsA, tagsB) {
  const a = new Set(tagsA || []);
  const b = new Set(tagsB || []);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

// Top Picks composer. Default split: 8 relevance + 4 serendipity (of 12).
// - Relevance phase: greedy MMR with a country cap. MMR penalty interleaves
//   similar items; country cap stops one country from monopolizing slots
//   when scores are heavily skewed (the tokyo-sushi-only case where pure
//   MMR can't overcome a 20-point base-score gap).
// - Serendipity phase: one destination per region not represented in the
//   relevance picks, picked deterministically (alphabetical-first by name)
//   so reloads are stable.
// - Backfill phase: if both phases leave slots empty (e.g. user has signal
//   across every region already), top up with the next score-sorted picks.
export function pickTopPicks(destinations, tagWeights, clickCounts, limit = 12, options = {}) {
  const {
    relevanceCount = Math.ceil(limit * 2 / 3),
    maxPerCountry = 2,
    mmrLambda = 0.5,
  } = options;

  const weights = tagWeights || {};
  const clicks = clickCounts || {};

  const scored = destinations.map(d => ({
    dest: d,
    score: scoreOne(d, weights, clicks),
  }));
  const maxScore = Math.max(...scored.map(s => s.score), 0.001);

  const picks = [];
  const pickedIds = new Set();
  const countryCounts = {};

  // Phase 1: MMR + country cap, among positive-score destinations only.
  while (picks.length < relevanceCount) {
    let best = null;
    let bestMmr = -Infinity;
    for (const s of scored) {
      if (pickedIds.has(s.dest.id)) continue;
      if (s.score <= 0) continue;
      if ((countryCounts[s.dest.country] || 0) >= maxPerCountry) continue;
      let maxSim = 0;
      for (const p of picks) {
        const sim = jaccard(s.dest.tags, p.tags);
        if (sim > maxSim) maxSim = sim;
      }
      // Penalty scaled by maxScore so it has meaningful weight against
      // raw scores (Jaccard is in [0,1] but scores can be tens of units).
      const mmr = s.score - mmrLambda * maxSim * maxScore;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        best = s.dest;
      }
    }
    if (!best) break;
    picks.push(best);
    pickedIds.add(best.id);
    countryCounts[best.country] = (countryCounts[best.country] || 0) + 1;
  }

  // Phase 2: serendipity — first destination alphabetically from each
  // region not represented in picks so far.
  const usedRegions = new Set(picks.map(d => d.region));
  const allRegions = [...new Set(destinations.map(d => d.region))];
  for (const region of allRegions) {
    if (picks.length >= limit) break;
    if (usedRegions.has(region)) continue;
    const candidates = destinations
      .filter(d => d.region === region && !pickedIds.has(d.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (candidates.length > 0) {
      picks.push(candidates[0]);
      pickedIds.add(candidates[0].id);
    }
  }

  // Phase 3: backfill any remaining slots with the next score-sorted
  // picks, relaxing the country cap.
  if (picks.length < limit) {
    const sortedByScore = scored.slice().sort((a, b) => b.score - a.score);
    for (const s of sortedByScore) {
      if (picks.length >= limit) break;
      if (pickedIds.has(s.dest.id)) continue;
      picks.push(s.dest);
      pickedIds.add(s.dest.id);
    }
  }

  return picks.slice(0, limit);
}
