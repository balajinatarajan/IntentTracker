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
      if (type === 'view')      { sig.itemId = 'dest-' + randInt(1, 40); sig.dwellMs = randInt(800, 5000); }
      else if (type === 'hover'){ sig.itemId = 'dest-' + randInt(1, 40); sig.dwellMs = randInt(1000, 4000); }
      else if (type === 'click'){ sig.itemId = 'dest-' + randInt(1, 40); }
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

  for (let i = 0; i < USER_COUNT; i++) {
    try { await seedUser(i); }
    catch (err) { console.error('  seed error:', err.message); }
  }

  const summary = await fetch(BASE + '/api/analytics/summary').then(r => r.json());
  console.log('\nDone. Summary:', summary);
  console.log(`Open ${BASE}/dashboard.html`);
}

main();
