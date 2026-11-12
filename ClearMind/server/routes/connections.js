// Connection routes - FR-7 (UC-4, Practitioner side).
//
// FR-7 is the practitioner's story: "I'd like to be able to find students that
// I can connect with." Publishing a profile (routes/resources.js) only covers
// the half where the student goes looking. This file covers the other half.
//
// The Security NFR says a student's check-ins are visible only to that student,
// and the Ethical NFR says consent comes before anything is shared. So a
// practitioner never sees check-in data, derived risk, or anything inferred
// from it. They see only what the student chose to publish about themselves:
// a display name, their school, and support areas the student typed in. A
// student is invisible here until they opt in, and their email is released
// only once they accept a request.

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/** First name plus last initial - enough to address someone, not to identify them. */
function displayName(user) {
  const [first, ...rest] = user.name.trim().split(/\s+/);
  const initial = rest.length ? ` ${rest[rest.length - 1][0]}.` : '';
  return `${first}${initial}`;
}

/** The practitioner profile fields a student is allowed to see. */
function publicPractitioner(profile, user) {
  if (!profile) {
    return { id: null, name: user?.name || 'A practitioner', specialties: [], credentials: '' };
  }
  return {
    id: profile.id,
    name: profile.name,
    credentials: profile.credentials,
    specialties: profile.specialties,
    bio: profile.bio,
    location: profile.location,
    telehealth: profile.telehealth,
    acceptsStudentInsurance: profile.acceptsStudentInsurance,
  };
}

// ---------------------------------------------------------------------------
// Student side: control discoverability, answer requests
// ---------------------------------------------------------------------------

// PATCH /api/connections/discoverability
router.patch('/discoverability', requireAuth, requireRole('student'), (req, res) => {
  const { optInDiscoverable, supportAreas } = req.body || {};

  if (typeof optInDiscoverable !== 'boolean') {
    return res.status(400).json({ error: 'optInDiscoverable must be true or false.' });
  }

  const areas = Array.isArray(supportAreas)
    ? supportAreas.map((a) => String(a).trim()).filter(Boolean).slice(0, 8)
    : [];

  const updated = db.update((data) => {
    const user = data.users.find((u) => u.id === req.user.id);
    if (!user) return null;
    user.optInDiscoverable = optInDiscoverable;
    user.supportAreas = areas;
    const { passwordHash, ...safe } = user;
    return safe;
  });

  if (!updated) return res.status(404).json({ error: 'Account not found.' });

  db.audit(req.user.id, 'connections.discoverability', `optIn=${optInDiscoverable}`);
  return res.json({ user: updated });
});

// ---------------------------------------------------------------------------
// Practitioner side: find students (FR-7)
// ---------------------------------------------------------------------------

// GET /api/connections/students
router.get('/students', requireAuth, requireRole('practitioner'), (req, res) => {
  const data = db.read();
  const alreadyContacted = new Set(
    data.connectionRequests
      .filter((c) => c.practitionerId === req.user.id)
      .map((c) => c.studentId)
  );

  const students = data.users
    .filter((u) => u.role === 'student' && u.optInDiscoverable)
    .map((u) => ({
      id: u.id,
      displayName: displayName(u),
      school: u.school,
      supportAreas: u.supportAreas || [],
      alreadyContacted: alreadyContacted.has(u.id),
    }));

  db.audit(req.user.id, 'connections.browseStudents', `count=${students.length}`);
  return res.json({ students });
});

// POST /api/connections  - send a request to a student
router.post('/', requireAuth, requireRole('practitioner'), (req, res) => {
  const { studentId, message = '' } = req.body || {};
  const data = db.read();

  const student = data.users.find((u) => u.id === studentId && u.role === 'student');
  if (!student) return res.status(404).json({ error: 'That student was not found.' });

  // A student who has not opted in cannot be contacted at all.
  if (!student.optInDiscoverable) {
    return res.status(403).json({ error: 'That student is not accepting connection requests.' });
  }

  if (data.connectionRequests.some((c) => c.practitionerId === req.user.id && c.studentId === studentId)) {
    return res.status(409).json({ error: 'You have already contacted this student.' });
  }

  if (String(message).length > 1000) {
    return res.status(400).json({ error: 'Please keep your message under 1000 characters.' });
  }

  const request = {
    id: db.newId('req'),
    practitionerId: req.user.id,
    studentId,
    message: String(message).trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    respondedAt: null,
  };

  db.update((d) => d.connectionRequests.push(request));
  db.audit(req.user.id, 'connections.send', request.id);
  return res.status(201).json({ request });
});

// ---------------------------------------------------------------------------
// Both sides: list requests
// ---------------------------------------------------------------------------

// GET /api/connections
router.get('/', requireAuth, (req, res) => {
  const data = db.read();
  const isStudent = req.user.role === 'student';

  const mine = data.connectionRequests.filter((c) =>
    isStudent ? c.studentId === req.user.id : c.practitionerId === req.user.id
  );

  const requests = mine
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => {
      if (isStudent) {
        const owner = data.users.find((u) => u.id === c.practitionerId);
        const profile = data.practitioners.find((p) => p.ownerId === c.practitionerId);
        return {
          ...c,
          practitioner: publicPractitioner(profile, owner),
          // Contact details are released only once the student accepts.
          contactInfo: c.status === 'accepted' ? profile?.contactInfo || owner?.email || null : null,
        };
      }

      const student = data.users.find((u) => u.id === c.studentId);
      return {
        ...c,
        student: {
          displayName: student ? displayName(student) : 'Student',
          school: student?.school || '',
          supportAreas: student?.supportAreas || [],
        },
        // The student's email reaches the practitioner only after they accept.
        studentEmail: c.status === 'accepted' ? student?.email || null : null,
      };
    });

  return res.json({ requests });
});

// POST /api/connections/:id/respond  { decision: 'accept' | 'decline' }
router.post('/:id/respond', requireAuth, requireRole('student'), (req, res) => {
  const { decision } = req.body || {};
  if (!['accept', 'decline'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be accept or decline.' });
  }

  const updated = db.update((data) => {
    const request = data.connectionRequests.find(
      (c) => c.id === req.params.id && c.studentId === req.user.id
    );
    if (!request) return null;
    if (request.status !== 'pending') return 'already';
    request.status = decision === 'accept' ? 'accepted' : 'declined';
    request.respondedAt = new Date().toISOString();
    return request;
  });

  if (!updated) return res.status(404).json({ error: 'That request was not found.' });
  if (updated === 'already') {
    return res.status(409).json({ error: 'You have already answered that request.' });
  }

  db.audit(req.user.id, `connections.${decision}`, updated.id);
  return res.json({ request: updated });
});

module.exports = router;
