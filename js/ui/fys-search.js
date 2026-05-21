import { regions } from '../utils/categories.js';

// Read the seeded profile written by persona-seed.js (key: 'ik_profile').
// Defensive: never throws. JSON.parse errors return null.
export function readSeededProfile() {
  try {
    const raw = localStorage.getItem('ik_profile');
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return profile && typeof profile === 'object' ? profile : null;
  } catch (e) {
    return null;
  }
}

// Compute ordered results for a region pick. Pure function (no DOM, no localStorage).
// Returns { mode, items, region, regionLabel }.
export function computeFysResults(profile, region, regionLabel, allDestinations, recEngine) {
  // Step 1: empty if no region or unknown region key
  if (!region || !regions[region]) {
    return { mode: 'empty', items: [], region: region || null, regionLabel: regionLabel || null };
  }

  // Step 2: collect in-region destinations in source order
  const inRegion = allDestinations.filter(d => d.region === region);

  // Step 3: empty if no destinations in this region
  if (inRegion.length === 0) {
    return { mode: 'empty', items: [], region, regionLabel };
  }

  // Step 4: detect whether the profile carries any signal
  const hasProfile = profile && profile.tagWeights && Object.keys(profile.tagWeights).length > 0;

  // Step 5: cold-start branch — source order, no scoring
  if (!hasProfile || !recEngine) {
    return {
      mode: 'cold-start',
      items: inRegion.slice(0, 12).map(d => ({ destination: d, reason: null, matchedTags: [] })),
      region,
      regionLabel
    };
  }

  // Step 6: rank via the recommendation engine
  const ranked = recEngine.recommend(profile, 100);

  // Step 7: keep only in-region items from the ranked list
  const filtered = ranked.filter(r => r.destination && r.destination.region === region);

  // Step 8 (safety net): tail-append any in-region destinations the engine dropped
  // (zero-score items, or items beyond the 3-per-region diversity cap) in source order.
  if (filtered.length < inRegion.length) {
    const includedIds = new Set(filtered.map(r => r.destinationId));
    const tail = inRegion
      .filter(d => !includedIds.has(d.id))
      .map(d => ({ destination: d, reason: null, matchedTags: [] }));
    filtered.push(...tail);
  }

  // Step 9: slice top 12 and normalize shape
  return {
    mode: 'personalized',
    items: filtered.slice(0, 12).map(r => ({
      destination: r.destination,
      reason: r.reason != null ? r.reason : null,
      matchedTags: r.matchedTags != null ? r.matchedTags : []
    })),
    region,
    regionLabel
  };
}

// Render the results grid into `container`. result === computeFysResults output.
export function renderFysResults(container, result, onCardClick) {
  if (!container) return;
  const { mode, items, regionLabel } = result;

  if (mode === 'empty') {
    if (!regionLabel) {
      container.innerHTML = `
        <div class="fys-empty-state">
          <h2 class="fys-empty-title">Plan a trip — tailored to you</h2>
          <p class="fys-empty-body">Pick a region above to see destinations ordered by your profile affinity.</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="fys-empty-state">
          <h2 class="fys-empty-title">Destinations in ${regionLabel}</h2>
          <p class="fys-empty-body">No destinations in our catalog for ${regionLabel} yet.</p>
        </div>
      `;
    }
    return;
  }

  const isCold = mode === 'cold-start';
  const wrapperClass = isCold ? 'fys-results-inner fys-cold' : 'fys-results-inner';
  const title = isCold ? `Destinations in ${regionLabel}` : `Top picks in ${regionLabel}`;
  const subtitle = isCold
    ? 'Sorted alphabetically — sign in for a tailored ranking.'
    : 'Ranked by your profile';
  const banner = isCold
    ? `<div class="fys-cold-banner">Sign in to personalize these picks.</div>`
    : '';

  container.innerHTML = `
    <div class="${wrapperClass}">
      ${banner}
      <div class="fys-results-header">
        <h2 class="fys-results-title">${title}</h2>
        <p class="fys-results-subtitle">${subtitle}</p>
      </div>
      <div class="fys-results-grid">
        ${items.map(item => {
          const dest = item.destination;
          const tagLabel = regions[dest.region]?.label || dest.region;
          const reasonText = item.reason != null ? item.reason : `Also in ${regionLabel}`;
          const reasonBlock = isCold
            ? ''
            : `<p class="rec-card-reason">${reasonText}</p>`;
          return `
            <article class="rec-card" data-destination-id="${dest.id}">
              <img class="rec-card-image" src="${dest.image}" alt="${dest.name}" loading="lazy">
              <div class="rec-card-body">
                <div class="rec-card-header">
                  <span class="rec-card-name">${dest.name}</span>
                  <span class="rec-card-price">$${dest.price}</span>
                </div>
                <div class="rec-card-meta">
                  <span class="region-tag">${tagLabel}</span>
                  <span class="price-badge ${dest.priceTier}">${dest.priceTier.replace('-', ' ')}</span>
                </div>
                ${reasonBlock}
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
      const it = items.find(i => i.destination.id === card.dataset.destinationId);
      if (it && typeof onCardClick === 'function') onCardClick(it.destination);
    });
  });
}

// Populate the <select> with one <option> per region, sorted alphabetically by label.
// Preserves the existing placeholder option (value="").
export function populateRegionPicker(selectEl, regionsMap) {
  if (!selectEl || !regionsMap) return;

  // Preserve the existing empty-value placeholder option(s)
  const placeholders = Array.from(selectEl.querySelectorAll('option')).filter(o => o.value === '');

  // Wipe and re-attach placeholder(s) first
  selectEl.innerHTML = '';
  placeholders.forEach(opt => selectEl.appendChild(opt));

  // Build sorted region options
  const entries = Object.entries(regionsMap).slice();
  entries.sort((a, b) => {
    const la = (a[1] && a[1].label) ? a[1].label : a[0];
    const lb = (b[1] && b[1].label) ? b[1].label : b[0];
    return la.localeCompare(lb);
  });

  for (const [key, config] of entries) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = (config && config.label) ? config.label : key;
    selectEl.appendChild(opt);
  }
}

// Read ?region=… from window.location.search. Returns string or null. Empty → null.
export function getRegionFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('region');
    if (!value) return null;
    return value;
  } catch (e) {
    return null;
  }
}

// Update ?region=… using history.replaceState. If region is null/empty, remove the param.
export function setRegionInUrl(region) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (region) {
      params.set('region', region);
    } else {
      params.delete('region');
    }
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
    history.replaceState(null, '', newUrl);
  } catch (e) {
    // Best-effort; never throw from a URL update
  }
}
