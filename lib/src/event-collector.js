// Auto-attaching event collector
// Tracks views (IntersectionObserver), hovers, clicks on [data-ik-id] elements

const VIEW_THRESHOLD = 0.5;
const MIN_DWELL_MS = 800;
const MIN_HOVER_MS = 1000;

export function createEventCollector({ catalog, flushInterval = 5000, trackViews = false, onEvent, onFlush }) {
  const eventBuffer = [];
  const viewTimers = new Map(); // itemId -> { start }
  const hoverTimers = new Map(); // itemId -> { start }
  const attachedElements = new WeakSet();
  let flushTimer = null;
  let destroyed = false;

  const observer = trackViews ? new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.__ikId;
      if (!id) return;

      if (entry.isIntersecting) {
        viewTimers.set(id, { start: Date.now() });
      } else {
        const timer = viewTimers.get(id);
        if (timer) {
          const dwellMs = Date.now() - timer.start;
          viewTimers.delete(id);

          if (dwellMs >= MIN_DWELL_MS) {
            pushEvent({ type: 'view', timestamp: Date.now(), itemId: id, dwellMs, query: null });
          }
        }
      }
    });
  }, { root: null, threshold: VIEW_THRESHOLD }) : null;

  function pushEvent(event) {
    eventBuffer.push(event);
    if (onEvent) onEvent(event);
  }

  function attachElement(el, itemId) {
    if (attachedElements.has(el)) return;
    attachedElements.add(el);
    el.__ikId = itemId;

    // Viewport observation (only when trackViews is enabled)
    if (observer) observer.observe(el);

    // Hover tracking
    el.addEventListener('mouseenter', () => {
      hoverTimers.set(itemId, { start: Date.now() });
    });
    el.addEventListener('mouseleave', () => {
      const timer = hoverTimers.get(itemId);
      if (timer) {
        const hoverMs = Date.now() - timer.start;
        hoverTimers.delete(itemId);
        if (hoverMs >= MIN_HOVER_MS) {
          pushEvent({ type: 'hover', timestamp: Date.now(), itemId, dwellMs: hoverMs, query: null });
        }
      }
    });

    // Click tracking
    el.addEventListener('click', () => {
      pushEvent({ type: 'click', timestamp: Date.now(), itemId, dwellMs: null, query: null });
    });
  }

  function observe(elements) {
    elements.forEach(el => {
      const item = catalog.getItem(el.__ikId || el.getAttribute(catalog.getSelector().slice(1, -1)));
      if (item) attachElement(el, item.id);
    });
  }

  function observeNew(items) {
    items.forEach(item => {
      if (item.element) attachElement(item.element, item.id);
    });
  }

  // Periodic flush — only fires when new events exist (prevents idle decay)
  let lastFlushedLength = 0;
  flushTimer = setInterval(() => {
    if (eventBuffer.length > lastFlushedLength && onFlush) {
      lastFlushedLength = eventBuffer.length;
      onFlush([...eventBuffer]);
    }
  }, flushInterval);

  // Flush on page unload
  function handleUnload() {
    // Flush remaining view timers
    viewTimers.forEach((timer, id) => {
      const dwellMs = Date.now() - timer.start;
      if (dwellMs >= MIN_DWELL_MS) {
        eventBuffer.push({ type: 'view', timestamp: Date.now(), itemId: id, dwellMs, query: null });
      }
    });
    if (eventBuffer.length > 0 && onFlush) {
      onFlush([...eventBuffer]);
    }
  }
  window.addEventListener('beforeunload', handleUnload);

  return {
    observe,
    observeNew,

    trackClick(itemId) {
      pushEvent({ type: 'click', timestamp: Date.now(), itemId, dwellMs: null, query: null });
    },

    trackSearch(query) {
      pushEvent({ type: 'search', timestamp: Date.now(), itemId: null, dwellMs: null, query });
    },

    trackTabView(tabId, tags = []) {
      pushEvent({ type: 'tab_view', timestamp: Date.now(), itemId: null, dwellMs: null, query: null, tabId, tags });
    },

    trackPageView(pageMeta) {
      pushEvent({ type: 'page_view', timestamp: Date.now(), itemId: null, dwellMs: null, query: null, pageMeta });
    },

    getEvents() {
      return [...eventBuffer];
    },

    clearBuffer() {
      eventBuffer.length = 0;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(flushTimer);
      if (observer) observer.disconnect();
      window.removeEventListener('beforeunload', handleUnload);
    }
  };
}
