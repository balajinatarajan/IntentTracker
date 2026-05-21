import { renderDestinationGrid, setFilter } from './ui/destination-grid.js';
import { initModal, openModal } from './ui/detail-modal.js';
import { initSearchBar } from './ui/search-bar.js';
import { renderRecommendations } from './ui/recommendation-section.js';
import { renderContinueSearch } from './ui/continue-search.js';
import { destinations } from './data/destinations.js';

// --- Initialize ---
const gridContainer = document.getElementById('destination-grid');
const searchInput = document.getElementById('search-input');
const recsSection = document.getElementById('recommendations-section');
const continueSection = document.getElementById('continue-search-section');

// Lookup for mapping plugin recs back to full destination objects
const destMap = new Map(destinations.map(d => [d.id, d]));

// Init UI
initModal();

// Render grid
function refreshGrid() {
  renderDestinationGrid(gridContainer, handleCardClick);
  // Re-scan for new data-ik-* elements after grid re-render
  if (window.__intentTracker) window.__intentTracker.scan();
}

refreshGrid();

// Card click handler
function handleCardClick(dest) {
  openModal(dest);
}

// Search
initSearchBar(searchInput, (query) => {
  setFilter(query);
  refreshGrid();
  if (query.trim().length >= 2 && window.__intentTracker) {
    window.__intentTracker.trackSearch(query.trim());
  }
});

// --- IntentTracker plugin (loaded via <script> in index.html) ---
function initTracker() {
  if (typeof IntentTracker === 'undefined') {
    console.warn('IntentTracker not loaded — include intent-tracker.js before app.js');
    return;
  }

  const tracker = IntentTracker.create({
    root: gridContainer,
    debug: true,
    pageMeta: { name: 'Home', category: 'home', url: '/index.html' },
    onRecommendations: (recs) => {
      // Map plugin recs (item shape) to Wanderlust recs (destination shape)
      const mapped = recs.map(r => ({
        ...r,
        destinationId: r.itemId,
        destination: destMap.get(r.itemId) || r.item,
      }));
      renderRecommendations(recsSection, mapped, handleCardClick);
      // Update journey predictions alongside recommendations
      renderContinueSearch(continueSection, tracker.predictNext(3));
    },
  });

  window.__intentTracker = tracker;

  // Show journey predictions for returning visitors
  renderContinueSearch(continueSection, tracker.predictNext(3));
}

initTracker();
