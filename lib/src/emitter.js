// Batched emitter — flushes signals + profile snapshots to a backend via
// navigator.sendBeacon (with fetch keepalive fallback). All payloads carry
// the IntentTracker userId (GUID) so the server can aggregate across users.
//
// Payload shape:
//   {
//     userId:    'user-xxxxxxxx',
//     sessionId: 'session-...',
//     pageUrl:   '/hotels.html',
//     ts:        1716200000000,
//     signals:   [ { type, itemId, timestamp, dwellMs, query }, ... ],
//     profile:   { userId, sessions, tagWeights } | null
//   }

export function createEmitter({ url, batchMs = 3000, getUserId, getSessionId }) {
  if (!url) throw new Error('emitter: url is required');

  let signalQueue = [];
  let pendingProfile = null;
  let timer = null;
  let lastSignalCount = 0; // event-collector flushes the full buffer; dedupe here

  function schedule() {
    if (timer) return;
    timer = setTimeout(flush, batchMs);
  }

  function send(body) {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch (_) { /* fall through */ }
    // Fallback
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (_) { /* swallow */ }
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (signalQueue.length === 0 && !pendingProfile) return;

    const payload = {
      userId: getUserId(),
      sessionId: getSessionId(),
      pageUrl: typeof location !== 'undefined' ? location.pathname : null,
      ts: Date.now(),
      signals: signalQueue,
      profile: pendingProfile,
    };
    signalQueue = [];
    pendingProfile = null;

    send(JSON.stringify(payload));
  }

  function queueSignal(ev) {
    signalQueue.push(ev);
    schedule();
  }

  // event-collector calls onFlush with the *cumulative* buffer; only queue the
  // delta to avoid double-sending the same events.
  function queueFlushDelta(allEvents) {
    if (allEvents.length <= lastSignalCount) return;
    for (let i = lastSignalCount; i < allEvents.length; i++) {
      signalQueue.push(allEvents[i]);
    }
    lastSignalCount = allEvents.length;
    schedule();
  }

  function queueProfile(profile) {
    pendingProfile = profile;
    schedule();
  }

  // Best-effort flush on page hide / unload
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return { queueSignal, queueFlushDelta, queueProfile, flush };
}
