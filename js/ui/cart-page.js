import { destinations } from '../data/destinations.js';
import { asHotel, formatStayDates, nightsBetween } from '../data/hotel-utils.js';
import { BookingStore } from '../storage/booking-store.js';
import { updateCartIcon } from './cart-icon.js';
import { ICONS } from '../utils/icons.js';

const store = new BookingStore();
let timerInterval = null;

export function renderCartPage(container, { onResume, onRemove, onBrowse }) {
  if (!container) return;

  clearInterval(timerInterval);
  container.replaceChildren();

  const cart = store.getCart();
  const abandoned = store.getAbandoned();

  updateHeroSubtitle(cart, abandoned);

  if (cart) {
    container.appendChild(buildActiveCart(cart, onResume, onRemove));
  } else if (abandoned.length === 0) {
    container.appendChild(buildEmptyState(onBrowse));
  }

  if (abandoned.length > 0) {
    container.appendChild(buildAbandonedSection(abandoned, onResume, onRemove));
  }
}

function updateHeroSubtitle(cart, abandoned) {
  const el = document.getElementById('cart-hero-subtitle');
  if (!el) return;
  if (cart) {
    el.textContent = 'Your rate is held — complete checkout before it expires.';
  } else if (abandoned.length) {
    el.textContent = 'Pick up where you left off on an incomplete reservation.';
  } else {
    el.textContent = 'No reservations yet — explore our featured hotels.';
  }
}

function buildActiveCart(cart, onResume, onRemove) {
  const dest = destinations.find(d => d.id === cart.destinationId);
  const hotel = dest ? asHotel(dest) : null;
  if (!hotel) return document.createElement('div');

  const nights = nightsBetween(cart.checkIn, cart.checkOut);
  const nightly = cart.nightlyRate || dest.price;
  const subtotal = nightly * nights;
  const taxes = Math.round(subtotal * 0.12);
  const total = subtotal + taxes;

  const wrap = document.createElement('div');
  wrap.className = 'cart-page-card';

  const hold = document.createElement('div');
  hold.className = 'cart-hold-banner';
  hold.innerHTML = `<span class="cart-hold-pulse"></span>${ICONS.clock}<span class="cart-hold-text" id="cart-page-hold-timer"></span>`;
  updateHoldTimer(hold.querySelector('.cart-hold-text'));
  timerInterval = setInterval(() => updateHoldTimer(hold.querySelector('.cart-hold-text')), 1000);

  const item = document.createElement('article');
  item.className = 'cart-item';

  const visual = document.createElement('div');
  visual.className = 'cart-item-visual';
  const img = document.createElement('img');
  img.className = 'cart-item-image';
  img.src = dest.image;
  img.alt = hotel.hotelName;
  const overlay = document.createElement('div');
  overlay.className = 'cart-item-visual-overlay';
  overlay.innerHTML = `
    <span class="cart-item-visual-brand">${hotel.brand}</span>
    <span class="cart-item-visual-name">${hotel.hotelName}</span>
    <span class="cart-item-visual-location">${dest.name}</span>
  `;
  visual.appendChild(img);
  visual.appendChild(overlay);

  const details = document.createElement('div');
  details.className = 'cart-item-details';

  const meta = document.createElement('dl');
  meta.className = 'cart-item-meta-grid';
  meta.innerHTML = `
    <div class="cart-meta-chip"><dt>Check-in / out</dt><dd>${formatStayDates(cart.checkIn, cart.checkOut)}</dd></div>
    <div class="cart-meta-chip"><dt>Duration</dt><dd>${nights} night${nights > 1 ? 's' : ''}</dd></div>
    <div class="cart-meta-chip"><dt>Guests</dt><dd>${cart.guests || 2}</dd></div>
    <div class="cart-meta-chip"><dt>Room</dt><dd>${cart.roomName || 'Selected at checkout'}</dd></div>
  `;

  const pricing = document.createElement('div');
  pricing.className = 'cart-item-pricing';
  pricing.innerHTML = `
    <div class="cart-price-row"><span>${nights} night${nights > 1 ? 's' : ''} × $${nightly}</span><span>$${subtotal.toLocaleString()}</span></div>
    ${cart.rateName ? `<div class="cart-price-row cart-price-muted"><span>${cart.rateName}</span><span></span></div>` : ''}
    <div class="cart-price-row cart-price-muted"><span>Taxes & fees</span><span>$${taxes.toLocaleString()}</span></div>
    <div class="cart-price-row cart-price-total"><span>Total</span><strong>$${total.toLocaleString()}</strong></div>
  `;

  const actions = document.createElement('div');
  actions.className = 'cart-item-actions';

  const resumeBtn = document.createElement('button');
  resumeBtn.className = 'btn btn-primary';
  resumeBtn.innerHTML = `Complete Booking ${ICONS.arrowRight}`;
  resumeBtn.addEventListener('click', () => onResume?.(dest, cart));

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-secondary';
  removeBtn.innerHTML = `${ICONS.trash} Clear & Start Over`;
  removeBtn.addEventListener('click', () => {
    store.clearAllPending();
    updateCartIcon();
    onRemove?.();
  });

  actions.appendChild(resumeBtn);
  actions.appendChild(removeBtn);
  details.appendChild(meta);
  details.appendChild(pricing);
  details.appendChild(actions);

  item.appendChild(visual);
  item.appendChild(details);
  wrap.appendChild(hold);
  wrap.appendChild(item);
  return wrap;
}

function buildAbandonedSection(abandoned, onResume, onRemove) {
  const section = document.createElement('section');
  section.className = 'cart-page-abandoned';

  const heading = document.createElement('h2');
  heading.className = 'cart-section-title';
  heading.textContent = store.getCart() ? 'Incomplete Reservations' : 'Pick Up Where You Left Off';

  const list = document.createElement('div');
  list.className = 'cart-abandoned-list';

  const stepLabels = {
    dates: 'Dates selected',
    room: 'Room selected',
    guest: 'Guest info started',
    review: 'Ready to confirm',
    cart: 'In cart'
  };

  abandoned.forEach(entry => {
    const dest = destinations.find(d => d.id === entry.destinationId);
    if (!dest) return;
    const hotel = asHotel(dest);

    const card = document.createElement('article');
    card.className = 'cart-abandoned-item';

    const thumb = document.createElement('img');
    thumb.src = dest.image;
    thumb.alt = hotel.hotelName;

    const info = document.createElement('div');
    info.className = 'cart-abandoned-info';
    const name = document.createElement('h3');
    name.textContent = hotel.hotelName;
    const detail = document.createElement('p');
    detail.textContent = entry.checkIn
      ? formatStayDates(entry.checkIn, entry.checkOut)
      : dest.name;
    const step = document.createElement('span');
    step.className = 'cart-abandoned-step';
    step.textContent = stepLabels[entry.funnelStep] || 'In progress';

    const actions = document.createElement('div');
    actions.className = 'cart-abandoned-actions';

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn btn-secondary cart-abandoned-resume';
    resumeBtn.innerHTML = `${ICONS.rotateCcw} Resume`;
    resumeBtn.addEventListener('click', () => onResume?.(dest, entry));

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-secondary cart-abandoned-clear';
    clearBtn.innerHTML = `${ICONS.trash} Clear`;
    clearBtn.addEventListener('click', () => {
      store.clearAbandoned(entry.destinationId);
      updateCartIcon();
      onRemove?.();
    });

    actions.appendChild(resumeBtn);
    actions.appendChild(clearBtn);
    info.appendChild(name);
    info.appendChild(detail);
    info.appendChild(step);
    card.appendChild(thumb);
    card.appendChild(info);
    card.appendChild(actions);
    list.appendChild(card);
  });

  section.appendChild(heading);
  section.appendChild(list);
  return section;
}

function buildEmptyState(onBrowse) {
  const empty = document.createElement('div');
  empty.className = 'cart-empty';
  empty.innerHTML = `
    <div class="cart-empty-icon">${ICONS.hotel}</div>
    <h2>Your cart is empty</h2>
    <p>No reservations yet. Browse our collection of hotels and resorts to find your next stay.</p>
  `;
  const btn = document.createElement('a');
  btn.href = 'index.html';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Browse Hotels';
  btn.addEventListener('click', (e) => {
    if (onBrowse) { e.preventDefault(); onBrowse(); }
  });
  empty.appendChild(btn);
  return empty;
}

function updateHoldTimer(el) {
  if (!el) return;
  const remaining = store.getHoldRemainingMs();
  if (remaining <= 0) {
    el.textContent = 'Rate hold expired — reservation removed.';
    store.abandonCart('hold_expired');
    updateCartIcon();
    clearInterval(timerInterval);
    setTimeout(() => window.location.reload(), 1500);
    return;
  }
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  el.textContent = `Rate held ${mins}:${secs.toString().padStart(2, '0')} remaining — complete checkout to confirm.`;
}
