// Generic intent summarizer
// Adapted from Wanderlust's intent-summarizer.js — domain-agnostic

export class IntentSummarizer {
  constructor(catalog) {
    this.catalog = catalog;
  }

  _eventWeight(eventType, category) {
    if (eventType === 'click') return category === 'tag' ? 2 : 3;
    if (eventType === 'hover') return category === 'tag' ? 1.5 : 2;
    if (eventType === 'tab_view') return category === 'tag' ? 1.5 : 2;
    return 1; // view
  }

  summarize(events) {
    const intents = [];
    const groupCounts = {};
    const tagCounts = {};
    const clickedIds = [];
    const hoveredIds = [];
    const searchQueries = [];
    const hoversByGroup = {}; // group -> [{ itemId, hoverMs }]

    // Recency: compute session time window
    const now = Date.now();
    const sessionStartMs = events.length > 0 ? events[0].timestamp : now;
    const sessionSpanMs = Math.max(now - sessionStartMs, 1);

    events.forEach(event => {
      // Skip page_view events — handled by journey-tracker
      if (event.type === 'page_view') return;

      // Tab view: carries tags directly, no catalog item
      if (event.type === 'tab_view') {
        const age = (event.timestamp - sessionStartMs) / sessionSpanMs;
        const recencyMultiplier = 0.5 + 0.5 * age;
        (event.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + this._eventWeight('tab_view', 'tag') * recencyMultiplier;
        });
        return;
      }

      if (event.type === 'search' && event.query) {
        searchQueries.push(event.query);
        return;
      }

      const item = this.catalog.getItem(event.itemId);
      if (!item) return;

      if (event.type === 'click') clickedIds.push(item.id);
      if (event.type === 'hover') {
        hoveredIds.push(item.id);
        if (item.group) {
          if (!hoversByGroup[item.group]) hoversByGroup[item.group] = [];
          hoversByGroup[item.group].push({ itemId: item.id, hoverMs: event.dwellMs || 0 });
        }
      }

      // Recency multiplier: 0.5 (oldest) → 1.0 (newest)
      const age = (event.timestamp - sessionStartMs) / sessionSpanMs;
      const recencyMultiplier = 0.5 + 0.5 * age;

      // Count group
      if (item.group) {
        groupCounts[item.group] = (groupCounts[item.group] || 0) + this._eventWeight(event.type, 'group') * recencyMultiplier;
      }

      // Count all tags
      item.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + this._eventWeight(event.type, 'tag') * recencyMultiplier;
      });
    });

    // Frequency bonus: reward repeated interactions
    const itemInteractionCounts = {};
    events.forEach(event => {
      if (event.itemId && (event.type === 'click' || event.type === 'hover')) {
        itemInteractionCounts[event.itemId] = (itemInteractionCounts[event.itemId] || 0) + 1;
      }
    });

    Object.entries(itemInteractionCounts).forEach(([itemId, count]) => {
      if (count >= 2) {
        const item = this.catalog.getItem(itemId);
        if (!item) return;
        const bonus = Math.log2(count);
        if (item.group) {
          groupCounts[item.group] = (groupCounts[item.group] || 0) + bonus;
        }
        item.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + bonus;
        });
      }
    });

    // --- Pattern detection ---

    // Group interest (replaces region_interest)
    const topGroups = this._topEntries(groupCounts, 3);
    topGroups.forEach(([group, count]) => {
      if (count < 3) return;
      const topTag = this._topNonGroupTag(tagCounts);
      intents.push({
        id: this._id(),
        timestamp: Date.now(),
        summary: topTag
          ? `Interested in ${group} — ${topTag[0]}`
          : `Exploring ${group}`,
        tags: [group, ...(topTag ? [topTag[0]] : [])],
        confidence: Math.min(count / 10, 1.0),
        category: 'group_interest',
        sourceEventCount: count,
      });
    });

    // Price preference (detect price:* tags)
    const priceTags = {};
    let totalPriceEvents = 0;
    Object.entries(tagCounts).forEach(([tag, count]) => {
      if (tag.startsWith('price:')) {
        priceTags[tag] = count;
        totalPriceEvents += count;
      }
    });
    if (totalPriceEvents >= 3) {
      const topPrice = this._topEntry(priceTags);
      if (topPrice && topPrice[1] / totalPriceEvents >= 0.5) {
        const label = topPrice[0].replace('price:', '');
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Looking for ${label} options`,
          tags: [topPrice[0]],
          confidence: Math.min(topPrice[1] / totalPriceEvents, 1.0),
          category: 'price_preference',
          sourceEventCount: topPrice[1],
        });
      }
    }

    // Tag affinity (replaces trip_type)
    const nonPriceTags = {};
    Object.entries(tagCounts).forEach(([tag, count]) => {
      if (!tag.startsWith('price:')) nonPriceTags[tag] = count;
    });
    const totalTagEvents = Object.values(nonPriceTags).reduce((a, b) => a + b, 0);
    if (totalTagEvents >= 3) {
      const topTag = this._topEntry(nonPriceTags);
      if (topTag && topTag[1] / totalTagEvents >= 0.35) {
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Interested in ${topTag[0]}`,
          tags: [topTag[0]],
          confidence: Math.min(topTag[1] / totalTagEvents, 1.0),
          category: 'tag_affinity',
          sourceEventCount: topTag[1],
        });
      }
    }

    // Search intent
    searchQueries.forEach(query => {
      intents.push({
        id: this._id(),
        timestamp: Date.now(),
        summary: `Searched for "${query}"`,
        tags: [query.toLowerCase()],
        confidence: 0.9,
        category: 'search_intent',
        sourceEventCount: 1,
      });
    });

    // Comparison detection
    if (clickedIds.length >= 2) {
      const uniqueClicked = [...new Set(clickedIds)];
      if (uniqueClicked.length >= 2 && uniqueClicked.length <= 3) {
        const names = uniqueClicked.map(id => this.catalog.getItem(id)?.name || id);
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Comparing ${names.join(' and ')}`,
          tags: uniqueClicked.flatMap(id => this.catalog.getItem(id)?.tags || []),
          confidence: 0.85,
          category: 'comparison',
          sourceEventCount: clickedIds.length,
        });
      }
    }

    // Hover interest: 2+ hovers in same group (non-clicked)
    const uniqueHovered = [...new Set(hoveredIds)];
    const hoveredNotClicked = uniqueHovered.filter(id => !clickedIds.includes(id));
    if (hoveredNotClicked.length >= 2) {
      Object.entries(hoversByGroup).forEach(([group, hovers]) => {
        const uniqueInGroup = [...new Set(
          hovers.filter(h => hoveredNotClicked.includes(h.itemId)).map(h => h.itemId)
        )];
        if (uniqueInGroup.length >= 2) {
          const totalHoverMs = hovers.reduce((sum, h) => sum + h.hoverMs, 0);
          const topTag = this._topNonGroupTag(tagCounts);
          intents.push({
            id: this._id(),
            timestamp: Date.now(),
            summary: topTag
              ? `Considering ${topTag[0]} options in ${group}`
              : `Browsing ${group} with interest`,
            tags: [group, ...(topTag ? [topTag[0]] : [])],
            confidence: Math.min(totalHoverMs / 10000, 0.9),
            category: 'hover_interest',
            sourceEventCount: hovers.length,
          });
        }
      });
    }

    return this._dedupe(intents);
  }

  _topNonGroupTag(tagCounts) {
    const entries = Object.entries(tagCounts).filter(([t]) => !t.startsWith('price:'));
    return entries.sort((a, b) => b[1] - a[1])[0] || null;
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
      const key = intent.category + ':' + intent.tags.slice().sort().join(',');
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
