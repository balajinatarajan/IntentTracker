// Captures raw interaction events: viewport views, hovers, clicks, searches, scroll
import { FEATURE_TOGGLES } from './feature-toggles.js';

const EVENT_BUFFER = [];
const FLUSH_INTERVAL_MS = 5000;
const VIEW_THRESHOLD = 0.5; // 50% of card must be visible
const MIN_DWELL_MS = 800; // Ignore very brief views
const MIN_HOVER_MS = 1000; // Ignore hovers shorter than 1 second (accidental mouse-overs)

export function initEventCollector(gridContainer, { onEvent, onFlush }) {
  const viewTimers = new Map(); // destinationId -> { start }
  const hoverTimers = new Map(); // destinationId -> { start }
  let flushTimer = null;

  // --- Intersection Observer for viewport tracking ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.dataset.destinationId;
      if (!id) return;

      if (entry.isIntersecting) {
        // Card entered viewport
        viewTimers.set(id, { start: Date.now() });
        entry.target.classList.add('in-view');
      } else {
        // Card left viewport
        entry.target.classList.remove('in-view');
        const timer = viewTimers.get(id);
        if (timer) {
          const dwellMs = Date.now() - timer.start;
          viewTimers.delete(id);

          if (dwellMs >= MIN_DWELL_MS && FEATURE_TOGGLES.enableViewTracking) {
            const event = {
              type: 'view',
              timestamp: Date.now(),
              destinationId: id,
              dwellMs,
              query: null,
              scrollVelocity: null
            };
            EVENT_BUFFER.push(event);
            onEvent(event);
          }
        }
      }
    });
  }, {
    root: null,
    threshold: VIEW_THRESHOLD
  });

  // --- Hover listener attachment ---
  function attachHoverListeners() {
    gridContainer.querySelectorAll('.destination-card').forEach(card => {
      const id = card.dataset.destinationId;
      if (!id) return;

      // Avoid duplicate listeners by marking the card
      if (card.__hoverAttached) return;
      card.__hoverAttached = true;

      card.addEventListener('mouseenter', () => {
        hoverTimers.set(id, { start: Date.now() });
      });

      card.addEventListener('mouseleave', () => {
        const timer = hoverTimers.get(id);
        if (timer) {
          const hoverMs = Date.now() - timer.start;
          hoverTimers.delete(id);

          if (hoverMs >= MIN_HOVER_MS) {
            const event = {
              type: 'hover',
              timestamp: Date.now(),
              destinationId: id,
              dwellMs: hoverMs,
              query: null,
              scrollVelocity: null
            };
            EVENT_BUFFER.push(event);
            onEvent(event);
          }
        }
      });
    });
  }

  // Observe all current cards and attach hover listeners
  function attachListeners() {
    gridContainer.querySelectorAll('.destination-card').forEach(card => {
      observer.observe(card);
    });
    attachHoverListeners();
  }

  attachListeners();

  // Allow re-attachment after grid re-renders
  window.__reattachObserver = () => {
    observer.disconnect();
    attachListeners();
  };

  // --- Periodic flush ---
  flushTimer = setInterval(() => {
    if (EVENT_BUFFER.length > 0) {
      onFlush([...EVENT_BUFFER]);
      // Keep buffer for session-end flush but mark as flushed
    }
  }, FLUSH_INTERVAL_MS);

  // --- Flush on page unload ---
  window.addEventListener('beforeunload', () => {
    // Flush any remaining view timers (only if view tracking is enabled)
    if (FEATURE_TOGGLES.enableViewTracking) {
      viewTimers.forEach((timer, id) => {
        const dwellMs = Date.now() - timer.start;
        if (dwellMs >= MIN_DWELL_MS) {
          EVENT_BUFFER.push({
            type: 'view',
            timestamp: Date.now(),
            destinationId: id,
            dwellMs,
            query: null,
            scrollVelocity: null
          });
        }
      });
    }

    if (EVENT_BUFFER.length > 0) {
      onFlush([...EVENT_BUFFER]);
    }
  });

  // --- Public API for explicit tracking ---
  return {
    trackClick(destinationId) {
      const event = {
        type: 'click',
        timestamp: Date.now(),
        destinationId,
        dwellMs: null,
        query: null,
        scrollVelocity: null
      };
      EVENT_BUFFER.push(event);
      onEvent(event);
    },

    trackSearch(query) {
      const event = {
        type: 'search',
        timestamp: Date.now(),
        destinationId: null,
        dwellMs: null,
        query,
        scrollVelocity: null
      };
      EVENT_BUFFER.push(event);
      onEvent(event);
    },

    getEvents() {
      return [...EVENT_BUFFER];
    },

    clearBuffer() {
      EVENT_BUFFER.length = 0;
    }
  };
}
