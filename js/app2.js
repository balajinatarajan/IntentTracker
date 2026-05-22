import { initTabs, showForYouTab, setSearchFilter } from './ui/tabbed-grid.js?v=7';
import { initModal, openModal } from './ui/detail-modal.js';
import { initSearchBar } from './ui/search-bar.js';
import { renderContinueSearch } from './ui/continue-search.js';
import { destinations } from './data/destinations.js';
import { pickTopPicks } from './utils/scoring.js';
import { BookingStore } from './storage/booking-store.js';
import { asHotel, ABANDONMENT_MESSAGES } from './data/hotel-utils.js';
import { openBookingFlow, resumeAbandonedBooking } from './ui/booking-flow.js';

// --- DOM refs ---
const tabBarEl = document.getElementById('tab-bar');
const gridContainer = document.getElementById('destination-grid');
const searchInput = document.getElementById('search-input');
const continueSection = document.getElementById('continue-search-section');

// Mirrors PER_TAB_LIMIT in tabbed-grid.js — the For You ✦ tab must always
// fill 12 slots, same rule as every other tab.
const FOR_YOU_LIMIT = 12;

const bookingStore = new BookingStore();
const destMap = new Map(destinations.map(d => [d.id, d]));

// --- Init UI ---
initModal();
initTabs(tabBarEl, gridContainer, destinations, handleCardClick, {
  onResumeBooking: handleResumeBooking,
});

function handleCardClick(dest) {
  openModal(dest);
}

// Resume a pinned For You card. Restores the user to the exact funnel
// step they abandoned (dates / room / guest / review) via the booking
// flow's resume API.
function handleResumeBooking(dest) {
  const abandoned = bookingStore.getAbandoned().find(a => a.destinationId === dest.id);
  const activeCart = bookingStore.getCart();
  const resumeFrom = abandoned
    || (activeCart && activeCart.destinationId === dest.id ? activeCart : null);
  if (resumeFrom) resumeAbandonedBooking(dest, resumeFrom);
  else openBookingFlow(dest);
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
      refreshForYouTab();
    },
  });

  window.__intentTracker = tracker;

  refreshForYouTab();

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
  // Merged weights (lib intents + click-derived). See profile-state.js.
  const weights = window.IntentTrackerExt?.getMergedTagWeights?.(tracker)
    || tracker?.getProfile()?.tagWeights || {};
  const hasWeights = Object.values(weights).some(w => w > 0);

  // Pinned abandoned/in-cart entries take priority and bypass cold-start.
  const pinned = buildPinnedEntries();
  if (!hasWeights && pinned.length === 0) return;

  const pinnedIds = new Set(pinned.map(p => p.dest.id));
  const slotsLeft = Math.max(0, FOR_YOU_LIMIT - pinned.length);

  let fillerEntries = [];
  if (slotsLeft > 0) {
    const clickCounts = window.IntentTrackerExt?.getItemClickCounts?.() || {};
    const scored = hasWeights
      ? pickTopPicks(destinations, weights, clickCounts, FOR_YOU_LIMIT + pinned.length)
      : destinations;
    fillerEntries = scored
      .filter(d => !pinnedIds.has(d.id))
      .slice(0, slotsLeft)
      .map(dest => ({ dest }));
  }

  showForYouTab([...pinned, ...fillerEntries]);
}

function buildPinnedEntries() {
  const entries = [];
  const seen = new Set();
  const activeCart = bookingStore.getCart();
  if (activeCart && activeCart.destinationId) {
    const dest = destMap.get(activeCart.destinationId);
    if (dest) {
      entries.push(buildResumeEntry(dest, activeCart));
      seen.add(dest.id);
    }
  }
  for (const a of bookingStore.getAbandoned()) {
    if (seen.has(a.destinationId)) continue;
    const dest = destMap.get(a.destinationId);
    if (!dest) continue;
    entries.push(buildResumeEntry(dest, a));
    seen.add(dest.id);
  }
  return entries;
}

function buildResumeEntry(dest, booking) {
  const hotel = asHotel(dest);
  const step = booking?.funnelStep || 'cart';
  const msgFn = ABANDONMENT_MESSAGES[step] || ABANDONMENT_MESSAGES.cart;
  return {
    dest,
    reason: msgFn(hotel),
    isAbandoned: true,
    ctaLabel: 'Complete Booking',
  };
}

window.__refreshForYou = refreshForYouTab;

initTracker();
