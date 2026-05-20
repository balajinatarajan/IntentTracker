// IntentTracker — zero-config drop-in intent tracking plugin
// Orchestrates: catalog → event-collector → summarizer → store → recommendations

import { createCatalog } from './catalog.js';
import { createEventCollector } from './event-collector.js';
import { IntentSummarizer } from './intent-summarizer.js';
import { IntentStore } from './intent-store.js';
import { RecommendationEngine } from './recommendation-engine.js';
import { createDebugPanel } from './debug-panel.js';
import { createJourneyTracker } from './journey-tracker.js';
import { createEmitter } from './emitter.js';

function create(options = {}) {
  const {
    attributes = {},
    storageKey = 'ik_profile',
    flushInterval = 5000,
    debug = false,
    root = document.body,
    pageMeta = null,
    trackViews = false,
    onIntentsChanged = null,
    onRecommendations = null,
    emit = null, // string URL or { url, batchMs }
  } = options;

  const sessionId = 'session-' + Date.now();
  const catalog = createCatalog(attributes);
  const store = new IntentStore(storageKey);
  const summarizer = new IntentSummarizer(catalog);
  const recEngine = new RecommendationEngine(catalog);

  let debugPanel = null;
  let currentIntents = [];

  // --- Optional backend emitter ---
  // When `emit` is set, signals + profile snapshots are batched to the backend
  // via sendBeacon. The userId (GUID) lives in IntentStore and travels with
  // every payload, so the server can aggregate across users.
  let emitter = null;
  if (emit) {
    const emitUrl = typeof emit === 'string' ? emit : emit.url;
    const batchMs = (typeof emit === 'object' && emit.batchMs) || 3000;
    if (emitUrl) {
      emitter = createEmitter({
        url: emitUrl,
        batchMs,
        getUserId: () => store.getProfile().userId,
        getSessionId: () => sessionId,
      });
    }
  }

  // --- Journey tracker ---
  const journeyTracker = createJourneyTracker();

  // Auto-detect pageMeta if not provided
  const resolvedPageMeta = pageMeta || {
    name: document.title || location.pathname,
    category: null,
    url: location.pathname,
  };

  // Record initial page view
  journeyTracker.recordPageView(resolvedPageMeta);

  // --- Debug panel (opt-in) ---
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

  // --- Flush pipeline ---
  function handleFlush(events) {
    const intents = summarizer.summarize(events);
    // Merge journey-derived intents
    const journeyIntents = journeyTracker.deriveJourneyIntents();
    journeyIntents.forEach(ji => {
      if (!intents.find(i => i.category === ji.category && i.tags.join(',') === ji.tags.join(','))) {
        intents.push(ji);
      }
    });
    if (debugPanel) debugPanel.logJourney();
    if (intents.length > 0) {
      currentIntents = intents;

      if (debugPanel) debugPanel.replaceIntents(intents);

      store.saveSessionIntents(sessionId, intents);
      const profile = store.getProfile();

      if (debugPanel) debugPanel.logProfile(profile);

      if (emitter) emitter.queueProfile(profile);
      if (onIntentsChanged) onIntentsChanged(intents, profile);

      const recs = recEngine.recommend(profile);
      if (debugPanel) debugPanel.logRecommendations(recs);
      if (onRecommendations) onRecommendations(recs);
    }
  }

  // --- Event collector ---
  const collector = createEventCollector({
    catalog,
    flushInterval,
    trackViews,
    onEvent(event) {
      if (debugPanel) debugPanel.logEvent(event);
      if (emitter) emitter.queueSignal(event);
    },
    onFlush: handleFlush,
  });

  // --- Initial scan ---
  catalog.scanItems(root);
  const initialItems = catalog.getAllItems();
  collector.observeNew(initialItems);

  // --- MutationObserver for dynamic content ---
  const mutationObserver = new MutationObserver((mutations) => {
    const addedNodes = [];
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) addedNodes.push(node);
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

  // --- Log initial page view ---
  collector.trackPageView(resolvedPageMeta);
  if (debugPanel) debugPanel.logJourney();

  // --- Returning visitor: fire initial recommendations ---
  const existingProfile = store.getProfile();
  if (existingProfile && existingProfile.sessions.length > 0) {
    if (debugPanel) debugPanel.logProfile(existingProfile);
    const recs = recEngine.recommend(existingProfile);
    if (recs.length > 0) {
      if (debugPanel) debugPanel.logRecommendations(recs);
      if (onRecommendations) onRecommendations(recs);
    }
  }

  // --- Public API ---
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
        Array.from(root.querySelectorAll(catalog.getSelector()))
          .map(el => el) // pass elements for scanNewElements to process
      );
      if (newItems.length > 0) collector.observeNew(newItems);
    },

    clear() {
      store.clearAll();
      collector.clearBuffer();
      journeyTracker.clearAll();
      currentIntents = [];
    },

    trackPageView(pageMeta) {
      journeyTracker.recordPageView(pageMeta);
      collector.trackPageView(pageMeta);
      if (debugPanel) debugPanel.logJourney();
    },

    getJourney() {
      return journeyTracker.getState();
    },

    predictNext(n = 3) {
      const current = journeyTracker.getCurrentPage();
      if (!current) return [];
      return journeyTracker.predictNextPages(current.name, n);
    },

    destroy() {
      collector.destroy();
      mutationObserver.disconnect();
      if (debugPanel) debugPanel.destroy();
    },
  };
}

export default { create };
export { create };
