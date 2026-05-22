import { initTabs, showForYouTab, setSearchFilter } from './ui/tabbed-grid.js?v=6';
import { initModal, openModal } from './ui/detail-modal.js';
import { initSearchBar } from './ui/search-bar.js';
import { renderContinueSearch } from './ui/continue-search.js';
import { destinations } from './data/destinations.js';
import { pickTopPicks } from './utils/scoring.js';

// --- DOM refs ---
const tabBarEl = document.getElementById('tab-bar');
const gridContainer = document.getElementById('destination-grid');
const searchInput = document.getElementById('search-input');
const continueSection = document.getElementById('continue-search-section');

// Mirrors PER_TAB_LIMIT in tabbed-grid.js — the For You ✦ tab must always
// fill 12 slots, same rule as every other tab.
const FOR_YOU_LIMIT = 12;

// --- Init UI ---
initModal();
initTabs(tabBarEl, gridContainer, destinations, handleCardClick);

function handleCardClick(dest) {
  openModal(dest);
}

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
    onRecommendations: () => {
      // The lib's recs come from its DOM-scanned per-page catalog and are
      // capped at maxPerGroup:3 — neither compatible with the always-fill-12
      // rule. Use the callback only as a "profile updated" trigger and
      // compute our own top 12 from the full destinations.js catalog.
      refreshForYouTab();
    },
  });

  window.__intentTracker = tracker;

  // Profile may already have intent data from a prior session — surface the
  // tab on initial load instead of waiting for the next onRecommendations.
  refreshForYouTab();

  // Poll as a backstop: onRecommendations only fires when the lib's recs
  // actually change, which lags behind tagWeights updates in some cases.
  // The For You ✦ tab should appear within a couple seconds of any signal
  // that produces a positive tagWeight — same pattern the nav chip uses.
  // Stops polling once the tab is in the DOM.
  const pollId = setInterval(() => {
    if (tabBarEl.querySelector('[data-tab="for-you"]')) {
      clearInterval(pollId);
      return;
    }
    refreshForYouTab();
  }, 2000);
}

function refreshForYouTab() {
  const tracker = window.__intentTracker;
  if (!tracker) return;
  // Merged weights (lib intents + click-derived). The lib's tag_affinity
  // intent has a 0.35-of-total threshold that single-item heavy clicking
  // fails; the click-derived map keeps the For You ranking responsive in
  // that case. See profile-state.js.
  const weights = window.IntentTrackerExt?.getMergedTagWeights?.(tracker) || tracker.getProfile()?.tagWeights || {};
  // Cold-start guard: no weights at all, no For You tab.
  if (!Object.values(weights).some(w => w > 0)) return;
  const clickCounts = window.IntentTrackerExt?.getItemClickCounts?.() || {};
  // Same composer the FY page Top Picks uses: MMR + country cap +
  // region serendipity, so the homepage For You ✦ tab shows variety
  // instead of mirroring a single-tag filtered view.
  const top = pickTopPicks(destinations, weights, clickCounts, FOR_YOU_LIMIT);
  showForYouTab(top);
}

initTracker();
