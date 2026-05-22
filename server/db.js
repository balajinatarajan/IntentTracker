// SQLite schema + helpers for the analytics backend.
// Two ingestion paths feed three tables:
//   - signals          : every raw event emitted by the tracker
//   - profiles         : latest profile snapshot per userId
//   - profile_tag_weights : flattened {userId, tag, weight} for fast rollups
//
// The "GUID" is the IntentTracker userId (e.g. user-a1b2c3d4), stamped on
// every payload by lib/src/emitter.js. All aggregation pivots on this column.

import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { classifyProfile, recommendForProfile, destinationsById, PERSONAS, UNCLASSIFIED } from './persona.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'analytics.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT NOT NULL,
    session_id   TEXT,
    type         TEXT NOT NULL,
    item_id      TEXT,
    dwell_ms     INTEGER,
    query        TEXT,
    page_url     TEXT,
    ts           INTEGER NOT NULL,
    received_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_signals_user      ON signals(user_id);
  CREATE INDEX IF NOT EXISTS idx_signals_ts        ON signals(ts);
  CREATE INDEX IF NOT EXISTS idx_signals_type_ts   ON signals(type, ts);

  CREATE TABLE IF NOT EXISTS profiles (
    user_id      TEXT PRIMARY KEY,
    profile_json TEXT NOT NULL,
    updated_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_tag_weights (
    user_id  TEXT NOT NULL,
    tag      TEXT NOT NULL,
    weight   REAL NOT NULL,
    PRIMARY KEY (user_id, tag)
  );
  CREATE INDEX IF NOT EXISTS idx_ptw_tag ON profile_tag_weights(tag);
`);

const signalColumns = db.prepare(`PRAGMA table_info(signals)`).all().map(c => c.name);
if (!signalColumns.includes('metadata_json')) {
  db.prepare(`ALTER TABLE signals ADD COLUMN metadata_json TEXT`).run();
}

// --- Prepared statements ---
const insertSignal = db.prepare(`
  INSERT INTO signals (user_id, session_id, type, item_id, dwell_ms, query, page_url, ts, received_at, metadata_json)
  VALUES (@user_id, @session_id, @type, @item_id, @dwell_ms, @query, @page_url, @ts, @received_at, @metadata_json)
`);

const upsertProfile = db.prepare(`
  INSERT INTO profiles (user_id, profile_json, updated_at)
  VALUES (@user_id, @profile_json, @updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    profile_json = excluded.profile_json,
    updated_at   = excluded.updated_at
`);

const deleteUserTags = db.prepare(`DELETE FROM profile_tag_weights WHERE user_id = ?`);
const insertTagWeight = db.prepare(`
  INSERT INTO profile_tag_weights (user_id, tag, weight) VALUES (?, ?, ?)
`);

const SIGNAL_BASE_KEYS = new Set([
  'type',
  'itemId',
  'destinationId',
  'timestamp',
  'dwellMs',
  'query',
]);

function metadataFromSignal(signal) {
  const metadata = {};
  for (const [key, value] of Object.entries(signal || {})) {
    if (SIGNAL_BASE_KEYS.has(key)) continue;
    if (value == null) continue;
    metadata[key] = value;
  }
  if (signal?.destinationId && !signal.itemId) metadata.destinationId = signal.destinationId;
  return Object.keys(metadata).length ? JSON.stringify(metadata) : null;
}

// --- Ingestion (single transaction per payload) ---
export const ingest = db.transaction((payload) => {
  const { userId, sessionId, pageUrl, signals = [], profile = null } = payload;
  const receivedAt = Date.now();

  if (!userId) return { signalsInserted: 0, profileUpdated: false, error: 'missing userId' };

  let signalsInserted = 0;
  for (const s of signals) {
    if (!s || !s.type) continue;
    insertSignal.run({
      user_id:     userId,
      session_id:  sessionId || null,
      type:        s.type,
      item_id:     s.itemId || s.destinationId || null,
      dwell_ms:    s.dwellMs == null ? null : s.dwellMs,
      query:       s.query || null,
      page_url:    pageUrl || null,
      ts:          s.timestamp || receivedAt,
      received_at: receivedAt,
      metadata_json: metadataFromSignal(s),
    });
    signalsInserted++;
  }

  let profileUpdated = false;
  if (profile && profile.userId) {
    upsertProfile.run({
      user_id:      profile.userId,
      profile_json: JSON.stringify(profile),
      updated_at:   receivedAt,
    });
    deleteUserTags.run(profile.userId);
    const tw = profile.tagWeights || {};
    for (const [tag, weight] of Object.entries(tw)) {
      if (typeof weight === 'number' && isFinite(weight)) {
        insertTagWeight.run(profile.userId, tag, weight);
      }
    }
    profileUpdated = true;
  }

  return { signalsInserted, profileUpdated };
});

// --- Analytics queries ---
export function topTags(limit = 20) {
  return db.prepare(`
    SELECT tag,
           SUM(weight)         AS total_weight,
           COUNT(DISTINCT user_id) AS user_count
    FROM profile_tag_weights
    GROUP BY tag
    ORDER BY total_weight DESC
    LIMIT ?
  `).all(limit);
}

// Signal volume by type, bucketed. bucketMs defaults to 1 hour.
export function signalVolume({ sinceMs, bucketMs = 3600_000 } = {}) {
  const since = sinceMs ?? (Date.now() - 24 * 3600_000);
  // CAST forces integer division — better-sqlite3 binds JS numbers as REAL,
  // which would otherwise turn this into a float round-trip and yield the
  // original ts unchanged.
  return db.prepare(`
    SELECT CAST(ts / @bucketMs AS INTEGER) * @bucketMs AS bucket_ts,
           type,
           COUNT(*) AS count
    FROM signals
    WHERE ts >= @since
    GROUP BY bucket_ts, type
    ORDER BY bucket_ts ASC, type ASC
  `).all({ bucketMs, since });
}

// Pull every user's tagWeights once; the persona classifier and recommender
// reduce the rest in JS. Cheap given the volumes a single-instance demo sees,
// and avoids storing derived rollups that go stale on every profile snapshot.
function _allUserTagWeights() {
  return db.prepare(`
    SELECT user_id, tag, weight
    FROM profile_tag_weights
  `).all().reduce((acc, row) => {
    (acc[row.user_id] ||= {})[row.tag] = row.weight;
    return acc;
  }, {});
}

export function userTypes() {
  const byUser = _allUserTagWeights();
  // Seed bucket order with the declared personas + Unclassified so empty
  // buckets still appear in the response (good UX for the dashboard legend).
  const counts = Object.fromEntries(
    [...PERSONAS, UNCLASSIFIED].map(p => [p.id, { id: p.id, label: p.label, count: 0 }])
  );
  for (const tw of Object.values(byUser)) {
    const p = classifyProfile(tw);
    if (counts[p.id]) counts[p.id].count++;
  }
  const total = Object.values(counts).reduce((s, p) => s + p.count, 0);
  return {
    total_users: total,
    personas: Object.values(counts).map(p => ({
      ...p,
      pct: total ? +((p.count / total) * 100).toFixed(1) : 0,
    })),
  };
}

export function topRecommendations({ limit = 10, perUser = 6 } = {}) {
  const byUser = _allUserTagWeights();
  const tally = new Map(); // id -> { id, count, scoreSum }
  let usersConsidered = 0;

  for (const tw of Object.values(byUser)) {
    const recs = recommendForProfile(tw, { maxResults: perUser });
    if (recs.length === 0) continue;
    usersConsidered++;
    for (const r of recs) {
      const cur = tally.get(r.id) || { id: r.id, count: 0, scoreSum: 0 };
      cur.count++;
      cur.scoreSum += r.score;
      tally.set(r.id, cur);
    }
  }

  const catalog = destinationsById();
  const rows = [...tally.values()]
    .map(t => ({
      ...catalog[t.id],
      times_recommended: t.count,
      avg_score: +(t.scoreSum / t.count).toFixed(3),
      pct_of_users: usersConsidered ? +((t.count / usersConsidered) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.times_recommended - a.times_recommended || b.avg_score - a.avg_score)
    .slice(0, limit);

  return { users_considered: usersConsidered, items: rows };
}

// --- Per-user drill-down ---
//
// listUsers() ranks users by recent activity for the picker; userDetail()
// returns everything we know about one userId: profile snapshot, persona,
// tag weights, all signals grouped by session, and what we'd recommend.

export function listUsers({ limit = 100, search = '' } = {}) {
  const like = `%${search}%`;
  const rows = db.prepare(`
    SELECT s.user_id                      AS user_id,
           COUNT(*)                       AS signal_count,
           COUNT(DISTINCT s.session_id)   AS session_count,
           MAX(s.ts)                      AS last_signal_at,
           MIN(s.ts)                      AS first_signal_at,
           (SELECT updated_at FROM profiles WHERE user_id = s.user_id) AS profile_updated_at
    FROM signals s
    WHERE (@search = '' OR s.user_id LIKE @like)
    GROUP BY s.user_id
    ORDER BY last_signal_at DESC
    LIMIT @limit
  `).all({ search, like, limit });

  // Pull tagWeights once for persona labeling
  const tagRows = db.prepare(`SELECT user_id, tag, weight FROM profile_tag_weights`).all();
  const tw = {};
  for (const r of tagRows) (tw[r.user_id] ||= {})[r.tag] = r.weight;

  // Pull displayName hints in a single round-trip so we don't N+1 the DB.
  const profileRows = db.prepare(`SELECT user_id, profile_json FROM profiles`).all();
  const hintByUser = {};
  for (const row of profileRows) {
    try {
      const parsed = JSON.parse(row.profile_json);
      if (parsed?.displayName) hintByUser[row.user_id] = parsed.displayName;
    } catch { /* ignore */ }
  }

  return rows.map(r => {
    const persona = classifyProfile(tw[r.user_id]);
    const topTag = topTagFor(tw[r.user_id]);
    const displayName = personaDisplayName(r.user_id, tw[r.user_id], hintByUser[r.user_id]);
    return {
      user_id: r.user_id,
      display_name: displayName,
      signal_count: r.signal_count,
      session_count: r.session_count,
      last_signal_at: r.last_signal_at,
      first_signal_at: r.first_signal_at,
      profile_updated_at: r.profile_updated_at,
      persona_id: persona.id,
      persona_label: persona.label,
      top_tag: topTag,
    };
  });
}

function topTagFor(tagWeights) {
  if (!tagWeights) return null;
  let best = null;
  let bestW = -Infinity;
  for (const [t, w] of Object.entries(tagWeights)) {
    if (w > bestW) { best = t; bestW = w; }
  }
  return best ? { tag: best, weight: +bestW.toFixed(3) } : null;
}

export function userDetail(userId) {
  if (!userId) return null;

  // Existence check — distinguish "no such user" from "user with empty data"
  const profileRow = db.prepare(`SELECT profile_json, updated_at FROM profiles WHERE user_id = ?`).get(userId);
  const signalCountRow = db.prepare(`SELECT COUNT(*) AS c FROM signals WHERE user_id = ?`).get(userId);
  if (!profileRow && signalCountRow.c === 0) return null;

  // Tag weights
  const tagRows = db.prepare(`
    SELECT tag, weight FROM profile_tag_weights WHERE user_id = ? ORDER BY weight DESC
  `).all(userId);
  const tagWeights = Object.fromEntries(tagRows.map(r => [r.tag, r.weight]));

  // All signals, ordered chronologically
  const signals = db.prepare(`
    SELECT session_id, type, item_id, dwell_ms, query, page_url, ts, received_at, metadata_json
    FROM signals WHERE user_id = ? ORDER BY ts ASC
  `).all(userId).map(parseSignalRow);

  // Group by session, preserving session order by their first-seen timestamp
  const sessionMap = new Map();
  for (const s of signals) {
    const key = s.session_id || '(no-session)';
    if (!sessionMap.has(key)) {
      sessionMap.set(key, { session_id: key, started_at: s.ts, ended_at: s.ts, signals: [], pages: new Set(), types: {} });
    }
    const bucket = sessionMap.get(key);
    bucket.ended_at = Math.max(bucket.ended_at, s.ts);
    bucket.started_at = Math.min(bucket.started_at, s.ts);
    bucket.signals.push(s);
    if (s.page_url) bucket.pages.add(s.page_url);
    bucket.types[s.type] = (bucket.types[s.type] || 0) + 1;
  }
  const sessions = [...sessionMap.values()]
    .sort((a, b) => a.started_at - b.started_at)
    .map(s => ({
      ...s,
      pages: [...s.pages],
      signal_count: s.signals.length,
      duration_ms: s.ended_at - s.started_at,
    }));

  // Signal-type counts across all sessions
  const typeCounts = {};
  for (const s of signals) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;

  // Persona + recommendations
  const persona = classifyProfile(tagWeights);
  const recommendations = recommendForProfile(tagWeights, { maxResults: 6 });

  let profile = null;
  if (profileRow) {
    try { profile = JSON.parse(profileRow.profile_json); }
    catch { /* corrupt JSON shouldn't crash the detail view */ }
  }

  return {
    user_id: userId,
    profile_updated_at: profileRow ? profileRow.updated_at : null,
    profile,
    persona,
    tag_weights: tagWeights,
    type_counts: typeCounts,
    total_signals: signals.length,
    sessions,
    recommendations,
  };
}

function parseSignalRow(row) {
  let metadata = {};
  if (row.metadata_json) {
    try { metadata = JSON.parse(row.metadata_json); }
    catch { metadata = {}; }
  }
  return {
    session_id: row.session_id,
    type: row.type,
    item_id: row.item_id,
    dwell_ms: row.dwell_ms,
    query: row.query,
    page_url: row.page_url,
    ts: row.ts,
    received_at: row.received_at,
    metadata,
  };
}

const STAGE_ORDER = ['discovery', 'consideration', 'checkout', 'abandonment', 'conversion'];
const CHECKOUT_STEP_SCORE = { dates: 1, room: 2, cart: 2, guest: 3, review: 4 };

// --- Persona display names ---
//
// Maps a user's tag-weight signature to a friendly stakeholder-facing name
// like "Honeymoon Planner" instead of "user-abc12345". Templates are ordered
// by specificity (more required tags first) so a romantic-luxury-beach user
// gets "Honeymoon Planner" instead of falling through to "Luxury Beach Seeker".
//
// Each template requires ALL its tags to clear `min` weight; ties broken by
// the sum of matched weights. Name picked deterministically from `names` by
// hashing userId, so the same user always shows the same name across reloads.
const PERSONA_NAME_TEMPLATES = [
  { tags: { romantic: 2, beach: 2, luxury: 1.5 }, names: ['Honeymoon Planner', 'Romantic Escapist', 'Sun & Champagne Couple'] },
  { tags: { luxury: 2.5, beach: 2 }, names: ['Overwater Dreamer', 'Five-Star Sunseeker', 'Luxury Beach Seeker'] },
  { tags: { family: 1.8, beach: 1.5 }, names: ['Family Beach Planner', 'Sandcastle Captain', 'Kid-Friendly Voyager'] },
  { tags: { adventure: 2, nature: 1.8 }, names: ['Wilderness Explorer', 'Trail Chaser', 'Mountain Daydreamer'] },
  { tags: { adventure: 1.8, 'east-asia': 1.5 }, names: ['Far East Adventurer', 'Asia Trailblazer'] },
  { tags: { city: 2, europe: 2, culture: 1.5 }, names: ['European Culture Seeker', 'Old World Wanderer', 'Cobblestone Connoisseur'] },
  { tags: { food: 1.8, culture: 1.5 }, names: ['Culinary Wanderer', 'Foodie Globetrotter'] },
  { tags: { nightlife: 1.8, city: 1.5 }, names: ['Night Owl Nomad', 'City Glow Chaser'] },
  { tags: { budget: 2.5, 'southeast-asia': 1.5 }, names: ['Backpack Bargain Hunter', 'Budget Drifter', 'Hostel Hopper'] },
  { tags: { budget: 2.5, adventure: 1.8 }, names: ['Frugal Adventurer', 'Bargain Trailblazer'] },
  { tags: { luxury: 2, city: 1.8 }, names: ['Urban Luxe Traveler', 'Skyline Connoisseur'] },
  { tags: { beach: 2 }, names: ['Beach Daydreamer', 'Coastal Browser'] },
  { tags: { culture: 1.8 }, names: ['Culture Curious', 'Heritage Hunter'] },
  { tags: { europe: 1.8 }, names: ['Europe Window-Shopper', 'Old Continent Browser'] },
];

const FALLBACK_NAMES = [
  'Curious Explorer', 'Daydream Browser', 'Window Shopper', 'Casual Wanderer',
  'Spark Seeker', 'First-Time Visitor', 'Inspiration Hunter',
];

// Display-name overrides for seeded archetypes — set by seed.js via the
// profile snapshot's `displayName` field. When present they take precedence
// over the tag-template inference so demo archetypes read cleanly.
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickFromPool(pool, userId) {
  if (!pool || pool.length === 0) return null;
  return pool[hashStr(userId || 'anon') % pool.length];
}

export function personaDisplayName(userId, tagWeights = {}, profileHint = null) {
  if (profileHint && typeof profileHint === 'string') return profileHint;
  if (!tagWeights || Object.keys(tagWeights).length === 0) {
    return pickFromPool(FALLBACK_NAMES, userId);
  }

  let best = null;
  let bestScore = -Infinity;
  for (const template of PERSONA_NAME_TEMPLATES) {
    let matched = true;
    let score = 0;
    for (const [tag, min] of Object.entries(template.tags)) {
      const w = tagWeights[tag] || 0;
      if (w < min) { matched = false; break; }
      score += w;
    }
    if (!matched) continue;
    // Specificity bonus — templates with more required tags win ties.
    score += Object.keys(template.tags).length * 0.5;
    if (score > bestScore) { bestScore = score; best = template; }
  }
  if (best) return pickFromPool(best.names, userId);
  return pickFromPool(FALLBACK_NAMES, userId);
}

// Extract the optional displayName hint a profile snapshot may carry.
function profileDisplayNameHint(userId) {
  const row = db.prepare(`SELECT profile_json FROM profiles WHERE user_id = ?`).get(userId);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.profile_json);
    return parsed?.displayName || null;
  } catch { return null; }
}

function stageForSignal(signal) {
  if (signal.type === 'booking_complete') return 'conversion';
  if (signal.type === 'checkout_abandoned') return 'abandonment';
  if (['booking_started', 'checkout_step', 'add_to_cart'].includes(signal.type)) return 'checkout';
  if (['click', 'hover', 'view'].includes(signal.type)) return 'consideration';
  return 'discovery';
}

function labelForSignal(signal) {
  if (signal.type === 'search') return `Searched "${signal.query || ''}"`;
  if (signal.type === 'tab_view') return `Viewed tab ${signal.item_id || ''}`;
  if (signal.type === 'checkout_step') return `Reached checkout step ${signal.metadata?.funnelStep || 'unknown'}`;
  if (signal.type === 'add_to_cart') return `Added ${signal.item_id || 'item'} to cart`;
  if (signal.type === 'checkout_abandoned') return `Abandoned checkout at ${signal.metadata?.funnelStep || 'unknown'}`;
  if (signal.type === 'booking_complete') return `Completed booking for ${signal.item_id || 'item'}`;
  if (signal.item_id) return `${signal.type} ${signal.item_id}`;
  return signal.type;
}

function normalizeJourneySignal(signal) {
  const stage = stageForSignal(signal);
  return {
    type: signal.type,
    itemId: signal.item_id,
    query: signal.query,
    dwellMs: signal.dwell_ms,
    pageUrl: signal.page_url,
    ts: signal.ts,
    stage,
    label: labelForSignal(signal),
    metadata: signal.metadata || {},
  };
}

function getFunnelSummary(events) {
  let furthestStage = null;
  let furthestScore = 0;
  let abandonmentReason = null;
  let abandonedAt = null;
  let completed = false;
  let completedAt = null;

  for (const event of events) {
    const step = event.metadata?.funnelStep;
    const score = CHECKOUT_STEP_SCORE[step] || 0;
    if (score > furthestScore) {
      furthestScore = score;
      furthestStage = step;
    }
    if (event.type === 'add_to_cart' && furthestScore < CHECKOUT_STEP_SCORE.cart) {
      furthestStage = 'cart';
      furthestScore = CHECKOUT_STEP_SCORE.cart;
    }
    if (event.type === 'checkout_abandoned') {
      abandonmentReason = event.metadata?.reason || null;
      abandonedAt = event.ts;
    }
    if (event.type === 'booking_complete') {
      completed = true;
      completedAt = event.ts;
    }
  }

  return {
    furthestStage,
    completed,
    completedAt,
    abandoned: Boolean(abandonedAt && !completed),
    abandonedAt,
    abandonmentReason,
  };
}

function detectJourneyPatterns(events, sessions, funnel, tagWeights = {}) {
  const patterns = [];
  const counts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
  const clickedItems = events.filter(e => e.type === 'click' && e.itemId).map(e => e.itemId);
  const uniqueClicked = new Set(clickedItems);
  const viewedItems = events.filter(e => e.type === 'view' && e.itemId);
  const uniqueViewed = new Set(viewedItems.map(e => e.itemId));
  const searchEvents = events.filter(e => e.type === 'search' && e.query);
  const searchQueries = searchEvents.map(e => e.query.toLowerCase());
  const longHovers = events.filter(e => e.type === 'hover' && e.dwellMs >= 3000);
  const longViews = viewedItems.filter(e => e.dwellMs >= 2000);
  const bounces = sessions.filter(s => s.signal_count <= 2 && s.duration_ms < 30_000);
  const hadAbandonment = events.some(e => e.type === 'checkout_abandoned');
  const abandonReason = funnel.abandonmentReason || '';
  const luxuryAffinity = (tagWeights.luxury || 0) + (tagWeights.romantic || 0);

  // Identify "search dead-ends": a search followed by no click within 30s, then session ended.
  const deadEnds = searchEvents.filter(searchEvent => {
    const followups = events.filter(e => e.ts > searchEvent.ts && e.ts <= searchEvent.ts + 30_000);
    return followups.every(e => e.type !== 'click' && e.type !== 'view');
  });

  if (funnel.abandoned) {
    const isPriceShock = /price|rate|expensive|cost/i.test(abandonReason) || (luxuryAffinity > 4 && funnel.furthestStage === 'room');
    if (isPriceShock) {
      patterns.push({
        id: 'price_shock',
        severity: 'high',
        title: 'Price shock at room selection',
        evidence: `User reached ${funnel.furthestStage || 'room'} and abandoned${abandonReason ? ` (${abandonReason})` : ''}. Affinity for luxury suggests rate sticker-shock.`,
      });
    } else {
      patterns.push({
        id: 'cart_abandonment',
        severity: 'high',
        title: 'Checkout abandonment',
        evidence: `Dropped at ${funnel.furthestStage || 'checkout'}${abandonReason ? ` via ${abandonReason}` : ''}.`,
      });
    }
  }
  if (uniqueClicked.size >= 6 && !funnel.completed && !funnel.abandoned) {
    patterns.push({
      id: 'decision_paralysis',
      severity: 'high',
      title: 'Decision paralysis',
      evidence: `${clickedItems.length} clicks across ${uniqueClicked.size} destinations with no booking started — user is stuck comparing.`,
    });
  } else if ((uniqueClicked.size >= 3 || clickedItems.length >= 5) && !funnel.completed) {
    patterns.push({
      id: 'comparison_loop',
      severity: 'medium',
      title: 'Comparison loop',
      evidence: `${clickedItems.length} clicks across ${uniqueClicked.size} destinations without conversion.`,
    });
  }
  if (uniqueViewed.size >= 5 && longViews.length >= 3 && uniqueClicked.size < 2 && !funnel.completed) {
    patterns.push({
      id: 'comparison_fatigue',
      severity: 'medium',
      title: 'Comparison fatigue',
      evidence: `Viewed ${uniqueViewed.size} destinations with sustained attention but only ${uniqueClicked.size} click-throughs — user is browsing but not committing.`,
    });
  }
  if (deadEnds.length >= 1 && uniqueClicked.size === 0) {
    patterns.push({
      id: 'search_deadend',
      severity: 'medium',
      title: 'Search dead-end',
      evidence: `${deadEnds.length} search${deadEnds.length === 1 ? '' : 'es'} returned no engagement — likely zero-result or off-target matches.`,
    });
  } else if (searchQueries.length >= 3) {
    patterns.push({
      id: 'search_refinement',
      severity: 'medium',
      title: 'Repeated search refinement',
      evidence: `${searchQueries.length} searches indicate unresolved intent.`,
    });
  }
  if (longHovers.length >= 2 && (counts.click || 0) === 0) {
    patterns.push({
      id: 'passive_consideration',
      severity: 'low',
      title: 'Long dwell without selection',
      evidence: `${longHovers.length} long hovers with no click-through.`,
    });
  }
  if (bounces.length > 0 && !funnel.completed) {
    patterns.push({
      id: 'bounce_risk',
      severity: 'medium',
      title: 'Bounce-like session',
      evidence: `${bounces.length} session had minimal activity under 30 seconds.`,
    });
  }
  if (hadAbandonment && funnel.completed) {
    patterns.push({
      id: 'return_resume',
      severity: 'positive',
      title: 'Recovered after abandonment',
      evidence: 'User abandoned checkout in an earlier session and later returned to complete booking.',
    });
  } else if (funnel.completed) {
    patterns.push({
      id: 'converted',
      severity: 'positive',
      title: 'Converted booking journey',
      evidence: `Completed booking at ${new Date(funnel.completedAt).toISOString()}.`,
    });
  }

  return patterns;
}

function conversionStateFromFunnel(funnel, events) {
  if (funnel.completed) return 'converted';
  if (funnel.abandoned) return 'abandoned_checkout';
  if (events.some(e => e.type === 'add_to_cart')) return 'active_cart_or_hold';
  if (events.some(e => ['booking_started', 'checkout_step'].includes(e.type))) return 'checkout_started';
  if (events.some(e => e.type === 'click')) return 'considering';
  return 'exploring';
}

// Recommendation type taxonomy — exposed in the unified `recommendations`
// array so the UI can show a typed badge per item instead of forcing
// stakeholders to pick between "Growth experiment" and "A/B test" tabs.
const REC_TYPES = {
  ab_test: { label: 'A/B test', tone: 'checkout' },
  copy_test: { label: 'Copy test', tone: 'consideration' },
  recovery_email: { label: 'Recovery email', tone: 'abandonment' },
  feature_launch: { label: 'Feature launch', tone: 'discovery' },
  painted_door: { label: 'Painted-door', tone: 'consideration' },
  pricing_test: { label: 'Pricing test', tone: 'abandonment' },
  ranking_test: { label: 'Ranking test', tone: 'checkout' },
  segmented_offer: { label: 'Segmented offer', tone: 'conversion' },
};

function buildMockAiResponse(payload) {
  const patterns = payload.detectedPatterns || [];
  const has = id => patterns.includes(id);
  const topTags = payload.recommendationContext.topTags.slice(0, 3).join(', ') || 'unknown preferences';

  // --- Pain points ---
  const painPoints = [];
  if (has('price_shock')) {
    painPoints.push({
      severity: 'high',
      title: 'Price shock at room selection',
      evidence: 'User opened booking, saw the nightly rate, then abandoned at the room step.',
      likelyCause: 'Rate is anchored too high relative to the user\u2019s budget expectations, or value reinforcement is missing on the room card.',
    });
  }
  if (has('cart_abandonment') && !has('price_shock')) {
    painPoints.push({
      severity: 'high',
      title: 'Checkout flow is losing high-intent users',
      evidence: `User reached ${payload.funnel.furthestStage || 'checkout'} and abandoned before booking.`,
      likelyCause: 'Form friction, missing reassurance, or rate uncertainty near checkout.',
    });
  }
  if (has('decision_paralysis')) {
    painPoints.push({
      severity: 'high',
      title: 'User is stuck comparing without committing',
      evidence: 'Many destinations opened, but no booking started — classic paralysis of choice.',
      likelyCause: 'Cards lack a "best for you" cue strong enough to break the tie.',
    });
  }
  if (has('comparison_loop') && !has('decision_paralysis')) {
    painPoints.push({
      severity: 'medium',
      title: 'User is comparing without a clear decision aid',
      evidence: 'Multiple destination clicks happened without conversion.',
      likelyCause: 'Cards and modal details may not expose enough differentiators for fast choice.',
    });
  }
  if (has('comparison_fatigue')) {
    painPoints.push({
      severity: 'medium',
      title: 'Browsing fatigue — long views, no clicks',
      evidence: 'User dwelled on many destinations but rarely opened details.',
      likelyCause: 'Grid is engaging but the click-through promise (price, availability, "why this one") is unclear.',
    });
  }
  if (has('search_deadend')) {
    painPoints.push({
      severity: 'medium',
      title: 'Search returned nothing the user wanted',
      evidence: 'Searches had no follow-up clicks within 30 seconds.',
      likelyCause: 'Either zero-result queries or search ranking is mismatched to intent.',
    });
  }
  if (has('search_refinement') && !has('search_deadend')) {
    painPoints.push({
      severity: 'medium',
      title: 'Repeated search refinement',
      evidence: 'Multiple search queries indicate unresolved intent.',
      likelyCause: 'First-page results are not specific enough to the user\u2019s actual goal.',
    });
  }
  if (has('bounce_risk')) {
    painPoints.push({
      severity: 'medium',
      title: 'Early-session bounce risk',
      evidence: 'At least one session had very low activity and short duration.',
      likelyCause: 'Landing content may not quickly align to user intent.',
    });
  }
  if (painPoints.length === 0) {
    painPoints.push({
      severity: 'low',
      title: 'No severe friction detected',
      evidence: 'Journey shows exploration without an obvious abandonment signature.',
      likelyCause: 'More signals may be needed before a strong diagnosis.',
    });
  }

  // --- Unified recommendations: each item carries a `type` so the UI shows
  //     a single list with typed badges instead of two parallel sections.
  const recommendations = [];

  if (has('price_shock')) {
    recommendations.push({
      type: 'pricing_test',
      title: 'Rate transparency on room cards',
      hypothesis: 'Showing per-night vs total-stay price plus a "rate locked for 24h" badge will reduce room-step abandonment.',
      targetSegment: 'Users who reach room-selection and abandon within 60s',
      primaryMetric: 'room_step_to_guest_step_rate',
      guardrailMetrics: ['booking_completion_rate', 'average_order_value'],
      confidence: 'high',
    });
    recommendations.push({
      type: 'recovery_email',
      title: 'Same-rate hold email',
      hypothesis: 'Emailing the user "your rate is held for 24 hours" recovers a meaningful slice of price-shocked abandoners.',
      targetSegment: 'Authenticated users who abandoned at room or guest step',
      primaryMetric: 'recovery_email_booking_rate',
      guardrailMetrics: ['unsubscribe_rate'],
      confidence: 'medium',
    });
  }
  if (has('cart_abandonment') || has('price_shock')) {
    recommendations.push({
      type: 'feature_launch',
      title: 'Personalized resume module',
      hypothesis: 'A persistent resume card with saved room, rate, and dates increases checkout recovery.',
      targetSegment: 'Returning users with an abandoned cart',
      primaryMetric: 'checkout_resume_rate',
      guardrailMetrics: ['booking_completion_rate', 'cart_clear_rate'],
      confidence: 'high',
    });
    recommendations.push({
      type: 'ab_test',
      title: 'Checkout reassurance variants',
      hypothesis: 'Adding cancellation policy + rate-hold timer in the checkout footer reduces abandonment.',
      variants: [
        { id: 'control', description: 'Existing checkout footer' },
        { id: 'variant_a', description: 'Cancellation reassurance + rate-hold timer' },
        { id: 'variant_b', description: 'Variant A plus social proof for the selected hotel' },
      ],
      primaryMetric: 'booking_complete_rate',
      guardrailMetrics: ['checkout_step_error_rate', 'average_order_value'],
      confidence: 'high',
    });
  }
  if (has('decision_paralysis') || has('comparison_loop') || has('comparison_fatigue')) {
    recommendations.push({
      type: 'copy_test',
      title: '\u201CBest for you\u201D badges on cards',
      hypothesis: 'A single highlighted card with reason-based copy ("Matches your luxury beach interest") breaks the comparison loop.',
      targetSegment: 'Users with 3+ destination clicks in a single session',
      primaryMetric: 'card_click_to_booking_start_rate',
      guardrailMetrics: ['time_to_first_click', 'modal_close_rate'],
      confidence: 'medium',
    });
    recommendations.push({
      type: 'ranking_test',
      title: 'For You ranking with abandonment-first',
      hypothesis: 'Pinning the abandoned booking above generic recs lifts return conversion.',
      variants: [
        { id: 'control', description: 'Score-based recommendation ranking' },
        { id: 'variant_a', description: 'Abandoned booking pinned as first card' },
        { id: 'variant_b', description: 'Variant A plus discount/benefit messaging' },
      ],
      primaryMetric: 'resume_booking_click_rate',
      guardrailMetrics: ['recommendation_click_rate'],
      confidence: 'high',
    });
  }
  if (has('search_deadend') || has('search_refinement')) {
    recommendations.push({
      type: 'feature_launch',
      title: 'Zero-result fallback recommendations',
      hypothesis: 'When search returns nothing, surface 3 inferred-intent picks instead of an empty state.',
      targetSegment: 'Sessions where a search has no click within 30s',
      primaryMetric: 'post_search_click_rate',
      guardrailMetrics: ['search_session_bounce_rate'],
      confidence: 'medium',
    });
    recommendations.push({
      type: 'painted_door',
      title: 'Natural-language search prompt',
      hypothesis: 'Users are typing intent phrases ("romantic europe under $200"); a smarter parser surfaces matches faster.',
      targetSegment: 'Users issuing 3+ searches per session',
      primaryMetric: 'painted_door_click_rate',
      guardrailMetrics: [],
      confidence: 'low',
    });
  }
  if (has('bounce_risk')) {
    recommendations.push({
      type: 'copy_test',
      title: 'Hero headline aligned to inferred intent',
      hypothesis: 'A first-second headline that matches the user\u2019s top tag reduces immediate bounce.',
      targetSegment: 'First-time visitors with at least one prior signal in localStorage',
      primaryMetric: 'first_minute_engagement_rate',
      guardrailMetrics: ['hero_search_click_rate'],
      confidence: 'medium',
    });
  }
  if (has('return_resume')) {
    recommendations.push({
      type: 'segmented_offer',
      title: 'Loyalty nudge for returners-who-converted',
      hypothesis: 'Users who came back to finish are prime candidates for a loyalty-tier upsell.',
      targetSegment: 'Users with abandonment-then-conversion in the same week',
      primaryMetric: 'loyalty_signup_rate',
      guardrailMetrics: ['post_booking_churn_rate'],
      confidence: 'medium',
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'feature_launch',
      title: 'Capture more high-signal events',
      hypothesis: 'Adding rage-click and scroll-depth tracking would surface friction we currently cannot see.',
      targetSegment: 'All sessions',
      primaryMetric: 'instrumented_signal_coverage',
      guardrailMetrics: [],
      confidence: 'low',
    });
  }

  // Decorate with the human-readable label for the badge.
  for (const rec of recommendations) {
    const meta = REC_TYPES[rec.type] || { label: 'Experiment', tone: 'discovery' };
    rec.typeLabel = meta.label;
    rec.typeTone = meta.tone;
  }

  // Back-compat: keep the old shape populated so any older consumer keeps
  // working. New UI should prefer `recommendations`.
  const experiments = recommendations.filter(r => !r.variants).map(r => ({
    title: r.title, hypothesis: r.hypothesis, targetSegment: r.targetSegment,
    primaryMetric: r.primaryMetric, guardrailMetrics: r.guardrailMetrics, confidence: r.confidence,
  }));
  const abTests = recommendations.filter(r => r.variants).map(r => ({
    name: r.title, hypothesis: r.hypothesis, variants: r.variants,
    primaryMetric: r.primaryMetric, guardrailMetrics: r.guardrailMetrics,
  }));

  return {
    summary: `This user appears to be in a ${payload.journeySummary.conversionState.replace(/_/g, ' ')} state with strongest affinity around ${topTags}. The next best growth move is to reduce decision friction and add contextual reassurance at the most advanced funnel stage reached.`,
    painPoints,
    recommendations,
    experiments,
    abTests,
    instrumentationGaps: [
      'Capture field-level validation errors in checkout forms.',
      'Capture modal close source and time-on-step for each checkout step.',
      'Capture experiment assignment once real A/B/n infrastructure is connected.',
    ],
  };
}

export function userJourneyAnalysis(userId) {
  const detail = userDetail(userId);
  if (!detail) return null;

  const normalizedSessions = detail.sessions.map(session => {
    const events = session.signals.map(normalizeJourneySignal);
    return {
      sessionId: session.session_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationMs: session.duration_ms,
      pages: session.pages,
      signalCount: session.signal_count,
      stages: [...new Set(events.map(e => e.stage))],
      events,
    };
  });
  const events = normalizedSessions.flatMap(s => s.events);
  const funnel = getFunnelSummary(events);
  const detected = detectJourneyPatterns(events, detail.sessions, funnel, detail.tag_weights);
  const topTags = Object.entries(detail.tag_weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, weight]) => ({ tag, weight: +weight.toFixed(3) }));
  const firstSeenAt = normalizedSessions[0]?.startedAt || null;
  const lastSeenAt = normalizedSessions.at(-1)?.endedAt || null;

  const displayName = personaDisplayName(
    detail.user_id,
    detail.tag_weights,
    profileDisplayNameHint(detail.user_id),
  );

  const payload = {
    userId: detail.user_id,
    displayName,
    persona: detail.persona,
    journeySummary: {
      sessions: normalizedSessions.length,
      firstSeenAt,
      lastSeenAt,
      totalSignals: detail.total_signals,
      conversionState: conversionStateFromFunnel(funnel, events),
    },
    funnel,
    signals: events.map(e => ({
      type: e.type,
      itemId: e.itemId,
      query: e.query,
      ts: e.ts,
      stage: e.stage,
      metadata: e.metadata,
    })),
    detectedPatterns: detected.map(p => p.id),
    recommendationContext: {
      topTags: topTags.map(t => t.tag),
      topRecommendations: detail.recommendations.map(r => r.name),
    },
  };

  return {
    user_id: detail.user_id,
    display_name: displayName,
    persona: detail.persona,
    journey_summary: payload.journeySummary,
    funnel,
    sessions: normalizedSessions,
    type_counts: detail.type_counts,
    tag_weights: detail.tag_weights,
    recommendations: detail.recommendations,
    pain_points: detected,
    genai_payload: payload,
    mock_ai_response: buildMockAiResponse(payload),
  };
}

// Aggregate friction across all users — runs the per-user pattern detector
// against every user with signals and counts how many users exhibit each
// pattern. Used by /api/analytics/friction to show the "across all users"
// strip at the top of the Journey Observatory, so judges immediately see
// systemic value (not just per-user analysis).
//
// Cost is O(users * signals) and fully in-memory; fine at hackathon scale
// (tens of users, low thousands of signals). Cache at the HTTP layer if it
// ever becomes a hot path.
const FRICTION_PATTERN_META = {
  cart_abandonment:     { label: 'Checkout abandonments', tone: 'abandonment' },
  price_shock:          { label: 'Price-shock exits',     tone: 'abandonment' },
  decision_paralysis:   { label: 'Decision paralysis',    tone: 'consideration' },
  comparison_loop:      { label: 'Comparison loops',      tone: 'consideration' },
  comparison_fatigue:   { label: 'Browsing fatigue',      tone: 'consideration' },
  search_deadend:       { label: 'Search dead-ends',      tone: 'consideration' },
  search_refinement:    { label: 'Search refinement',     tone: 'consideration' },
  bounce_risk:          { label: 'Bounce risk',           tone: 'discovery' },
  passive_consideration:{ label: 'Long dwell, no click',  tone: 'discovery' },
  return_resume:        { label: 'Recovered after abandon', tone: 'conversion' },
  converted:            { label: 'Completed bookings',    tone: 'conversion' },
};

export function aggregateFriction() {
  const userRows = db.prepare(`SELECT DISTINCT user_id FROM signals`).all();
  const counts = Object.fromEntries(
    Object.keys(FRICTION_PATTERN_META).map(id => [id, 0])
  );
  let usersAnalyzed = 0;
  let usersWithFriction = 0;

  for (const { user_id } of userRows) {
    const analysis = userJourneyAnalysis(user_id);
    if (!analysis) continue;
    usersAnalyzed++;
    const ids = analysis.pain_points.map(p => p.id);
    const hasNonPositive = analysis.pain_points.some(p => p.severity !== 'positive');
    if (hasNonPositive) usersWithFriction++;
    for (const id of ids) {
      if (counts[id] != null) counts[id]++;
    }
  }

  // Order: friction patterns first (most users affected), then positives
  const items = Object.entries(counts)
    .map(([id, count]) => ({
      id,
      label: FRICTION_PATTERN_META[id].label,
      tone: FRICTION_PATTERN_META[id].tone,
      count,
      pct: usersAnalyzed ? +((count / usersAnalyzed) * 100).toFixed(1) : 0,
    }))
    .filter(x => x.count > 0)
    .sort((a, b) => {
      // Positives go to the right; otherwise descending count.
      const aPos = a.tone === 'conversion' ? 1 : 0;
      const bPos = b.tone === 'conversion' ? 1 : 0;
      if (aPos !== bPos) return aPos - bPos;
      return b.count - a.count;
    });

  return {
    users_analyzed: usersAnalyzed,
    users_with_friction: usersWithFriction,
    pct_with_friction: usersAnalyzed ? +((usersWithFriction / usersAnalyzed) * 100).toFixed(1) : 0,
    items,
  };
}

export function summary() {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM signals)                              AS total_signals,
      (SELECT COUNT(DISTINCT user_id) FROM signals)               AS unique_users,
      (SELECT COUNT(*) FROM profiles)                             AS profiles_stored,
      (SELECT MAX(received_at) FROM signals)                      AS last_signal_at
  `).get();
  return row;
}
