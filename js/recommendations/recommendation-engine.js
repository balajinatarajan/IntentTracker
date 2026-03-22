export class RecommendationEngine {
  constructor(destinations) {
    this.destinations = destinations;
  }

  recommend(profile, maxResults = 6) {
    if (!profile || !profile.tagWeights || Object.keys(profile.tagWeights).length === 0) {
      return [];
    }

    const weights = profile.tagWeights;

    // Score each destination
    const scored = this.destinations.map(dest => {
      let score = 0;
      let matchedTags = [];

      dest.tags.forEach(tag => {
        if (weights[tag]) {
          score += weights[tag];
          matchedTags.push({ tag, weight: weights[tag] });
        }
      });

      // Normalize by tag count to avoid bias toward destinations with many tags
      if (dest.tags.length > 0) {
        score = score / Math.sqrt(dest.tags.length);
      }

      // Sort matched tags by weight descending
      matchedTags.sort((a, b) => b.weight - a.weight);

      return { dest, score, matchedTags };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Diversity filter: max 3 per region
    const regionCount = {};
    const results = [];

    for (const item of scored) {
      if (item.score <= 0) break;
      if (results.length >= maxResults) break;

      const region = item.dest.region;
      regionCount[region] = (regionCount[region] || 0) + 1;
      if (regionCount[region] > 3) continue;

      // Generate reason from top matched tag
      const topTag = item.matchedTags[0];
      const reason = topTag
        ? `Based on your interest in ${this._tagLabel(topTag.tag)}`
        : 'Recommended for you';

      results.push({
        destinationId: item.dest.id,
        destination: item.dest,
        score: Math.round(item.score * 100) / 100,
        reason,
        matchedTags: item.matchedTags.map(t => t.tag)
      });
    }

    return results;
  }

  _tagLabel(tag) {
    const labels = {
      'beach': 'beach destinations',
      'city': 'city breaks',
      'nature': 'nature & outdoors',
      'southeast-asia': 'Southeast Asia',
      'europe': 'Europe',
      'east-asia': 'East Asia',
      'south-asia': 'South Asia',
      'caribbean': 'the Caribbean',
      'north-america': 'North America',
      'south-america': 'South America',
      'central-america': 'Central America',
      'africa': 'Africa',
      'middle-east': 'the Middle East',
      'budget': 'budget-friendly travel',
      'mid-range': 'mid-range travel',
      'luxury': 'luxury travel',
      'romantic': 'romantic getaways',
      'adventure': 'adventure travel',
      'family': 'family-friendly destinations',
      'solo': 'solo travel',
      'culture': 'cultural experiences',
      'food': 'culinary destinations',
      'nightlife': 'nightlife & entertainment',
      'diving': 'diving & snorkeling',
      'surfing': 'surfing',
      'wildlife': 'wildlife & nature',
      'shopping': 'shopping destinations',
      'technology': 'modern cities'
    };
    return labels[tag] || tag;
  }
}
