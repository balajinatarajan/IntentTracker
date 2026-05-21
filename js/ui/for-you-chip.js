// For You navigation chip — pill that routes to /for-you.html when the user
// has intent data. Visibility is gated on the tracker's stored profile so the
// chip stays hidden for first-time anonymous visitors (per #31 cold-start).
// Auto-mounts on listing pages that include this script after the tracker
// initializes (i.e. after window.__intentTracker is assigned).

(function () {
  const TARGET_PAGE = '/for-you.html';
  const POLL_MS = 3000;
  const READY_MAX_MS = 5000;

  function hasIntentData(tracker) {
    const ext = window.IntentTrackerExt;
    if (ext && typeof ext.hasIntentData === 'function') return ext.hasIntentData(tracker);
    // Fallback if profile-state.js isn't loaded — keep behavior conservative
    if (!tracker || typeof tracker.getProfile !== 'function') return false;
    const profile = tracker.getProfile();
    const weights = profile && profile.tagWeights;
    if (!weights) return false;
    for (const k in weights) if (weights[k] > 0) return true;
    return false;
  }

  function injectStyles() {
    if (document.getElementById('for-you-chip-styles')) return;
    const style = document.createElement('style');
    style.id = 'for-you-chip-styles';
    style.textContent = `
      .for-you-chip-host {
        max-width: 1200px;
        margin: 1.5rem auto 0;
        padding: 0 2rem;
        display: flex;
        justify-content: flex-end;
      }
      .for-you-chip {
        display: none;
        align-items: center;
        gap: 0.35rem;
        padding: 0.5rem 1rem;
        border-radius: 999px;
        background: linear-gradient(135deg, #ff8d6b, #ff6b9a);
        color: #fff;
        font-family: 'DM Sans', sans-serif;
        font-size: 0.875rem;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(255, 141, 107, 0.3);
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.4s ease;
        opacity: 0;
      }
      .for-you-chip.visible {
        display: inline-flex;
        opacity: 1;
      }
      .for-you-chip:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 141, 107, 0.4);
      }
      .for-you-chip-sparkle {
        font-size: 0.75rem;
      }
    `;
    document.head.appendChild(style);
  }

  function createChip() {
    const chip = document.createElement('a');
    chip.className = 'for-you-chip';
    chip.href = TARGET_PAGE;
    chip.setAttribute('data-fy-chip', '');
    chip.innerHTML = 'For You <span class="for-you-chip-sparkle">✦</span>';
    return chip;
  }

  function pickHost() {
    // Prefer a slot inside <main>, fall back to inserting one after the hero
    const main = document.querySelector('main');
    if (!main) return null;
    const existing = document.querySelector('.for-you-chip-host');
    if (existing) return existing;
    const host = document.createElement('div');
    host.className = 'for-you-chip-host';
    main.insertBefore(host, main.firstChild);
    return host;
  }

  function mount(tracker) {
    injectStyles();
    const host = pickHost();
    if (!host) return;
    if (host.querySelector('[data-fy-chip]')) return; // already mounted
    const chip = createChip();
    host.appendChild(chip);

    function update() {
      chip.classList.toggle('visible', hasIntentData(tracker));
    }
    update();
    setInterval(update, POLL_MS);
  }

  function waitForTracker(cb) {
    if (window.__intentTracker) {
      cb(window.__intentTracker);
      return;
    }
    const startedAt = Date.now();
    const t = setInterval(() => {
      if (window.__intentTracker) {
        clearInterval(t);
        cb(window.__intentTracker);
      } else if (Date.now() - startedAt > READY_MAX_MS) {
        clearInterval(t);
      }
    }, 100);
  }

  function init() {
    waitForTracker(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
