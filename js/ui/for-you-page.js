// For You page bootstrap + theme taxonomy (Feature 3, Streams D + E folded).
//
// Exports the theme constants consumed by `journey-pill.js` (Stream B),
// and auto-runs an IIFE that paints the themed-tab UI on `for-you.html`.
//
// On vertical pages, this module is transitively imported by `journey-pill.js`
// solely for the THEMES / PILL_* / PAGE_GROUP_TO_THEMES constants. The bootstrap
// IIFE early-returns there (no #tab-bar / #destination-grid elements).
//
// See working/plans/for-you-page.md §5.1 (theme taxonomy), §5.3 (Plan B renderer),
// §5.4 (slice), §5.5 (inline scorer — note the deliberate deviations from
// RecommendationEngine.recommend: NO score<=0 drop, NO maxPerGroup cap),
// §5.6 (tie-break), §5.9 (bootstrap shape).

import { catalogManifest } from "../data/catalog-manifest.js";

// ─── Theme taxonomy (§5.1) ────────────────────────────────────────────────────

export const THEMES = [
  { id: "beaches",   label: "Beaches",   tags: ["beach", "tropical", "caribbean"] },
  { id: "romantic",  label: "Romantic",  tags: ["romantic", "couples", "adults-only", "honeymoon"] },
  { id: "urban",     label: "Urban",     tags: ["urban", "city", "downtown", "nightlife"] },
  { id: "adventure", label: "Adventure", tags: ["adventure", "nature", "wildlife", "ski", "mountain"] },
  { id: "budget",    label: "Budget",    tags: ["budget", "casual", "street-food"] },
  { id: "luxury",    label: "Luxury",    tags: ["luxury", "fine-dining", "spa", "boutique", "overwater"] },
];

export const PILL_THEME_LOOKUP = {
  beach:         "beaches",
  tropical:      "beaches",
  caribbean:     "beaches",
  romantic:      "romantic",
  couples:       "romantic",
  "adults-only": "romantic",
  honeymoon:     "romantic",
  urban:         "urban",
  city:          "urban",
  downtown:      "urban",
  nightlife:     "urban",
  adventure:     "adventure",
  nature:        "adventure",
  wildlife:      "adventure",
  ski:           "adventure",
  mountain:      "adventure",
  budget:        "budget",
  casual:        "budget",
  "street-food": "budget",
  luxury:        "luxury",
  "fine-dining": "luxury",
  spa:           "luxury",
  boutique:      "luxury",
  overwater:     "luxury",
};

// Region/group tags that should NOT count for "top tag" computation.
// NOTE: `caribbean` intentionally appears here AND in THEMES.beaches.tags — the two
// uses are independent. Slicing uses THEMES.beaches.tags raw; the pill's top-tag
// selection filters against this blacklist. Do not "fix" the apparent duplication.
export const PILL_TAG_BLACKLIST = new Set([
  "southeast-asia", "europe", "east-asia", "south-asia", "north-america",
  "central-america", "south-america", "africa", "middle-east", "caribbean",
  "all-inclusive",
]);

export const PAGE_GROUP_TO_THEMES = {
  hotels:          ["urban"],
  "all-inclusive": ["beaches"],
  resorts:         ["luxury"],
  dining:          ["luxury"],
};

const THEME_IDS = new Set(THEMES.map(t => t.id));

// ─── HTML escape (defensive against catalog values containing markup) ─────────

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titlecase(value) {
  if (!value) return "";
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ─── Profile / URL helpers ────────────────────────────────────────────────────

function readProfile() {
  try {
    return JSON.parse(localStorage.getItem("ik_profile") || "null");
  } catch {
    return null;
  }
}

function readTabFromUrl() {
  try {
    const raw = new URLSearchParams(location.search).get("tab");
    if (raw && THEME_IDS.has(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

// ─── Reason header (Stream D, §5.6 tie-break) ─────────────────────────────────

function renderReasonHeader(tagWeights) {
  const el = document.getElementById("for-you-reason");
  if (!el) return;
  const top = Object.entries(tagWeights || {})
    .filter(([t]) => !PILL_TAG_BLACKLIST.has(t))
    .filter(([t]) => !t.startsWith("price:"))
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([t]) => t);
  if (top.length === 0) {
    el.textContent = "Explore picks by theme.";
    return;
  }
  el.textContent = `Based on your recent browsing — ${top.join(", ")}.`;
}

// ─── Empty placeholder ────────────────────────────────────────────────────────

function renderEmptyPlaceholder(theme) {
  const div = document.createElement("div");
  div.className = "tab-empty-placeholder";
  div.textContent = `Coming soon — we don't have enough ${theme.label} picks yet.`;
  return div;
}

// ─── Click handler ────────────────────────────────────────────────────────────

function navigateToItem(item) {
  window.location.href = (item && item.url) || "#";
}

// ─── Theme slice (§5.4) ───────────────────────────────────────────────────────

function sliceForTheme(manifest, theme) {
  const tagSet = new Set(theme.tags);
  return manifest.filter(item =>
    Array.isArray(item.tags) && item.tags.some(t => tagSet.has(t))
  );
}

// ─── Inline scorer (§5.5) ─────────────────────────────────────────────────────
// Mirrors RecommendationEngine.recommend (lib/dist/intent-tracker.js:544-589)
// with two deliberate deviations documented in §5.5:
//   1. NO `score <= 0` drop — theme tab is the thematic filter; we keep items.
//   2. NO `maxPerGroup` cap — the theme IS the diversity axis.

function scoreItems(items, tagWeights, { maxResults = 12 } = {}) {
  if (!tagWeights || Object.keys(tagWeights).length === 0) {
    return items.slice(0, maxResults).map(item => ({ item, reason: null }));
  }
  const scored = items.map(item => {
    let score = 0;
    const matched = [];
    (item.tags || []).forEach(t => {
      if (tagWeights[t]) {
        score += tagWeights[t];
        matched.push({ tag: t, weight: tagWeights[t] });
      }
    });
    if (item.tags && item.tags.length > 0) {
      score = score / Math.sqrt(item.tags.length);
    }
    matched.sort((a, b) => b.weight - a.weight);
    return { item, score, matched };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(e => ({
    item: e.item,
    reason: e.matched[0] ? `Based on your interest in ${e.matched[0].tag}` : null,
  }));
}

// ─── Themed-tab renderer (§5.3, Plan B — internal; NOT exported) ──────────────

function buildCardElement(item) {
  const card = document.createElement("article");
  card.className = "destination-card";
  card.dataset.destinationId = item.id || "";

  const regionLabel = titlecase(item.group || item.vertical || "");
  const priceTier = item.priceTier || "mid-range";
  const priceLabel = priceTier.replace("-", " ");
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const descText = tags.slice(0, 3).join(", ");

  const reasonHtml = item.reason
    ? `<p class="card-reason">${escapeHtml(item.reason)}</p>`
    : "";

  card.innerHTML = `
    <div class="card-image-wrapper">
      <img class="card-image" src="${escapeHtml(item.image || "")}" alt="${escapeHtml(item.name || "")}" loading="lazy">
      <span class="card-image-price">${escapeHtml(titlecase(priceTier))}</span>
      <div class="card-image-overlay">
        <div class="card-overlay-name">${escapeHtml(item.name || "")}</div>
        <div class="card-overlay-region">${escapeHtml(regionLabel)}</div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="region-tag">${escapeHtml(regionLabel)}</span>
        <span class="price-badge ${escapeHtml(priceTier)}">${escapeHtml(priceLabel)}</span>
      </div>
      <p class="card-desc">${escapeHtml(descText)}</p>
      <div class="card-tags">
        ${tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join("")}
      </div>
      ${reasonHtml}
    </div>
  `;

  return card;
}

function renderThemedTabs(tabBarEl, gridEl, tabs, opts) {
  const options = opts || {};
  const onCardClick = typeof options.onCardClick === "function" ? options.onCardClick : () => {};
  const emptyTabRenderer = typeof options.emptyTabRenderer === "function"
    ? options.emptyTabRenderer
    : () => document.createElement("div");

  let activeTabId = options.initialTabId && tabs.some(t => t.id === options.initialTabId)
    ? options.initialTabId
    : (tabs[0] && tabs[0].id);

  function paintTabBar() {
    tabBarEl.innerHTML = tabs.map(t => {
      const activeClass = t.id === activeTabId ? " active" : "";
      return `<button type="button" class="tab-pill${activeClass}" data-tab-id="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`;
    }).join("");
  }

  function paintGrid() {
    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    gridEl.innerHTML = "";
    if (!activeTab) return;

    if (!activeTab.items || activeTab.items.length < 2) {
      gridEl.appendChild(emptyTabRenderer(activeTab));
      return;
    }

    activeTab.items.forEach(item => {
      const card = buildCardElement(item);
      card.addEventListener("click", () => onCardClick(item));
      gridEl.appendChild(card);
    });
  }

  tabBarEl.addEventListener("click", e => {
    const pill = e.target.closest && e.target.closest(".tab-pill");
    if (!pill || !tabBarEl.contains(pill)) return;
    const nextId = pill.dataset.tabId;
    if (!nextId || nextId === activeTabId) return;
    if (!tabs.some(t => t.id === nextId)) return;
    activeTabId = nextId;
    paintTabBar();
    paintGrid();
  });

  paintTabBar();
  paintGrid();
}

// ─── Bootstrap IIFE (§5.9) ────────────────────────────────────────────────────

(function bootstrapForYouPage() {
  const tabBarEl = document.getElementById("tab-bar");
  const gridEl   = document.getElementById("destination-grid");
  if (!tabBarEl || !gridEl) return; // not on for-you.html — safe no-op for vertical pages

  // Defensive: catch future drift in F2's manifest shape.
  if (Array.isArray(catalogManifest) && catalogManifest[0] && catalogManifest[0].tags === undefined) {
    console.warn("[for-you-page] catalogManifest[0].tags is undefined — manifest shape may have drifted; theme slicing will return empty.");
  }

  const profile = readProfile();
  const tagWeights = (profile && profile.tagWeights) || {};

  const tabs = THEMES.map(theme => {
    const slice = sliceForTheme(catalogManifest, theme);
    const scored = scoreItems(slice, tagWeights, { maxResults: 12 });
    return {
      id: theme.id,
      label: theme.label,
      items: scored.map(({ item, reason }) => ({ ...item, reason })),
    };
  });

  renderReasonHeader(tagWeights);

  renderThemedTabs(tabBarEl, gridEl, tabs, {
    initialTabId: readTabFromUrl() || THEMES[0].id,
    onCardClick: navigateToItem,
    emptyTabRenderer: renderEmptyPlaceholder,
  });
})();
