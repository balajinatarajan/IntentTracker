import { regions } from '../utils/categories.js';

export function renderRecommendations(container, recommendations, onCardClick) {
  if (!recommendations || recommendations.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  container.innerHTML = `
    <div class="recommendations-inner">
      <h2 class="recommendations-title">Recommended for You</h2>
      <p class="recommendations-subtitle">Based on your browsing interests</p>
      <div class="recommendations-grid">
        ${recommendations.map(rec => {
          const dest = rec.destination;
          const regionLabel = regions[dest.region]?.label || dest.region;
          return `
            <article class="rec-card" data-destination-id="${dest.id}">
              <img class="rec-card-image" src="${dest.image}" alt="${dest.name}" loading="lazy">
              <div class="rec-card-body">
                <div class="rec-card-header">
                  <span class="rec-card-name">${dest.name}</span>
                  <span class="rec-card-price">$${dest.price}</span>
                </div>
                <div class="rec-card-meta">
                  <span class="region-tag">${regionLabel}</span>
                  <span class="price-badge ${dest.priceTier}">${dest.priceTier.replace('-', ' ')}</span>
                </div>
                <p class="rec-card-reason">${rec.reason}</p>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Wire click handlers
  container.querySelectorAll('.rec-card').forEach(card => {
    card.addEventListener('click', () => {
      const dest = recommendations.find(r => r.destinationId === card.dataset.destinationId)?.destination;
      if (dest) onCardClick(dest);
    });
  });
}
