// Derive Marriott-style hotel metadata from destination catalog entries

const ROOM_CATALOG = {
  budget: [
    { id: 'standard-king', name: 'Standard King Guest Room', bed: '1 King', sqft: 280, perks: ['Free Wi-Fi', 'City view'] },
    { id: 'deluxe-double', name: 'Deluxe Double Guest Room', bed: '2 Double', sqft: 300, perks: ['Free Wi-Fi', 'Pool view'] }
  ],
  'mid-range': [
    { id: 'premier-king', name: 'Premier King Guest Room', bed: '1 King', sqft: 340, perks: ['Club lounge access', 'Premium Wi-Fi'] },
    { id: 'premier-double', name: 'Premier Double Guest Room', bed: '2 Double', sqft: 360, perks: ['City or garden view', 'Premium Wi-Fi'] }
  ],
  luxury: [
    { id: 'junior-suite', name: 'Junior Suite', bed: '1 King', sqft: 520, perks: ['Separate living area', 'Club lounge access'] },
    { id: 'signature-suite', name: 'Signature Suite', bed: '1 King', sqft: 680, perks: ['Panoramic view', 'Butler service'] }
  ]
};

const RATE_PLANS = [
  { id: 'member', name: 'Member Rate', tagline: 'Best available rate · Free cancellation', multiplier: 1.0 },
  { id: 'prepaid', name: 'Prepay & Save', tagline: 'Save 12% · Non-refundable', multiplier: 0.88 }
];

export function asHotel(dest) {
  const city = dest.name.split(',')[0].trim();
  const rooms = (ROOM_CATALOG[dest.priceTier] || ROOM_CATALOG['mid-range']).map(room => ({
    ...room,
    rates: RATE_PLANS.map(plan => ({
      ...plan,
      nightlyRate: Math.round(dest.price * plan.multiplier)
    }))
  }));

  return {
    ...dest,
    hotelName: `Wanderlust ${city}`,
    brand: 'Wanderlust Collection',
    propertyType: 'Hotel & Resort',
    starRating: dest.priceTier === 'luxury' ? 5 : dest.priceTier === 'mid-range' ? 4 : 3,
    rooms
  };
}

export function getHotelById(destinations, id) {
  const dest = destinations.find(d => d.id === id);
  return dest ? asHotel(dest) : null;
}

export function formatStayDates(checkIn, checkOut) {
  const opts = { month: 'short', day: 'numeric' };
  const inDate = new Date(checkIn + 'T12:00:00');
  const outDate = new Date(checkOut + 'T12:00:00');
  return `${inDate.toLocaleDateString('en-US', opts)} – ${outDate.toLocaleDateString('en-US', opts)}`;
}

export function nightsBetween(checkIn, checkOut) {
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function defaultCheckInDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function defaultCheckOutDate(checkIn) {
  const d = new Date(checkIn + 'T12:00:00');
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export const BOOKING_STEPS = [
  { id: 'dates', label: 'Dates & Guests' },
  { id: 'room', label: 'Select Room' },
  { id: 'guest', label: 'Guest Info' },
  { id: 'review', label: 'Review & Reserve' }
];

export const ABANDONMENT_MESSAGES = {
  dates: (hotel) => `You started planning a stay at ${hotel.hotelName} — pick up where you left off.`,
  room: (hotel) => `Your room selection at ${hotel.hotelName} is waiting — complete your reservation.`,
  guest: (hotel) => `Almost there! Finish booking ${hotel.hotelName} before your rate expires.`,
  review: (hotel) => `Your dream stay at ${hotel.hotelName} is one step away — reserve now.`,
  cart: (hotel) => `Complete your reservation at ${hotel.hotelName} — limited time hold active.`
};
