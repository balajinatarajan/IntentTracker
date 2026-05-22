const STORAGE_KEY = 'wanderlust_booking_state';
const HOLD_DURATION_MS = 15 * 60 * 1000; // 15-minute rate hold (Marriott-style)

const DEFAULT_STATE = {
  cart: null,
  abandoned: [],
  completed: []
};

export class BookingStore {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  getCart() {
    const state = this.load();
    if (!state.cart) return null;
    if (state.cart.holdExpiresAt && Date.now() > state.cart.holdExpiresAt) {
      this.abandonCart('hold_expired');
      return null;
    }
    return state.cart;
  }

  setCart(cart) {
    const state = this.load();
    state.cart = {
      ...cart,
      holdExpiresAt: Date.now() + HOLD_DURATION_MS,
      updatedAt: Date.now()
    };
    this.save(state);
    return state.cart;
  }

  updateCart(partial) {
    const state = this.load();
    if (!state.cart) return null;
    state.cart = { ...state.cart, ...partial, updatedAt: Date.now() };
    this.save(state);
    return state.cart;
  }

  clearCart() {
    const state = this.load();
    state.cart = null;
    this.save(state);
  }

  recordAbandonment(entry) {
    const state = this.load();
    state.abandoned = [
      {
        ...entry,
        abandonedAt: Date.now()
      },
      ...state.abandoned.filter(a => a.destinationId !== entry.destinationId)
    ].slice(0, 5);
    state.cart = null;
    this.save(state);
  }

  abandonCart(reason = 'user_exit') {
    const state = this.load();
    if (!state.cart) return null;

    const entry = {
      destinationId: state.cart.destinationId,
      funnelStep: state.cart.funnelStep || 'cart',
      stepIndex: state.cart.stepIndex ?? 4,
      checkIn: state.cart.checkIn,
      checkOut: state.cart.checkOut,
      guests: state.cart.guests,
      roomId: state.cart.roomId,
      rateId: state.cart.rateId,
      nightlyRate: state.cart.nightlyRate,
      reason
    };

    this.recordAbandonment(entry);
    return entry;
  }

  getAbandoned() {
    return this.load().abandoned.filter(a => {
      const age = Date.now() - a.abandonedAt;
      return age < 7 * 24 * 60 * 60 * 1000; // keep 7 days
    });
  }

  getPrimaryAbandonment() {
    const abandoned = this.getAbandoned();
    if (abandoned.length === 0) return null;
    return abandoned.sort((a, b) => {
      const stepScore = (s) => ({ review: 4, guest: 3, room: 2, dates: 1, cart: 5 }[s] || 0);
      const diff = stepScore(b.funnelStep) - stepScore(a.funnelStep);
      if (diff !== 0) return diff;
      return b.abandonedAt - a.abandonedAt;
    })[0];
  }

  markCompleted(destinationId) {
    const state = this.load();
    state.cart = null;
    state.abandoned = state.abandoned.filter(a => a.destinationId !== destinationId);
    state.completed = [{ destinationId, completedAt: Date.now() }, ...state.completed].slice(0, 10);
    this.save(state);
  }

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  getPendingCount() {
    const cart = this.getCart();
    const abandoned = this.getAbandoned();
    return (cart ? 1 : 0) + abandoned.length;
  }

  clearAllPending() {
    const state = this.load();
    state.cart = null;
    state.abandoned = [];
    this.save(state);
  }

  clearAbandoned(destinationId) {
    const state = this.load();
    state.abandoned = state.abandoned.filter(a => a.destinationId !== destinationId);
    this.save(state);
  }

  getHoldRemainingMs() {
    const cart = this.getCart();
    if (!cart?.holdExpiresAt) return 0;
    return Math.max(0, cart.holdExpiresAt - Date.now());
  }
}

export { HOLD_DURATION_MS };
