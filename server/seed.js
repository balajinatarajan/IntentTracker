// Seed synthetic data into the running analytics server.
// Posts through the real /api/ingest endpoint so it exercises the same path
// the browser uses. Run with: node server/seed.js  (server must be running)

const BASE = process.env.BASE || 'http://localhost:8090';
const USER_COUNT = parseInt(process.env.USERS || '25', 10);
const HOURS_BACK = parseInt(process.env.HOURS || '24', 10);

// Real tags from js/data/destinations.js (skewed weights make the bar chart
// interesting — beach/culture/food show up everywhere, technology is rare).
const TAG_POOL = [
  ['beach',          1.0],
  ['culture',        0.9],
  ['food',           0.8],
  ['luxury',         0.7],
  ['city',           0.7],
  ['europe',         0.6],
  ['romantic',       0.55],
  ['adventure',      0.5],
  ['nightlife',      0.45],
  ['family',         0.45],
  ['nature',         0.4],
  ['southeast-asia', 0.35],
  ['mid-range',      0.35],
  ['budget',         0.3],
  ['east-asia',      0.25],
  ['caribbean',      0.2],
  ['surfing',        0.15],
  ['diving',         0.15],
  ['wildlife',       0.12],
  ['shopping',       0.1],
  ['technology',     0.08],
];

const PAGES = [
  { url: '/index.html',    name: 'Home' },
  { url: '/hotels.html',   name: 'Hotels' },
  { url: '/vacations.html', name: 'Vacations' },
  { url: '/resorts.html',  name: 'Resorts' },
  { url: '/dining.html',   name: 'Dining' },
];

// Intent funnel: view >> hover > click; page_view + tab_view less; search rare.
const SIGNAL_TYPES = [
  ['view',      50],
  ['hover',     22],
  ['click',     12],
  ['page_view',  8],
  ['tab_view',   5],
  ['search',     3],
];

const SEARCH_QUERIES = ['bali', 'paris', 'tokyo', 'maldives', 'iceland', 'safari', 'thailand', 'tuscany'];
const DESTINATION_IDS = [
  'bali', 'phuket', 'danang', 'paris', 'barcelona', 'prague', 'lisbon', 'tokyo',
  'kyoto', 'maldives', 'cancun', 'santorini', 'nyc', 'dubai', 'costa-rica',
  'marrakech', 'iceland', 'cape-town', 'machu-picchu', 'swiss-alps', 'maui',
  'sri-lanka', 'amsterdam', 'patagonia',
];
const ARCHETYPE_TAGS = {
  abandoner: { budget: 4.2, beach: 2.4, 'southeast-asia': 3.7, family: 1.1 },
  comparer: { city: 3.4, europe: 3.2, culture: 2.8, budget: 1.3 },
  bouncer: { beach: 0.8, luxury: 0.5 },
  converter: { romantic: 3.8, beach: 3.2, luxury: 2.7 },
  returner: { budget: 3.8, adventure: 2.9, 'southeast-asia': 3.1 },
  price_shocker: { luxury: 4.4, romantic: 3.1, beach: 2.6, europe: 1.4 },
  decision_paralysis: { city: 3.0, europe: 2.8, culture: 2.5, food: 2.1, nightlife: 1.6 },
  search_deadend: { adventure: 2.2, nature: 1.9, wildlife: 1.4 },
  comparison_fatigue: { beach: 3.6, luxury: 2.4, romantic: 2.0, caribbean: 1.5 },
};

// Stakeholder-friendly display names per archetype. These get attached to the
// profile snapshot so userJourneyAnalysis can show "Honeymoon Planner" instead
// of the GUID. (Picked here so the demo always reads the same name for the
// same archetype rather than letting the hash-based fallback wander.)
const ARCHETYPE_DISPLAY_NAMES = {
  abandoner: 'Almost-There Alex',
  comparer: 'Indecisive Iris',
  bouncer: 'Quick-Peek Quinn',
  converter: 'Decisive Dana',
  returner: 'Comeback Casey',
  price_shocker: 'Sticker-Shock Sam',
  decision_paralysis: 'Endless-Tab Tara',
  search_deadend: 'Off-Map Morgan',
  comparison_fatigue: 'Window-Shop Whitney',
};

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedPick(table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of table) {
    r -= w;
    if (r <= 0) return v;
  }
  return table[table.length - 1][0];
}

function makeUserId() {
  return 'user-' + Math.random().toString(36).slice(2, 10);
}

// Build a tag-weight profile that emphasizes 3–6 tags for this user, so each
// user has a recognizable "taste" and the cross-user rollup still varies.
function makeUserTagWeights() {
  const out = {};
  const favCount = randInt(3, 6);
  const shuffled = [...TAG_POOL].sort(() => Math.random() - 0.5);
  for (let i = 0; i < favCount; i++) {
    const [tag] = shuffled[i];
    out[tag] = +(rand(1.0, 5.0)).toFixed(3);
  }
  // A few low-weight long-tail tags
  for (let i = favCount; i < favCount + randInt(2, 5); i++) {
    if (!shuffled[i]) break;
    const [tag] = shuffled[i];
    out[tag] = +(rand(0.1, 0.9)).toFixed(3);
  }
  return out;
}

async function postIngest(payload) {
  const r = await fetch(BASE + '/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`ingest ${r.status}: ${await r.text()}`);
  return r.json();
}

function at(start, seconds) {
  return start + seconds * 1000;
}

function checkoutSignals({ start, itemId, outcome, abandonStep = 'guest' }) {
  const base = [
    { type: 'search', timestamp: at(start, 4), query: itemId },
    { type: 'click', timestamp: at(start, 12), itemId },
    { type: 'booking_started', timestamp: at(start, 28), destinationId: itemId, funnelStep: 'dates', stepIndex: 0 },
    { type: 'checkout_step', timestamp: at(start, 44), destinationId: itemId, funnelStep: 'dates', stepIndex: 0 },
    { type: 'add_to_cart', timestamp: at(start, 82), destinationId: itemId, funnelStep: 'room', stepIndex: 1, roomId: 'standard-king', rateId: 'member', nightlyRate: 720 },
    { type: 'checkout_step', timestamp: at(start, 86), destinationId: itemId, funnelStep: 'room', stepIndex: 1 },
  ];
  if (outcome === 'abandoned') {
    base.push({ type: 'checkout_step', timestamp: at(start, 125), destinationId: itemId, funnelStep: abandonStep, stepIndex: abandonStep === 'review' ? 3 : 2 });
    base.push({ type: 'checkout_abandoned', timestamp: at(start, 170), destinationId: itemId, funnelStep: abandonStep, stepIndex: abandonStep === 'review' ? 3 : 2, reason: 'close_button' });
  } else if (outcome === 'completed') {
    base.push({ type: 'checkout_step', timestamp: at(start, 125), destinationId: itemId, funnelStep: 'guest', stepIndex: 2 });
    base.push({ type: 'checkout_step', timestamp: at(start, 170), destinationId: itemId, funnelStep: 'review', stepIndex: 3 });
    base.push({ type: 'booking_complete', timestamp: at(start, 205), destinationId: itemId, funnelStep: 'review', stepIndex: 3 });
  }
  return base;
}

async function seedJourneyArchetype(kind, index) {
  const userId = `user-${kind}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const start = now - randInt(1, HOURS_BACK * 3600_000);
  let sessions = [];

  if (kind === 'abandoner') {
    sessions = [{
      sessionId: `session-${start}`,
      pageUrl: '/index.html',
      signals: checkoutSignals({ start, itemId: 'phuket', outcome: 'abandoned', abandonStep: 'guest' }),
    }];
  } else if (kind === 'comparer') {
    const items = ['prague', 'marrakech', 'swiss-alps', 'santorini', 'kyoto'];
    sessions = [{
      sessionId: `session-${start}`,
      pageUrl: '/index.html',
      signals: [
        { type: 'search', timestamp: at(start, 3), query: 'budget city' },
        { type: 'tab_view', timestamp: at(start, 8), itemId: 'tab-for-you' },
        ...items.flatMap((item, i) => [
          { type: 'view', timestamp: at(start, 18 + i * 22), itemId: item, dwellMs: 1800 + i * 250 },
          { type: 'click', timestamp: at(start, 28 + i * 22), itemId: item },
        ]),
        { type: 'search', timestamp: at(start, 170), query: 'europe budget hotels' },
      ],
    }];
  } else if (kind === 'bouncer') {
    sessions = [{
      sessionId: `session-${start}`,
      pageUrl: '/index.html',
      signals: [
        { type: 'page_view', timestamp: at(start, 1), itemId: 'Home' },
        { type: 'view', timestamp: at(start, 8), itemId: 'bali', dwellMs: 900 },
      ],
    }];
  } else if (kind === 'converter') {
    sessions = [{
      sessionId: `session-${start}`,
      pageUrl: '/index.html',
      signals: checkoutSignals({ start, itemId: 'maldives', outcome: 'completed' }),
    }];
  } else if (kind === 'returner') {
    const first = start - 2 * 3600_000;
    sessions = [
      {
        sessionId: `session-${first}`,
        pageUrl: '/index.html',
        signals: checkoutSignals({ start: first, itemId: 'danang', outcome: 'abandoned', abandonStep: 'review' }),
      },
      {
        sessionId: `session-${start}`,
        pageUrl: '/index.html',
        signals: [
          { type: 'page_view', timestamp: at(start, 1), itemId: 'Home' },
          { type: 'tab_view', timestamp: at(start, 6), itemId: 'tab-for-you' },
          { type: 'click', timestamp: at(start, 20), itemId: 'danang' },
          ...checkoutSignals({ start: at(start, 30), itemId: 'danang', outcome: 'completed' }).filter(s => s.type !== 'search'),
        ],
      },
    ];
  } else if (kind === 'price_shocker') {
    // Luxury intent, opens booking, sees rate, bounces fast at the room step
    // with a price-flavored reason code so the detector picks up price_shock.
    sessions = [{
      sessionId: `session-${start}`,
      pageUrl: '/index.html',
      signals: [
        { type: 'page_view', timestamp: at(start, 1), itemId: 'Home' },
        { type: 'tab_view', timestamp: at(start, 5), itemId: 'tab-romantic' },
        { type: 'view', timestamp: at(start, 14), itemId: 'maldives', dwellMs: 4200 },
        { type: 'click', timestamp: at(start, 22), itemId: 'maldives' },
        { type: 'booking_started', timestamp: at(start, 36), destinationId: 'maldives', funnelStep: 'dates', stepIndex: 0 },
        { type: 'checkout_step', timestamp: at(start, 48), destinationId: 'maldives', funnelStep: 'dates', stepIndex: 0 },
        { type: 'checkout_step', timestamp: at(start, 72), destinationId: 'maldives', funnelStep: 'room', stepIndex: 1 },
        { type: 'checkout_abandoned', timestamp: at(start, 92), destinationId: 'maldives', funnelStep: 'room', stepIndex: 1, reason: 'price_too_high' },
      ],
    }];
  } else if (kind === 'decision_paralysis') {
    // Many distinct destination clicks across two sessions, never starts booking.
    const itemsA = ['paris', 'barcelona', 'amsterdam', 'lisbon'];
    const itemsB = ['prague', 'kyoto', 'tokyo', 'santorini'];
    const second = start + 90 * 60_000;
    sessions = [
      {
        sessionId: `session-${start}`,
        pageUrl: '/index.html',
        signals: [
          { type: 'page_view', timestamp: at(start, 1), itemId: 'Home' },
          { type: 'search', timestamp: at(start, 8), query: 'european city break' },
          ...itemsA.flatMap((id, i) => [
            { type: 'view', timestamp: at(start, 22 + i * 18), itemId: id, dwellMs: 2200 + i * 200 },
            { type: 'click', timestamp: at(start, 32 + i * 18), itemId: id },
          ]),
        ],
      },
      {
        sessionId: `session-${second}`,
        pageUrl: '/index.html',
        signals: [
          { type: 'page_view', timestamp: at(second, 1), itemId: 'Home' },
          { type: 'tab_view', timestamp: at(second, 4), itemId: 'tab-for-you' },
          ...itemsB.flatMap((id, i) => [
            { type: 'view', timestamp: at(second, 14 + i * 16), itemId: id, dwellMs: 2400 + i * 180 },
            { type: 'click', timestamp: at(second, 24 + i * 16), itemId: id },
          ]),
        ],
      },
    ];
  } else if (kind === 'search_deadend') {
    // Multiple searches, none followed by engagement within 30s — then leaves.
    sessions = [{
      sessionId: `session-${start}`,
      pageUrl: '/index.html',
      signals: [
        { type: 'page_view', timestamp: at(start, 1), itemId: 'Home' },
        { type: 'search', timestamp: at(start, 10), query: 'antarctica wildlife cruise' },
        { type: 'search', timestamp: at(start, 55), query: 'galapagos under 1500' },
        { type: 'search', timestamp: at(start, 102), query: 'mongolia steppe horseback' },
        { type: 'page_view', timestamp: at(start, 140), itemId: 'Home' },
      ],
    }];
  } else if (kind === 'comparison_fatigue') {
    // Long dwell across many destinations, few clicks, no booking.
    const items = ['maldives', 'cancun', 'santorini', 'phuket', 'bali', 'hawaii'];
    sessions = [{
      sessionId: `session-${start}`,
      pageUrl: '/index.html',
      signals: [
        { type: 'page_view', timestamp: at(start, 1), itemId: 'Home' },
        { type: 'tab_view', timestamp: at(start, 5), itemId: 'tab-romantic' },
        ...items.flatMap((id, i) => [
          { type: 'view', timestamp: at(start, 14 + i * 20), itemId: id, dwellMs: 3200 + i * 220 },
          { type: 'hover', timestamp: at(start, 20 + i * 20), itemId: id, dwellMs: 2400 },
        ]),
        { type: 'click', timestamp: at(start, 170), itemId: 'maldives' },
      ],
    }];
  }

  let totalSignals = 0;
  for (const session of sessions) {
    session.signals.sort((a, b) => a.timestamp - b.timestamp);
    totalSignals += session.signals.length;
    await postIngest({
      userId,
      sessionId: session.sessionId,
      pageUrl: session.pageUrl,
      signals: session.signals,
      profile: null,
    });
  }

  await postIngest({
    userId,
    sessionId: `session-${now}`,
    pageUrl: '/index.html',
    signals: [],
    profile: {
      userId,
      sessions: [],
      tagWeights: ARCHETYPE_TAGS[kind],
      displayName: ARCHETYPE_DISPLAY_NAMES[kind] || null,
    },
  });

  console.log(`[journey ${index + 1}] ${userId}: ${kind} (${ARCHETYPE_DISPLAY_NAMES[kind] || 'unnamed'}), ${sessions.length} sessions, ${totalSignals} signals`);
}

async function seedUser(i) {
  const userId = makeUserId();
  const sessions = randInt(1, 3);
  const now = Date.now();

  let totalSignals = 0;

  for (let s = 0; s < sessions; s++) {
    const sessionId = `session-${now - randInt(0, HOURS_BACK * 3600_000)}`;
    const page = pick(PAGES);
    // Session spans 1–20 min somewhere in the last HOURS_BACK hours.
    const sessionEnd = now - randInt(0, HOURS_BACK * 3600_000);
    const sessionLenMs = randInt(1, 20) * 60_000;
    const sessionStart = sessionEnd - sessionLenMs;

    const signalCount = randInt(4, 30);
    const signals = [];
    for (let n = 0; n < signalCount; n++) {
      const type = weightedPick(SIGNAL_TYPES);
      const ts = randInt(sessionStart, sessionEnd);
      const sig = { type, timestamp: ts, itemId: null, dwellMs: null, query: null };
      if (type === 'view')      { sig.itemId = pick(DESTINATION_IDS); sig.dwellMs = randInt(800, 5000); }
      else if (type === 'hover'){ sig.itemId = pick(DESTINATION_IDS); sig.dwellMs = randInt(1000, 4000); }
      else if (type === 'click'){ sig.itemId = pick(DESTINATION_IDS); }
      else if (type === 'search'){ sig.query = pick(SEARCH_QUERIES); }
      else if (type === 'tab_view'){ sig.itemId = pick(['tab-hotels', 'tab-vacations', 'tab-resorts', 'tab-dining', 'tab-for-you']); }
      signals.push(sig);
    }
    signals.sort((a, b) => a.timestamp - b.timestamp);
    totalSignals += signals.length;

    await postIngest({
      userId,
      sessionId,
      pageUrl: page.url,
      ts: sessionEnd,
      signals,
      profile: null, // send signals first
    });
  }

  // Final profile snapshot
  const tagWeights = makeUserTagWeights();
  await postIngest({
    userId,
    sessionId: `session-${now}`,
    pageUrl: '/index.html',
    ts: now,
    signals: [],
    profile: { userId, sessions: [], tagWeights },
  });

  console.log(`[${i + 1}/${USER_COUNT}] ${userId}: ${sessions} sessions, ${totalSignals} signals, ${Object.keys(tagWeights).length} tags`);
}

async function main() {
  console.log(`Seeding ${USER_COUNT} users over the last ${HOURS_BACK}h against ${BASE} ...`);
  // Health check first
  const h = await fetch(BASE + '/api/health').then(r => r.json()).catch(() => null);
  if (!h || h.status !== 'ok') {
    console.error(`Server not reachable at ${BASE}. Start it with: cd server && npm start`);
    process.exit(1);
  }

  const archetypes = [
    'abandoner', 'comparer', 'bouncer', 'converter', 'returner',
    'price_shocker', 'decision_paralysis', 'search_deadend', 'comparison_fatigue',
  ];
  for (let i = 0; i < archetypes.length; i++) {
    try { await seedJourneyArchetype(archetypes[i], i); }
    catch (err) { console.error('  journey seed error:', err.message); }
  }

  const randomUsers = Math.max(0, USER_COUNT - archetypes.length);
  for (let i = 0; i < randomUsers; i++) {
    try { await seedUser(i); }
    catch (err) { console.error('  seed error:', err.message); }
  }

  const summary = await fetch(BASE + '/api/analytics/summary').then(r => r.json());
  console.log('\nDone. Summary:', summary);
  console.log(`Open ${BASE}/dashboard.html`);
}

main();
