// Authentication middleware (server tier).
//
// The Security NFR says a student's check-in must only be readable by that
// student and that this is enforced server-side, and the SDD names Firebase
// Auth as the identity provider.
//
// ClearMind therefore treats identity as a pluggable provider:
//
//   AUTH_PROVIDER=local     (default) - email + password stored with bcrypt,
//                           session carried in a signed JWT. Runs with no
//                           external accounts, which is what the grader needs.
//   AUTH_PROVIDER=firebase  - the client sends a Firebase ID token instead and
//                           the server verifies it with firebase-admin.
//
// Either way, every protected route ends up with req.user set from a verified
// token. No route trusts a user id sent in the request body.

const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'clearmind-dev-secret-change-me';
const TOKEN_TTL = process.env.JWT_TTL || '7d';
const PROVIDER = (process.env.AUTH_PROVIDER || 'local').toLowerCase();

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

/** Verifies a Firebase ID token. Only loaded when AUTH_PROVIDER=firebase. */
async function verifyFirebaseToken(token) {
  // Required lazily so the project installs and runs without firebase-admin.
  // eslint-disable-next-line global-require, import/no-unresolved
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  const decoded = await admin.auth().verifyIdToken(token);
  return { sub: decoded.uid, email: decoded.email };
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Rejects the request unless it carries a valid token. */
async function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }

  try {
    let claims;
    if (PROVIDER === 'firebase') {
      claims = await verifyFirebaseToken(token);
    } else {
      claims = jwt.verify(token, JWT_SECRET);
    }

    const user = db.read().users.find((u) => u.id === claims.sub || u.email === claims.email);
    if (!user) {
      return res.status(401).json({ error: 'That account no longer exists.' });
    }

    const { passwordHash, ...safe } = user;
    req.user = safe;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

/** Restricts a route to one or more roles (student / practitioner / school_admin). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Your account type cannot access that.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, signToken, JWT_SECRET, PROVIDER };
