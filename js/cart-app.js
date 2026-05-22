import { initCartIcon, updateCartIcon } from './ui/cart-icon.js';
import { renderCartPage } from './ui/cart-page.js';
import { initBookingFlow, resumeAbandonedBooking, bookingStore } from './ui/booking-flow.js';
import { initCartBar, updateCartBar } from './ui/cart-bar.js';

const container = document.getElementById('cart-page-content');

function refresh() {
  renderCartPage(container, {
    onResume: (dest, data) => resumeAbandonedBooking(dest, data),
    onRemove: () => { updateCartBar(); refresh(); },
    onBrowse: () => { window.location.href = 'index.html'; }
  });
  updateCartIcon();
  updateCartBar();
}

initCartIcon({ onClear: refresh });

initBookingFlow({
  onEvent: () => {},
  onCartChange: () => { refresh(); },
  onComplete: () => { window.location.href = 'index.html'; },
  onAbandon: () => { refresh(); }
});

initCartBar({
  onResume: (dest, cart) => resumeAbandonedBooking(dest, cart),
  onClear: () => refresh()
});

refresh();
