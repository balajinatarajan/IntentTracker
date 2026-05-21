// Journey pill: mounts a single themed pill into the .site-nav, just before the
// #signin-mount slot (so it sits next to the sign-in control instead of inside
// .nav-links). Falls back to appending to .site-nav if the slot is missing.
import { isSignedIn } from "../auth/auth-state.js";
import {
  THEMES,
  PILL_THEME_LOOKUP,
  PILL_TAG_BLACKLIST,
  PAGE_GROUP_TO_THEMES,
} from "./for-you-themes.js";

/**
 * Mounts a journey pill adjacent to the #signin-mount slot in the page nav.
 * Returns a teardown function, or null if the pill is hidden (no profile signal).
 *
 * @param {{ currentGroup: string }} opts
 * @returns {(() => void) | null}
 */
export function mountJourneyPill({ currentGroup }) {
  // 1. Guest? No pill.
  if (!isSignedIn()) return null;

  // 2. Read profile from localStorage (the contract — not tracker.getProfile()).
  let profile = null;
  try {
    profile = JSON.parse(localStorage.getItem("ik_profile") || "null");
  } catch (_err) {
    return null;
  }
  if (!profile) return null;

  const tagWeights = profile.tagWeights;
  if (!tagWeights || typeof tagWeights !== "object") return null;
  const weightKeys = Object.keys(tagWeights);
  if (weightKeys.length === 0) return null;

  // 3. Threshold gate: max weight must be >= 0.5 (aligned with F2 strip).
  const maxWeight = Math.max(...Object.values(tagWeights));
  if (!(maxWeight >= 0.5)) return null;

  // 4. Build sorted candidates with deterministic tie-break: weight desc, then localeCompare asc.
  const excluded = new Set(PAGE_GROUP_TO_THEMES[currentGroup] || []);
  const candidates = Object.entries(tagWeights)
    .filter(([t]) => !PILL_TAG_BLACKLIST.has(t))
    .filter(([t]) => !!PILL_THEME_LOOKUP[t])
    .filter(([t]) => !excluded.has(PILL_THEME_LOOKUP[t]))
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));

  if (candidates.length === 0) return null;

  // 5. Hysteresis: prefer the previously-shown tag if it's still a valid candidate
  //    AND the new top tag doesn't beat it by ≥ HYSTERESIS_MARGIN. Per-page-group
  //    state so each surface has its own stable theme.
  const HYSTERESIS_MARGIN = 1.20;  // new must be ≥ 1.20× old to flip
  const HYSTERESIS_KEY = `ik_pill_tag_${currentGroup}`;
  const [newTopTag, newTopWeight] = candidates[0];
  let resolvedTag = newTopTag;
  try {
    const prevTag = localStorage.getItem(HYSTERESIS_KEY);
    if (prevTag && prevTag !== newTopTag) {
      const prevEntry = candidates.find(([t]) => t === prevTag);
      if (prevEntry) {
        const prevWeight = prevEntry[1];
        if (newTopWeight < prevWeight * HYSTERESIS_MARGIN) {
          resolvedTag = prevTag;
        }
      }
    }
  } catch (_err) { /* localStorage unavailable — fall back to newTopTag */ }
  try { localStorage.setItem(HYSTERESIS_KEY, resolvedTag); } catch (_err) {}

  // 6. Map tag -> theme id (guaranteed defined by step 4 filter).
  const themeId = PILL_THEME_LOOKUP[resolvedTag];

  // 7. Look up label.
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) return null;
  const themeLabel = theme.label;

  // 8. Render and insert before #signin-mount in the page nav.
  const pill = document.createElement("a");
  pill.className = "journey-pill";
  pill.href = `for-you.html?tab=${themeId}`;
  pill.setAttribute(
    "aria-label",
    `${themeLabel} picks personalized for you`
  );
  pill.textContent = `${themeLabel} picks for you →`;

  const signinSlot = document.getElementById("signin-mount");
  if (signinSlot && signinSlot.parentNode) {
    signinSlot.parentNode.insertBefore(pill, signinSlot);
  } else {
    const navEl = document.querySelector(".site-nav");
    if (navEl) navEl.appendChild(pill);
    else return null;
  }

  // 9. Teardown.
  return () => pill.remove();
}
