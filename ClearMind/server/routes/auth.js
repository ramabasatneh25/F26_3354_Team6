// Auth routes - register, sign in, current user.
// Supports UC-1/UC-2/UC-3/UC-4 <<include>> Log In.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();
const ROLES = ['student', 'practitioner', 'school_admin'];

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'student', school = '', consent } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are all required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Unknown account type.' });
  }
  // Ethical NFR: consent is collected before any data is recorded.
  if (role === 'student' && consent !== true) {
    return res
      .status(400)
      .json({ error: 'We need your consent before ClearMind can store check-in data.' });
  }

  const normalisedEmail = String(email).trim().toLowerCase();
  if (db.read().users.some((u) => u.email === normalisedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const user = {
    id: db.newId('usr'),
    name: String(name).trim(),
    email: normalisedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    school: String(school || '').trim(),
    consentGivenAt: role === 'student' ? new Date().toISOString() : null,
    // FR-7: students are invisible to practitioners until they opt in.
    optInDiscoverable: false,
    supportAreas: [],
    createdAt: new Date().toISOString(),
  };

  db.update((data) => data.users.push(user));
  db.audit(user.id, 'account.register', `role=${role}`);

  return res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.read().users.find((u) => u.email === String(email).trim().toLowerCase());
  // Same message either way so the endpoint does not reveal which emails exist.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) {
    return res.status(401).json({ error: 'That email and password do not match.' });
  }

  db.audit(user.id, 'account.login');
  return res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
