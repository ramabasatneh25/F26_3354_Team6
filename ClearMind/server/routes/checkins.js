// Check-in routes - FR-1, FR-2, FR-3, FR-6 (UC-1, UC-2).

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { assessRisk, riskReasons, getCrisisResources } = require('../services/crisisService');
const { generateFeedback } = require('../services/feedbackEngine');

const router = express.Router();

/** A student's own check-ins, newest first. Security NFR: scoped by token. */
function historyFor(studentId) {
  return db
    .read()
    .checkIns.filter((c) => c.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// POST /api/checkins - UC-1 Complete Mental Health Check-In
router.post('/', requireAuth, requireRole('student'), (req, res) => {
  const { moodScore, stressLevel, sleepHours, thoughts = '' } = req.body || {};

  const candidate = { moodScore, stressLevel };

  // UC-1 step 3: validate before saving. assessRisk throws on anything outside
  // [1-10] or non-numeric, so it doubles as the validator for both fields.
  let crisisFlagged;
  try {
    crisisFlagged = assessRisk(candidate);
  } catch (err) {
    return res.status(400).json({
      error: 'Mood and stress must both be numbers between 1 and 10.',
      detail: err.message,
    });
  }

  if (sleepHours !== undefined && sleepHours !== null && sleepHours !== '') {
    const hours = Number(sleepHours);
    if (Number.isNaN(hours) || hours < 0 || hours > 24) {
      return res.status(400).json({ error: 'Sleep hours must be between 0 and 24.' });
    }
  }

  if (String(thoughts).length > 5000) {
    // Space NFR: keeps a check-in record under 10KB.
    return res.status(400).json({ error: 'Please keep your notes under 5000 characters.' });
  }

  const history = historyFor(req.user.id);

  const checkIn = {
    id: db.newId('chk'),
    studentId: req.user.id,
    timestamp: new Date().toISOString(),
    moodScore: Number(moodScore),
    stressLevel: Number(stressLevel),
    sleepHours:
      sleepHours === undefined || sleepHours === null || sleepHours === ''
        ? null
        : Number(sleepHours),
    thoughts: String(thoughts).trim(),
    crisisFlagged,
  };

  db.update((data) => data.checkIns.push(checkIn));
  db.audit(req.user.id, 'checkin.create', checkIn.id);

  // FR-2: feedback generated from this entry plus past trends.
  const feedback = generateFeedback(checkIn, history);

  // FR-6 / UC-1 A1: a flagged check-in returns crisis resources with it so the
  // client can show the unskippable alert before anything else (Safety NFR).
  const crisis = crisisFlagged
    ? {
        flagged: true,
        reasons: riskReasons(checkIn),
        resources: getCrisisResources(),
      }
    : { flagged: false, reasons: [], resources: [] };

  return res.status(201).json({ checkIn, feedback, crisis });
});

// GET /api/checkins?from=YYYY-MM-DD&to=YYYY-MM-DD  - FR-3, UC-2 A1 filter by date
router.get('/', requireAuth, requireRole('student'), (req, res) => {
  const { from, to } = req.query;
  let results = historyFor(req.user.id);

  if (from) {
    const start = new Date(`${from}T00:00:00.000Z`);
    results = results.filter((c) => new Date(c.timestamp) >= start);
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999Z`);
    results = results.filter((c) => new Date(c.timestamp) <= end);
  }

  db.audit(req.user.id, 'checkin.list', `count=${results.length}`);
  return res.json({ checkIns: results });
});

// DELETE /api/checkins/:id  - UC-2 A2 Remove My Data (Legislative-Privacy NFR)
router.delete('/:id', requireAuth, requireRole('student'), (req, res) => {
  const removed = db.update((data) => {
    const index = data.checkIns.findIndex(
      (c) => c.id === req.params.id && c.studentId === req.user.id
    );
    if (index === -1) return null;
    return data.checkIns.splice(index, 1)[0];
  });

  if (!removed) return res.status(404).json({ error: 'That check-in was not found.' });

  db.audit(req.user.id, 'checkin.delete', req.params.id);
  return res.json({ deleted: removed.id });
});

module.exports = router;
