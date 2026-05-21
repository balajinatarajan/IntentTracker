// Self-contained debug panel — injects its own DOM and CSS
// Adapted from Wanderlust's debug-panel.js + debug-panel.css

const CSS = `
.__ik-fab {
  position: fixed; bottom: 1.5rem; right: 1.5rem;
  width: 48px; height: 48px; border-radius: 50%;
  background: #1c1c1c; color: #ff6b35; border: none;
  font-size: 1.3rem; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s, background 0.2s;
  font-family: system-ui, sans-serif;
}
.__ik-fab:hover { transform: scale(1.1); background: #2a2a2a; }

.__ik-panel {
  position: fixed; top: 0; right: -400px; width: 400px; height: 100vh;
  background: #1c1c1c; color: #e0e0e0; z-index: 100000;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  transition: right 0.3s ease;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.82rem;
}
.__ik-panel.__ik-open { right: 0; }

.__ik-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 1rem; background: #111; border-bottom: 1px solid #333;
}
.__ik-title { font-weight: 700; font-size: 0.95rem; color: #ff6b35; }
.__ik-close {
  background: none; border: none; color: #888; font-size: 1.3rem;
  cursor: pointer; padding: 0.2rem;
}
.__ik-close:hover { color: white; }

.__ik-tabs {
  display: flex; background: #111; border-bottom: 1px solid #333; padding: 0 0.5rem;
}
.__ik-tab {
  background: none; border: none; color: #888; padding: 0.5rem 0.75rem;
  font-size: 0.78rem; cursor: pointer; border-bottom: 2px solid transparent;
  font-family: inherit; transition: color 0.15s, border-color 0.15s;
}
.__ik-tab:hover { color: #e0e0e0; }
.__ik-tab.__ik-active { color: #ff6b35; border-bottom-color: #ff6b35; }

.__ik-content { flex: 1; overflow-y: auto; padding: 0.75rem; }
.__ik-empty { color: #666; text-align: center; padding: 2rem 1rem; font-style: italic; }

.__ik-event {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #555; line-height: 1.4;
}
.__ik-event.__ik-click { border-left-color: #ff6b35; }
.__ik-event.__ik-hover { border-left-color: #14b8a6; }
.__ik-event.__ik-view { border-left-color: #10b981; }
.__ik-event.__ik-search { border-left-color: #a78bfa; }
.__ik-event.__ik-page_view { border-left-color: #3b82f6; }

.__ik-etype {
  font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em;
}
.__ik-etype.__ik-click { color: #ff6b35; }
.__ik-etype.__ik-hover { color: #14b8a6; }
.__ik-etype.__ik-view { color: #10b981; }
.__ik-etype.__ik-search { color: #a78bfa; }
.__ik-etype.__ik-page_view { color: #3b82f6; }
.__ik-edetail { color: #ccc; }
.__ik-etime { color: #666; font-size: 0.72rem; }

.__ik-intent {
  padding: 0.6rem 0.7rem; margin-bottom: 0.4rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #ff6b35;
}
.__ik-intent.__ik-inactive { opacity: 0.45; border-left-color: #555; background: #222; }
.__ik-isummary { color: #ffc4b0; font-weight: 600; margin-bottom: 0.2rem; }
.__ik-intent.__ik-inactive .__ik-isummary { color: #888; }
.__ik-imeta { color: #666; font-size: 0.72rem; }
.__ik-conf {
  display: inline-block; padding: 0.1rem 0.3rem; border-radius: 2px;
  font-size: 0.68rem; font-weight: 600;
}
.__ik-conf.__ik-high { background: #065f46; color: #6ee7b7; }
.__ik-conf.__ik-medium { background: #4a2c1a; color: #ffc4b0; }
.__ik-conf.__ik-low { background: #333; color: #999; }
.__ik-faded {
  font-size: 0.6rem; font-weight: 400; color: #666; background: #333;
  padding: 0.1rem 0.35rem; border-radius: 2px; margin-left: 0.4rem;
  text-transform: uppercase; letter-spacing: 0.5px;
}

.__ik-psection { margin-bottom: 1rem; }
.__ik-psection h4 {
  color: #ff6b35; font-size: 0.78rem; text-transform: uppercase;
  letter-spacing: 0.05em; margin: 0 0 0.4rem 0;
}
.__ik-tw {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.25rem 0.5rem; margin-bottom: 0.2rem; background: #2a2a2a; border-radius: 2px;
}
.__ik-tw-name { color: #e0e0e0; }
.__ik-tw-bar { flex: 1; margin: 0 0.5rem; height: 4px; background: #1c1c1c; border-radius: 2px; overflow: hidden; }
.__ik-tw-fill { height: 100%; background: #ff6b35; border-radius: 2px; }
.__ik-tw-val { color: #888; font-size: 0.72rem; min-width: 2.5rem; text-align: right; }

.__ik-rec {
  padding: 0.5rem 0.7rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #1a2e1a; border-left: 3px solid #10b981;
}
.__ik-rec-name { color: #6ee7b7; font-weight: 600; }
.__ik-rec-reason { color: #888; font-size: 0.75rem; }
.__ik-rec-score { color: #10b981; font-weight: 700; font-size: 0.72rem; }

.__ik-footer { padding: 0.6rem; background: #111; border-top: 1px solid #333; }
.__ik-clear {
  width: 100%; padding: 0.5rem; background: #991b1b; color: #fecaca;
  border: none; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; font-family: inherit; transition: background 0.15s;
}
.__ik-clear:hover { background: #b91c1c; }

.__ik-jnode {
  display: inline-block; padding: 0.25rem 0.6rem; border-radius: 2px;
  background: #2a2a2a; color: #e0e0e0; font-size: 0.78rem; font-weight: 600;
}
.__ik-jnode.__ik-current { background: #065f46; color: #6ee7b7; }
.__ik-jarrow {
  display: inline-block; color: #ff6b35; margin: 0 0.3rem;
  font-size: 0.85rem; font-weight: 700;
}
.__ik-jpath { margin-bottom: 1rem; line-height: 2; }
.__ik-jtransition {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #a78bfa; line-height: 1.4;
  display: flex; justify-content: space-between; align-items: center;
}
.__ik-jtransition-label { color: #e0e0e0; }
.__ik-jtransition-count { color: #a78bfa; font-weight: 700; font-size: 0.78rem; }
.__ik-jprediction {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #1a2e1a; border-left: 3px solid #10b981; line-height: 1.4;
  display: flex; justify-content: space-between; align-items: center;
}
.__ik-jprediction-label { color: #6ee7b7; }
.__ik-jprediction-prob { color: #10b981; font-weight: 700; font-size: 0.78rem; }

@media (max-width: 768px) {
  .__ik-panel { width: 100%; right: -100%; }
}
`;

export function createDebugPanel({ onClear, journeyTracker }) {
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // Build DOM
  const fab = document.createElement('button');
  fab.className = '__ik-fab';
  fab.innerHTML = '&#9881;';
  fab.title = 'SignalTracker Debug';

  const panel = document.createElement('div');
  panel.className = '__ik-panel';
  panel.innerHTML = `
    <div class="__ik-header">
      <span class="__ik-title">SignalTracker Debug</span>
      <button class="__ik-close">&times;</button>
    </div>
    <div class="__ik-tabs">
      <button class="__ik-tab __ik-active" data-tab="events">Events</button>
      <button class="__ik-tab" data-tab="intents">Signals</button>
      <button class="__ik-tab" data-tab="profile">Profile</button>
      <button class="__ik-tab" data-tab="recs">Recs</button>
      <button class="__ik-tab" data-tab="journey">Journey</button>
    </div>
    <div class="__ik-content"></div>
    <div class="__ik-footer">
      <button class="__ik-clear">Clear All Data</button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const content = panel.querySelector('.__ik-content');
  const tabs = panel.querySelectorAll('.__ik-tab');
  let currentTab = 'events';

  // Persist events, intents & recs via localStorage (shared across tabs for dashboard)
  const SK_EVENTS = '__ik_debug_events';
  const SK_INTENTS = '__ik_debug_intents';
  const SK_RECS = '__ik_debug_recs';

  function loadSession(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : []; }
    catch (e) { return []; }
  }
  function saveSession(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (e) { /* ignore */ }
  }

  const eventLog = loadSession(SK_EVENTS);
  const intentLog = loadSession(SK_INTENTS);
  let profileData = null;
  let recsData = loadSession(SK_RECS);

  // Toggle
  fab.addEventListener('click', () => {
    panel.classList.add('__ik-open');
    fab.style.display = 'none';
  });
  panel.querySelector('.__ik-close').addEventListener('click', () => {
    panel.classList.remove('__ik-open');
    fab.style.display = 'flex';
  });

  // Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('__ik-active'));
      tab.classList.add('__ik-active');
      currentTab = tab.dataset.tab;
      render();
    });
  });

  // Clear
  panel.querySelector('.__ik-clear').addEventListener('click', () => {
    eventLog.length = 0;
    intentLog.length = 0;
    profileData = null;
    recsData = [];
    saveSession(SK_EVENTS, []);
    saveSession(SK_INTENTS, []);
    saveSession(SK_RECS, []);
    if (onClear) onClear();
    render();
  });

  function render() {
    switch (currentTab) {
      case 'events': renderEvents(); break;
      case 'intents': renderIntents(); break;
      case 'profile': renderProfile(); break;
      case 'recs': renderRecs(); break;
      case 'journey': renderJourney(); break;
    }
  }

  function renderEvents() {
    if (eventLog.length === 0) {
      content.innerHTML = '<div class="__ik-empty">Interact with the page to see events...</div>';
      return;
    }
    content.innerHTML = [...eventLog].reverse().map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      let detail = '';
      switch (e.type) {
        case 'view': detail = `${e.itemId} (${Math.round(e.dwellMs / 100) / 10}s)`; break;
        case 'hover': detail = `${e.itemId} (${Math.round(e.dwellMs / 100) / 10}s hover)`; break;
        case 'click': detail = e.itemId; break;
        case 'search': detail = `"${e.query}"`; break;
        case 'tab_view': detail = e.tabId + (e.tags && e.tags.length ? ` [${e.tags.join(', ')}]` : ''); break;
        case 'page_view': detail = e.pageMeta ? e.pageMeta.name : 'page'; break;
      }
      return `<div class="__ik-event __ik-${e.type}">
        <span class="__ik-etype __ik-${e.type}">${e.type}</span>
        <span class="__ik-edetail">${detail}</span>
        <span class="__ik-etime">${time}</span>
      </div>`;
    }).join('');
  }

  function renderIntents() {
    if (intentLog.length === 0) {
      content.innerHTML = '<div class="__ik-empty">No signals detected yet...</div>';
      return;
    }
    const sorted = intentLog.slice().sort((a, b) => {
      const aA = a.active !== false ? 1 : 0;
      const bA = b.active !== false ? 1 : 0;
      if (aA !== bA) return bA - aA;
      return b.confidence - a.confidence;
    });
    content.innerHTML = sorted.map(i => {
      const cl = i.confidence >= 0.7 ? 'high' : i.confidence >= 0.4 ? 'medium' : 'low';
      const inactive = i.active === false;
      return `<div class="__ik-intent${inactive ? ' __ik-inactive' : ''}">
        <div class="__ik-isummary">${i.summary}${inactive ? ' <span class="__ik-faded">faded</span>' : ''}</div>
        <div class="__ik-imeta">
          <span class="__ik-conf __ik-${cl}">${Math.round(i.confidence * 100)}%</span>
          ${i.category} · ${Math.round(i.sourceEventCount)} events · [${i.tags.join(', ')}]
        </div>
      </div>`;
    }).join('');
  }

  function renderProfile() {
    if (!profileData || Object.keys(profileData.tagWeights).length === 0) {
      content.innerHTML = '<div class="__ik-empty">No profile data yet.</div>';
      return;
    }
    const weights = Object.entries(profileData.tagWeights).sort((a, b) => b[1] - a[1]);
    const max = weights.length > 0 ? weights[0][1] : 1;
    content.innerHTML = `
      <div class="__ik-psection"><h4>Sessions: ${profileData.sessions.length}</h4></div>
      <div class="__ik-psection"><h4>Tag Weights</h4>
        ${weights.map(([tag, w]) => `
          <div class="__ik-tw">
            <span class="__ik-tw-name">${tag}</span>
            <div class="__ik-tw-bar"><div class="__ik-tw-fill" style="width:${(w/max*100)}%"></div></div>
            <span class="__ik-tw-val">${w.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>`;
  }

  function renderRecs() {
    if (recsData.length === 0) {
      content.innerHTML = '<div class="__ik-empty">No recommendations yet.</div>';
      return;
    }
    content.innerHTML = recsData.map(r => `
      <div class="__ik-rec">
        <div class="__ik-rec-name">${r.item?.name || r.itemId}</div>
        <div class="__ik-rec-reason">${r.reason}</div>
        <div class="__ik-rec-score">Score: ${r.score} · Tags: [${r.matchedTags.join(', ')}]</div>
      </div>
    `).join('');
  }

  function renderJourney() {
    if (!journeyTracker) {
      content.innerHTML = '<div class="__ik-empty">Journey tracking not enabled.</div>';
      return;
    }

    const currentPath = journeyTracker.getCurrentPath();
    const currentPage = journeyTracker.getCurrentPage();
    const transitions = journeyTracker.getTopTransitions(10);
    const predictions = currentPage ? journeyTracker.predictNextPages(currentPage.name, 3) : [];

    let html = '';

    // Section 1: Current Path
    html += '<div class="__ik-psection"><h4>Current Path</h4>';
    if (currentPath.length === 0) {
      html += '<div class="__ik-empty">No pages visited yet.</div>';
    } else {
      html += '<div class="__ik-jpath">';
      currentPath.forEach((pageName, i) => {
        const isCurrent = currentPage && pageName === currentPage.name && i === currentPath.length - 1;
        html += `<span class="__ik-jnode${isCurrent ? ' __ik-current' : ''}">${pageName}</span>`;
        if (i < currentPath.length - 1) {
          html += '<span class="__ik-jarrow">&rarr;</span>';
        }
      });
      html += '</div>';
    }
    html += '</div>';

    // Section 2: Top Transitions
    html += '<div class="__ik-psection"><h4>Top Transitions</h4>';
    if (transitions.length === 0) {
      html += '<div class="__ik-empty">No transitions recorded yet.</div>';
    } else {
      transitions.forEach(t => {
        html += `<div class="__ik-jtransition">
          <span class="__ik-jtransition-label">${t.from} &rarr; ${t.to}</span>
          <span class="__ik-jtransition-count">${t.count}&times;</span>
        </div>`;
      });
    }
    html += '</div>';

    // Section 3: Predictions
    html += '<div class="__ik-psection"><h4>Predicted Next</h4>';
    if (predictions.length === 0) {
      html += '<div class="__ik-empty">Not enough data for predictions.</div>';
    } else {
      predictions.forEach(p => {
        html += `<div class="__ik-jprediction">
          <span class="__ik-jprediction-label">${p.page}</span>
          <span class="__ik-jprediction-prob">${Math.round(p.probability * 100)}%</span>
        </div>`;
      });
    }
    html += '</div>';

    content.innerHTML = html;
  }

  return {
    logEvent(event) {
      eventLog.push(event);
      if (eventLog.length > 100) eventLog.shift();
      saveSession(SK_EVENTS, eventLog);
      if (currentTab === 'events') render();
    },

    replaceIntents(intents) {
      const activeKeys = new Set(
        intents.map(i => i.category + ':' + i.tags.slice().sort().join(','))
      );
      intentLog.forEach(existing => {
        const key = existing.category + ':' + existing.tags.slice().sort().join(',');
        if (!activeKeys.has(key)) {
          existing.confidence = (existing.confidence || 0) * 0.8;
          if (existing.confidence < 0.05) existing.active = false;
        }
      });
      intents.forEach(newIntent => {
        const key = newIntent.category + ':' + newIntent.tags.slice().sort().join(',');
        const idx = intentLog.findIndex(i =>
          i.category + ':' + i.tags.slice().sort().join(',') === key
        );
        newIntent.active = true;
        if (idx >= 0) intentLog[idx] = newIntent;
        else intentLog.push(newIntent);
      });
      saveSession(SK_INTENTS, intentLog);
      if (currentTab === 'intents') render();
    },

    logProfile(profile) {
      profileData = profile;
      if (currentTab === 'profile') render();
    },

    logRecommendations(recs) {
      recsData = recs;
      saveSession(SK_RECS, recs);
      if (currentTab === 'recs') render();
    },

    logJourney() {
      if (currentTab === 'journey') render();
    },

    destroy() {
      fab.remove();
      panel.remove();
      style.remove();
    }
  };
}
