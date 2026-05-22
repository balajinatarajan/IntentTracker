// For You page — intent-driven tab layout.
// Tabs derive from the user's intent profile: a default "Top Picks" tab driven
// by the recommendation engine, plus one tab per high-signal tag from
// tagWeights. Access is gated on the profile having intent data — first-time
// anonymous visitors land on the empty state (per #31 cold-start).

import { destinations } from './data/destinations.js';
import { initModal, openModal } from './ui/detail-modal.js';
import { regions } from './utils/categories.js';

const MAX_TAG_TABS = 4;
const PER_TAB_LIMIT = 12;

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
    pageMeta: { name: 'For You', category: 'for-you', url: '/for-you.html' },
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
  const byClicksDesc = (a, b) => (clickCounts[b.id] || 0) - (clickCounts[a.id] || 0);

  // Top Picks: pull a wider candidate pool from the rec engine so that
  // repeatedly-clicked items have a chance to surface, then re-sort by
  // click count (stable sort preserves rec order as the tiebreaker).
  const recs = tracker.recommend(PER_TAB_LIMIT * 4);
  if (recs.length > 0) {
    recs.sort((a, b) => (clickCounts[b.itemId] || 0) - (clickCounts[a.itemId] || 0));
    tabs.push({
      id: 'top-picks',
      label: 'Top Picks',
      type: 'recommendations',
      recs: recs.slice(0, PER_TAB_LIMIT),
    });
  }

  const weights = profile?.tagWeights || {};
  const sortedTags = Object.entries(weights)
    .filter(([tag, w]) => w > 0 && !tag.startsWith('price:'))
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  for (const tag of sortedTags) {
    const matches = destinations
      .filter(d => d.tags && d.tags.includes(tag))
      .slice()
      .sort(byClicksDesc);
    if (matches.length === 0) continue;
    tabs.push({
      id: `tag-${tag}`,
      label: prettyLabel(tag),
      type: 'tag',
      tag,
      destinations: matches.slice(0, PER_TAB_LIMIT),
    });
    if (tabs.length - 1 >= MAX_TAG_TABS) break;
  }

  return tabs;
}

function renderIntentStrip(profile) {
  if (!intentStripEl) return;
  const weights = profile?.tagWeights || {};
  const top = Object.entries(weights)
    .filter(([t, w]) => w > 0 && !t.startsWith('price:'))
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
  if (tab.type === 'recommendations') {
    tab.recs.forEach(rec => {
      const dest = destMap.get(rec.itemId) || rec.item;
      if (!dest) return;
      gridEl.appendChild(createCard(dest, rec.reason));
    });
  } else {
    tab.destinations.forEach(dest => {
      gridEl.appendChild(createCard(dest, ''));
    });
  }

  if (gridEl.children.length === 0) {
    gridEl.innerHTML = '<div class="no-results">No matches yet — try exploring more.</div>';
  }

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
