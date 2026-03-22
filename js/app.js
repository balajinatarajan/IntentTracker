import { renderDestinationGrid, setFilter } from './ui/destination-grid.js';
import { initModal, openModal } from './ui/detail-modal.js';
import { initSearchBar } from './ui/search-bar.js';
import { initEventCollector } from './tracking/event-collector.js';
import { initDebugPanel, logEvent, replaceIntents, logProfile, logRecommendations } from './ui/debug-panel.js';
import { IntentSummarizer } from './tracking/intent-summarizer.js';
import { IntentStore } from './storage/intent-store.js';
import { RecommendationEngine } from './recommendations/recommendation-engine.js';
import { renderRecommendations } from './ui/recommendation-section.js';
import { destinations } from './data/destinations.js';

// --- Initialize ---
const gridContainer = document.getElementById('destination-grid');
const searchInput = document.getElementById('search-input');
const recsSection = document.getElementById('recommendations-section');

// Session ID
const sessionId = 'session-' + Date.now();

// Core modules
const store = new IntentStore();
const summarizer = new IntentSummarizer(destinations);
const recEngine = new RecommendationEngine(destinations);

// Init UI
initModal();
initDebugPanel();

// Render grid
function refreshGrid() {
  renderDestinationGrid(gridContainer, handleCardClick);
  // Re-attach intersection observer after re-render
  if (window.__reattachObserver) window.__reattachObserver();
}

refreshGrid();

// Search
initSearchBar(searchInput, (query) => {
  setFilter(query);
  refreshGrid();

  // Track search event
  if (query.trim().length >= 2) {
    collector.trackSearch(query.trim());
  }
});

// Card click handler
function handleCardClick(dest) {
  openModal(dest);
  collector.trackClick(dest.id);
}

// Event collector
const collector = initEventCollector(gridContainer, {
  onEvent: (event) => {
    logEvent(event);
  },
  onFlush: (events) => {
    // Summarize intents from events
    const intents = summarizer.summarize(events);
    if (intents.length > 0) {
      replaceIntents(intents);

      // Save to store
      store.saveSessionIntents(sessionId, intents);
      const profile = store.getProfile();
      logProfile(profile);

      // Update recommendations
      const recs = recEngine.recommend(profile);
      logRecommendations(recs);
      renderRecommendations(recsSection, recs, handleCardClick);
    }
  }
});

// Expose collector's clearBuffer for debug panel "Clear All Data"
window.__clearEventBuffer = () => collector.clearBuffer();

// On load: check for returning visitor
const existingProfile = store.getProfile();
if (existingProfile && existingProfile.sessions.length > 0) {
  logProfile(existingProfile);
  const recs = recEngine.recommend(existingProfile);
  if (recs.length > 0) {
    logRecommendations(recs);
    renderRecommendations(recsSection, recs, handleCardClick);
  }
}
