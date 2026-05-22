// Wipe the analytics DB and reset the schema. Used before reseeding so the
// demo has exactly the curated archetype gallery and no leftover random
// users from previous seed runs.
//
// Usage: node server/reset-db.js

import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'analytics.db');
const db = new Database(dbPath);

db.exec(`
  DELETE FROM signals;
  DELETE FROM profiles;
  DELETE FROM profile_tag_weights;
  VACUUM;
`);

const counts = {
  signals: db.prepare('SELECT COUNT(*) AS c FROM signals').get().c,
  profiles: db.prepare('SELECT COUNT(*) AS c FROM profiles').get().c,
  tags: db.prepare('SELECT COUNT(*) AS c FROM profile_tag_weights').get().c,
};

console.log('Wiped analytics.db. Remaining rows:', counts);
console.log('Next step: node server/seed.js   (creates the curated archetype gallery)');
db.close();
