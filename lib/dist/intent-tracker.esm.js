// src/catalog.js
var DEFAULT_ATTRS = {
  id: "data-ik-id",
  tags: "data-ik-tags",
  group: "data-ik-group",
  name: "data-ik-name",
  price: "data-ik-price"
};
function createCatalog(attrMap = {}) {
  const attrs = { ...DEFAULT_ATTRS, ...attrMap };
  const items = /* @__PURE__ */ new Map();
  function getSelector() {
    return `[${attrs.id}]`;
  }
  function readAttr(el, field) {
    if (attrMap[field] && attrMap[field] !== DEFAULT_ATTRS[field]) {
      const val = el.getAttribute(attrMap[field]);
      if (val != null)
        return val;
    }
    return el.getAttribute(DEFAULT_ATTRS[field]);
  }
  function parseElement(el) {
    const id = readAttr(el, "id");
    if (!id)
      return null;
    const rawTags = readAttr(el, "tags") || "";
    const tags = rawTags.split(",").map((t) => t.trim()).filter(Boolean);
    const price = readAttr(el, "price");
    if (price) {
      tags.push("price:" + price.trim());
    }
    const group = readAttr(el, "group") || null;
    const name = readAttr(el, "name") || id;
    return { id, tags, group, name, element: el };
  }
  function scanItems(root) {
    const els = root.querySelectorAll(getSelector());
    els.forEach((el) => {
      const item = parseElement(el);
      if (item)
        items.set(item.id, item);
    });
    return items;
  }
  function scanNewElements(elements) {
    const added = [];
    elements.forEach((el) => {
      if (el.matches && el.matches(getSelector())) {
        _processElement(el, added);
      }
      if (el.querySelectorAll) {
        el.querySelectorAll(getSelector()).forEach((child) => {
          _processElement(child, added);
        });
      }
    });
    return added;
  }
  function _processElement(el, added) {
    const item = parseElement(el);
    if (!item)
      return;
    const existing = items.get(item.id);
    if (!existing) {
      items.set(item.id, item);
      added.push(item);
    } else if (existing.element !== el) {
      existing.element = el;
      item.element = el;
      added.push(item);
    }
  }
  function getItem(id) {
    return items.get(id) || null;
  }
  function getAllItems() {
    return Array.from(items.values());
  }
  return { scanItems, scanNewElements, getItem, getAllItems, getSelector };
}

// src/event-collector.js
var VIEW_THRESHOLD = 0.5;
var MIN_DWELL_MS = 800;
var MIN_HOVER_MS = 1e3;
function createEventCollector({ catalog, flushInterval = 5e3, trackViews = false, onEvent, onFlush }) {
  const eventBuffer = [];
  const viewTimers = /* @__PURE__ */ new Map();
  const hoverTimers = /* @__PURE__ */ new Map();
  const attachedElements = /* @__PURE__ */ new WeakSet();
  let flushTimer = null;
  let destroyed = false;
  const observer = trackViews ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const id = entry.target.__ikId;
      if (!id)
        return;
      if (entry.isIntersecting) {
        viewTimers.set(id, { start: Date.now() });
      } else {
        const timer = viewTimers.get(id);
        if (timer) {
          const dwellMs = Date.now() - timer.start;
          viewTimers.delete(id);
          if (dwellMs >= MIN_DWELL_MS) {
            pushEvent({ type: "view", timestamp: Date.now(), itemId: id, dwellMs, query: null });
          }
        }
      }
    });
  }, { root: null, threshold: VIEW_THRESHOLD }) : null;
  function pushEvent(event) {
    eventBuffer.push(event);
    if (onEvent)
      onEvent(event);
  }
  function attachElement(el, itemId) {
    if (attachedElements.has(el))
      return;
    attachedElements.add(el);
    el.__ikId = itemId;
    if (observer)
      observer.observe(el);
    el.addEventListener("mouseenter", () => {
      hoverTimers.set(itemId, { start: Date.now() });
    });
    el.addEventListener("mouseleave", () => {
      const timer = hoverTimers.get(itemId);
      if (timer) {
        const hoverMs = Date.now() - timer.start;
        hoverTimers.delete(itemId);
        if (hoverMs >= MIN_HOVER_MS) {
          pushEvent({ type: "hover", timestamp: Date.now(), itemId, dwellMs: hoverMs, query: null });
        }
      }
    });
    el.addEventListener("click", () => {
      pushEvent({ type: "click", timestamp: Date.now(), itemId, dwellMs: null, query: null });
    });
  }
  function observe(elements) {
    elements.forEach((el) => {
      const item = catalog.getItem(el.__ikId || el.getAttribute(catalog.getSelector().slice(1, -1)));
      if (item)
        attachElement(el, item.id);
    });
  }
  function observeNew(items) {
    items.forEach((item) => {
      if (item.element)
        attachElement(item.element, item.id);
    });
  }
  let lastFlushedLength = 0;
  flushTimer = setInterval(() => {
    if (eventBuffer.length > lastFlushedLength && onFlush) {
      lastFlushedLength = eventBuffer.length;
      onFlush([...eventBuffer]);
    }
  }, flushInterval);
  function handleUnload() {
    viewTimers.forEach((timer, id) => {
      const dwellMs = Date.now() - timer.start;
      if (dwellMs >= MIN_DWELL_MS) {
        eventBuffer.push({ type: "view", timestamp: Date.now(), itemId: id, dwellMs, query: null });
      }
    });
    if (eventBuffer.length > 0 && onFlush) {
      onFlush([...eventBuffer]);
    }
  }
  window.addEventListener("beforeunload", handleUnload);
  return {
    observe,
    observeNew,
    trackClick(itemId) {
      pushEvent({ type: "click", timestamp: Date.now(), itemId, dwellMs: null, query: null });
    },
    trackSearch(query) {
      pushEvent({ type: "search", timestamp: Date.now(), itemId: null, dwellMs: null, query });
    },
    trackTabView(tabId, tags = []) {
      pushEvent({ type: "tab_view", timestamp: Date.now(), itemId: null, dwellMs: null, query: null, tabId, tags });
    },
    trackPageView(pageMeta) {
      pushEvent({ type: "page_view", timestamp: Date.now(), itemId: null, dwellMs: null, query: null, pageMeta });
    },
    getEvents() {
      return [...eventBuffer];
    },
    clearBuffer() {
      eventBuffer.length = 0;
    },
    destroy() {
      if (destroyed)
        return;
      destroyed = true;
      clearInterval(flushTimer);
      if (observer)
        observer.disconnect();
      window.removeEventListener("beforeunload", handleUnload);
    }
  };
}

// src/intent-summarizer.js
var IntentSummarizer = class {
  constructor(catalog) {
    this.catalog = catalog;
  }
  _eventWeight(eventType, category) {
    if (eventType === "click")
      return category === "tag" ? 2 : 3;
    if (eventType === "hover")
      return category === "tag" ? 1.5 : 2;
    if (eventType === "tab_view")
      return category === "tag" ? 1.5 : 2;
    return 1;
  }
  summarize(events) {
    const intents = [];
    const groupCounts = {};
    const tagCounts = {};
    const clickedIds = [];
    const hoveredIds = [];
    const searchQueries = [];
    const hoversByGroup = {};
    const now = Date.now();
    const sessionStartMs = events.length > 0 ? events[0].timestamp : now;
    const sessionSpanMs = Math.max(now - sessionStartMs, 1);
    events.forEach((event) => {
      if (event.type === "page_view")
        return;
      if (event.type === "tab_view") {
        const age2 = (event.timestamp - sessionStartMs) / sessionSpanMs;
        const recencyMultiplier2 = 0.5 + 0.5 * age2;
        (event.tags || []).forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + this._eventWeight("tab_view", "tag") * recencyMultiplier2;
        });
        return;
      }
      if (event.type === "search" && event.query) {
        searchQueries.push(event.query);
        return;
      }
      const item = this.catalog.getItem(event.itemId);
      if (!item)
        return;
      if (event.type === "click")
        clickedIds.push(item.id);
      if (event.type === "hover") {
        hoveredIds.push(item.id);
        if (item.group) {
          if (!hoversByGroup[item.group])
            hoversByGroup[item.group] = [];
          hoversByGroup[item.group].push({ itemId: item.id, hoverMs: event.dwellMs || 0 });
        }
      }
      const age = (event.timestamp - sessionStartMs) / sessionSpanMs;
      const recencyMultiplier = 0.5 + 0.5 * age;
      if (item.group) {
        groupCounts[item.group] = (groupCounts[item.group] || 0) + this._eventWeight(event.type, "group") * recencyMultiplier;
      }
      item.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + this._eventWeight(event.type, "tag") * recencyMultiplier;
      });
    });
    const itemInteractionCounts = {};
    events.forEach((event) => {
      if (event.itemId && (event.type === "click" || event.type === "hover")) {
        itemInteractionCounts[event.itemId] = (itemInteractionCounts[event.itemId] || 0) + 1;
      }
    });
    Object.entries(itemInteractionCounts).forEach(([itemId, count]) => {
      if (count >= 2) {
        const item = this.catalog.getItem(itemId);
        if (!item)
          return;
        const bonus = Math.log2(count);
        if (item.group) {
          groupCounts[item.group] = (groupCounts[item.group] || 0) + bonus;
        }
        item.tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + bonus;
        });
      }
    });
    const topGroups = this._topEntries(groupCounts, 3);
    topGroups.forEach(([group, count]) => {
      if (count < 3)
        return;
      const topTag = this._topNonGroupTag(tagCounts);
      intents.push({
        id: this._id(),
        timestamp: Date.now(),
        summary: topTag ? `Interested in ${group} \u2014 ${topTag[0]}` : `Exploring ${group}`,
        tags: [group, ...topTag ? [topTag[0]] : []],
        confidence: Math.min(count / 10, 1),
        category: "group_interest",
        sourceEventCount: count
      });
    });
    const priceTags = {};
    let totalPriceEvents = 0;
    Object.entries(tagCounts).forEach(([tag, count]) => {
      if (tag.startsWith("price:")) {
        priceTags[tag] = count;
        totalPriceEvents += count;
      }
    });
    if (totalPriceEvents >= 3) {
      const topPrice = this._topEntry(priceTags);
      if (topPrice && topPrice[1] / totalPriceEvents >= 0.5) {
        const label = topPrice[0].replace("price:", "");
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Looking for ${label} options`,
          tags: [topPrice[0]],
          confidence: Math.min(topPrice[1] / totalPriceEvents, 1),
          category: "price_preference",
          sourceEventCount: topPrice[1]
        });
      }
    }
    const nonPriceTags = {};
    Object.entries(tagCounts).forEach(([tag, count]) => {
      if (!tag.startsWith("price:"))
        nonPriceTags[tag] = count;
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
          confidence: Math.min(topTag[1] / totalTagEvents, 1),
          category: "tag_affinity",
          sourceEventCount: topTag[1]
        });
      }
    }
    searchQueries.forEach((query) => {
      intents.push({
        id: this._id(),
        timestamp: Date.now(),
        summary: `Searched for "${query}"`,
        tags: [query.toLowerCase()],
        confidence: 0.9,
        category: "search_intent",
        sourceEventCount: 1
      });
    });
    if (clickedIds.length >= 2) {
      const uniqueClicked = [...new Set(clickedIds)];
      if (uniqueClicked.length >= 2 && uniqueClicked.length <= 3) {
        const names = uniqueClicked.map((id) => this.catalog.getItem(id)?.name || id);
        intents.push({
          id: this._id(),
          timestamp: Date.now(),
          summary: `Comparing ${names.join(" and ")}`,
          tags: uniqueClicked.flatMap((id) => this.catalog.getItem(id)?.tags || []),
          confidence: 0.85,
          category: "comparison",
          sourceEventCount: clickedIds.length
        });
      }
    }
    const uniqueHovered = [...new Set(hoveredIds)];
    const hoveredNotClicked = uniqueHovered.filter((id) => !clickedIds.includes(id));
    if (hoveredNotClicked.length >= 2) {
      Object.entries(hoversByGroup).forEach(([group, hovers]) => {
        const uniqueInGroup = [...new Set(
          hovers.filter((h) => hoveredNotClicked.includes(h.itemId)).map((h) => h.itemId)
        )];
        if (uniqueInGroup.length >= 2) {
          const totalHoverMs = hovers.reduce((sum, h) => sum + h.hoverMs, 0);
          const topTag = this._topNonGroupTag(tagCounts);
          intents.push({
            id: this._id(),
            timestamp: Date.now(),
            summary: topTag ? `Considering ${topTag[0]} options in ${group}` : `Browsing ${group} with interest`,
            tags: [group, ...topTag ? [topTag[0]] : []],
            confidence: Math.min(totalHoverMs / 1e4, 0.9),
            category: "hover_interest",
            sourceEventCount: hovers.length
          });
        }
      });
    }
    return this._dedupe(intents);
  }
  _topNonGroupTag(tagCounts) {
    const entries = Object.entries(tagCounts).filter(([t]) => !t.startsWith("price:"));
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
    const byCategory = /* @__PURE__ */ new Map();
    intents.forEach((intent) => {
      const key = intent.category + ":" + intent.tags.slice().sort().join(",");
      const existing = byCategory.get(key);
      if (!existing || intent.confidence > existing.confidence) {
        byCategory.set(key, intent);
      }
    });
    return Array.from(byCategory.values());
  }
  _id() {
    return "intent-" + Math.random().toString(36).slice(2, 10);
  }
};

// src/intent-store.js
var IntentStore = class {
  constructor(storageKey = "ik_profile") {
    this.storageKey = storageKey;
    this.profile = this._load();
  }
  saveSessionIntents(sessionId, intents) {
    let session = this.profile.sessions.find((s) => s.sessionId === sessionId);
    if (!session) {
      session = { sessionId, startedAt: Date.now(), intents: [] };
      this.profile.sessions.push(session);
    }
    const activeKeys = new Set(
      intents.map((i) => i.category + ":" + i.tags.slice().sort().join(","))
    );
    session.intents.forEach((existing) => {
      const key = existing.category + ":" + existing.tags.slice().sort().join(",");
      if (!activeKeys.has(key)) {
        existing.confidence = (existing.confidence || 0) * 0.8;
        if (existing.confidence < 0.05)
          existing.active = false;
      }
    });
    intents.forEach((newIntent) => {
      const key = newIntent.category + ":" + newIntent.tags.slice().sort().join(",");
      const idx = session.intents.findIndex(
        (i) => i.category + ":" + i.tags.slice().sort().join(",") === key
      );
      newIntent.active = true;
      if (idx >= 0) {
        session.intents[idx] = newIntent;
      } else {
        session.intents.push(newIntent);
      }
    });
    this._computeTagWeights();
    this._save();
  }
  getProfile() {
    return this.profile;
  }
  clearAll() {
    this.profile = this._createEmpty();
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
    }
  }
  _computeTagWeights() {
    const weights = {};
    const sessionCount = this.profile.sessions.length;
    this.profile.sessions.forEach((session, index) => {
      const sessionsAgo = sessionCount - 1 - index;
      const decay = Math.pow(0.8, sessionsAgo);
      session.intents.forEach((intent) => {
        if (intent.active === false)
          return;
        intent.tags.forEach((tag) => {
          weights[tag] = (weights[tag] || 0) + intent.confidence * decay;
        });
      });
    });
    this.profile.tagWeights = weights;
  }
  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw)
        return JSON.parse(raw);
    } catch (e) {
    }
    return this._createEmpty();
  }
  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    } catch (e) {
    }
  }
  _createEmpty() {
    return {
      userId: "user-" + Math.random().toString(36).slice(2, 10),
      sessions: [],
      tagWeights: {}
    };
  }
};

// src/recommendation-engine.js
var RecommendationEngine = class {
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
    const scored = items.map((item) => {
      let score = 0;
      const matchedTags = [];
      item.tags.forEach((tag) => {
        if (weights[tag]) {
          score += weights[tag];
          matchedTags.push({ tag, weight: weights[tag] });
        }
      });
      if (item.tags.length > 0) {
        score = score / Math.sqrt(item.tags.length);
      }
      matchedTags.sort((a, b) => b.weight - a.weight);
      return { item, score, matchedTags };
    });
    scored.sort((a, b) => b.score - a.score);
    const groupCount = {};
    const results = [];
    for (const entry of scored) {
      if (entry.score <= 0)
        break;
      if (results.length >= maxResults)
        break;
      if (entry.item.group) {
        groupCount[entry.item.group] = (groupCount[entry.item.group] || 0) + 1;
        if (groupCount[entry.item.group] > this.maxPerGroup)
          continue;
      }
      const topTag = entry.matchedTags[0];
      const reason = topTag ? `Based on your interest in ${topTag.tag}` : "Recommended for you";
      results.push({
        itemId: entry.item.id,
        item: entry.item,
        score: Math.round(entry.score * 100) / 100,
        reason,
        matchedTags: entry.matchedTags.map((t) => t.tag)
      });
    }
    return results;
  }
};

// src/debug-panel.js
var CSS = `
.__ik-fab {
  position: fixed; bottom: 1.5rem; right: 1.5rem;
  width: 48px; height: 48px; border-radius: 50%;
  background: #1c1c1c; color: #ff6b35; border: none;
  font-size: 1.3rem; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s, background 0.2s;
  font-family: system-ui, sans-serif;
}
.__ik-fab:hover { transform: scale(1.1); background: #2a2a2a; }

.__ik-panel {
  position: fixed; top: 0; right: -400px; width: 400px; height: 100vh;
  background: #1c1c1c; color: #e0e0e0; z-index: 100000;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  transition: right 0.3s ease;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.82rem;
}
.__ik-panel.__ik-open { right: 0; }

.__ik-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 1rem; background: #111; border-bottom: 1px solid #333;
}
.__ik-title { font-weight: 700; font-size: 0.95rem; color: #ff6b35; }
.__ik-close {
  background: none; border: none; color: #888; font-size: 1.3rem;
  cursor: pointer; padding: 0.2rem;
}
.__ik-close:hover { color: white; }

.__ik-tabs {
  display: flex; background: #111; border-bottom: 1px solid #333; padding: 0 0.5rem;
}
.__ik-tab {
  background: none; border: none; color: #888; padding: 0.5rem 0.75rem;
  font-size: 0.78rem; cursor: pointer; border-bottom: 2px solid transparent;
  font-family: inherit; transition: color 0.15s, border-color 0.15s;
}
.__ik-tab:hover { color: #e0e0e0; }
.__ik-tab.__ik-active { color: #ff6b35; border-bottom-color: #ff6b35; }

.__ik-content { flex: 1; overflow-y: auto; padding: 0.75rem; }
.__ik-empty { color: #666; text-align: center; padding: 2rem 1rem; font-style: italic; }

.__ik-event {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #555; line-height: 1.4;
}
.__ik-event.__ik-click { border-left-color: #ff6b35; }
.__ik-event.__ik-hover { border-left-color: #14b8a6; }
.__ik-event.__ik-view { border-left-color: #10b981; }
.__ik-event.__ik-search { border-left-color: #a78bfa; }
.__ik-event.__ik-page_view { border-left-color: #3b82f6; }
.__ik-event.__ik-booking_started { border-left-color: #f59e0b; }
.__ik-event.__ik-checkout_step { border-left-color: #f59e0b; }
.__ik-event.__ik-add_to_cart { border-left-color: #84cc16; }
.__ik-event.__ik-checkout_abandoned { border-left-color: #ef4444; background: #2a1818; }
.__ik-event.__ik-booking_complete { border-left-color: #10b981; background: #0f2820; }

.__ik-etype {
  font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em;
}
.__ik-etype.__ik-click { color: #ff6b35; }
.__ik-etype.__ik-hover { color: #14b8a6; }
.__ik-etype.__ik-view { color: #10b981; }
.__ik-etype.__ik-search { color: #a78bfa; }
.__ik-etype.__ik-page_view { color: #3b82f6; }
.__ik-etype.__ik-booking_started { color: #fbbf24; }
.__ik-etype.__ik-checkout_step { color: #fbbf24; }
.__ik-etype.__ik-add_to_cart { color: #a3e635; }
.__ik-etype.__ik-checkout_abandoned { color: #f87171; }
.__ik-etype.__ik-booking_complete { color: #34d399; }
.__ik-step-pill {
  display: inline-block; padding: 0.05rem 0.4rem; margin-left: 0.4rem;
  border-radius: 999px; background: #3a2e1a; color: #fbbf24;
  font-size: 0.68rem; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase;
}
.__ik-event.__ik-checkout_abandoned .__ik-step-pill { background: #3a1818; color: #fca5a5; }
.__ik-event.__ik-booking_complete .__ik-step-pill { background: #14321f; color: #6ee7b7; }
.__ik-event.__ik-add_to_cart .__ik-step-pill { background: #1f2e10; color: #bef264; }
.__ik-edetail { color: #ccc; }
.__ik-etime { color: #666; font-size: 0.72rem; }

.__ik-intent {
  padding: 0.6rem 0.7rem; margin-bottom: 0.4rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #ff6b35;
}
.__ik-intent.__ik-inactive { opacity: 0.45; border-left-color: #555; background: #222; }
.__ik-isummary { color: #ffc4b0; font-weight: 600; margin-bottom: 0.2rem; }
.__ik-intent.__ik-inactive .__ik-isummary { color: #888; }
.__ik-imeta { color: #666; font-size: 0.72rem; }
.__ik-conf {
  display: inline-block; padding: 0.1rem 0.3rem; border-radius: 2px;
  font-size: 0.68rem; font-weight: 600;
}
.__ik-conf.__ik-high { background: #065f46; color: #6ee7b7; }
.__ik-conf.__ik-medium { background: #4a2c1a; color: #ffc4b0; }
.__ik-conf.__ik-low { background: #333; color: #999; }
.__ik-faded {
  font-size: 0.6rem; font-weight: 400; color: #666; background: #333;
  padding: 0.1rem 0.35rem; border-radius: 2px; margin-left: 0.4rem;
  text-transform: uppercase; letter-spacing: 0.5px;
}

.__ik-psection { margin-bottom: 1rem; }
.__ik-psection h4 {
  color: #ff6b35; font-size: 0.78rem; text-transform: uppercase;
  letter-spacing: 0.05em; margin: 0 0 0.4rem 0;
}
.__ik-tw {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.25rem 0.5rem; margin-bottom: 0.2rem; background: #2a2a2a; border-radius: 2px;
}
.__ik-tw-name { color: #e0e0e0; }
.__ik-tw-bar { flex: 1; margin: 0 0.5rem; height: 4px; background: #1c1c1c; border-radius: 2px; overflow: hidden; }
.__ik-tw-fill { height: 100%; background: #ff6b35; border-radius: 2px; }
.__ik-tw-val { color: #888; font-size: 0.72rem; min-width: 2.5rem; text-align: right; }

.__ik-rec {
  padding: 0.5rem 0.7rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #1a2e1a; border-left: 3px solid #10b981;
}
.__ik-rec-name { color: #6ee7b7; font-weight: 600; }
.__ik-rec-reason { color: #888; font-size: 0.75rem; }
.__ik-rec-score { color: #10b981; font-weight: 700; font-size: 0.72rem; }

.__ik-footer { padding: 0.6rem; background: #111; border-top: 1px solid #333; }
.__ik-clear {
  width: 100%; padding: 0.5rem; background: #991b1b; color: #fecaca;
  border: none; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; font-family: inherit; transition: background 0.15s;
}
.__ik-clear:hover { background: #b91c1c; }

.__ik-jnode {
  display: inline-block; padding: 0.25rem 0.6rem; border-radius: 2px;
  background: #2a2a2a; color: #e0e0e0; font-size: 0.78rem; font-weight: 600;
}
.__ik-jnode.__ik-current { background: #065f46; color: #6ee7b7; }
.__ik-jarrow {
  display: inline-block; color: #ff6b35; margin: 0 0.3rem;
  font-size: 0.85rem; font-weight: 700;
}
.__ik-jpath { margin-bottom: 1rem; line-height: 2; }
.__ik-jtransition {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #a78bfa; line-height: 1.4;
  display: flex; justify-content: space-between; align-items: center;
}
.__ik-jtransition-label { color: #e0e0e0; }
.__ik-jtransition-count { color: #a78bfa; font-weight: 700; font-size: 0.78rem; }
.__ik-jprediction {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #1a2e1a; border-left: 3px solid #10b981; line-height: 1.4;
  display: flex; justify-content: space-between; align-items: center;
}
.__ik-jprediction-label { color: #6ee7b7; }
.__ik-jprediction-prob { color: #10b981; font-weight: 700; font-size: 0.78rem; }

@media (max-width: 768px) {
  .__ik-panel { width: 100%; right: -100%; }
}
`;
function createDebugPanel({ onClear, journeyTracker }) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const fab = document.createElement("button");
  fab.className = "__ik-fab";
  fab.innerHTML = "&#9881;";
  fab.title = "SignalTracker Debug";
  const panel = document.createElement("div");
  panel.className = "__ik-panel";
  panel.innerHTML = `
    <div class="__ik-header">
      <span class="__ik-title">SignalTracker Debug</span>
      <button class="__ik-close">&times;</button>
    </div>
    <div class="__ik-tabs">
      <button class="__ik-tab __ik-active" data-tab="events">Events</button>
      <button class="__ik-tab" data-tab="intents">Signals</button>
      <button class="__ik-tab" data-tab="profile">Profile</button>
      <button class="__ik-tab" data-tab="recs">Recs</button>
      <button class="__ik-tab" data-tab="journey">Journey</button>
    </div>
    <div class="__ik-content"></div>
    <div class="__ik-footer">
      <button class="__ik-clear">Clear All Data</button>
    </div>
  `;
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  const content = panel.querySelector(".__ik-content");
  const tabs = panel.querySelectorAll(".__ik-tab");
  let currentTab = "events";
  const SK_EVENTS = "__ik_debug_events";
  const SK_INTENTS = "__ik_debug_intents";
  const SK_RECS = "__ik_debug_recs";
  function loadSession(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : [];
    } catch (e) {
      return [];
    }
  }
  function saveSession(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
    }
  }
  const eventLog = loadSession(SK_EVENTS);
  const intentLog = loadSession(SK_INTENTS);
  let profileData = null;
  let recsData = loadSession(SK_RECS);
  fab.addEventListener("click", () => {
    panel.classList.add("__ik-open");
    fab.style.display = "none";
  });
  panel.querySelector(".__ik-close").addEventListener("click", () => {
    panel.classList.remove("__ik-open");
    fab.style.display = "flex";
  });
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("__ik-active"));
      tab.classList.add("__ik-active");
      currentTab = tab.dataset.tab;
      render();
    });
  });
  panel.querySelector(".__ik-clear").addEventListener("click", () => {
    eventLog.length = 0;
    intentLog.length = 0;
    profileData = null;
    recsData = [];
    saveSession(SK_EVENTS, []);
    saveSession(SK_INTENTS, []);
    saveSession(SK_RECS, []);
    if (onClear)
      onClear();
    render();
  });
  function render() {
    switch (currentTab) {
      case "events":
        renderEvents();
        break;
      case "intents":
        renderIntents();
        break;
      case "profile":
        renderProfile();
        break;
      case "recs":
        renderRecs();
        break;
      case "journey":
        renderJourney();
        break;
    }
  }
  function renderEvents() {
    if (eventLog.length === 0) {
      content.innerHTML = '<div class="__ik-empty">Interact with the page to see events...</div>';
      return;
    }
    content.innerHTML = [...eventLog].reverse().map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      let detail = "";
      switch (e.type) {
        case "view":
          detail = `${e.itemId} (${Math.round(e.dwellMs / 100) / 10}s)`;
          break;
        case "hover":
          detail = `${e.itemId} (${Math.round(e.dwellMs / 100) / 10}s hover)`;
          break;
        case "click":
          detail = e.itemId;
          break;
        case "search":
          detail = `"${e.query}"`;
          break;
        case "tab_view":
          detail = e.tabId + (e.tags && e.tags.length ? ` [${e.tags.join(", ")}]` : "");
          break;
        case "page_view":
          detail = e.pageMeta ? e.pageMeta.name : "page";
          break;
        case "booking_started":
        case "checkout_step":
        case "booking_complete": {
          const step = e.funnelStep || "?";
          const idx = typeof e.stepIndex === "number" ? e.stepIndex + 1 : "?";
          detail = `${e.destinationId || ""} <span class="__ik-step-pill">step ${idx}/4 \xB7 ${step}</span>`;
          break;
        }
        case "add_to_cart": {
          const rate = e.nightlyRate ? ` $${e.nightlyRate}/nt` : "";
          detail = `${e.destinationId || ""} ${e.roomId || ""}${rate} <span class="__ik-step-pill">room picked</span>`;
          break;
        }
        case "checkout_abandoned": {
          const step = e.funnelStep || "?";
          const idx = typeof e.stepIndex === "number" ? e.stepIndex + 1 : "?";
          const reason = e.reason ? ` \xB7 ${e.reason.replace(/_/g, " ")}` : "";
          detail = `${e.destinationId || ""} <span class="__ik-step-pill">abandoned step ${idx}/4 \xB7 ${step}${reason}</span>`;
          break;
        }
      }
      return `<div class="__ik-event __ik-${e.type}">
        <span class="__ik-etype __ik-${e.type}">${e.type}</span>
        <span class="__ik-edetail">${detail}</span>
        <span class="__ik-etime">${time}</span>
      </div>`;
    }).join("");
  }
  function renderIntents() {
    if (intentLog.length === 0) {
      content.innerHTML = '<div class="__ik-empty">No signals detected yet...</div>';
      return;
    }
    const sorted = intentLog.slice().sort((a, b) => {
      const aA = a.active !== false ? 1 : 0;
      const bA = b.active !== false ? 1 : 0;
      if (aA !== bA)
        return bA - aA;
      return b.confidence - a.confidence;
    });
    content.innerHTML = sorted.map((i) => {
      const cl = i.confidence >= 0.7 ? "high" : i.confidence >= 0.4 ? "medium" : "low";
      const inactive = i.active === false;
      return `<div class="__ik-intent${inactive ? " __ik-inactive" : ""}">
        <div class="__ik-isummary">${i.summary}${inactive ? ' <span class="__ik-faded">faded</span>' : ""}</div>
        <div class="__ik-imeta">
          <span class="__ik-conf __ik-${cl}">${Math.round(i.confidence * 100)}%</span>
          ${i.category} \xB7 ${Math.round(i.sourceEventCount)} events \xB7 [${i.tags.join(", ")}]
        </div>
      </div>`;
    }).join("");
  }
  function renderProfile() {
    if (!profileData || Object.keys(profileData.tagWeights).length === 0) {
      content.innerHTML = '<div class="__ik-empty">No profile data yet.</div>';
      return;
    }
    const weights = Object.entries(profileData.tagWeights).sort((a, b) => b[1] - a[1]);
    const max = weights.length > 0 ? weights[0][1] : 1;
    content.innerHTML = `
      <div class="__ik-psection"><h4>Sessions: ${profileData.sessions.length}</h4></div>
      <div class="__ik-psection"><h4>Tag Weights</h4>
        ${weights.map(([tag, w]) => `
          <div class="__ik-tw">
            <span class="__ik-tw-name">${tag}</span>
            <div class="__ik-tw-bar"><div class="__ik-tw-fill" style="width:${w / max * 100}%"></div></div>
            <span class="__ik-tw-val">${w.toFixed(2)}</span>
          </div>
        `).join("")}
      </div>`;
  }
  function renderRecs() {
    if (recsData.length === 0) {
      content.innerHTML = '<div class="__ik-empty">No recommendations yet.</div>';
      return;
    }
    content.innerHTML = recsData.map((r) => `
      <div class="__ik-rec">
        <div class="__ik-rec-name">${r.item?.name || r.itemId}</div>
        <div class="__ik-rec-reason">${r.reason}</div>
        <div class="__ik-rec-score">Score: ${r.score} \xB7 Tags: [${r.matchedTags.join(", ")}]</div>
      </div>
    `).join("");
  }
  function renderJourney() {
    if (!journeyTracker) {
      content.innerHTML = '<div class="__ik-empty">Journey tracking not enabled.</div>';
      return;
    }
    const currentPath = journeyTracker.getCurrentPath();
    const currentPage = journeyTracker.getCurrentPage();
    const transitions = journeyTracker.getTopTransitions(10);
    const predictions = currentPage ? journeyTracker.predictNextPages(currentPage.name, 3) : [];
    let html = "";
    html += '<div class="__ik-psection"><h4>Current Path</h4>';
    if (currentPath.length === 0) {
      html += '<div class="__ik-empty">No pages visited yet.</div>';
    } else {
      html += '<div class="__ik-jpath">';
      currentPath.forEach((pageName, i) => {
        const isCurrent = currentPage && pageName === currentPage.name && i === currentPath.length - 1;
        html += `<span class="__ik-jnode${isCurrent ? " __ik-current" : ""}">${pageName}</span>`;
        if (i < currentPath.length - 1) {
          html += '<span class="__ik-jarrow">&rarr;</span>';
        }
      });
      html += "</div>";
    }
    html += "</div>";
    html += '<div class="__ik-psection"><h4>Top Transitions</h4>';
    if (transitions.length === 0) {
      html += '<div class="__ik-empty">No transitions recorded yet.</div>';
    } else {
      transitions.forEach((t) => {
        html += `<div class="__ik-jtransition">
          <span class="__ik-jtransition-label">${t.from} &rarr; ${t.to}</span>
          <span class="__ik-jtransition-count">${t.count}&times;</span>
        </div>`;
      });
    }
    html += "</div>";
    html += '<div class="__ik-psection"><h4>Predicted Next</h4>';
    if (predictions.length === 0) {
      html += '<div class="__ik-empty">Not enough data for predictions.</div>';
    } else {
      predictions.forEach((p) => {
        html += `<div class="__ik-jprediction">
          <span class="__ik-jprediction-label">${p.page}</span>
          <span class="__ik-jprediction-prob">${Math.round(p.probability * 100)}%</span>
        </div>`;
      });
    }
    html += "</div>";
    content.innerHTML = html;
  }
  return {
    logEvent(event) {
      eventLog.push(event);
      if (eventLog.length > 100)
        eventLog.shift();
      saveSession(SK_EVENTS, eventLog);
      if (currentTab === "events")
        render();
    },
    replaceIntents(intents) {
      const activeKeys = new Set(
        intents.map((i) => i.category + ":" + i.tags.slice().sort().join(","))
      );
      intentLog.forEach((existing) => {
        const key = existing.category + ":" + existing.tags.slice().sort().join(",");
        if (!activeKeys.has(key)) {
          existing.confidence = (existing.confidence || 0) * 0.8;
          if (existing.confidence < 0.05)
            existing.active = false;
        }
      });
      intents.forEach((newIntent) => {
        const key = newIntent.category + ":" + newIntent.tags.slice().sort().join(",");
        const idx = intentLog.findIndex(
          (i) => i.category + ":" + i.tags.slice().sort().join(",") === key
        );
        newIntent.active = true;
        if (idx >= 0)
          intentLog[idx] = newIntent;
        else
          intentLog.push(newIntent);
      });
      saveSession(SK_INTENTS, intentLog);
      if (currentTab === "intents")
        render();
    },
    logProfile(profile) {
      profileData = profile;
      if (currentTab === "profile")
        render();
    },
    logRecommendations(recs) {
      recsData = recs;
      saveSession(SK_RECS, recs);
      if (currentTab === "recs")
        render();
    },
    logJourney() {
      if (currentTab === "journey")
        render();
    },
    destroy() {
      fab.remove();
      panel.remove();
      style.remove();
    }
  };
}

// src/journey-tracker.js
var STORAGE_KEY = "ik_journey";
var MAX_STEPS = 200;
var MAX_RECENT_PATHS = 10;
var SESSION_TIMEOUT_MS = 30 * 60 * 1e3;
var CATEGORY_VISIT_THRESHOLD = 3;
function createJourneyTracker() {
  let state = loadState();
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        return JSON.parse(raw);
    } catch (e) {
    }
    return defaultState();
  }
  function defaultState() {
    return {
      currentPage: null,
      currentPath: [],
      steps: [],
      transitionGraph: {},
      pageVisitCounts: {},
      recentPaths: []
    };
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
    }
  }
  function checkSessionBoundary() {
    if (state.currentPage && state.currentPage.enteredAt) {
      const elapsed = Date.now() - state.currentPage.enteredAt;
      if (elapsed > SESSION_TIMEOUT_MS) {
        if (state.currentPath.length > 1) {
          state.recentPaths.push([...state.currentPath]);
          if (state.recentPaths.length > MAX_RECENT_PATHS) {
            state.recentPaths.shift();
          }
        }
        state.currentPage = null;
        state.currentPath = [];
      }
    }
  }
  function recordPageView(pageMeta) {
    checkSessionBoundary();
    const previousPage = state.currentPage;
    const newPage = {
      name: pageMeta.name,
      category: pageMeta.category || null,
      url: pageMeta.url || null,
      enteredAt: Date.now()
    };
    if (previousPage) {
      const step = {
        from: { name: previousPage.name, category: previousPage.category, url: previousPage.url },
        to: { name: newPage.name, category: newPage.category, url: newPage.url },
        timestamp: Date.now()
      };
      state.steps.push(step);
      if (state.steps.length > MAX_STEPS) {
        state.steps = state.steps.slice(-MAX_STEPS);
      }
      const key = previousPage.name + "->" + newPage.name;
      if (!state.transitionGraph[key]) {
        state.transitionGraph[key] = { count: 0, lastSeen: 0 };
      }
      state.transitionGraph[key].count++;
      state.transitionGraph[key].lastSeen = Date.now();
    }
    state.pageVisitCounts[newPage.name] = (state.pageVisitCounts[newPage.name] || 0) + 1;
    state.currentPath.push(newPage.name);
    state.currentPage = newPage;
    persist();
  }
  function predictNextPages(currentPageName, n = 3) {
    const prefix = currentPageName + "->";
    const candidates = [];
    Object.entries(state.transitionGraph).forEach(([key, data]) => {
      if (key.startsWith(prefix)) {
        const targetPage = key.slice(prefix.length);
        const ageMs = Date.now() - data.lastSeen;
        const ageHours = ageMs / (1e3 * 60 * 60);
        const recencyBoost = 1 + Math.max(0, 0.5 - ageHours * 0.02);
        candidates.push({
          page: targetPage,
          score: data.count * recencyBoost
        });
      }
    });
    if (candidates.length === 0)
      return [];
    const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
    return candidates.sort((a, b) => b.score - a.score).slice(0, n).map((c) => ({
      page: c.page,
      probability: Math.round(c.score / totalScore * 100) / 100
    }));
  }
  function getTopTransitions(n = 10) {
    return Object.entries(state.transitionGraph).sort((a, b) => b[1].count - a[1].count).slice(0, n).map(([key, data]) => {
      const [from, to] = key.split("->");
      return { from, to, count: data.count, lastSeen: data.lastSeen };
    });
  }
  function deriveJourneyIntents() {
    const intents = [];
    const categoryCounts = {};
    Object.entries(state.pageVisitCounts).forEach(([pageName, count]) => {
      const step = state.steps.find((s) => s.to.name === pageName || s.from.name === pageName);
      let category = null;
      if (step) {
        category = step.to.name === pageName ? step.to.category : step.from.category;
      }
      if (!category && state.currentPage && state.currentPage.name === pageName) {
        category = state.currentPage.category;
      }
      if (category && category !== "home") {
        categoryCounts[category] = (categoryCounts[category] || 0) + count;
      }
    });
    Object.entries(categoryCounts).forEach(([category, count]) => {
      if (count >= CATEGORY_VISIT_THRESHOLD) {
        intents.push({
          id: "journey-" + category,
          timestamp: Date.now(),
          summary: `Frequently visits ${category} pages`,
          tags: [category],
          confidence: Math.min(count / 10, 1),
          category: "journey_affinity",
          sourceEventCount: count
        });
      }
    });
    return intents;
  }
  function getCurrentPath() {
    return [...state.currentPath];
  }
  function getCurrentPage() {
    return state.currentPage;
  }
  function getState() {
    return { ...state };
  }
  function clearAll() {
    state = defaultState();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
    }
  }
  return {
    recordPageView,
    predictNextPages,
    getTopTransitions,
    deriveJourneyIntents,
    getCurrentPath,
    getCurrentPage,
    getState,
    clearAll
  };
}

// src/emitter.js
function createEmitter({ url, batchMs = 3e3, getUserId, getSessionId }) {
  if (!url)
    throw new Error("emitter: url is required");
  let signalQueue = [];
  let pendingProfile = null;
  let timer = null;
  let lastSignalCount = 0;
  function schedule() {
    if (timer)
      return;
    timer = setTimeout(flush, batchMs);
  }
  function send(body) {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob))
          return;
      }
    } catch (_) {
    }
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {
      });
    } catch (_) {
    }
  }
  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (signalQueue.length === 0 && !pendingProfile)
      return;
    const payload = {
      userId: getUserId(),
      sessionId: getSessionId(),
      pageUrl: typeof location !== "undefined" ? location.pathname : null,
      ts: Date.now(),
      signals: signalQueue,
      profile: pendingProfile
    };
    signalQueue = [];
    pendingProfile = null;
    send(JSON.stringify(payload));
  }
  function queueSignal(ev) {
    signalQueue.push(ev);
    schedule();
  }
  function queueFlushDelta(allEvents) {
    if (allEvents.length <= lastSignalCount)
      return;
    for (let i = lastSignalCount; i < allEvents.length; i++) {
      signalQueue.push(allEvents[i]);
    }
    lastSignalCount = allEvents.length;
    schedule();
  }
  function queueProfile(profile) {
    pendingProfile = profile;
    schedule();
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden")
        flush();
    });
  }
  return { queueSignal, queueFlushDelta, queueProfile, flush };
}

// src/index.js
function create(options = {}) {
  const {
    attributes = {},
    // storageKey is the localStorage key for the user's intent profile.
    // CONTRACT: every page in a deployment that wants a shared "For You"
    // profile must use the same storageKey. The default is what every
    // Wanderlust surface uses; only change it for isolated test fixtures.
    storageKey = "ik_profile",
    flushInterval = 5e3,
    debug = false,
    root = document.body,
    pageMeta = null,
    trackViews = false,
    onIntentsChanged = null,
    onRecommendations = null,
    emit = null
    // string URL or { url, batchMs }
  } = options;
  const sessionId = "session-" + Date.now();
  const catalog = createCatalog(attributes);
  const store = new IntentStore(storageKey);
  const summarizer = new IntentSummarizer(catalog);
  const recEngine = new RecommendationEngine(catalog);
  let debugPanel = null;
  let currentIntents = [];
  let emitter = null;
  if (emit) {
    const emitUrl = typeof emit === "string" ? emit : emit.url;
    const batchMs = typeof emit === "object" && emit.batchMs || 3e3;
    if (emitUrl) {
      emitter = createEmitter({
        url: emitUrl,
        batchMs,
        getUserId: () => store.getProfile().userId,
        getSessionId: () => sessionId
      });
    }
  }
  const journeyTracker = createJourneyTracker();
  const resolvedPageMeta = pageMeta || {
    name: document.title || location.pathname,
    category: null,
    url: location.pathname
  };
  journeyTracker.recordPageView(resolvedPageMeta);
  if (debug) {
    debugPanel = createDebugPanel({
      journeyTracker,
      onClear() {
        store.clearAll();
        collector.clearBuffer();
        journeyTracker.clearAll();
        currentIntents = [];
      }
    });
  }
  function handleFlush(events) {
    const intents = summarizer.summarize(events);
    const journeyIntents = journeyTracker.deriveJourneyIntents();
    journeyIntents.forEach((ji) => {
      if (!intents.find((i) => i.category === ji.category && i.tags.join(",") === ji.tags.join(","))) {
        intents.push(ji);
      }
    });
    if (debugPanel)
      debugPanel.logJourney();
    if (intents.length > 0) {
      currentIntents = intents;
      if (debugPanel)
        debugPanel.replaceIntents(intents);
      store.saveSessionIntents(sessionId, intents);
      const profile = store.getProfile();
      if (debugPanel)
        debugPanel.logProfile(profile);
      if (emitter)
        emitter.queueProfile(profile);
      if (onIntentsChanged)
        onIntentsChanged(intents, profile);
      const recs = recEngine.recommend(profile);
      if (debugPanel)
        debugPanel.logRecommendations(recs);
      if (onRecommendations)
        onRecommendations(recs);
    }
  }
  const collector = createEventCollector({
    catalog,
    flushInterval,
    trackViews,
    onEvent(event) {
      if (debugPanel)
        debugPanel.logEvent(event);
      if (emitter)
        emitter.queueSignal(event);
    },
    onFlush: handleFlush
  });
  catalog.scanItems(root);
  const initialItems = catalog.getAllItems();
  collector.observeNew(initialItems);
  const mutationObserver = new MutationObserver((mutations) => {
    const addedNodes = [];
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1)
          addedNodes.push(node);
      });
    });
    if (addedNodes.length > 0) {
      const newItems = catalog.scanNewElements(addedNodes);
      if (newItems.length > 0) {
        collector.observeNew(newItems);
      }
    }
  });
  mutationObserver.observe(root, { childList: true, subtree: true });
  collector.trackPageView(resolvedPageMeta);
  if (debugPanel)
    debugPanel.logJourney();
  const existingProfile = store.getProfile();
  if (existingProfile && existingProfile.sessions.length > 0) {
    if (debugPanel)
      debugPanel.logProfile(existingProfile);
    const recs = recEngine.recommend(existingProfile);
    if (recs.length > 0) {
      if (debugPanel)
        debugPanel.logRecommendations(recs);
      if (onRecommendations)
        onRecommendations(recs);
    }
  }
  return {
    trackClick(itemId) {
      collector.trackClick(itemId);
    },
    trackSearch(query) {
      collector.trackSearch(query);
    },
    trackTabView(tabId, tags = []) {
      collector.trackTabView(tabId, tags);
    },
    trackCustom(event) {
      if (!event || !event.type)
        return;
      const enriched = { timestamp: Date.now(), ...event };
      if (debugPanel)
        debugPanel.logEvent(enriched);
    },
    recommend(maxResults = 6) {
      return recEngine.recommend(store.getProfile(), maxResults);
    },
    getProfile() {
      return store.getProfile();
    },
    getIntents() {
      return [...currentIntents];
    },
    scan() {
      const newItems = catalog.scanNewElements(
        Array.from(root.querySelectorAll(catalog.getSelector())).map((el) => el)
        // pass elements for scanNewElements to process
      );
      if (newItems.length > 0)
        collector.observeNew(newItems);
    },
    clear() {
      store.clearAll();
      collector.clearBuffer();
      journeyTracker.clearAll();
      currentIntents = [];
    },
    trackPageView(pageMeta2) {
      journeyTracker.recordPageView(pageMeta2);
      collector.trackPageView(pageMeta2);
      if (debugPanel)
        debugPanel.logJourney();
    },
    getJourney() {
      return journeyTracker.getState();
    },
    predictNext(n = 3) {
      const current = journeyTracker.getCurrentPage();
      if (!current)
        return [];
      return journeyTracker.predictNextPages(current.name, n);
    },
    destroy() {
      collector.destroy();
      mutationObserver.disconnect();
      if (debugPanel)
        debugPanel.destroy();
    }
  };
}
var src_default = { create };
export {
  create,
  src_default as default
};
