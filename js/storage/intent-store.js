const STORAGE_KEY = 'wanderlust_intent_profile';

export class IntentStore {
  constructor() {
    this.profile = this._load();
  }

  saveSessionIntents(sessionId, intents) {
    // Find or create session
    let session = this.profile.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      session = {
        sessionId,
        startedAt: Date.now(),
        intents: []
      };
      this.profile.sessions.push(session);
    }

    // Build a key set of currently active intents
    const activeKeys = new Set(
      intents.map(i => i.category + ':' + i.tags.slice().sort().join(','))
    );

    // Mark old intents not in the new batch as inactive
    session.intents.forEach(existing => {
      const key = existing.category + ':' + existing.tags.slice().sort().join(',');
      if (!activeKeys.has(key)) {
        existing.active = false;
      }
    });

    // Merge new intents: update existing or append
    intents.forEach(newIntent => {
      const key = newIntent.category + ':' + newIntent.tags.slice().sort().join(',');
      const idx = session.intents.findIndex(i =>
        i.category + ':' + i.tags.slice().sort().join(',') === key
      );
      newIntent.active = true;
      if (idx >= 0) {
        session.intents[idx] = newIntent;
      } else {
        session.intents.push(newIntent);
      }
    });

    // Recompute tag weights
    this._computeTagWeights();
    this._save();
  }

  getProfile() {
    return this.profile;
  }

  clearAll() {
    this.profile = this._createEmpty();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to remove intent profile:', e);
    }
  }

  _computeTagWeights() {
    const weights = {};
    const sessionCount = this.profile.sessions.length;

    this.profile.sessions.forEach((session, index) => {
      // Temporal decay: more recent sessions weighted higher
      const sessionsAgo = sessionCount - 1 - index;
      const decay = Math.pow(0.8, sessionsAgo);

      session.intents.forEach(intent => {
        // Only active intents contribute to recommendations
        if (intent.active === false) return;
        intent.tags.forEach(tag => {
          weights[tag] = (weights[tag] || 0) + intent.confidence * decay;
        });
      });
    });

    this.profile.tagWeights = weights;
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load intent profile:', e);
    }
    return this._createEmpty();
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch (e) {
      console.warn('Failed to save intent profile:', e);
    }
  }

  _createEmpty() {
    return {
      userId: 'user-' + Math.random().toString(36).slice(2, 10),
      sessions: [],
      tagWeights: {}
    };
  }
}
