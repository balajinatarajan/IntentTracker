// Analytics backend for IntentTracker.
//
// Serves the existing static site (so the demo pages and dashboard.html share
// the same origin as /api/* — no CORS) and exposes:
//   POST /api/ingest                    -- batched signals + profile snapshot
//   GET  /api/analytics/top-tags        -- aggregate tag weights across users
//   GET  /api/analytics/signal-volume   -- time-series counts per signal type
//   GET  /api/analytics/summary         -- totals for the dashboard header
//   GET  /api/health
//
// Run with: cd server && npm install && npm start

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ingest, topTags, signalVolume, summary, userTypes, topRecommendations, listUsers, userDetail, userJourneyAnalysis } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 8090;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1):(8080|8090)$/.test(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// sendBeacon sets Content-Type: application/json with the Blob trick; raw
// fetch fallback also uses JSON. A 1MB cap is plenty for a batch.
app.use(express.json({ limit: '1mb', type: ['application/json', 'text/plain'] }));

// --- Static site (demo pages + dashboard.html live at the repo root) ---
app.use(express.static(repoRoot, { extensions: ['html'] }));

// --- Ingestion ---
app.post('/api/ingest', (req, res) => {
  // sendBeacon with a Blob arrives as application/json and is already parsed.
  // But some browsers send it as text/plain — handle that too.
  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); }
    catch { return res.status(400).json({ error: 'invalid JSON' }); }
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'empty payload' });
  }

  try {
    const result = ingest(payload);
    if (result.error) return res.status(400).json(result);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[ingest] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Analytics ---
app.get('/api/analytics/top-tags', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  res.json({ tags: topTags(limit) });
});

app.get('/api/analytics/signal-volume', (req, res) => {
  const hours = Math.min(parseInt(req.query.hours, 10) || 24, 24 * 30);
  const bucketMs = parseInt(req.query.bucketMs, 10) || 3600_000;
  const sinceMs = Date.now() - hours * 3600_000;
  res.json({ rows: signalVolume({ sinceMs, bucketMs }), bucketMs, sinceMs });
});

app.get('/api/analytics/summary', (req, res) => {
  res.json(summary());
});

app.get('/api/analytics/user-types', (req, res) => {
  res.json(userTypes());
});

app.get('/api/analytics/top-recommendations', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const perUser = Math.min(parseInt(req.query.perUser, 10) || 6, 20);
  res.json(topRecommendations({ limit, perUser }));
});

// --- Per-user drill-down ---
app.get('/api/users', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const search = (req.query.search || '').toString().trim();
  res.json({ users: listUsers({ limit, search }) });
});

app.get('/api/users/:userId', (req, res) => {
  const u = userDetail(req.params.userId);
  if (!u) return res.status(404).json({ error: 'user not found' });
  res.json(u);
});

app.get('/api/users/:userId/journey', (req, res) => {
  const u = userJourneyAnalysis(req.params.userId);
  if (!u) return res.status(404).json({ error: 'user not found' });
  res.json(u);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[analytics] http://localhost:${PORT}`);
  console.log(`[analytics] dashboard: http://localhost:${PORT}/dashboard.html`);
});
