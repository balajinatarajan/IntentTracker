// Shared "does the user have intent data?" predicate. Single source of truth
// for cold-start gating across every For You surface (chip on listing pages,
// FY page tabs, FY nav entry once it ships).
//
// Rule: a user has intent data iff their profile has at least one positive
// tagWeight. tagWeights are derived from session intents inside IntentStore,
// so this single check covers both the active session and accumulated history.
// Page-view-only sessions return false here — visiting a page without
// interacting with anything is not enough signal to personalize.
//
// Plain non-module script so it can be loaded via <script src> on listing
// pages that don't use ES modules. Exposes window.IntentTrackerExt.

(function () {
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

  window.IntentTrackerExt = window.IntentTrackerExt || {};
  window.IntentTrackerExt.hasIntentData = hasIntentData;
})();
