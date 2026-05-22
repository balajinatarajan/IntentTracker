# IntentTracker — Wanderlust demo

Hackathon demo for **intent-aware travel**: the homepage tracks browsing signals,
surfaces personalized recommendations (including cart abandonment recovery), and
feeds an analytics backend that powers the business and journey dashboards.

## Quick start (hackathon demo)

From the repo root:

```sh
cd server
npm install
node reset-db.js && node seed.js   # required on a fresh clone — see below
npm start                          # http://localhost:8090
```

Then open:

| URL | What it is |
|-----|------------|
| http://localhost:8090/ | Wanderlust homepage (For You, cart, booking flow) |
| http://localhost:8090/journey-dashboard.html | Journey Observatory — per-user friction & recs |
| http://localhost:8090/dashboard.html | Business analytics aggregates |

**Use the Node server on `:8090`.** A plain static server (e.g. Python on `:8080`) will load the UI but the dashboards stay empty because `/api/*` is not available.

### Fresh clone? Seed first

`server/data/` (the SQLite database) is **gitignored**. A new checkout has no demo
users until you run the seed scripts. The server does **not** auto-seed on startup.

```sh
node server/reset-db.js   # wipe any local data from prior runs
node server/seed.js       # 9 curated user archetypes for the demo
```

See [server/README.md](server/README.md) for endpoint docs, emission wiring, and
storage details.

## Project layout

| Path | Role |
|------|------|
| `index.html`, `js/app2.js` | Homepage + For You recommendations |
| `cart.html`, `js/cart-app.js` | Cart / booking recovery |
| `journey-dashboard.html` | Per-user journey observatory |
| `dashboard.html` | Business analytics |
| `lib/src/` | IntentTracker core (rebuild with `cd lib && node build.js`) |
| `server/` | Express + SQLite analytics backend |
