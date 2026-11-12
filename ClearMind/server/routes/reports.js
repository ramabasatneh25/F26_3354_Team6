// Weekly report routes - FR-4 (UC-2).

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateWeeklyReport, groupByWeek } = require('../services/reportGenerator');

const router = express.Router();

function historyFor(studentId) {
  return db
    .read()
    .checkIns.filter((c) => c.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// GET /api/reports/weekly - latest weekly report
router.get('/weekly', requireAuth, requireRole('student'), (req, res) => {
  const checkIns = historyFor(req.user.id);
  const report = generateWeeklyReport(checkIns);

  db.audit(req.user.id, 'report.weekly');

  // UC-2 A3: not enough data yet is a normal state, not an error.
  if (!report) {
    return res.json({
      available: false,
      message:
        'A weekly report needs at least three check-ins. Keep logging and your first report will appear here.',
      checkInsNeeded: Math.max(0, 3 - checkIns.length),
    });
  }

  return res.json({ available: true, report });
});

// GET /api/reports/trend - per-day series for the dashboard chart
router.get('/trend', requireAuth, requireRole('student'), (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 180);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const series = historyFor(req.user.id)
    .filter((c) => new Date(c.timestamp) >= cutoff)
    .reverse()
    .map((c) => ({
      date: c.timestamp.slice(0, 10),
      mood: c.moodScore,
      stress: c.stressLevel,
      sleep: c.sleepHours,
      crisisFlagged: c.crisisFlagged,
    }));

  return res.json({ days, series });
});

// GET /api/reports/history - every week summarised, for the report archive
router.get('/history', requireAuth, requireRole('student'), (req, res) => {
  const weeks = groupByWeek(historyFor(req.user.id)).map((w) => ({
    weekStart: w.weekStart,
    entryCount: w.entries.length,
    averageMood:
      w.entries.reduce((sum, c) => sum + c.moodScore, 0) / w.entries.length,
    averageStress:
      w.entries.reduce((sum, c) => sum + c.stressLevel, 0) / w.entries.length,
    flagged: w.entries.filter((c) => c.crisisFlagged).length,
  }));

  return res.json({ weeks });
});

module.exports = router;
