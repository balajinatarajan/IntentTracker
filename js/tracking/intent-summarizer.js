import { regions, tripTypes, priceTiers, matchQueryToTags } from '../utils/categories.js';
import { FEATURE_TOGGLES } from './feature-toggles.js';

export class IntentSummarizer {
  constructor(destinations) {
    this.destinations = destinations;
    this.destMap = new Map(destinations.map(d => [d.id, d]));
  }

  // Helper: get weight multiplier for an event type
  _eventWeight(eventType, category) {
    // category: 'region', 'price', 'trip', 'tag'
    if (eventType === 'click') return category === 'trip' || category === 'tag' ? 2 : 3;
    if (eventType === 'hover') return category === 'trip' || category === 'tag' ? 1.5 : 2;
    return 1; // view
  }

  summarize(events) {
    const intents = [];

    // Stage 1: Group events by destination metadata
    const regionCounts = {};
    const priceTierCounts = {};
    const tripTypeCounts = {};
    const tagCounts = {};
    const clickedIds = [];
    const hoveredIds = [];
    const viewedIds = [];
    const searchQueries = [];
    const hoversByRegion = {}; // region -> [{ destId, hoverMs }]

    // Recency: compute session time window for decay within session
    const now = Date.now();
    const sessionStartMs = events.length > 0 ? events[0].timestamp : now;
    const sessionSpanMs = Math.max(now - sessionStartMs, 1); // avoid div-by-zero

    events.forEach(event => {
      if (event.type === 'search' && event.query) {
        searchQueries.push(event.query);
        return;
      }

      // Skip view events when view tracking is disabled (safety net for stale events)
      if (event.type === 'view' && !FEATURE_TOGGLES.enableViewTracking) return;

      const dest = this.destMap.get(event.destinationId);
      if (!dest) return;

      if (event.type === 'click') clickedIds.push(dest.id);
      if (event.type === 'hover') {
        hoveredIds.push(dest.id);
        // Track hovers by region for hover_interest detection
        if (!hoversByRegion[dest.region]) hoversByRegion[dest.region] = [];
        hoversByRegion[dest.region].push({ destId: dest.id, hoverMs: event.dwellMs || 0 });
      }
      if (event.type === 'view') viewedIds.push(dest.id);

      // Recency multiplier: 0.5 (oldest event) → 1.0 (most recent event)
      const age = (event.timestamp - sessionStartMs) / sessionSpanMs; // 0..1
      const recencyMultiplier = 0.5 + 0.5 * age;

      // Count region (click=3, hover=2, view=1) × recency
      regionCounts[dest.region] = (regionCounts[dest.region] || 0) + this._eventWeight(event.type, 'region') * recencyMultiplier;

      // Count price tier (click=3, hover=2, view=1) × recency
      priceTierCounts[dest.priceTier] = (priceTierCounts[dest.priceTier] || 0) + this._eventWeight(event.type, 'price') * recencyMultiplier;

      // Count trip types (click=2, hover=1.5, view=1) × recency
      dest.tripTypes.forEach(tt => {
        tripTypeCounts[tt] = (tripTypeCounts[tt] || 0) + this._eventWeight(event.type, 'trip') * recencyMultiplier;
      });

      // Count all tags (click=2, hover=1.5, view=1) × recency
      dest.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + this._eventWeight(event.type, 'tag') * recencyMultiplier;
      });
    });

    // Frequency bonus: reward repeated interactions with the same destination
    const destInteractionCounts = {};
    events.forEach(event => {
      if (event.destinationId && (event.type === 'click' || event.type === 'hover')) {
        destInteractionCounts[event.destinationId] = (destInteractionCounts[event.destinationId] || 0) + 1;
      }
    });

    Object.entries(destInteractionCounts).forEach(([destId, count]) => {
      if (count >= 2) {
        const dest = this.destMap.get(destId);
        if (!dest) return;
        const bonus = Math.log2(count); // 2→1.0, 3→1.58, 4→2.0 (diminishing returns)
        regionCounts[dest.region] = (regionCounts[dest.region] || 0) + bonus;
        priceTierCounts[dest.priceTier] = (priceTierCounts[dest.priceTier] || 0) + bonus;
        dest.tripTypes.forEach(tt => {
          tripTypeCounts[tt] = (tripTypeCounts[tt] || 0) + bonus;
        });
        dest.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + bonus;
        });
      }
    });

    // Stage 2: Pattern detection

    // Region interest
    const topRegions = this._topEntries(regionCounts, 3);
    topRegions.forEach(([region, count]) => {
      if (count < 3) return;
      const label = regions[region]?.label || region;
      const topTrip = this._topEntry(tripTypeCounts);
      const tripLabel = topTrip ? tripTypes[topTrip[0]]?.label?.toLowerCase() || topTrip[0] : null;

      intents.push({
        id: this._id(),
        timestamp: Date.now(),
        summary: tripLabel
          ? `Interested in ${tripLabel} destinations in ${label}`
          : `Exploring destinations in ${label}`,
        tags: [region, ...(topTrip ? [topTrip[0]] : [])],
        confidence: Math.min(count / 10, 1.0),
        category: 'region_interest',
        sourceEventCount: count
      });
    });

    // Price preference
    const totalPriceEvents = Object.values(priceTierCounts).reduce((a, b) => a + b, 0);
    if (totalPriceEvents >= 3) {
      const topPrice = this._topEntry(priceTierCounts);
      if (topPrice && topPrice[1] / totalPriceEvents >= 0.5) {
        const label = priceTiers[topPrice[0]]?.label || topPrice[0];
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Looking for ${label.toLowerCase()} travel options`,
          tags: [topPrice[0]],
          confidence: Math.min(topPrice[1] / totalPriceEvents, 1.0),
          category: 'price_preference',
          sourceEventCount: topPrice[1]
        });
      }
    }

    // Trip type affinity
    const totalTripEvents = Object.values(tripTypeCounts).reduce((a, b) => a + b, 0);
    if (totalTripEvents >= 3) {
      const topTrip = this._topEntry(tripTypeCounts);
      if (topTrip && topTrip[1] / totalTripEvents >= 0.35) {
        const label = tripTypes[topTrip[0]]?.label || topTrip[0];
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Interested in ${label.toLowerCase()} trips`,
          tags: [topTrip[0]],
          confidence: Math.min(topTrip[1] / totalTripEvents, 1.0),
          category: 'trip_type',
          sourceEventCount: topTrip[1]
        });
      }
    }

    // Search intent
    searchQueries.forEach(query => {
      const matchedTags = matchQueryToTags(query);
      const tagLabels = matchedTags
        .map(t => regions[t]?.label || tripTypes[t]?.label || priceTiers[t]?.label || t)
        .slice(0, 3);

      intents.push({
        id: this._id(),
        timestamp: Date.now(),
        summary: tagLabels.length > 0
          ? `Searched for "${query}" — interested in ${tagLabels.join(', ').toLowerCase()}`
          : `Searched for "${query}"`,
        tags: matchedTags.length > 0 ? matchedTags : [query.toLowerCase()],
        confidence: 0.9,
        category: 'search_intent',
        sourceEventCount: 1
      });
    });

    // Comparison detection
    if (clickedIds.length >= 2) {
      const uniqueClicked = [...new Set(clickedIds)];
      if (uniqueClicked.length >= 2 && uniqueClicked.length <= 3) {
        const names = uniqueClicked.map(id => this.destMap.get(id)?.name || id);
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Comparing ${names.join(' and ')}`,
          tags: uniqueClicked.flatMap(id => this.destMap.get(id)?.tags || []),
          confidence: 0.85,
          category: 'comparison',
          sourceEventCount: clickedIds.length
        });
      }
    }

    // Hover interest detection: user hovers 2+ destinations in same region without clicking
    const uniqueHovered = [...new Set(hoveredIds)];
    const hoveredNotClicked = uniqueHovered.filter(id => !clickedIds.includes(id));
    if (hoveredNotClicked.length >= 2) {
      // Find regions with 2+ hovered (non-clicked) destinations
      Object.entries(hoversByRegion).forEach(([region, hovers]) => {
        const uniqueInRegion = [...new Set(hovers.filter(h => hoveredNotClicked.includes(h.destId)).map(h => h.destId))];
        if (uniqueInRegion.length >= 2) {
          const totalHoverMs = hovers.reduce((sum, h) => sum + h.hoverMs, 0);
          const label = regions[region]?.label || region;
          const topTrip = this._topEntry(tripTypeCounts);
          const tripLabel = topTrip ? tripTypes[topTrip[0]]?.label?.toLowerCase() || topTrip[0] : null;

          intents.push({
            id: this._id(),
            timestamp: Date.now(),
            summary: tripLabel
              ? `Considering ${tripLabel} options in ${label}`
              : `Browsing destinations in ${label} with interest`,
            tags: [region, ...(topTrip ? [topTrip[0]] : [])],
            confidence: Math.min(totalHoverMs / 10000, 0.9), // More hover time = higher confidence, cap at 0.9
            category: 'hover_interest',
            sourceEventCount: hovers.length
          });
        }
      });
    }

    // Deduplicate by category (keep highest confidence per category)
    return this._dedupe(intents);
  }

  _topEntries(counts, n = 1) {
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  _topEntry(counts) {
    const entries = this._topEntries(counts, 1);
    return entries.length > 0 ? entries[0] : null;
  }

  _dedupe(intents) {
    const byCategory = new Map();
    intents.forEach(intent => {
      const key = intent.category + ':' + intent.tags.sort().join(',');
      const existing = byCategory.get(key);
      if (!existing || intent.confidence > existing.confidence) {
        byCategory.set(key, intent);
      }
    });
    return Array.from(byCategory.values());
  }

  _id() {
    return 'intent-' + Math.random().toString(36).slice(2, 10);
  }
}
