import { IntentStore } from '../storage/intent-store.js';

let panel, fab, tabContent, currentTab;
const eventLog = [];
const intentLog = [];
let profileData = null;
let recsData = [];

export function initDebugPanel() {
  panel = document.getElementById('debug-panel');
  fab = document.getElementById('debug-panel-fab');
  tabContent = document.getElementById('debug-tab-content');

  // Toggle panel
  fab.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) fab.style.display = 'none';
  });

  document.getElementById('debug-panel-close').addEventListener('click', () => {
    panel.classList.remove('open');
    fab.style.display = 'flex';
  });

  // Tab switching
  document.querySelectorAll('.debug-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.debug-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderCurrentTab();
    });
  });

  currentTab = 'events';

  // Clear button
  document.getElementById('debug-clear-btn').addEventListener('click', () => {
    const store = new IntentStore();
    store.clearAll();
    // Clear the in-memory event buffer so next flush doesn't repopulate
    if (window.__clearEventBuffer) window.__clearEventBuffer();
    eventLog.length = 0;
    intentLog.length = 0;
    profileData = null;
    recsData = [];
    renderCurrentTab();
  });
}

export function logEvent(event) {
  eventLog.push(event);
  // Keep last 100 events
  if (eventLog.length > 100) eventLog.shift();
  if (currentTab === 'events') renderCurrentTab();
}

export function logIntent(intent) {
  // Dedupe by summary
  const idx = intentLog.findIndex(i => i.summary === intent.summary);
  if (idx >= 0) {
    intentLog[idx] = intent;
  } else {
    intentLog.push(intent);
  }
  if (currentTab === 'intents') renderCurrentTab();
}

export function replaceIntents(intents) {
  // Mark active intents from the new batch
  const activeKeys = new Set(
    intents.map(i => i.category + ':' + i.tags.slice().sort().join(','))
  );

  // Mark existing intents not in the new batch as inactive
  intentLog.forEach(existing => {
    const key = existing.category + ':' + existing.tags.slice().sort().join(',');
    if (!activeKeys.has(key)) {
      existing.active = false;
    }
  });

  // Merge new intents: update existing or append
  intents.forEach(newIntent => {
    const key = newIntent.category + ':' + newIntent.tags.slice().sort().join(',');
    const idx = intentLog.findIndex(i =>
      i.category + ':' + i.tags.slice().sort().join(',') === key
    );
    newIntent.active = true;
    if (idx >= 0) {
      intentLog[idx] = newIntent;
    } else {
      intentLog.push(newIntent);
    }
  });

  if (currentTab === 'intents') renderCurrentTab();
}

export function logProfile(profile) {
  profileData = profile;
  if (currentTab === 'profile') renderCurrentTab();
}

export function logRecommendations(recs) {
  recsData = recs;
  if (currentTab === 'recs') renderCurrentTab();
}

function renderCurrentTab() {
  switch (currentTab) {
    case 'events': renderEvents(); break;
    case 'intents': renderIntents(); break;
    case 'profile': renderProfile(); break;
    case 'recs': renderRecs(); break;
  }
}

function renderEvents() {
  if (eventLog.length === 0) {
    tabContent.innerHTML = '<div class="debug-empty">Interact with the page to see events...</div>';
    return;
  }

  tabContent.innerHTML = [...eventLog].reverse().map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString();
    let detail = '';

    switch (e.type) {
      case 'view':
        detail = `${e.destinationId} (${Math.round(e.dwellMs / 1000 * 10) / 10}s)`;
        break;
      case 'hover':
        detail = `${e.destinationId} (${Math.round(e.dwellMs / 1000 * 10) / 10}s hover)`;
        break;
      case 'click':
        detail = e.destinationId;
        break;
      case 'search':
        detail = `"${e.query}"`;
        break;
    }

    return `
      <div class="debug-event event-${e.type}">
        <span class="event-type type-${e.type}">${e.type}</span>
        <span class="event-detail">${detail}</span>
        <span class="event-time">${time}</span>
      </div>
    `;
  }).join('');
}

function renderIntents() {
  if (intentLog.length === 0) {
    tabContent.innerHTML = '<div class="debug-empty">No intents detected yet. Browse more destinations...</div>';
    return;
  }

  // Sort: active first (by confidence desc), then inactive (by confidence desc)
  const sorted = intentLog.slice().sort((a, b) => {
    const aActive = a.active !== false ? 1 : 0;
    const bActive = b.active !== false ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return b.confidence - a.confidence;
  });

  tabContent.innerHTML = sorted.map(i => {
    const confLevel = i.confidence >= 0.7 ? 'high' : i.confidence >= 0.4 ? 'medium' : 'low';
    const isInactive = i.active === false;
    return `
      <div class="debug-intent${isInactive ? ' intent-inactive' : ''}">
        <div class="intent-summary">${i.summary}${isInactive ? ' <span class="intent-faded-label">faded</span>' : ''}</div>
        <div class="intent-meta">
          <span class="intent-confidence ${confLevel}">${Math.round(i.confidence * 100)}%</span>
          ${i.category} · ${i.sourceEventCount} events · [${i.tags.join(', ')}]
        </div>
      </div>
    `;
  }).join('');
}

function renderProfile() {
  if (!profileData || Object.keys(profileData.tagWeights).length === 0) {
    tabContent.innerHTML = '<div class="debug-empty">No profile data yet.</div>';
    return;
  }

  const weights = Object.entries(profileData.tagWeights).sort((a, b) => b[1] - a[1]);
  const maxWeight = weights.length > 0 ? weights[0][1] : 1;

  let html = `
    <div class="debug-profile-section">
      <h4>Sessions: ${profileData.sessions.length}</h4>
    </div>
    <div class="debug-profile-section">
      <h4>Tag Weights</h4>
      ${weights.map(([tag, weight]) => `
        <div class="debug-tag-weight">
          <span class="tag-name">${tag}</span>
          <div class="tag-bar">
            <div class="tag-bar-fill" style="width: ${(weight / maxWeight * 100)}%"></div>
          </div>
          <span class="tag-value">${weight.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
  `;

  tabContent.innerHTML = html;
}

function renderRecs() {
  if (recsData.length === 0) {
    tabContent.innerHTML = '<div class="debug-empty">No recommendations generated yet.</div>';
    return;
  }

  tabContent.innerHTML = recsData.map(r => `
    <div class="debug-rec">
      <div class="rec-name">${r.destination.name}</div>
      <div class="rec-reason">${r.reason}</div>
      <div class="rec-score">Score: ${r.score} · Tags: [${r.matchedTags.join(', ')}]</div>
    </div>
  `).join('');
}
