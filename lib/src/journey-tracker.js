// Journey Tracker — tracks cross-page navigation, builds transition graph, predicts next pages

const STORAGE_KEY = 'ik_journey';
const MAX_STEPS = 200;
const MAX_RECENT_PATHS = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CATEGORY_VISIT_THRESHOLD = 3;

export function createJourneyTracker() {
  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return defaultState();
  }

  function defaultState() {
    return {
      currentPage: null,
      currentPath: [],
      steps: [],
      transitionGraph: {},
      pageVisitCounts: {},
      recentPaths: [],
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  // Check session boundary — if last page entry is older than 30 min, archive path
  function checkSessionBoundary() {
    if (state.currentPage && state.currentPage.enteredAt) {
      const elapsed = Date.now() - state.currentPage.enteredAt;
      if (elapsed > SESSION_TIMEOUT_MS) {
        if (state.currentPath.length > 1) {
          state.recentPaths.push([...state.currentPath]);
          if (state.recentPaths.length > MAX_RECENT_PATHS) {
            state.recentPaths.shift();
          }
        }
        state.currentPage = null;
        state.currentPath = [];
      }
    }
  }

  function recordPageView(pageMeta) {
    checkSessionBoundary();

    const previousPage = state.currentPage;
    const newPage = {
      name: pageMeta.name,
      category: pageMeta.category || null,
      url: pageMeta.url || null,
      enteredAt: Date.now(),
    };

    // Record transition
    if (previousPage) {
      const step = {
        from: { name: previousPage.name, category: previousPage.category, url: previousPage.url },
        to: { name: newPage.name, category: newPage.category, url: newPage.url },
        timestamp: Date.now(),
      };
      state.steps.push(step);
      if (state.steps.length > MAX_STEPS) {
        state.steps = state.steps.slice(-MAX_STEPS);
      }

      // Update transition graph
      const key = previousPage.name + '->' + newPage.name;
      if (!state.transitionGraph[key]) {
        state.transitionGraph[key] = { count: 0, lastSeen: 0 };
      }
      state.transitionGraph[key].count++;
      state.transitionGraph[key].lastSeen = Date.now();
    }

    // Update visit counts
    state.pageVisitCounts[newPage.name] = (state.pageVisitCounts[newPage.name] || 0) + 1;

    // Update current path
    state.currentPath.push(newPage.name);
    state.currentPage = newPage;

    persist();
  }

  function predictNextPages(currentPageName, n = 3) {
    const prefix = currentPageName + '->';
    const candidates = [];

    Object.entries(state.transitionGraph).forEach(([key, data]) => {
      if (key.startsWith(prefix)) {
        const targetPage = key.slice(prefix.length);
        // Recency boost: 1.0 to 1.5 based on how recent the last transition was
        const ageMs = Date.now() - data.lastSeen;
        const ageHours = ageMs / (1000 * 60 * 60);
        const recencyBoost = 1.0 + Math.max(0, 0.5 - ageHours * 0.02);
        candidates.push({
          page: targetPage,
          score: data.count * recencyBoost,
        });
      }
    });

    if (candidates.length === 0) return [];

    // Normalize to probabilities
    const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map(c => ({
        page: c.page,
        probability: Math.round((c.score / totalScore) * 100) / 100,
      }));
  }

  function getTopTransitions(n = 10) {
    return Object.entries(state.transitionGraph)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, n)
      .map(([key, data]) => {
        const [from, to] = key.split('->');
        return { from, to, count: data.count, lastSeen: data.lastSeen };
      });
  }

  function deriveJourneyIntents() {
    const intents = [];

    // Find pages with category visited 3+ times — derive journey_affinity intents
    const categoryCounts = {};
    Object.entries(state.pageVisitCounts).forEach(([pageName, count]) => {
      // Look up category from steps
      const step = state.steps.find(s => s.to.name === pageName || s.from.name === pageName);
      let category = null;
      if (step) {
        category = (step.to.name === pageName ? step.to.category : step.from.category);
      }
      // Also check currentPage
      if (!category && state.currentPage && state.currentPage.name === pageName) {
        category = state.currentPage.category;
      }
      if (category && category !== 'home') {
        categoryCounts[category] = (categoryCounts[category] || 0) + count;
      }
    });

    Object.entries(categoryCounts).forEach(([category, count]) => {
      if (count >= CATEGORY_VISIT_THRESHOLD) {
        intents.push({
          id: 'journey-' + category,
          timestamp: Date.now(),
          summary: `Frequently visits ${category} pages`,
          tags: [category],
          confidence: Math.min(count / 10, 1.0),
          category: 'journey_affinity',
          sourceEventCount: count,
        });
      }
    });

    return intents;
  }

  function getCurrentPath() {
    return [...state.currentPath];
  }

  function getCurrentPage() {
    return state.currentPage;
  }

  function getState() {
    return { ...state };
  }

  function clearAll() {
    state = defaultState();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  return {
    recordPageView,
    predictNextPages,
    getTopTransitions,
    deriveJourneyIntents,
    getCurrentPath,
    getCurrentPage,
    getState,
    clearAll,
  };
}
