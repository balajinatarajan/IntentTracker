// For You nav chip — appends an "For You ✦" link into the site nav once the
// user has built up intent signal. Hidden for first-time anonymous visitors
// (cold-start). No-op on pages that already render a .for-you-nav-link
// (e.g. for-you.html, where the link is the active page indicator).

(function () {
  const TARGET_PAGE = 'for-you.html';
  const POLL_MS = 3000;
  const READY_MAX_MS = 5000;

  function hasIntentData(tracker) {
    const ext = window.IntentTrackerExt;
    if (ext && typeof ext.hasIntentData === 'function') return ext.hasIntentData(tracker);
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
      .for-you-nav-link {
        display: none;
        align-items: center;
        gap: 0.35rem;
        padding: 0.4rem 0.9rem;
        margin-left: 0.25rem;
        border-radius: 999px;
        background: linear-gradient(135deg, #ff8d6b, #ff6b9a);
        color: #fff !important;
        font-family: 'DM Sans', sans-serif;
        font-weight: 500;
        text-decoration: none;
        box-shadow: 0 2px 8px rgba(255, 141, 107, 0.3);
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.3s ease;
        opacity: 0;
      }
      .for-you-nav-link.visible {
        display: inline-flex;
        opacity: 1;
      }
      .for-you-nav-link:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 141, 107, 0.4);
      }
    `;
    document.head.appendChild(style);
  }

  function mount(tracker) {
    const navLinks = document.querySelector('.site-nav .nav-links');
    if (!navLinks) return;
    if (navLinks.querySelector('.for-you-nav-link')) return;

    injectStyles();
    const chip = document.createElement('a');
    chip.className = 'for-you-nav-link';
    chip.href = TARGET_PAGE;
    chip.setAttribute('data-fy-chip', '');
    chip.innerHTML = 'For You <span aria-hidden="true">✦</span>';
    navLinks.appendChild(chip);

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
