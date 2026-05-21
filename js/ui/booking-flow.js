import {
  asHotel,
  BOOKING_STEPS,
  defaultCheckInDate,
  defaultCheckOutDate,
  formatStayDates,
  nightsBetween
} from '../data/hotel-utils.js';
import { BookingStore } from '../storage/booking-store.js';

let overlay = null;
let callbacks = {};
let currentHotel = null;
let currentStep = 0;
let draft = {};
const store = new BookingStore();

export function initBookingFlow({ onEvent, onCartChange, onComplete, onAbandon }) {
  overlay = document.getElementById('booking-overlay');
  callbacks = { onEvent, onCartChange, onComplete, onAbandon };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleAbandon('overlay_click');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      handleAbandon('escape_key');
    }
  });
}

export function openBookingFlow(dest, { resumeFrom } = {}) {
  currentHotel = asHotel(dest);
  currentStep = 0;

  if (resumeFrom) {
    draft = { ...resumeFrom };
    currentStep = Math.max(0, BOOKING_STEPS.findIndex(s => s.id === resumeFrom.funnelStep));
    if (currentStep < 0) currentStep = 0;
  } else {
    const checkIn = defaultCheckInDate();
    draft = {
      destinationId: dest.id,
      checkIn,
      checkOut: defaultCheckOutDate(checkIn),
      guests: 2,
      roomId: null,
      rateId: null,
      guestFirstName: '',
      guestLastName: '',
      guestEmail: ''
    };
    emit('booking_started', { funnelStep: 'dates', stepIndex: 0 });
  }

  renderStep();
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeBookingFlow() {
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  currentHotel = null;
  draft = {};
}

function emit(type, extra = {}) {
  if (!callbacks.onEvent) return;
  callbacks.onEvent({
    type,
    timestamp: Date.now(),
    destinationId: currentHotel?.id || extra.destinationId || draft.destinationId,
    dwellMs: null,
    query: null,
    scrollVelocity: null,
    ...extra
  });
}

function handleAbandon(reason) {
  const step = BOOKING_STEPS[currentStep]?.id || 'dates';
  const hasProgress = currentStep > 0 || draft.roomId || store.getCart();

  if (hasProgress) {
    let entry;
    if (store.getCart()) {
      entry = store.abandonCart(reason);
    } else {
      entry = {
        destinationId: draft.destinationId,
        funnelStep: step,
        stepIndex: currentStep,
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        guests: draft.guests,
        roomId: draft.roomId,
        rateId: draft.rateId,
        nightlyRate: draft.nightlyRate,
        reason
      };
      store.recordAbandonment(entry);
    }

    emit('checkout_abandoned', {
      funnelStep: step,
      stepIndex: currentStep,
      reason,
      destinationId: draft.destinationId
    });

    callbacks.onAbandon?.(entry);
  }

  closeBookingFlow();
}

function renderStep() {
  const step = BOOKING_STEPS[currentStep];
  draft.funnelStep = step.id;
  draft.stepIndex = currentStep;

  overlay.replaceChildren();
  const modal = document.createElement('div');
  modal.className = 'booking-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Reserve your room');

  modal.appendChild(buildHeader());
  modal.appendChild(buildSteps());
  modal.appendChild(buildBody(step.id));
  modal.appendChild(buildFooter());
  overlay.appendChild(modal);

  modal.querySelector('.booking-close').addEventListener('click', () => handleAbandon('close_button'));
  modal.querySelector('.booking-back')?.addEventListener('click', () => {
    currentStep--;
    renderStep();
  });
  modal.querySelector('.booking-next').addEventListener('click', handleNext);
  wireStepInputs(step.id, modal);
}

function buildHeader() {
  const header = document.createElement('div');
  header.className = 'booking-header';
  header.innerHTML = `
    <div class="booking-header-info">
      <span class="booking-brand">${currentHotel.brand}</span>
      <h2 class="booking-hotel-name">${currentHotel.hotelName}</h2>
      <p class="booking-location">${currentHotel.name} · ${'★'.repeat(currentHotel.starRating)}</p>
    </div>
    <button class="booking-close" aria-label="Close">&times;</button>
  `;
  return header;
}

function buildSteps() {
  const steps = document.createElement('div');
  steps.className = 'booking-steps';
  BOOKING_STEPS.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'booking-step' + (i === currentStep ? ' active' : '') + (i < currentStep ? ' done' : '');
    el.innerHTML = `<span class="step-num">${i + 1}</span><span class="step-label">${s.label}</span>`;
    steps.appendChild(el);
  });
  return steps;
}

function buildBody(stepId) {
  const body = document.createElement('div');
  body.className = 'booking-body';
  if (stepId === 'dates') body.appendChild(buildDatesStep());
  else if (stepId === 'room') body.appendChild(buildRoomStep());
  else if (stepId === 'guest') body.appendChild(buildGuestStep());
  else if (stepId === 'review') body.appendChild(buildReviewStep());
  return body;
}

function buildFooter() {
  const footer = document.createElement('div');
  footer.className = 'booking-footer';
  if (currentStep > 0) {
    const back = document.createElement('button');
    back.className = 'btn btn-secondary booking-back';
    back.textContent = 'Back';
    footer.appendChild(back);
  } else {
    footer.appendChild(document.createElement('span'));
  }
  const next = document.createElement('button');
  next.className = 'btn btn-primary booking-next';
  next.textContent = currentStep === BOOKING_STEPS.length - 1 ? 'Confirm Reservation' : 'Continue';
  footer.appendChild(next);
  return footer;
}

function buildDatesStep() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3 class="booking-step-title">When are you staying?</h3>
    <p class="booking-step-desc">Select your dates and number of guests.</p>
    <div class="booking-form-grid">
      <label class="booking-field"><span>Check-in</span><input type="date" id="bf-checkin" value="${draft.checkIn}" min="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="booking-field"><span>Check-out</span><input type="date" id="bf-checkout" value="${draft.checkOut}"></label>
      <label class="booking-field"><span>Guests</span><select id="bf-guests">${[1,2,3,4,5,6].map(n => `<option value="${n}" ${draft.guests === n ? 'selected' : ''}>${n} guest${n > 1 ? 's' : ''}</option>`).join('')}</select></label>
    </div>
    <div class="booking-hold-notice"><span class="hold-icon">⏱</span> Rates are held for 15 minutes once you select a room.</div>
  `;
  return wrap;
}

function buildRoomStep() {
  const nights = nightsBetween(draft.checkIn, draft.checkOut);
  const wrap = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'booking-step-title';
  title.textContent = 'Select your room & rate';
  const desc = document.createElement('p');
  desc.className = 'booking-step-desc';
  desc.textContent = `${formatStayDates(draft.checkIn, draft.checkOut)} · ${nights} night${nights > 1 ? 's' : ''} · ${draft.guests} guest${draft.guests > 1 ? 's' : ''}`;
  wrap.appendChild(title);
  wrap.appendChild(desc);

  const list = document.createElement('div');
  list.className = 'room-list';
  currentHotel.rooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'room-card' + (draft.roomId === room.id ? ' selected' : '');
    card.dataset.roomId = room.id;
    card.innerHTML = `
      <div class="room-card-header"><div><h4 class="room-name">${room.name}</h4><p class="room-meta">${room.bed} · ${room.sqft} sq ft</p></div></div>
      <ul class="room-perks">${room.perks.map(p => `<li>${p}</li>`).join('')}</ul>
      <div class="rate-options">${room.rates.map(rate => `
        <label class="rate-option ${draft.roomId === room.id && draft.rateId === rate.id ? 'selected' : ''}">
          <input type="radio" name="room-rate" value="${room.id}:${rate.id}" ${draft.roomId === room.id && draft.rateId === rate.id ? 'checked' : ''}>
          <div class="rate-info"><span class="rate-name">${rate.name}</span><span class="rate-tagline">${rate.tagline}</span></div>
          <span class="rate-price">$${rate.nightlyRate}<small>/night</small></span>
        </label>`).join('')}
      </div>`;
    list.appendChild(card);
  });
  wrap.appendChild(list);
  return wrap;
}

function buildGuestStep() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3 class="booking-step-title">Guest information</h3>
    <p class="booking-step-desc">Who will be checking in?</p>
    <div class="booking-form-grid booking-form-grid-single">
      <label class="booking-field"><span>First name</span><input type="text" id="bf-first" value="${draft.guestFirstName || ''}" placeholder="First name" autocomplete="given-name"></label>
      <label class="booking-field"><span>Last name</span><input type="text" id="bf-last" value="${draft.guestLastName || ''}" placeholder="Last name" autocomplete="family-name"></label>
      <label class="booking-field booking-field-full"><span>Email</span><input type="email" id="bf-email" value="${draft.guestEmail || ''}" placeholder="you@email.com" autocomplete="email"></label>
    </div>`;
  return wrap;
}

function buildReviewStep() {
  const room = currentHotel.rooms.find(r => r.id === draft.roomId);
  const rate = room?.rates.find(r => r.id === draft.rateId);
  const nights = nightsBetween(draft.checkIn, draft.checkOut);
  const subtotal = (rate?.nightlyRate || 0) * nights;
  const taxes = Math.round(subtotal * 0.12);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3 class="booking-step-title">Review your reservation</h3>
    <div class="review-hold-banner"><span class="hold-pulse"></span><strong>Limited time hold</strong> — complete your reservation before your rate expires.</div>
    <div class="review-card">
      <div class="review-row"><span>Hotel</span><strong>${currentHotel.hotelName}</strong></div>
      <div class="review-row"><span>Dates</span><strong>${formatStayDates(draft.checkIn, draft.checkOut)}</strong></div>
      <div class="review-row"><span>Room</span><strong>${room?.name || '—'}</strong></div>
      <div class="review-row"><span>Rate</span><strong>${rate?.name || '—'}</strong></div>
      <div class="review-row"><span>Guest</span><strong>${draft.guestFirstName} ${draft.guestLastName}</strong></div>
      <div class="review-divider"></div>
      <div class="review-row"><span>${nights} night${nights > 1 ? 's' : ''} × $${rate?.nightlyRate || 0}</span><strong>$${subtotal}</strong></div>
      <div class="review-row review-muted"><span>Taxes & fees</span><span>$${taxes}</span></div>
      <div class="review-row review-total"><span>Total</span><strong>$${subtotal + taxes}</strong></div>
    </div>`;
  return wrap;
}

function wireStepInputs(stepId, modal) {
  if (stepId === 'dates') {
    const checkInEl = modal.querySelector('#bf-checkin');
    const checkOutEl = modal.querySelector('#bf-checkout');
    checkInEl?.addEventListener('change', () => {
      draft.checkIn = checkInEl.value;
      if (draft.checkOut <= draft.checkIn) {
        draft.checkOut = defaultCheckOutDate(draft.checkIn);
        checkOutEl.value = draft.checkOut;
      }
    });
    checkOutEl?.addEventListener('change', () => { draft.checkOut = checkOutEl.value; });
    modal.querySelector('#bf-guests')?.addEventListener('change', (e) => { draft.guests = parseInt(e.target.value, 10); });
  }
  if (stepId === 'room') {
    modal.querySelectorAll('input[name="room-rate"]').forEach(input => {
      input.addEventListener('change', () => {
        const [roomId, rateId] = input.value.split(':');
        draft.roomId = roomId;
        draft.rateId = rateId;
        const room = currentHotel.rooms.find(r => r.id === roomId);
        const rate = room?.rates.find(r => r.id === rateId);
        draft.nightlyRate = rate?.nightlyRate;
        draft.roomName = room?.name;
        draft.rateName = rate?.name;
        renderStep();
      });
    });
  }
  if (stepId === 'guest') {
    modal.querySelector('#bf-first')?.addEventListener('input', (e) => { draft.guestFirstName = e.target.value; });
    modal.querySelector('#bf-last')?.addEventListener('input', (e) => { draft.guestLastName = e.target.value; });
    modal.querySelector('#bf-email')?.addEventListener('input', (e) => { draft.guestEmail = e.target.value; });
  }
}

function handleNext() {
  const step = BOOKING_STEPS[currentStep];
  const modal = overlay.querySelector('.booking-modal');

  if (step.id === 'dates') {
    draft.checkIn = modal.querySelector('#bf-checkin')?.value || draft.checkIn;
    draft.checkOut = modal.querySelector('#bf-checkout')?.value || draft.checkOut;
    draft.guests = parseInt(modal.querySelector('#bf-guests')?.value || draft.guests, 10);
    if (draft.checkOut <= draft.checkIn) { alert('Check-out must be after check-in.'); return; }
    emit('checkout_step', { funnelStep: 'dates', stepIndex: 0 });
    currentStep++;
    renderStep();
    return;
  }

  if (step.id === 'room') {
    if (!draft.roomId || !draft.rateId) { alert('Please select a room and rate.'); return; }
    const cart = store.setCart({ ...draft, funnelStep: 'room', stepIndex: 1 });
    emit('add_to_cart', { funnelStep: 'room', stepIndex: 1, roomId: draft.roomId, rateId: draft.rateId, nightlyRate: draft.nightlyRate });
    callbacks.onCartChange?.(cart);
    emit('checkout_step', { funnelStep: 'room', stepIndex: 1 });
    currentStep++;
    renderStep();
    return;
  }

  if (step.id === 'guest') {
    draft.guestFirstName = modal.querySelector('#bf-first')?.value?.trim() || '';
    draft.guestLastName = modal.querySelector('#bf-last')?.value?.trim() || '';
    draft.guestEmail = modal.querySelector('#bf-email')?.value?.trim() || '';
    if (!draft.guestFirstName || !draft.guestLastName || !draft.guestEmail) { alert('Please fill in all guest details.'); return; }
    store.updateCart({ ...draft, funnelStep: 'guest', stepIndex: 2 });
    emit('checkout_step', { funnelStep: 'guest', stepIndex: 2 });
    currentStep++;
    renderStep();
    return;
  }

  if (step.id === 'review') {
    emit('checkout_step', { funnelStep: 'review', stepIndex: 3 });
    emit('booking_complete', { funnelStep: 'review', stepIndex: 3 });
    store.markCompleted(draft.destinationId);
    callbacks.onComplete?.({ ...draft });
    callbacks.onCartChange?.(null);
    const hotelName = currentHotel?.hotelName;
    closeBookingFlow();
    showConfirmation(hotelName);
  }
}

function showConfirmation(hotelName) {
  const toast = document.createElement('div');
  toast.className = 'booking-toast';
  toast.innerHTML = `<strong>Reservation confirmed!</strong><span>Your stay at ${hotelName || 'the hotel'} is booked. Check your email for details.</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); }, 4000);
}

export function resumeAbandonedBooking(dest, abandonment) {
  openBookingFlow(dest, {
    resumeFrom: {
      destinationId: dest.id,
      checkIn: abandonment.checkIn || defaultCheckInDate(),
      checkOut: abandonment.checkOut || defaultCheckOutDate(abandonment.checkIn || defaultCheckInDate()),
      guests: abandonment.guests || 2,
      roomId: abandonment.roomId,
      rateId: abandonment.rateId,
      nightlyRate: abandonment.nightlyRate,
      funnelStep: abandonment.funnelStep
    }
  });
}

export { store as bookingStore };
