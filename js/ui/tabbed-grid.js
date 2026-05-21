import { destinations } from '../data/destinations.js';
import { regions } from '../utils/categories.js';

// --- State ---
let allDestinations = [];
let cardClickHandler = null;
let tabBarEl = null;
let gridEl = null;
let activeTab = 'explore';
let exploreSet = []; // random subset, stable per session
let forYouRecs = []; // populated when recommendations arrive
let searchFilter = '';

const TABS = [
  { id: 'explore', label: 'Explore' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'family', label: 'Family' },
  { id: 'solo', label: 'Solo' },
  { id: 'culture', label: 'Culture' },
];

// --- Public API ---

export function initTabs(barEl, containerEl, dests, onCardClick) {
  tabBarEl = barEl;
  gridEl = containerEl;
  allDestinations = dests;
  cardClickHandler = onCardClick;

  // Generate a random "Explore" set (8 cards, stable for this page load)
  exploreSet = shuffle([...allDestinations]).slice(0, 8);

  renderTabBar();
  renderGrid();
}

export function showForYouTab(recommendations) {
  if (!recommendations || recommendations.length === 0) return;
  forYouRecs = recommendations;

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

    // Entrance animation
    requestAnimationFrame(() => btn.classList.add('visible'));
  }

  // If user is currently on the For You tab, re-render
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
  let cards;

  if (activeTab === 'explore') {
    cards = exploreSet;
  } else if (activeTab === 'for-you') {
    // For You tab returns full destination objects from recommendations
    cards = forYouRecs.map(r => r.destination).filter(Boolean);
  } else {
    // Filter by tripType
    cards = allDestinations.filter(d => d.tripTypes.includes(activeTab));
  }

  // Apply search filter
  if (searchFilter) {
    cards = cards.filter(dest => {
      const searchable = [
        dest.name, dest.country, dest.shortDesc, dest.region,
        ...dest.tags, ...dest.tripTypes, dest.priceTier
      ].join(' ').toLowerCase();
      return searchFilter.split(/\s+/).every(term => searchable.includes(term));
    });
  }

  return cards;
}

function renderGrid() {
  const cards = getFilteredCards();
  gridEl.innerHTML = '';

  if (cards.length === 0) {
    gridEl.innerHTML = '<div class="no-results">No destinations match your search.</div>';
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

function renderForYouCards(cards) {
  cards.forEach(dest => {
    const rec = forYouRecs.find(r => r.destination?.id === dest.id);
    const card = createCard(dest, rec?.reason);
    card.addEventListener('click', () => cardClickHandler(dest));
    gridEl.appendChild(card);
  });
}

// --- Card creation (mirrors destination-grid.js) ---

function createCard(dest, reason) {
  const card = document.createElement('article');
  card.className = 'destination-card';
  card.dataset.destinationId = dest.id;
  // IntentTracker data attributes
  card.dataset.ikId = dest.id;
  card.dataset.ikTags = dest.tags.join(', ');
  card.dataset.ikGroup = dest.region;
  card.dataset.ikName = dest.name;
  card.dataset.ikPrice = dest.priceTier;

  const regionLabel = regions[dest.region]?.label || dest.region;

  card.innerHTML = `
    <div class="card-image-wrapper">
      <img class="card-image" src="${dest.image}" alt="${dest.name}" loading="lazy">
      <span class="card-image-price">$${dest.price}</span>
      <div class="card-image-overlay">
        <div class="card-overlay-name">${dest.name}</div>
        <div class="card-overlay-region">${regionLabel}</div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="region-tag">${regionLabel}</span>
        <span class="price-badge ${dest.priceTier}">${dest.priceTier.replace('-', ' ')}</span>
      </div>
      ${reason ? `<p class="card-rec-reason">${reason}</p>` : ''}
      <p class="card-desc">${dest.shortDesc}</p>
      <div class="card-tags">
        ${dest.tripTypes.map(t => `<span class="card-tag">${t}</span>`).join('')}
      </div>
    </div>
  `;

  return card;
}

// --- Utils ---

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
