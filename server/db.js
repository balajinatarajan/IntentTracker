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

// --- Prepared statements ---
const insertSignal = db.prepare(`
  INSERT INTO signals (user_id, session_id, type, item_id, dwell_ms, query, page_url, ts, received_at)
  VALUES (@user_id, @session_id, @type, @item_id, @dwell_ms, @query, @page_url, @ts, @received_at)
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
      item_id:     s.itemId || null,
      dwell_ms:    s.dwellMs == null ? null : s.dwellMs,
      query:       s.query || null,
      page_url:    pageUrl || null,
      ts:          s.timestamp || receivedAt,
      received_at: receivedAt,
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

  return rows.map(r => {
    const persona = classifyProfile(tw[r.user_id]);
    const topTag = topTagFor(tw[r.user_id]);
    return {
      user_id: r.user_id,
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
    SELECT session_id, type, item_id, dwell_ms, query, page_url, ts, received_at
    FROM signals WHERE user_id = ? ORDER BY ts ASC
  `).all(userId);

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
