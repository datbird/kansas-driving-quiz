// Kansas driving quiz — Express + better-sqlite3.
// Identity comes from Cloudflare Access (Cf-Access-Authenticated-User-Email header).
// Admins (listed in the ADMIN_EMAILS env) can see every user's run counts and scores.
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'quiz.db');
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
// DEV_EMAIL lets you run locally without Cloudflare Access in front.
const DEV_EMAIL = process.env.DEV_EMAIL || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const db = new Database(DB_PATH, { fileMustExist: false });
db.pragma('journal_mode = WAL');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.disable('x-powered-by');

// Health check must be reachable without an Access header (Docker/Unraid probe it directly).
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---- identity middleware ----
function isAdmin(email) { return ADMIN_EMAILS.includes((email || '').toLowerCase()); }

app.use((req, res, next) => {
  // Cloudflare Access injects the verified email. Header name is case-insensitive.
  let email = req.get('Cf-Access-Authenticated-User-Email') || DEV_EMAIL || '';
  email = email.trim().toLowerCase();
  if (!email) {
    return res.status(401).json({ error: 'No authenticated identity. This app must sit behind Cloudflare Access.' });
  }
  // Auto-provision any Access-allowed email we have not seen before.
  let user = db.prepare('SELECT email,name,role FROM users WHERE email=?').get(email);
  if (!user) {
    const name = email.split('@')[0];
    const role = isAdmin(email) ? 'admin' : 'user';
    db.prepare('INSERT INTO users (email,name,role) VALUES (?,?,?)').run(email, name, role);
    user = { email, name, role };
  }
  if (isAdmin(email) && user.role !== 'admin') {
    db.prepare('UPDATE users SET role=? WHERE email=?').run('admin', email);
    user.role = 'admin';
  }
  req.user = user;
  next();
});

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

// ---- API ----
app.get('/api/me', (req, res) => res.json(req.user));

// Per-category quota for a freshly generated practice test. Sums to 25 (one full
// exam). Every section is represented (>=1); the heavily-tested topics get 2.
const QUOTA = {
  'Sign Identification': 2,
  'Sign Shapes & Colors': 2,
  'Specific Signs': 2,
  'Traffic Signals': 2,
  'Right-of-Way': 2,
  'Speed & Speed Limits': 2,
  'Pavement Markings': 1,
  'Sharing the Road': 1,
  'License, Permits & Rules': 1,
  'Following & Stopping Distance': 1,
  'Passing': 1,
  'Alcohol, Drugs & Distraction': 1,
  'Seat Belts & Child Safety': 1,
  'Parking': 1,
  'School Buses & Stopping': 1,
  'Visual Search & Communicating': 1,
  'Before Driving & Vehicle Control': 1,
  'Night, Weather & Emergencies': 1,
  'Hand Signals': 1,
};
const TEST_SIZE = Object.values(QUOTA).reduce((a, b) => a + b, 0);

const pickByCat = db.prepare(
  `SELECT id, category, text, options_json, image FROM questions
   WHERE category = ? ORDER BY RANDOM() LIMIT ?`);

function generatePractice() {
  const picked = [];
  for (const [cat, n] of Object.entries(QUOTA)) picked.push(...pickByCat.all(cat, n));
  // shuffle the combined set so categories are interleaved
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.map(r => ({
    id: r.id, category: r.category, text: r.text, options: JSON.parse(r.options_json),
    image: r.image || null,
  }));
}

// Quick per-user summary for the home screen.
app.get('/api/stats', (req, res) => {
  const a = db.prepare(
    `SELECT COUNT(*) runs, MAX(score) best, ROUND(AVG(score),1) avg,
            SUM(CASE WHEN score>=20 THEN 1 ELSE 0 END) passes, MAX(finished_at) last
     FROM runs WHERE email=?`).get(req.user.email);
  res.json({ runs: a.runs || 0, best: a.best, avg: a.avg, passes: a.passes || 0, last: a.last, size: TEST_SIZE });
});

// Generate a fresh random practice test (no correct answers in the payload).
app.get('/api/practice', (req, res) => {
  res.json({ size: TEST_SIZE, questions: generatePractice() });
});

// Grade a practice submission (ordered responses), store the run, return review.
app.post('/api/practice/submit', (req, res) => {
  const responses = Array.isArray(req.body && req.body.responses) ? req.body.responses : [];
  const startedAt = (req.body && req.body.started_at) || null;
  const ids = responses.map(r => parseInt(r.id, 10)).filter(Number.isInteger);
  if (!ids.length) return res.status(400).json({ error: 'No answers submitted.' });

  const rows = db.prepare(
    `SELECT id, text, options_json, correct_index, image FROM questions
     WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const byId = new Map(rows.map(r => [r.id, r]));

  let score = 0;
  const results = [];
  for (const resp of responses) {
    const q = byId.get(parseInt(resp.id, 10));
    if (!q) continue;
    const chosen = Number.isInteger(resp.choice) ? resp.choice : null;
    const correct = chosen === q.correct_index;
    if (correct) score++;
    results.push({
      id: q.id, text: q.text, options: JSON.parse(q.options_json), image: q.image || null,
      your: chosen, correct_index: q.correct_index, correct,
    });
  }
  const total = results.length;
  db.prepare(
    `INSERT INTO runs (email,test_n,score,total,answers_json,started_at)
     VALUES (?,0,?,?,?,?)`
  ).run(req.user.email, score, total, JSON.stringify(responses), startedAt);

  res.json({ score, total, passed: score >= Math.ceil(total * 0.8), results });
});

// Current user's run history.
app.get('/api/history', (req, res) => {
  const rows = db.prepare(
    `SELECT id, test_n, score, total, finished_at
     FROM runs WHERE email=? ORDER BY finished_at DESC, id DESC LIMIT 200`).all(req.user.email);
  res.json(rows);
});

// ---- admin ----
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT email,name,role FROM users ORDER BY role DESC, name').all();
  const agg = db.prepare(
    `SELECT COUNT(*) runs, MAX(score) best, ROUND(AVG(score),1) avg,
            MAX(finished_at) last, SUM(CASE WHEN score>=20 THEN 1 ELSE 0 END) passes
     FROM runs WHERE email=?`);
  const out = users.map(u => {
    const a = agg.get(u.email);
    return {
      email: u.email, name: u.name, role: u.role,
      runs: a.runs || 0, best: a.best, avg: a.avg, passes: a.passes || 0, last: a.last,
    };
  });
  res.json(out);
});

app.get('/api/admin/user/:email/runs', requireAdmin, (req, res) => {
  const email = String(req.params.email).toLowerCase();
  const rows = db.prepare(
    `SELECT id, test_n, score, total, finished_at
     FROM runs WHERE email=? ORDER BY finished_at DESC, id DESC LIMIT 500`).all(email);
  res.json(rows);
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, HOST, () => {
  console.log(`[server] KS quiz on http://${HOST}:${PORT}  db=${DB_PATH}  admins=${ADMIN_EMAILS.join(',')}`);
});
