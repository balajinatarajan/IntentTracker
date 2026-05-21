// Bookmarklet entry point — self-executing script
// Loads reference data from localStorage (saved by the Site Scanner) or uses inline defaults

import { create } from '../src/index.js';

// Try to load reference from localStorage (saved by scanner UI's "Copy JSON" or manual paste)
let REFERENCE = { items: {} };
try {
  const stored = localStorage.getItem('__signal_tracker_reference');
  if (stored) {
    REFERENCE = JSON.parse(stored);
    console.log('[SignalTracker] Loaded reference from localStorage:', Object.keys(REFERENCE.items).length, 'items');
  }
} catch (e) {
  console.warn('[SignalTracker] Failed to parse stored reference:', e.message);
}

// If no stored reference, prompt user
if (Object.keys(REFERENCE.items).length === 0) {
  const json = prompt(
    'SignalTracker: No reference file found.\n\n' +
    'Paste a reference JSON (from the Site Scanner), or cancel to use an empty config.\n\n' +
    'Tip: Use the Site Scanner at http://localhost:8082 to generate one.'
  );
  if (json) {
    try {
      REFERENCE = JSON.parse(json);
      localStorage.setItem('__signal_tracker_reference', json);
      console.log('[SignalTracker] Reference saved:', Object.keys(REFERENCE.items).length, 'items');
    } catch (e) {
      console.error('[SignalTracker] Invalid JSON:', e.message);
    }
  }
}

// Guard against double-injection
if (!window.__legacyIntentTracker) {
  window.__legacyIntentTracker = create({
    reference: REFERENCE,
    root: document.body,
    debug: true,
    trackViews: true,
  });
  console.log('[SignalTracker] Bookmarklet injected — tracking', Object.keys(REFERENCE.items).length, 'elements');
} else {
  console.log('[SignalTracker] Already active on this page');
}
