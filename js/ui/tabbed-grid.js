// Tabbed homepage grid: Popular (always) + For You (revealed when profile has signal)
import { regions } from "../utils/categories.js";

const SEEN_KEY = "foryou_seen";

const state = {
  tabBarEl: null,
  gridContainer: null,
  popularDests: [],
  forYouRecs: [],
  forYouRevealed: false,
  activeTab: "popular",
  query: "",
  onCardClick: null,
  newDotVisible: false
};

export function initTabs(tabBarEl, gridContainer, destinations, onCardClick) {
  state.tabBarEl = tabBarEl;
  state.gridContainer = gridContainer;
  state.popularDests = Array.isArray(destinations) ? destinations : [];
  state.onCardClick = typeof onCardClick === "function" ? onCardClick : () => {};
  state.newDotVisible = sessionStorage.getItem(SEEN_KEY) !== "1";

  tabBarEl.addEventListener("click", onTabBarClick);

  renderTabBar();
  renderActive();
}

export function showForYouTab(recs) {
  if (!recs || recs.length === 0) {
    if (state.forYouRevealed) {
      state.forYouRevealed = false;
      state.forYouRecs = [];
      if (state.activeTab === "foryou") {
        state.activeTab = "popular";
      }
      renderTabBar();
      renderActive();
    }
    return;
  }

  state.forYouRecs = recs;

  if (!state.forYouRevealed) {
    state.forYouRevealed = true;
    state.newDotVisible = sessionStorage.getItem(SEEN_KEY) !== "1";
    renderTabBar();
  }

  if (state.activeTab === "foryou") {
    renderActive();
  }
}

export function setSearchFilter(query) {
  state.query = (query || "").toLowerCase().trim();
  renderActive();
}

function onTabBarClick(event) {
  const pill = event.target.closest(".tab-pill");
  if (!pill || !state.tabBarEl.contains(pill)) return;
  const tab = pill.dataset.tab;
  if (!tab || tab === state.activeTab) return;
  if (tab === "foryou" && !state.forYouRevealed) return;

  state.activeTab = tab;

  if (tab === "foryou" && state.newDotVisible) {
    state.newDotVisible = false;
    sessionStorage.setItem(SEEN_KEY, "1");
  }

  renderTabBar();
  renderActive();
}

function renderTabBar() {
  if (!state.tabBarEl) return;
  const popularActive = state.activeTab === "popular" ? " active" : "";
  let html = '<button class="tab-pill' + popularActive + '" type="button" data-tab="popular">Popular</button>';

  if (state.forYouRevealed) {
    const foryouActive = state.activeTab === "foryou" ? " active" : "";
    const hasNew = state.newDotVisible ? " has-new" : "";
    const dot = state.newDotVisible ? '<span class="tab-new-dot" aria-label="new"></span>' : "";
    html += '<button class="tab-pill' + foryouActive + hasNew + '" type="button" data-tab="foryou">For You' + dot + '</button>';
  }

  state.tabBarEl.innerHTML = html;
}

function renderActive() {
  if (!state.gridContainer) return;
  state.gridContainer.innerHTML = "";

  let source;
  if (state.activeTab === "foryou") {
    source = state.forYouRecs
      .map(r => (r && r.destination) ? r.destination : null)
      .filter(d => d && d.id);
  } else {
    source = state.popularDests;
  }

  const filtered = filter(source, state.query);

  if (state.activeTab === "foryou") {
    const subtitle = document.createElement("div");
    subtitle.className = "for-you-subtitle";
    subtitle.textContent = "Picked for you based on your recent activity";
    state.gridContainer.appendChild(subtitle);
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "no-results";
    empty.textContent = "No destinations match your search.";
    state.gridContainer.appendChild(empty);
    return;
  }

  const isForYou = state.activeTab === "foryou";
  filtered.forEach(dest => {
    const card = buildCard(dest);
    card.addEventListener("click", () => {
      state.onCardClick(dest);
      if (isForYou && window.__intentTracker && typeof window.__intentTracker.trackClick === "function") {
        window.__intentTracker.trackClick(dest.id);
      }
    });
    state.gridContainer.appendChild(card);
  });
}

function filter(items, query) {
  if (!query) return items;
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;

  return items.filter(dest => {
    const searchable = [
      dest.name,
      dest.country,
      dest.shortDesc,
      dest.region,
      ...(dest.tags || []),
      ...(dest.tripTypes || []),
      dest.priceTier
    ].join(" ").toLowerCase();

    return terms.every(term => searchable.includes(term));
  });
}

function buildCard(dest) {
  const card = document.createElement("article");
  card.className = "destination-card";
  card.dataset.destinationId = dest.id;

  const regionLabel = (regions[dest.region] && regions[dest.region].label) || dest.region;

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
        <span class="price-badge ${dest.priceTier}">${dest.priceTier.replace("-", " ")}</span>
      </div>
      <p class="card-desc">${dest.shortDesc}</p>
      <div class="card-tags">
        ${dest.tripTypes.map(t => `<span class="card-tag">${t}</span>`).join("")}
      </div>
    </div>
  `;

  return card;
}
