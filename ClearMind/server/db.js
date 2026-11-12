// Lightweight JSON-file data store (data tier).
//
// Why a JSON file and not Postgres/Firestore: the Operational NFR says ClearMind
// is deployed and maintained by the team with no dedicated operations staff, and
// the Space NFR budgets < 10KB per check-in for ~100 students over one semester.
// A single JSON document stays well inside that and keeps the project runnable
// with `npm install && npm start` - no database server, no cloud credentials.
// The module exposes a narrow read/write API so swapping in a real database
// later only touches this file.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.CLEARMIND_DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'clearmind.json');

const EMPTY_DB = {
  users: [],
  checkIns: [],
  weeklyReports: [],
  practitioners: [],
  schoolResources: [],
  connectionRequests: [], // FR-7: practitioner -> student outreach
  auditLog: [],
};

let cache = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function read() {
  if (cache) return cache;
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    cache = JSON.parse(JSON.stringify(EMPTY_DB));
    write(cache);
    return cache;
  }
  try {
    cache = { ...EMPTY_DB, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  } catch (err) {
    // Reliability NFR: a corrupt store must not take the whole service down.
    console.error('[db] could not parse data file, starting empty:', err.message);
    cache = JSON.parse(JSON.stringify(EMPTY_DB));
  }
  return cache;
}

function write(next) {
  ensureDir();
  cache = next;
  // Write to a temp file then rename, so a crash mid-write cannot leave a
  // half-written store behind (Reliability NFR: no submitted check-in is lost).
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

/** Run a mutation against the store and persist the result. */
function update(mutator) {
  const db = read();
  const result = mutator(db);
  write(db);
  return result;
}

/** Reset the store - used by seed.js and by the API test suite. */
function reset() {
  write(JSON.parse(JSON.stringify(EMPTY_DB)));
}

let counter = 0;
/** Short unique id. Date + counter is enough for a single-process app. */
function newId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * Legislative-Security NFR: the HIPAA Security Rule expects access to health
 * data to be logged. Every read or write of a student's check-in data records
 * who did it and when.
 */
function audit(actorId, action, detail = '') {
  update((db) => {
    db.auditLog.push({
      id: newId('log'),
      actorId,
      action,
      detail,
      at: new Date().toISOString(),
    });
    // Keep the log bounded so the file stays inside the Space NFR budget.
    if (db.auditLog.length > 5000) db.auditLog.splice(0, db.auditLog.length - 5000);
  });
}

module.exports = { read, write, update, reset, newId, audit, DATA_FILE };
