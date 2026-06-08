// Seeds (or migrates) the SQLite database from data/questions.json + data/tests.json.
// Idempotent: safe to run on every container start. Never deletes runs/users.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'quiz.db');
const DATA = path.join(__dirname, 'data');

// Optional initial users, supplied as JSON via the SEED_USERS env var, e.g.
//   SEED_USERS='[{"email":"alex@example.com","name":"Alex","role":"admin"}]'
// This is optional: any allowed email is auto-created on first sign-in, and admins
// are determined by ADMIN_EMAILS. Use SEED_USERS only to pre-set friendly names.
let SEED_USERS = [];
try {
  SEED_USERS = JSON.parse(process.env.SEED_USERS || '[]');
  if (!Array.isArray(SEED_USERS)) SEED_USERS = [];
} catch (e) {
  console.warn('[seed] SEED_USERS is not valid JSON — ignoring.');
  SEED_USERS = [];
}

function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      role  TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      category TEXT NOT NULL,
      text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tests (
      n INTEGER PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS test_questions (
      test_n INTEGER NOT NULL,
      position INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      PRIMARY KEY (test_n, position)
    );
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      test_n INTEGER NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      answers_json TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_runs_email ON runs(email);
  `);

  // Users: insert if missing; keep admin role for datbird, don't clobber a manually-changed name.
  const upUser = db.prepare(
    `INSERT INTO users (email,name,role) VALUES (@email,@name,@role)
     ON CONFLICT(email) DO UPDATE SET role=excluded.role`
  );
  const tx1 = db.transaction(() => SEED_USERS.forEach(u => upUser.run(u)));
  tx1();

  // Questions: full refresh (content is canonical from JSON).
  const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'));
  const tests = JSON.parse(fs.readFileSync(path.join(DATA, 'tests.json'), 'utf8'));
  const insQ = db.prepare(
    `INSERT INTO questions (id,category,text,options_json,correct_index)
     VALUES (@id,@category,@text,@options_json,@correct_index)
     ON CONFLICT(id) DO UPDATE SET category=excluded.category, text=excluded.text,
       options_json=excluded.options_json, correct_index=excluded.correct_index`
  );
  const insT = db.prepare(`INSERT OR IGNORE INTO tests (n) VALUES (?)`);
  const insTQ = db.prepare(
    `INSERT INTO test_questions (test_n,position,question_id) VALUES (?,?,?)
     ON CONFLICT(test_n,position) DO UPDATE SET question_id=excluded.question_id`
  );
  const tx2 = db.transaction(() => {
    for (const q of questions)
      insQ.run({ id: q.id, category: q.category, text: q.text,
                 options_json: JSON.stringify(q.options), correct_index: q.correct_index });
    for (const t of tests) {
      insT.run(t.n);
      t.question_ids.forEach((qid, i) => insTQ.run(t.n, i, qid));
    }
  });
  tx2();

  const nq = db.prepare('SELECT COUNT(*) c FROM questions').get().c;
  const nt = db.prepare('SELECT COUNT(*) c FROM tests').get().c;
  const nu = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  console.log(`[seed] db=${DB_PATH} users=${nu} questions=${nq} tests=${nt}`);
  db.close();
}

main();
