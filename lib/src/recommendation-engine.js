// Tag-weight scoring + diversity filter
// Adapted from Wanderlust's recommendation-engine.js

export class RecommendationEngine {
  constructor(catalog, { maxPerGroup = 3 } = {}) {
    this.catalog = catalog;
    this.maxPerGroup = maxPerGroup;
  }

  recommend(profile, maxResults = 6) {
    if (!profile || !profile.tagWeights || Object.keys(profile.tagWeights).length === 0) {
      return [];
    }

    const weights = profile.tagWeights;
    const items = this.catalog.getAllItems();

    const scored = items.map(item => {
      let score = 0;
      const matchedTags = [];

      item.tags.forEach(tag => {
        if (weights[tag]) {
          score += weights[tag];
          matchedTags.push({ tag, weight: weights[tag] });
        }
      });

      // Normalize by sqrt(tagCount) to avoid bias toward items with many tags
      if (item.tags.length > 0) {
        score = score / Math.sqrt(item.tags.length);
      }

      matchedTags.sort((a, b) => b.weight - a.weight);
      return { item, score, matchedTags };
    });

    scored.sort((a, b) => b.score - a.score);

    // Diversity filter: max N per group
    const groupCount = {};
    const results = [];

    for (const entry of scored) {
      if (entry.score <= 0) break;
      if (results.length >= maxResults) break;

      if (entry.item.group) {
        groupCount[entry.item.group] = (groupCount[entry.item.group] || 0) + 1;
        if (groupCount[entry.item.group] > this.maxPerGroup) continue;
      }

      const topTag = entry.matchedTags[0];
      const reason = topTag
        ? `Based on your interest in ${topTag.tag}`
        : 'Recommended for you';

      results.push({
        itemId: entry.item.id,
        item: entry.item,
        score: Math.round(entry.score * 100) / 100,
        reason,
        matchedTags: entry.matchedTags.map(t => t.tag),
      });
    }

    return results;
  }
}
