// For You Strip — renders cross-vertical recommendations inline on each vertical page
import { getAllManifestItems, VERTICAL_LABELS } from "../data/catalog-manifest.js";

const manifestById = new Map(getAllManifestItems().map(item => [item.id, item]));

export function shouldShowStrip(profile) {
  if (!profile || !profile.tagWeights) return false;
  return Object.values(profile.tagWeights).some(weight => weight >= 0.5);
}

export function renderForYouStrip(container, recs, options) {
  if (!container || !options) return;
  const currentGroup = options.currentGroup;

  if (!shouldShowStrip(options.profile)) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  if (!Array.isArray(recs) || recs.length === 0) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  const offGroup = recs.filter(rec => rec && rec.item && rec.item.group !== currentGroup);
  const enriched = offGroup
    .map(rec => ({ rec, manifest: manifestById.get(rec.itemId) }))
    .filter(entry => entry.manifest);
  const picks = enriched.slice(0, 4);

  if (picks.length === 0) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.innerHTML = buildStripHTML(picks);
  container.hidden = false;

  const tracker = options.tracker;
  const cardEls = container.querySelectorAll(".for-you-strip-card");
  cardEls.forEach(cardEl => {
    cardEl.addEventListener("click", () => {
      const id = cardEl.dataset.itemId;
      const manifestItem = manifestById.get(id);
      if (!manifestItem) return;
      if (tracker && typeof tracker.trackClick === "function") {
        try {
          tracker.trackClick(id);
        } catch (err) {
          // best-effort: never let telemetry block navigation
        }
      }
      window.location.href = manifestItem.url;
    });
  });
}

export function mountForYouStrip(container, tracker, options) {
  const currentGroup = options && options.currentGroup;
  const profile = tracker.getProfile();
  const recs = tracker.recommend(20);
  renderForYouStrip(container, recs, { currentGroup, profile, tracker });
  return function teardown() {
    // no-op: reserved for future SPA-style mounts
  };
}

function buildStripHTML(picks) {
  const header =
    '<div class="for-you-strip-header">' +
      '<h2 class="for-you-strip-title">For You</h2>' +
      '<p class="for-you-strip-subtitle">Picked from across Wanderlust based on your interests</p>' +
    "</div>";

  const cards = picks.map(entry => buildCardHTML(entry.rec, entry.manifest)).join("");
  const track = '<div class="for-you-strip-track">' + cards + "</div>";
  return header + track;
}

function buildCardHTML(rec, manifestItem) {
  const verticalKey = manifestItem.vertical;
  const verticalLabel = VERTICAL_LABELS[verticalKey] || verticalKey;
  const reason = buildReason(rec);
  const priceTier = manifestItem.priceTier || "";
  const priceLabel = priceTier ? priceTier.charAt(0).toUpperCase() + priceTier.slice(1) : "";

  return (
    '<article class="for-you-strip-card" data-item-id="' + escapeAttr(manifestItem.id) + '">' +
      '<div class="for-you-strip-card-image-wrapper">' +
        '<img class="for-you-strip-card-image" src="' + escapeAttr(manifestItem.image) + '" alt="' + escapeAttr(manifestItem.name) + '" loading="lazy">' +
        '<span class="for-you-strip-card-from-badge">From ' + escapeHTML(verticalLabel) + "</span>" +
      "</div>" +
      '<div class="for-you-strip-card-body">' +
        '<div class="for-you-strip-card-name">' + escapeHTML(manifestItem.name) + "</div>" +
        '<div class="for-you-strip-card-meta">' +
          (priceTier ? '<span class="price-badge ' + escapeAttr(priceTier) + '">' + escapeHTML(priceLabel) + "</span>" : "") +
        "</div>" +
        '<div class="for-you-strip-card-reason">' + escapeHTML(reason) + "</div>" +
      "</div>" +
    "</article>"
  );
}

function buildReason(rec) {
  const matched = rec && Array.isArray(rec.matchedTags) ? rec.matchedTags : [];
  if (matched.length > 0 && typeof matched[0] === "string" && matched[0].length > 0) {
    return "Because you like " + matched[0];
  }
  return "Recommended for you";
}

function escapeHTML(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}
