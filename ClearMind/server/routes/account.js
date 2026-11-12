// Account routes - Legislative-Privacy NFR: "allow users to view or remove
// their data at request" (FERPA / HIPAA). Backs UC-2 A2 Remove My Data.

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/account/export - everything ClearMind holds about the caller
router.get('/export', requireAuth, (req, res) => {
  const data = db.read();
  const payload = {
    exportedAt: new Date().toISOString(),
    account: req.user,
    checkIns: data.checkIns.filter((c) => c.studentId === req.user.id),
    practitionerProfile: data.practitioners.find((p) => p.ownerId === req.user.id) || null,
    schoolResources: data.schoolResources.filter((r) => r.ownerId === req.user.id),
    accessLog: data.auditLog.filter((l) => l.actorId === req.user.id),
  };

  db.audit(req.user.id, 'account.export');
  res.setHeader('Content-Disposition', 'attachment; filename="clearmind-my-data.json"');
  return res.json(payload);
});

// DELETE /api/account/checkins - erase all check-in history, keep the account
router.delete('/checkins', requireAuth, (req, res) => {
  const removed = db.update((data) => {
    const before = data.checkIns.length;
    data.checkIns = data.checkIns.filter((c) => c.studentId !== req.user.id);
    return before - data.checkIns.length;
  });

  db.audit(req.user.id, 'account.checkins.deleteAll', `count=${removed}`);
  return res.json({ deletedCount: removed });
});

// DELETE /api/account - erase the account and everything attached to it
router.delete('/', requireAuth, (req, res) => {
  db.update((data) => {
    data.checkIns = data.checkIns.filter((c) => c.studentId !== req.user.id);
    data.practitioners = data.practitioners.filter((p) => p.ownerId !== req.user.id);
    data.schoolResources = data.schoolResources.filter((r) => r.ownerId !== req.user.id);
    data.users = data.users.filter((u) => u.id !== req.user.id);
  });

  // The audit entry survives deletion on purpose: the HIPAA Security Rule
  // expects the erasure itself to be recorded. It holds no health data.
  db.audit(req.user.id, 'account.delete');
  return res.json({ deleted: true });
});

module.exports = router;
