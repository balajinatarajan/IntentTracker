// Profile store with cross-session temporal decay
// Adapted from Wanderlust's intent-store.js

export class IntentStore {
  constructor(storageKey = 'ik_profile') {
    this.storageKey = storageKey;
    this.profile = this._load();
  }

  saveSessionIntents(sessionId, intents) {
    let session = this.profile.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      session = { sessionId, startedAt: Date.now(), intents: [] };
      this.profile.sessions.push(session);
    }

    const activeKeys = new Set(
      intents.map(i => i.category + ':' + i.tags.slice().sort().join(','))
    );

    // Gradual decay: reduce confidence by 20% each flush cycle for intents not re-detected
    session.intents.forEach(existing => {
      const key = existing.category + ':' + existing.tags.slice().sort().join(',');
      if (!activeKeys.has(key)) {
        existing.confidence = (existing.confidence || 0) * 0.8;
        if (existing.confidence < 0.05) existing.active = false;
      }
    });

    // Merge new intents
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

    this._computeTagWeights();
    this._save();
  }

  getProfile() {
    return this.profile;
  }

  clearAll() {
    this.profile = this._createEmpty();
    try { localStorage.removeItem(this.storageKey); } catch (e) { /* noop */ }
  }

  _computeTagWeights() {
    const weights = {};
    const sessionCount = this.profile.sessions.length;

    this.profile.sessions.forEach((session, index) => {
      const sessionsAgo = sessionCount - 1 - index;
      const decay = Math.pow(0.8, sessionsAgo);

      session.intents.forEach(intent => {
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
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* noop */ }
    return this._createEmpty();
  }

  _save() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.profile)); } catch (e) { /* noop */ }
  }

  _createEmpty() {
    return {
      userId: 'user-' + Math.random().toString(36).slice(2, 10),
      sessions: [],
      tagWeights: {},
    };
  }
}
