// Persona classifier + lightweight recommender for the analytics backend.
//
// Personas are the five archetypes documented in scenarios.html:
//   1. The Honeymoon Planner       — romantic + beach/tropical
//   2. The Budget Backpacker       — budget + adventure / SE Asia
//   3. The Luxury Comparison Shopper — luxury, multi-tag depth
//   4. The Family Vacation Researcher — family + all-inclusive
//   5. The Culture Explorer        — culture/food/city
//
// Each persona scores a profile's tagWeights against a tag-affinity vector;
// the highest-scoring persona wins (ties broken in declaration order). Users
// whose profile has no tagWeights or whose top score is ~zero are bucketed
// as "Unclassified".
//
// The recommender mirrors lib/src/recommendation-engine.js — same scoring
// (sum of matched weights, normalized by sqrt(tagCount)) so dashboard rollups
// reflect what the client would actually recommend.

import { destinations } from '../js/data/destinations.js';

export const PERSONAS = [
  {
    id: 'honeymoon-planner',
    label: 'Honeymoon Planner',
    affinity: { romantic: 2.0, beach: 1.2, tropical: 1.2, luxury: 0.8, spa: 1.0 },
  },
  {
    id: 'budget-backpacker',
    label: 'Budget Backpacker',
    affinity: { budget: 2.0, 'price:budget': 2.0, adventure: 1.5, 'southeast-asia': 1.0, beach: 0.6 },
  },
  {
    id: 'luxury-shopper',
    label: 'Luxury Comparison Shopper',
    affinity: { luxury: 2.5, 'price:luxury': 2.5, city: 0.6, food: 0.6, culture: 0.4 },
  },
  {
    id: 'family-researcher',
    label: 'Family Vacation Researcher',
    affinity: { family: 2.5, 'all-inclusive': 2.0, beach: 0.6, 'mid-range': 0.5 },
  },
  {
    id: 'culture-explorer',
    label: 'Culture Explorer',
    affinity: { culture: 2.0, food: 1.5, city: 1.0, europe: 0.8, 'east-asia': 0.8 },
  },
];

export const UNCLASSIFIED = { id: 'unclassified', label: 'Unclassified' };

// Classify a single profile by its tagWeights.
export function classifyProfile(tagWeights) {
  if (!tagWeights || Object.keys(tagWeights).length === 0) return UNCLASSIFIED;

  let best = null;
  let bestScore = 0;
  for (const p of PERSONAS) {
    let score = 0;
    for (const [tag, aff] of Object.entries(p.affinity)) {
      const w = tagWeights[tag];
      if (w) score += w * aff;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  // Require a minimum threshold so noise-only profiles don't claim a persona
  if (!best || bestScore < 1.0) return UNCLASSIFIED;
  return { id: best.id, label: best.label, score: +bestScore.toFixed(3) };
}

// Mirror of lib/src/recommendation-engine.js: score = sum(matched weights),
// then divide by sqrt(tagCount). Diversity filter caps repeats per region.
export function recommendForProfile(tagWeights, { maxResults = 6, maxPerGroup = 3 } = {}) {
  if (!tagWeights || Object.keys(tagWeights).length === 0) return [];

  const scored = destinations.map(dest => {
    let score = 0;
    const matched = [];
    for (const tag of dest.tags || []) {
      const w = tagWeights[tag];
      if (w) { score += w; matched.push(tag); }
    }
    if (dest.tags && dest.tags.length > 0) {
      score = score / Math.sqrt(dest.tags.length);
    }
    return { dest, score, matched };
  });

  scored.sort((a, b) => b.score - a.score);

  const groupCount = {};
  const results = [];
  for (const entry of scored) {
    if (entry.score <= 0) break;
    if (results.length >= maxResults) break;
    const group = entry.dest.region;
    if (group) {
      groupCount[group] = (groupCount[group] || 0) + 1;
      if (groupCount[group] > maxPerGroup) continue;
    }
    results.push({
      id: entry.dest.id,
      name: entry.dest.name,
      image: entry.dest.image,
      priceTier: entry.dest.priceTier,
      score: +entry.score.toFixed(3),
      matchedTags: entry.matched,
    });
  }
  return results;
}

// Public catalog snapshot (id -> minimal fields) for the dashboard widget.
export function destinationsById() {
  const map = {};
  for (const d of destinations) {
    map[d.id] = { id: d.id, name: d.name, image: d.image, priceTier: d.priceTier, region: d.region };
  }
  return map;
}
