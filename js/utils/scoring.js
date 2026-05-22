// Shared scoring for the For You surfaces (FY page, homepage For You tab).
//
// Scores every destination in the catalog against the user's tagWeights
// using the same sqrt(tagCount) normalization as the lib's
// RecommendationEngine, plus a small additive click-count boost. Returns
// the top `limit` destinations ranked by score desc.
//
// Why this lives here and not in the lib: the lib's RecommendationEngine
// reads from its per-tracker DOM-scanned catalog (only items rendered on
// the current page) and caps results with maxPerGroup. Neither is
// compatible with the For You surfaces' "always fill PER_TAB_LIMIT" rule.
// Scoring directly against destinations.js sidesteps both constraints.

export function scoreDestinations(destinations, tagWeights, clickCounts, limit) {
  const weights = tagWeights || {};
  const clicks = clickCounts || {};

  const scored = destinations.map(d => {
    const tagScore = (d.tags || []).reduce((acc, t) => acc + (weights[t] || 0), 0);
    const normalized = d.tags && d.tags.length > 0 ? tagScore / Math.sqrt(d.tags.length) : 0;
    const clickBoost = (clicks[d.id] || 0) * 0.5;
    return { dest: d, score: normalized + clickBoost };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.dest);
}
