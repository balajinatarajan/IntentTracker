import { destinations } from '../data/destinations.js';
import { regions } from '../utils/categories.js';

export function renderDestinationGrid(container, onCardClick) {
  container.innerHTML = '';
  const filtered = getFilteredDestinations();

  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-results">No destinations match your search.</div>';
    return;
  }

  filtered.forEach(dest => {
    const card = createCard(dest);
    card.addEventListener('click', () => onCardClick(dest));
    container.appendChild(card);
  });
}

let currentFilter = '';

export function setFilter(query) {
  currentFilter = query.toLowerCase().trim();
}

export function getFilteredDestinations() {
  if (!currentFilter) return destinations;

  return destinations.filter(dest => {
    const searchable = [
      dest.name,
      dest.country,
      dest.shortDesc,
      dest.region,
      ...dest.tags,
      ...dest.tripTypes,
      dest.priceTier
    ].join(' ').toLowerCase();

    return currentFilter.split(/\s+/).every(term => searchable.includes(term));
  });
}

function createCard(dest) {
  const card = document.createElement('article');
  card.className = 'destination-card';
  card.dataset.destinationId = dest.id;

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
      <p class="card-desc">${dest.shortDesc}</p>
      <div class="card-tags">
        ${dest.tripTypes.map(t => `<span class="card-tag">${t}</span>`).join('')}
      </div>
    </div>
  `;

  return card;
}
