import { initCartIcon, updateCartIcon } from './ui/cart-icon.js?v=2';
import { renderCartPage } from './ui/cart-page.js';
import { initBookingFlow, resumeAbandonedBooking, bookingStore } from './ui/booking-flow.js';
import { initCartBar, updateCartBar } from './ui/cart-bar.js';

const container = document.getElementById('cart-page-content');

// Demo default: if there's no active cart but there ARE abandoned
// bookings, promote the furthest-along one into the active slot so
// /cart.html opens with the hero card + rate-held timer instead of
// the sparse "Pick Up Where You Left Off" list-only view.
function ensureActiveCartFromAbandoned() {
  if (bookingStore.getCart()) return;
  const primary = bookingStore.getPrimaryAbandonment();
  if (!primary) return;
  bookingStore.clearAbandoned(primary.destinationId);
  bookingStore.setCart({ ...primary });
}

function refresh() {
  renderCartPage(container, {
    onResume: handleResume,
    onRemove: () => { updateCartBar(); refresh(); },
    onBrowse: () => { window.location.href = 'index.html'; }
  });
  updateCartIcon();
  updateCartBar();
}

// Resume always rehydrates the chosen booking into the active cart slot
// (hero card + timer) then opens the booking stepper on top. The dimmed
// page underneath IS the cart page updating — not a second mystery view.
function handleResume(dest, data) {
  if (data?.destinationId) {
    const active = bookingStore.getCart();
    if (!active || active.destinationId !== data.destinationId) {
      bookingStore.clearAbandoned(data.destinationId);
      bookingStore.setCart({ ...data });
      refresh();
    }
  }
  resumeAbandonedBooking(dest, data);
}

initCartIcon({ onClear: refresh });

initBookingFlow({
  onEvent: () => {},
  onCartChange: () => { refresh(); },
  onComplete: () => { window.location.href = 'index.html'; },
  onAbandon: () => { refresh(); }
});

initCartBar({
  onResume: (dest, cart) => handleResume(dest, cart),
  onClear: () => refresh()
});

ensureActiveCartFromAbandoned();
refresh();
