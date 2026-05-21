// LegacyIntentTracker — intent tracking for existing sites via reference file
// Adapts lib/src/index.js: swaps createCatalog for createLegacyCatalog,
// reuses all other core modules unchanged.

import { createLegacyCatalog } from './legacy-catalog.js';
import { createEventCollector } from '../../lib/src/event-collector.js';
import { IntentSummarizer } from '../../lib/src/intent-summarizer.js';
import { IntentStore } from '../../lib/src/intent-store.js';
import { RecommendationEngine } from '../../lib/src/recommendation-engine.js';
import { createDebugPanel } from '../../lib/src/debug-panel.js';
import { createJourneyTracker } from '../../lib/src/journey-tracker.js';

function create(options = {}) {
  const {
    reference = {},
    storageKey = 'ik_profile',
    flushInterval = 5000,
    debug = false,
    root = document.body,
    pageMeta = null,
    trackViews = false,
    onIntentsChanged = null,
    onRecommendations = null,
  } = options;

  const sessionId = 'session-' + Date.now();
  const catalog = createLegacyCatalog(reference);
  const store = new IntentStore(storageKey);
  const summarizer = new IntentSummarizer(catalog);
  const recEngine = new RecommendationEngine(catalog);

  let debugPanel = null;
  let currentIntents = [];

  // --- Journey tracker ---
  const journeyTracker = createJourneyTracker();

  const resolvedPageMeta = pageMeta || {
    name: document.title || location.pathname,
    category: null,
    url: location.pathname,
  };

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
      const sel = catalog.getSelector();
      if (!sel) return;
      const newItems = catalog.scanNewElements(
        Array.from(root.querySelectorAll(sel)).map(el => el)
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
