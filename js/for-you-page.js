// For You page — intent-driven tab layout.
// Tabs derive from the user's intent profile: a "Top Picks" tab scored
// against the full destination catalog, plus one tab per high-signal tag
// from tagWeights. Access is gated on the profile having intent data —
// first-time anonymous visitors land on the empty state.
//
// Why not the lib's RecommendationEngine for Top Picks: that engine reads
// from the per-tracker DOM-scanned catalog, which is empty when the page
// bootstraps (the grid hasn't been rendered yet). It also caps results
// with maxPerGroup=3 and drops score<=0 entries, which collides with the
// "always fill 12 slots" UX rule. We score destinations.js directly here
// so every tab is guaranteed PER_TAB_LIMIT cards.

import { destinations } from './data/destinations.js';
import { initModal, openModal } from './ui/detail-modal.js';
import { regions } from './utils/categories.js';
import { scoreDestinations } from './utils/scoring.js';

const MAX_TAG_TABS = 4;
const PER_TAB_LIMIT = 12;

// Tags that come from meta-page categories (the FY page itself, the
// homepage), not from content the user actually explored. Filtered out
// of both the intent strip and the tag-tab list. Future categories like
// these (search pages, etc.) should be added here.
const META_TAGS = new Set(['for-you', 'home']);
const isContentTag = ([tag, w]) => w > 0 && !tag.startsWith('price:') && !META_TAGS.has(tag);

const destMap = new Map(destinations.map(d => [d.id, d]));

const tabBarEl = document.getElementById('fy-tab-bar');
const gridEl = document.getElementById('destination-grid');
const intentStripEl = document.getElementById('intent-strip');
const emptyEl = document.getElementById('fy-empty');
const contentEl = document.getElementById('fy-content');

initModal();

if (typeof IntentTracker === 'undefined') {
  console.warn('IntentTracker not loaded — include intent-tracker.js before for-you-page.js');
} else {
  const tracker = IntentTracker.create({
    root: gridEl,
    debug: true,
    // Meta page (like the homepage) — leave category null so journey-tracker
    // doesn't add 'for-you' to the user's tagWeights as a journey_affinity.
    pageMeta: { name: 'For You', category: null, url: '/for-you.html' },
    emit: '/api/ingest',
  });
  window.__intentTracker = tracker;

  bootstrap(tracker);
}

function bootstrap(tracker) {
  const hasData = window.IntentTrackerExt?.hasIntentData?.(tracker);
  if (!hasData) {
    emptyEl.hidden = false;
    contentEl.hidden = true;
    return;
  }

  const profile = tracker.getProfile();
  const tabs = deriveTabs(tracker, profile);

  // Edge case: profile has tagWeights but no destinations match — show empty
  // so we don't render a tab bar with nothing under it.
  if (tabs.length === 0) {
    emptyEl.hidden = false;
    contentEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  contentEl.hidden = false;

  renderIntentStrip(profile);
  renderTabs(tracker, tabs);
}

function deriveTabs(tracker, profile) {
  const tabs = [];
  const clickCounts = window.IntentTrackerExt?.getItemClickCounts?.() || {};
  // Use merged weights (lib + click-derived) so single-item heavy clicking
  // ranks as expected. See profile-state.js for the reason the lib's own
  // tag_affinity threshold isn't enough.
  const weights = window.IntentTrackerExt?.getMergedTagWeights?.(tracker) || profile?.tagWeights || {};

  // Always include Top Picks — guarantees 12 cards (catalog is 100+).
  const topPicks = scoreDestinations(destinations, weights, clickCounts, PER_TAB_LIMIT);
  tabs.push({
    id: 'top-picks',
    label: 'Top Picks',
    type: 'top-picks',
    destinations: topPicks,
  });

  const sortedTags = Object.entries(weights)
    .filter(isContentTag)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  for (const tag of sortedTags) {
    const matches = destinations.filter(d => d.tags && d.tags.includes(tag));
    // Rule: a tab only ships if it can fill all PER_TAB_LIMIT slots.
    // A half-empty tab looks worse than no tab at all.
    if (matches.length < PER_TAB_LIMIT) continue;
    // Sort: click count desc, then score desc (so a click-heavy item beats a
    // weight-matched-but-never-clicked item; absent clicks, weight wins).
    const ranked = matches
      .map(d => {
        const tagScore = (d.tags || []).reduce((acc, t) => acc + (weights[t] || 0), 0);
        const normalized = d.tags.length > 0 ? tagScore / Math.sqrt(d.tags.length) : 0;
        return { dest: d, clicks: clickCounts[d.id] || 0, score: normalized };
      })
      .sort((a, b) => (b.clicks - a.clicks) || (b.score - a.score));
    tabs.push({
      id: `tag-${tag}`,
      label: prettyLabel(tag),
      type: 'tag',
      tag,
      destinations: ranked.slice(0, PER_TAB_LIMIT).map(r => r.dest),
    });
    if (tabs.length - 1 >= MAX_TAG_TABS) break;
  }

  return tabs;
}

function renderIntentStrip(profile) {
  if (!intentStripEl) return;
  // Merged weights (lib + clicks) so the strip reflects the same signal
  // the tabs are ranked against.
  const weights = window.IntentTrackerExt?.getMergedTagWeights?.(window.__intentTracker) || profile?.tagWeights || {};
  const top = Object.entries(weights)
    .filter(isContentTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => prettyLabel(t));
  if (top.length === 0) {
    intentStripEl.textContent = '';
    return;
  }
  intentStripEl.innerHTML = `<span class="intent-strip-label">Most explored tags:</span> ${top.map(t => `<span class="intent-pill">${t}</span>`).join('')}`;
}

function renderTabs(tracker, tabs) {
  tabBarEl.innerHTML = '';
  let activeId = tabs[0].id;

  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn${i === 0 ? ' active' : ''}`;
    btn.dataset.tab = tab.id;
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      activeId = tab.id;
      tabBarEl.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === activeId);
      });
      renderGrid(tab);

      if (window.__intentTracker) {
        const tags = tab.type === 'tag' ? [tab.tag] : [];
        window.__intentTracker.trackTabView(tab.id, tags);
        window.__intentTracker.scan();
      }
    });
    tabBarEl.appendChild(btn);
  });

  renderGrid(tabs[0]);
}

function renderGrid(tab) {
  gridEl.innerHTML = '';
  tab.destinations.forEach(dest => {
    gridEl.appendChild(createCard(dest, ''));
  });
  if (window.__intentTracker) window.__intentTracker.scan();
}

function createCard(dest, reason) {
  const card = document.createElement('article');
  card.className = 'destination-card';
  card.dataset.destinationId = dest.id;
  card.dataset.ikId = dest.id;
  card.dataset.ikTags = (dest.tags || []).join(', ');
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
        ${(dest.tripTypes || []).map(t => `<span class="card-tag">${t}</span>`).join('')}
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModal(dest));
  return card;
}

function prettyLabel(tag) {
  if (regions[tag]?.label) return regions[tag].label;
  return tag
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
