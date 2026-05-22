import { destinations } from '../data/destinations.js';
import { regions } from '../utils/categories.js';

// --- State ---
let allDestinations = [];
let cardClickHandler = null;
let resumeBookingHandler = null;
let tabBarEl = null;
let gridEl = null;
let activeTab = 'explore';
let exploreSet = [];  // random 12, stable per session
let tripTypePools = {}; // tripType -> precomputed pool of 12 (only tabs that can fill 12)
// For You entries: { dest, reason?, isAbandoned?, ctaLabel? }. App2.js
// passes rich entries so abandoned bookings get pinned to the top with
// a "Complete Booking" CTA. Bare destination objects are still accepted
// for backwards compat (normalized in setForYouEntries).
let forYouEntries = [];
let hasShownAbandonedCue = false;
let searchFilter = '';

// Always fill exactly 12 cards per tab (mirrors For You page rule). A tab
// only ships if its candidate pool can fill all PER_TAB_LIMIT slots — a
// half-empty tab looks worse than no tab.
const PER_TAB_LIMIT = 12;

const ALL_TABS = [
  { id: 'explore', label: 'Explore' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'family', label: 'Family' },
  { id: 'solo', label: 'Solo' },
  { id: 'culture', label: 'Culture' },
];
let TABS = ALL_TABS;

// --- Public API ---

export function initTabs(barEl, containerEl, dests, onCardClick, opts = {}) {
  tabBarEl = barEl;
  gridEl = containerEl;
  allDestinations = dests;
  cardClickHandler = onCardClick;
  resumeBookingHandler = opts.onResumeBooking || null;

  // Non-FY tabs are STATIC — same content in the same order every time.
  // Only the For You ✦ tab personalizes. Sorted alphabetically by name so
  // the ordering is deterministic, varied, and independent of catalog
  // source order (which would otherwise bias the first 12 to one region).
  const byName = (a, b) => a.name.localeCompare(b.name);

  // Explore: first 12 destinations alphabetically across the whole catalog.
  exploreSet = [...allDestinations].sort(byName).slice(0, PER_TAB_LIMIT);

  // Trip-type tabs: precompute the candidate pool per tripType and drop any
  // tab that can't fill all PER_TAB_LIMIT slots. No personalization — same
  // alphabetical sort as Explore.
  tripTypePools = {};
  TABS = ALL_TABS.filter(tab => {
    if (tab.id === 'explore') return true;
    const matches = allDestinations
      .filter(d => (d.tripTypes || []).includes(tab.id))
      .sort(byName);
    if (matches.length < PER_TAB_LIMIT) return false;
    tripTypePools[tab.id] = matches.slice(0, PER_TAB_LIMIT);
    return true;
  });

  renderTabBar();
  renderGrid();
}

export function showForYouTab(entries) {
  if (!entries || entries.length === 0) return;

  // Accept either bare destinations or rich entries. A rich entry is
  // anything that already has a `.dest`; everything else is wrapped.
  forYouEntries = entries.map(e => (e && e.dest) ? e : { dest: e });

  // Add tab button if not already present
  if (!tabBarEl.querySelector('[data-tab="for-you"]')) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn for-you-btn';
    btn.dataset.tab = 'for-you';
    btn.textContent = 'For You ✦';
    btn.addEventListener('click', () => switchTab('for-you'));

    // Insert after Explore (first tab)
    const firstTab = tabBarEl.querySelector('.tab-btn');
    if (firstTab && firstTab.nextSibling) {
      tabBarEl.insertBefore(btn, firstTab.nextSibling);
    } else {
      tabBarEl.appendChild(btn);
    }

    requestAnimationFrame(() => btn.classList.add('visible'));
  }

  // Auto-switch to For You the FIRST time we see an abandoned entry —
  // matches the original recommendation-engine UX where pinning a
  // resume-booking card was the whole point. Only steal focus once
  // (hasShownAbandonedCue) and only from Explore, so we don't yank
  // someone out of a category tab they're browsing.
  const hasAbandoned = forYouEntries.some(e => e.isAbandoned);
  if (hasAbandoned && !hasShownAbandonedCue && activeTab === 'explore') {
    hasShownAbandonedCue = true;
    switchTab('for-you');
    return;
  }
  if (!hasAbandoned) hasShownAbandonedCue = false;

  if (activeTab === 'for-you') renderGrid();
}

export function setSearchFilter(query) {
  searchFilter = query.toLowerCase().trim();
  renderGrid();
}

export function getActiveTabDestinations() {
  return getFilteredCards();
}

// --- Tab rendering ---

function renderTabBar() {
  tabBarEl.innerHTML = '';

  TABS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `tab-btn${tab.id === activeTab ? ' active' : ''}`;
    btn.dataset.tab = tab.id;
    btn.textContent = tab.label;
    btn.addEventListener('click', () => switchTab(tab.id));
    tabBarEl.appendChild(btn);
  });
}

function switchTab(tabId) {
  activeTab = tabId;

  // Update active state on all tab buttons
  tabBarEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  renderGrid();

  // Track tab view as an intent signal (skip generic tabs)
  if (window.__intentTracker) {
    const tags = (tabId === 'explore' || tabId === 'for-you') ? [] : [tabId];
    window.__intentTracker.trackTabView(tabId, tags);
    window.__intentTracker.scan();
  }
}

// --- Grid rendering ---

function getFilteredCards() {
  // For You is rendered from entries (pinned abandoned + scored picks)
  // while every other tab still works in plain destinations. Keeping the
  // two shapes separate avoids polluting the static tab paths with
  // booking-flow concerns.
  if (activeTab === 'for-you') {
    return matchesSearchEntries(forYouEntries);
  }

  let cards;
  if (activeTab === 'explore') {
    cards = exploreSet;
  } else {
    // Trip-type tabs draw from the precomputed PER_TAB_LIMIT pool built in
    // initTabs. Fallback to a live filter only if the pool is missing
    // (shouldn't happen — tabs without a full pool aren't rendered).
    cards = tripTypePools[activeTab]
      || allDestinations.filter(d => (d.tripTypes || []).includes(activeTab)).slice(0, PER_TAB_LIMIT);
  }

  if (searchFilter) cards = cards.filter(matchesSearchDest);
  return cards;
}

function matchesSearchDest(dest) {
  if (!searchFilter) return true;
  const searchable = [
    dest.name, dest.country, dest.shortDesc, dest.region,
    ...dest.tags, ...dest.tripTypes, dest.priceTier,
  ].join(' ').toLowerCase();
  return searchFilter.split(/\s+/).every(term => searchable.includes(term));
}

function matchesSearchEntries(entries) {
  if (!searchFilter) return entries;
  return entries.filter(e => e.dest && matchesSearchDest(e.dest));
}

function renderGrid() {
  const cards = getFilteredCards();
  gridEl.replaceChildren();

  if (cards.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.textContent = 'No destinations match your search.';
    gridEl.appendChild(empty);
    return;
  }

  if (activeTab === 'for-you') {
    renderForYouCards(cards);
  } else {
    renderStandardCards(cards);
  }
}

function renderStandardCards(cards) {
  cards.forEach(dest => {
    const card = createCard(dest);
    card.addEventListener('click', () => cardClickHandler(dest));
    gridEl.appendChild(card);
  });
}

function renderForYouCards(entries) {
  entries.forEach(entry => {
    const card = createCard(entry.dest, entry);
    card.addEventListener('click', () => cardClickHandler(entry.dest));
    gridEl.appendChild(card);
  });
}

// --- Card creation (mirrors destination-grid.js) ---

// Accepts either createCard(dest) or createCard(dest, { reason, isAbandoned, ctaLabel }).
// Built with DOM APIs (not innerHTML) so the abandoned-booking reason
// text and CTA can render trusted dynamic content without XSS surface.
function createCard(dest, opts = {}) {
  const { reason, isAbandoned, ctaLabel } = opts;
  const regionLabel = regions[dest.region]?.label || dest.region;

  const card = document.createElement('article');
  card.className = 'destination-card' + (isAbandoned ? ' destination-card-abandoned' : '');
  card.dataset.destinationId = dest.id;
  card.dataset.ikId = dest.id;
  card.dataset.ikTags = dest.tags.join(', ');
  card.dataset.ikGroup = dest.region;
  card.dataset.ikName = dest.name;
  card.dataset.ikPrice = dest.priceTier;

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-image-wrapper';
  const img = document.createElement('img');
  img.className = 'card-image';
  img.src = dest.image;
  img.alt = dest.name;
  img.loading = 'lazy';
  const price = document.createElement('span');
  price.className = 'card-image-price';
  price.textContent = `$${dest.price}`;
  const overlay = document.createElement('div');
  overlay.className = 'card-image-overlay';
  const overlayName = document.createElement('div');
  overlayName.className = 'card-overlay-name';
  overlayName.textContent = dest.name;
  const overlayRegion = document.createElement('div');
  overlayRegion.className = 'card-overlay-region';
  overlayRegion.textContent = regionLabel;
  overlay.append(overlayName, overlayRegion);
  imgWrap.append(img, price, overlay);

  if (isAbandoned) {
    const ribbon = document.createElement('span');
    ribbon.className = 'card-resume-ribbon';
    ribbon.textContent = 'Resume booking';
    imgWrap.appendChild(ribbon);
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const regionTag = document.createElement('span');
  regionTag.className = 'region-tag';
  regionTag.textContent = regionLabel;
  const tierBadge = document.createElement('span');
  tierBadge.className = `price-badge ${dest.priceTier}`;
  tierBadge.textContent = dest.priceTier.replace('-', ' ');
  meta.append(regionTag, tierBadge);
  body.appendChild(meta);

  if (reason) {
    const reasonEl = document.createElement('p');
    reasonEl.className = 'card-rec-reason' + (isAbandoned ? ' card-rec-abandoned' : '');
    reasonEl.textContent = reason;
    body.appendChild(reasonEl);
  }

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = dest.shortDesc;
  body.appendChild(desc);

  const tags = document.createElement('div');
  tags.className = 'card-tags';
  dest.tripTypes.forEach(t => {
    const tag = document.createElement('span');
    tag.className = 'card-tag';
    tag.textContent = t;
    tags.appendChild(tag);
  });
  body.appendChild(tags);

  if (ctaLabel) {
    // Inline text-link style (vs. a pill button) so the CTA folds into
    // the card body instead of becoming a chunky footer row. The arrow
    // is added via CSS ::after to keep the JS markup minimal.
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'tab-card-cta';
    cta.textContent = ctaLabel;
    cta.addEventListener('click', (e) => {
      e.stopPropagation();
      resumeBookingHandler?.(dest);
    });
    body.appendChild(cta);
  }

  card.append(imgWrap, body);
  return card;
}

