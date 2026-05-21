// Standalone IntentTracker Dashboard
// Reads from localStorage/sessionStorage and polls for changes

// --- Storage keys (must match debug-panel.js and intent-store.js) ---
const SK_EVENTS = '__ik_debug_events';
const SK_INTENTS = '__ik_debug_intents';
const SK_RECS = '__ik_debug_recs';
const SK_PROFILE = 'ik_profile';
const SK_JOURNEY = 'ik_journey';

// --- DOM refs ---
const eventsBody = document.getElementById('events-body');
const intentsBody = document.getElementById('intents-body');
const profileBody = document.getElementById('profile-body');
const journeyBody = document.getElementById('journey-body');
const recsBody = document.getElementById('recs-body');
const eventCount = document.getElementById('event-count');
const intentCount = document.getElementById('intent-count');
const recsCount = document.getElementById('recs-count');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// --- State for change detection ---
let prev = { events: '', intents: '', profile: '', journey: '', recs: '' };
let lastChangeTime = Date.now();

// --- Helpers ---
function readSession(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : []; }
  catch { return []; }
}

function readLocal(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// --- Renderers ---

function renderEvents(events) {
  eventCount.textContent = events.length;
  if (events.length === 0) {
    eventsBody.innerHTML = '<div class="tk-empty">No events yet — browse the site in another tab</div>';
    return;
  }

  const reversed = [...events].reverse();
  eventsBody.innerHTML = reversed.map(e => {
    const type = e.type || 'view';
    const detail = e.itemId || e.tabId || e.query || e.pageMeta?.name || '—';
    const tags = (e.tags && e.tags.length) ? ` [${e.tags.join(', ')}]` : '';
    const time = e.timestamp ? timeAgo(e.timestamp) : '';
    return `
      <div class="tk-event">
        <span class="tk-event-type ${type}">${type}</span>
        <span class="tk-event-detail">${esc(detail)}${esc(tags)}</span>
        <span class="tk-event-time">${time}</span>
      </div>
    `;
  }).join('');
}

function renderIntents(intents) {
  intentCount.textContent = intents.length;
  if (intents.length === 0) {
    intentsBody.innerHTML = '<div class="tk-empty">No signals detected yet</div>';
    return;
  }

  // Sort: active first, then by confidence desc
  const sorted = [...intents].sort((a, b) => {
    if (a.active !== b.active) return a.active === false ? 1 : -1;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  intentsBody.innerHTML = sorted.map(i => {
    const conf = Math.round((i.confidence || 0) * 100);
    const level = conf >= 70 ? 'high' : conf >= 40 ? 'medium' : 'low';
    const active = i.active !== false;
    return `
      <div class="tk-intent${active ? '' : ' inactive'}">
        <div class="tk-intent-header">
          <span class="tk-intent-summary">${esc(i.summary || i.category)}</span>
          <span class="tk-intent-confidence ${level}">${conf}%</span>
        </div>
        <div class="tk-intent-meta">
          <span class="tk-intent-category">${esc(i.category)}</span>
          <span>${i.sourceEventCount || 0} events</span>
        </div>
        ${i.tags?.length ? `
          <div class="tk-intent-tags">
            ${i.tags.map(t => `<span class="tk-tag">${esc(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderProfile(profile) {
  if (!profile || !profile.sessions) {
    profileBody.innerHTML = '<div class="tk-empty">No profile data</div>';
    return;
  }

  const weights = profile.tagWeights || {};
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const maxWeight = entries.length > 0 ? entries[0][1] : 1;

  let html = `<div class="tk-stat">Sessions: <strong>${profile.sessions.length}</strong></div>`;

  if (entries.length === 0) {
    html += '<div class="tk-empty">No tag weights yet</div>';
  } else {
    html += entries.map(([tag, weight]) => {
      const pct = Math.round((weight / maxWeight) * 100);
      return `
        <div class="tk-weight-row">
          <span class="tk-weight-label">${esc(tag)}</span>
          <div class="tk-weight-bar-bg">
            <div class="tk-weight-bar" style="width: ${pct}%"></div>
          </div>
          <span class="tk-weight-value">${weight.toFixed(2)}</span>
        </div>
      `;
    }).join('');
  }

  profileBody.innerHTML = html;
}

function renderJourney(journey) {
  if (!journey) {
    journeyBody.innerHTML = '<div class="tk-empty">No journey data</div>';
    return;
  }

  let html = '';

  // Current path
  const currentPath = journey.currentPath || [];
  if (currentPath.length > 0) {
    html += '<div class="tk-journey-section">';
    html += '<div class="tk-journey-label">Current Path</div>';
    html += '<div class="tk-path">';
    currentPath.forEach((page, i) => {
      const isCurrent = i === currentPath.length - 1;
      if (i > 0) html += '<span class="tk-path-arrow">→</span>';
      html += `<span class="tk-path-node${isCurrent ? ' current' : ''}">${esc(page)}</span>`;
    });
    html += '</div></div>';
  }

  // Top transitions — graph keys are "From->To" with { count, lastSeen }
  const graph = journey.transitionGraph || {};
  const transitions = Object.entries(graph)
    .map(([route, data]) => ({ route, count: data.count || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (transitions.length > 0) {
    html += '<div class="tk-journey-section">';
    html += '<div class="tk-journey-label">Top Transitions</div>';
    html += transitions.map(t => {
      const display = t.route.replace('->', ' → ');
      return `<div class="tk-transition">
        <span class="tk-transition-route">${esc(display)}</span>
        <span class="tk-transition-count">×${t.count}</span>
      </div>`;
    }).join('');
    html += '</div>';
  }

  // Predictions — find transitions from current page
  if (currentPath.length > 0) {
    const currentPage = currentPath[currentPath.length - 1];
    const prefix = currentPage + '->';
    const predictions = [];
    let total = 0;
    for (const [route, data] of Object.entries(graph)) {
      if (route.startsWith(prefix)) {
        const target = route.slice(prefix.length);
        predictions.push({ page: target, count: data.count || 0 });
        total += data.count || 0;
      }
    }
    predictions.sort((a, b) => b.count - a.count);

    if (predictions.length > 0) {
      html += '<div class="tk-journey-section">';
      html += '<div class="tk-journey-label">Predicted Next</div>';
      html += predictions.slice(0, 5).map(p => {
        const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
        return `
          <div class="tk-prediction">
            <span class="tk-prediction-name">${esc(p.page)}</span>
            <div class="tk-prediction-bar-bg">
              <div class="tk-prediction-bar" style="width: ${pct}%"></div>
            </div>
            <span class="tk-prediction-pct">${pct}%</span>
          </div>
        `;
      }).join('');
      html += '</div>';
    }
  }

  // Page visit counts
  const visits = journey.pageVisitCounts || {};
  const visitEntries = Object.entries(visits).sort((a, b) => b[1] - a[1]);
  if (visitEntries.length > 0) {
    html += '<div class="tk-journey-section">';
    html += '<div class="tk-journey-label">Page Visits</div>';
    html += visitEntries.map(([page, count]) =>
      `<div class="tk-transition">
        <span class="tk-transition-route">${esc(page)}</span>
        <span class="tk-transition-count">×${count}</span>
      </div>`
    ).join('');
    html += '</div>';
  }

  journeyBody.innerHTML = html || '<div class="tk-empty">No journey data</div>';
}

function renderRecs(recs) {
  recsCount.textContent = recs.length;
  if (recs.length === 0) {
    recsBody.innerHTML = '<div class="tk-empty">No recommendations yet</div>';
    return;
  }

  recsBody.innerHTML = `
    <div class="tk-recs-grid">
      ${recs.map(r => `
        <div class="tk-rec-card">
          <div class="tk-rec-card-body">
            <div class="tk-rec-card-name">${esc(r.item?.name || r.itemId || '—')}</div>
            <div class="tk-rec-card-reason">${esc(r.reason || '')}</div>
            <div class="tk-rec-card-score">score: ${(r.score || 0).toFixed(3)}</div>
            ${r.matchedTags?.length ? `
              <div class="tk-rec-card-tags">
                ${r.matchedTags.map(t => `<span class="tk-tag">${esc(t)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// --- HTML escaping ---
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Polling loop ---
function poll() {
  const eventsRaw = localStorage.getItem(SK_EVENTS) || '[]';
  const intentsRaw = localStorage.getItem(SK_INTENTS) || '[]';
  const recsRaw = localStorage.getItem(SK_RECS) || '[]';
  const profileRaw = localStorage.getItem(SK_PROFILE) || '';
  const journeyRaw = localStorage.getItem(SK_JOURNEY) || '';

  let changed = false;

  if (eventsRaw !== prev.events) {
    prev.events = eventsRaw;
    renderEvents(JSON.parse(eventsRaw));
    changed = true;
  }

  if (intentsRaw !== prev.intents) {
    prev.intents = intentsRaw;
    renderIntents(JSON.parse(intentsRaw));
    changed = true;
  }

  if (profileRaw !== prev.profile) {
    prev.profile = profileRaw;
    renderProfile(profileRaw ? JSON.parse(profileRaw) : null);
    changed = true;
  }

  if (journeyRaw !== prev.journey) {
    prev.journey = journeyRaw;
    renderJourney(journeyRaw ? JSON.parse(journeyRaw) : null);
    changed = true;
  }

  if (recsRaw !== prev.recs) {
    prev.recs = recsRaw;
    renderRecs(JSON.parse(recsRaw));
    changed = true;
  }

  if (changed) {
    lastChangeTime = Date.now();
    statusDot.classList.remove('idle');
    statusText.textContent = 'live';
  } else if (Date.now() - lastChangeTime > 10000) {
    statusDot.classList.add('idle');
    statusText.textContent = 'idle';
  }
}

// Initial poll + start interval
poll();
setInterval(poll, 1000);
