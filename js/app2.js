import { initTabs, showForYouTab, setSearchFilter } from './ui/tabbed-grid.js?v=4';
import { initModal, openModal } from './ui/detail-modal.js';
import { initSearchBar } from './ui/search-bar.js';
import { renderContinueSearch } from './ui/continue-search.js';
import { destinations } from './data/destinations.js';

// --- DOM refs ---
const tabBarEl = document.getElementById('tab-bar');
const gridContainer = document.getElementById('destination-grid');
const searchInput = document.getElementById('search-input');
const continueSection = document.getElementById('continue-search-section');

// Lookup for mapping plugin recs back to full destination objects
const destMap = new Map(destinations.map(d => [d.id, d]));

// --- Init UI ---
initModal();
initTabs(tabBarEl, gridContainer, destinations, handleCardClick);

// Card click handler
function handleCardClick(dest) {
  openModal(dest);
}

// Search — filters within the active tab
initSearchBar(searchInput, (query) => {
  setSearchFilter(query);
  if (window.__intentTracker) window.__intentTracker.scan();
  if (query.trim().length >= 2 && window.__intentTracker) {
    window.__intentTracker.trackSearch(query.trim());
  }
});

// --- IntentTracker plugin ---
function initTracker() {
  if (typeof IntentTracker === 'undefined') {
    console.warn('IntentTracker not loaded — include intent-tracker.js before app2.js');
    return;
  }

  let tracker;
  tracker = IntentTracker.create({
    root: gridContainer,
    debug: true,
    pageMeta: { name: 'Home', category: 'home', url: '/index.html' },
    emit: '/api/ingest',
    onRecommendations: (recs) => {
      // Map plugin recs to full destination objects
      const mapped = recs.map(r => ({
        ...r,
        destinationId: r.itemId,
        destination: destMap.get(r.itemId) || r.item,
      }));

      // Inject the "For You" tab with recommendations
      showForYouTab(mapped);

      // Continue-search section hidden for now
      // if (tracker) renderContinueSearch(continueSection, tracker.predictNext(3));
    },
  });

  window.__intentTracker = tracker;

  // Continue-search section hidden for now
  // renderContinueSearch(continueSection, tracker.predictNext(3));
}

initTracker();
