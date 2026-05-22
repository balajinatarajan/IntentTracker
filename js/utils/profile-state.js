// Shared "does the user have intent data?", per-item click counting, and
// click-derived tag weighting. Single source of truth for cold-start gating
// and personal ranking across every For You surface (chip on listing pages,
// FY page tabs, FY nav entry, homepage For You ✦ tab).
//
// Why click-derived tag weights live here (not in the lib): the lib's
// IntentSummarizer only emits a tag_affinity intent when one tag dominates
// (topTagCount / totalTagCount >= 0.35). Clicking a single card with many
// tags produces a flat distribution that fails the threshold — no intent,
// no tagWeights, no ranking signal. We work around it by mirroring the
// per-item click counts into a tag-weighted map: each click on an item
// contributes 1.0 per tag. The scorer merges this with the lib's
// profile.tagWeights so both signals add up.
//
// Plain non-module script so it can be loaded via <script src> on listing
// pages that don't use ES modules. Exposes window.IntentTrackerExt.

(function () {
  const ITEM_CLICKS_KEY = 'ik_item_clicks';
  const ITEM_TAGS_KEY = 'ik_item_tags'; // itemId -> string[] of tags

  function hasIntentData(tracker) {
    if (tracker && typeof tracker.getProfile === 'function') {
      const profile = tracker.getProfile();
      const weights = profile && profile.tagWeights;
      if (weights) {
        for (const k in weights) {
          if (weights[k] > 0) return true;
        }
      }
    }
    // Lib didn't surface any tagWeights, but the click recorder may have.
    // Treat any recorded click as intent data so the FY surfaces appear
    // even when the lib's thresholds haven't fired.
    const clicks = getItemClickCounts();
    return Object.keys(clicks).length > 0;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
  }

  function getItemClickCounts() { return readJson(ITEM_CLICKS_KEY); }
  function getItemClickCount(itemId) { return getItemClickCounts()[itemId] || 0; }
  function getItemTagMap() { return readJson(ITEM_TAGS_KEY); }

  function bumpItemClick(itemId, tags) {
    if (!itemId) return;
    const counts = getItemClickCounts();
    counts[itemId] = (counts[itemId] || 0) + 1;
    writeJson(ITEM_CLICKS_KEY, counts);

    if (tags && tags.length > 0) {
      const tagMap = getItemTagMap();
      tagMap[itemId] = tags;
      writeJson(ITEM_TAGS_KEY, tagMap);
    }
  }

  // Sum click_count across every clicked item's tags. Each click contributes
  // 1.0 to each of the item's tags. Returns { tag: weight }.
  function getClickDerivedTagWeights() {
    const clicks = getItemClickCounts();
    const tagMap = getItemTagMap();
    const weights = {};
    for (const itemId in clicks) {
      const count = clicks[itemId];
      const tags = tagMap[itemId] || [];
      for (const tag of tags) {
        weights[tag] = (weights[tag] || 0) + count;
      }
    }
    return weights;
  }

  // Merge lib-generated profile.tagWeights with click-derived weights.
  // Both signals add — the lib's intent system contributes when it fires,
  // click-derived weights ensure single-item heavy clicking still ranks.
  function getMergedTagWeights(tracker) {
    const profileWeights = (tracker && tracker.getProfile && tracker.getProfile()?.tagWeights) || {};
    const clickWeights = getClickDerivedTagWeights();
    const merged = { ...profileWeights };
    for (const tag in clickWeights) {
      merged[tag] = (merged[tag] || 0) + clickWeights[tag];
    }
    return merged;
  }

  // Delegated listener: any click on a .destination-card increments that
  // item's counter AND records the item's tags (read from data-ik-tags so
  // we can derive tag weights without re-scanning the DOM later).
  function attachClickListener() {
    document.addEventListener('click', function (e) {
      const card = e.target.closest && e.target.closest('.destination-card');
      if (!card) return;
      const itemId = card.dataset.ikId || card.dataset.destinationId;
      if (!itemId) return;
      const tagsStr = card.dataset.ikTags || '';
      const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      bumpItemClick(itemId, tags);
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
  window.IntentTrackerExt.getItemTagMap = getItemTagMap;
  window.IntentTrackerExt.getClickDerivedTagWeights = getClickDerivedTagWeights;
  window.IntentTrackerExt.getMergedTagWeights = getMergedTagWeights;
})();
