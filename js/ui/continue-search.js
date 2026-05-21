const PAGE_URLS = {
  Vacations: 'vacations.html',
  Hotels: 'hotels.html',
  Resorts: 'resorts.html',
  Dining: 'dining.html',
  Home: 'index.html',
};

const PAGE_DESCRIPTIONS = {
  Vacations: 'All-inclusive getaways',
  Hotels: 'City stays & business travel',
  Resorts: 'Luxury retreats & wellness',
  Dining: 'Restaurants & cuisine',
  Home: 'Back to home',
};

export function renderContinueSearch(container, predictions) {
  if (!predictions || predictions.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Filter out Home and predictions without a URL mapping
  const valid = predictions.filter(p => PAGE_URLS[p.page] && p.page !== 'Home');
  if (valid.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  container.innerHTML = `
    <div class="continue-search-inner">
      <h2 class="continue-search-title">Continue Your Search</h2>
      <p class="continue-search-subtitle">Based on your browsing journey</p>
      <div class="continue-search-grid">
        ${valid.map(p => {
          const pct = Math.round(p.probability * 100);
          const desc = PAGE_DESCRIPTIONS[p.page] || p.page;
          const url = PAGE_URLS[p.page];
          return `
            <a class="journey-link-card" href="${url}">
              <span class="journey-link-name">${p.page}</span>
              <span class="journey-link-desc">${desc}</span>
              <div class="journey-link-bar-track">
                <div class="journey-link-bar-fill" style="width:${pct}%"></div>
              </div>
              <span class="journey-link-pct">${pct}% likely next</span>
            </a>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
