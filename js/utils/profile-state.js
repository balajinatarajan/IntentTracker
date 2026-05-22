// Shared "does the user have intent data?" predicate plus per-item click
// counting. Single source of truth for cold-start gating and personal
// ranking across every For You surface (chip on listing pages, FY page
// tabs, FY nav entry).
//
// Rule for hasIntentData: a user has intent data iff their profile has at
// least one positive tagWeight. tagWeights are derived from session intents
// inside IntentStore, so this single check covers both the active session
// and accumulated history.
//
// Per-item click counts are tracked here (not in the lib) because the
// lib's IntentStore only persists summarized intents + tagWeights — raw
// per-item interaction counts are not retained across sessions. The FY
// page uses these counts to bubble repeatedly-clicked items to the top of
// their tag tab.
//
// Plain non-module script so it can be loaded via <script src> on listing
// pages that don't use ES modules. Exposes window.IntentTrackerExt.

(function () {
  const ITEM_CLICKS_KEY = 'ik_item_clicks';

  function hasIntentData(tracker) {
    if (!tracker || typeof tracker.getProfile !== 'function') return false;
    const profile = tracker.getProfile();
    if (!profile) return false;
    const weights = profile.tagWeights || {};
    for (const k in weights) {
      if (weights[k] > 0) return true;
    }
    return false;
  }

  function getItemClickCounts() {
    try {
      const raw = localStorage.getItem(ITEM_CLICKS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getItemClickCount(itemId) {
    return getItemClickCounts()[itemId] || 0;
  }

  function bumpItemClick(itemId) {
    if (!itemId) return;
    const counts = getItemClickCounts();
    counts[itemId] = (counts[itemId] || 0) + 1;
    try {
      localStorage.setItem(ITEM_CLICKS_KEY, JSON.stringify(counts));
    } catch (e) { /* noop */ }
  }

  // Delegated listener: any click on a .destination-card increments that
  // item's counter. Coexists with the lib's own click tracker and any
  // page-level handlers (modal open, etc).
  function attachClickListener() {
    document.addEventListener('click', function (e) {
      const card = e.target.closest && e.target.closest('.destination-card');
      if (!card) return;
      const itemId = card.dataset.ikId || card.dataset.destinationId;
      if (itemId) bumpItemClick(itemId);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachClickListener);
  } else {
    attachClickListener();
  }

  window.IntentTrackerExt = window.IntentTrackerExt || {};
  window.IntentTrackerExt.hasIntentData = hasIntentData;
  window.IntentTrackerExt.getItemClickCount = getItemClickCount;
  window.IntentTrackerExt.getItemClickCounts = getItemClickCounts;
})();
