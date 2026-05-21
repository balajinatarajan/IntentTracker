import { asHotel, formatStayDates } from '../data/hotel-utils.js';
import { destinations } from '../data/destinations.js';
import { BookingStore } from '../storage/booking-store.js';
import { updateCartIcon } from './cart-icon.js';

let barEl = null;
let timerInterval = null;
let callbacks = {};
const store = new BookingStore();

export function initCartBar({ onResume, onClear }) {
  barEl = document.getElementById('cart-bar');
  callbacks = { onResume, onClear };
  render();
}

export function updateCartBar() {
  render();
}

function render() {
  if (!barEl) return;
  const cart = store.getCart();

  if (!cart) {
    barEl.classList.remove('visible');
    barEl.replaceChildren();
    clearInterval(timerInterval);
    updateCartIcon();
    return;
  }

  const dest = destinations.find(d => d.id === cart.destinationId);
  const hotel = dest ? asHotel(dest) : null;
  if (!hotel) return;

  barEl.classList.add('visible');
  barEl.replaceChildren();

  const inner = document.createElement('div');
  inner.className = 'cart-bar-inner';

  const info = document.createElement('div');
  info.className = 'cart-bar-info';
  const label = document.createElement('span');
  label.className = 'cart-bar-label';
  label.textContent = 'Reservation in progress';
  const name = document.createElement('strong');
  name.className = 'cart-bar-hotel';
  name.textContent = hotel.hotelName;
  const dates = document.createElement('span');
  dates.className = 'cart-bar-dates';
  dates.textContent = formatStayDates(cart.checkIn, cart.checkOut) + (cart.roomName ? ' · ' + cart.roomName : '');
  info.appendChild(label);
  info.appendChild(name);
  info.appendChild(dates);

  const actions = document.createElement('div');
  actions.className = 'cart-bar-actions';

  const timer = document.createElement('span');
  timer.className = 'cart-bar-timer';
  updateTimer(timer);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => updateTimer(timer), 1000);

  const resumeBtn = document.createElement('button');
  resumeBtn.className = 'btn btn-primary cart-bar-resume';
  resumeBtn.textContent = 'Complete Booking';
  resumeBtn.addEventListener('click', () => callbacks.onResume?.(dest, cart));

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn-secondary cart-bar-clear';
  clearBtn.textContent = 'Clear & Start Over';
  clearBtn.addEventListener('click', () => {
    store.abandonCart('user_cleared');
    updateCartIcon();
    callbacks.onClear?.();
    render();
  });

  actions.appendChild(timer);
  actions.appendChild(resumeBtn);
  actions.appendChild(clearBtn);
  inner.appendChild(info);
  inner.appendChild(actions);
  barEl.appendChild(inner);
}

function updateTimer(el) {
  const remaining = store.getHoldRemainingMs();
  if (remaining <= 0) {
    el.textContent = 'Hold expired';
    store.abandonCart('hold_expired');
    updateCartIcon();
    render();
    return;
  }
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  el.textContent = 'Rate held ' + mins + ':' + secs.toString().padStart(2, '0');
}

export { store as cartStore };
