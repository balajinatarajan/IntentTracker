import { destinations } from '../data/destinations.js';
import { asHotel, formatStayDates } from '../data/hotel-utils.js';
import { BookingStore } from '../storage/booking-store.js';

const store = new BookingStore();
let onClearCallback = null;
let flyoutOpen = false;

export function initCartIcon({ onClear } = {}) {
  onClearCallback = onClear;
  wireCartNav();
  updateCartIcon();
}

export function updateCartIcon() {
  const badge = document.getElementById('cart-badge');
  const countEl = badge?.querySelector('.cart-badge-count');
  const toggle = document.getElementById('cart-nav-toggle');
  const flyout = document.getElementById('cart-flyout');
  const flyoutBody = document.getElementById('cart-flyout-body');
  const flyoutLabel = document.querySelector('.cart-flyout-label');
  const clearBtn = document.getElementById('cart-flyout-clear');
  if (!badge || !toggle) return;

  const cart = store.getCart();
  const abandoned = store.getAbandoned();
  const count = store.getPendingCount();
  const hasPending = count > 0;

  if (countEl) countEl.textContent = String(count);
  if (hasPending) {
    badge.removeAttribute('hidden');
  } else {
    badge.setAttribute('hidden', '');
  }

  toggle.classList.toggle('has-items', hasPending);
  toggle.setAttribute('aria-label', hasPending ? `Cart, ${count} pending` : 'Cart, empty');

  if (flyoutLabel) {
    flyoutLabel.textContent = cart ? 'In your cart' : abandoned.length ? 'Incomplete reservation' : 'In your cart';
  }

  if (clearBtn) {
    clearBtn.style.display = hasPending ? '' : 'none';
  }

  if (flyoutBody) {
    flyoutBody.replaceChildren();
    if (cart) {
      flyoutBody.appendChild(buildSummary(cart.destinationId, cart, 'Held — complete checkout soon'));
      flyout?.classList.remove('cart-flyout-empty');
    } else if (abandoned.length > 0) {
      abandoned.slice(0, 2).forEach(entry => {
        flyoutBody.appendChild(buildSummary(entry.destinationId, entry, 'Pick up where you left off'));
      });
      flyout?.classList.remove('cart-flyout-empty');
    } else {
      const empty = document.createElement('p');
      empty.className = 'cart-flyout-empty-text';
      empty.textContent = 'No reservations in your cart.';
      flyoutBody.appendChild(empty);
      flyout?.classList.add('cart-flyout-empty');
    }
  }

  if (!hasPending && flyoutOpen) closeFlyout();
}

function buildSummary(destinationId, data, statusText) {
  const dest = destinations.find(d => d.id === destinationId);
  const hotel = dest ? asHotel(dest) : null;
  const summary = document.createElement('div');
  summary.className = 'cart-flyout-summary';
  if (!hotel) return summary;

  const thumb = document.createElement('img');
  thumb.className = 'cart-flyout-thumb';
  thumb.src = dest.image;
  thumb.alt = hotel.hotelName;

  const info = document.createElement('div');
  info.className = 'cart-flyout-info';
  const name = document.createElement('strong');
  name.textContent = hotel.hotelName;
  const status = document.createElement('span');
  status.className = 'cart-flyout-status';
  status.textContent = statusText;
  info.appendChild(name);
  info.appendChild(status);
  if (data.checkIn && data.checkOut) {
    const dates = document.createElement('span');
    dates.textContent = formatStayDates(data.checkIn, data.checkOut);
    info.appendChild(dates);
  }
  if (data.roomName) {
    const room = document.createElement('span');
    room.className = 'cart-flyout-room';
    room.textContent = data.roomName;
    info.appendChild(room);
  }
  summary.appendChild(thumb);
  summary.appendChild(info);
  return summary;
}

function wireCartNav() {
  const toggle = document.getElementById('cart-nav-toggle');
  const clearBtn = document.getElementById('cart-flyout-clear');
  const wrap = document.getElementById('cart-nav-wrap');

  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (store.getPendingCount() > 0) {
      flyoutOpen ? closeFlyout() : openFlyout();
    } else {
      window.location.href = 'cart.html';
    }
  });

  clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllPending();
  });

  document.addEventListener('click', (e) => {
    if (flyoutOpen && wrap && !wrap.contains(e.target)) closeFlyout();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && flyoutOpen) closeFlyout();
  });

  window.addEventListener('resize', () => syncFlyoutPosition());
  window.addEventListener('scroll', () => syncFlyoutPosition(), { passive: true });
}

function openFlyout() {
  const flyout = document.getElementById('cart-flyout');
  const toggle = document.getElementById('cart-nav-toggle');
  if (!flyout) return;
  flyout.hidden = false;
  flyoutOpen = true;
  toggle?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    flyout.classList.add('open');
    syncFlyoutPosition();
  });
}

function closeFlyout() {
  const flyout = document.getElementById('cart-flyout');
  const toggle = document.getElementById('cart-nav-toggle');
  if (!flyout) return;
  flyout.classList.remove('open');
  flyoutOpen = false;
  toggle?.setAttribute('aria-expanded', 'false');
  resetFlyoutPosition(flyout);
  setTimeout(() => { if (!flyoutOpen) flyout.hidden = true; }, 200);
}

// Pin the flyout to the viewport on open so it never loses a z-index
// fight with .cart-page-content (negative margin overlap) or other
// page layers. Absolute positioning inside the hero header always
// eventually collides with main content on cart.html.
function syncFlyoutPosition() {
  const flyout = document.getElementById('cart-flyout');
  const toggle = document.getElementById('cart-nav-toggle');
  if (!flyout || !toggle || !flyoutOpen) return;
  const rect = toggle.getBoundingClientRect();
  flyout.style.position = 'fixed';
  flyout.style.top = `${Math.round(rect.bottom + 12)}px`;
  flyout.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
  flyout.style.left = 'auto';
  flyout.style.width = '320px';
  flyout.style.zIndex = '10000';
}

function resetFlyoutPosition(flyout) {
  flyout.style.position = '';
  flyout.style.top = '';
  flyout.style.right = '';
  flyout.style.left = '';
  flyout.style.width = '';
  flyout.style.zIndex = '';
}

function clearAllPending() {
  if (store.getPendingCount() === 0) return;
  store.clearAllPending();
  closeFlyout();
  updateCartIcon();
  onClearCallback?.();
  showClearToast();
}

function showClearToast() {
  document.querySelector('.cart-clear-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'cart-clear-toast';
  toast.textContent = 'Reservation cleared — start fresh anytime.';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

export { store as iconStore };
