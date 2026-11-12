// Support + resource routes - FR-5, FR-6, FR-7, FR-8 (UC-3, UC-4).

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recommend } = require('../services/recommendationService');
const { getCrisisResources } = require('../services/crisisService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Student-facing  (UC-3 Receive Mental Health Support)
// ---------------------------------------------------------------------------

// GET /api/resources/recommendations - FR-5 + FR-8
router.get('/recommendations', requireAuth, requireRole('student'), (req, res) => {
  const data = db.read();
  const checkIns = data.checkIns
    .filter((c) => c.studentId === req.user.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const payload = recommend(req.user, checkIns, data.practitioners, data.schoolResources);
  db.audit(req.user.id, 'support.recommendations');
  return res.json(payload);
});

// GET /api/resources/crisis - FR-6. Deliberately open to any signed-in user:
// the Safety NFR says crisis information must never be gated behind a check-in.
router.get('/crisis', requireAuth, (req, res) => {
  res.json({ resources: getCrisisResources() });
});

// ---------------------------------------------------------------------------
// Provider-facing  (UC-4 Provide Mental Health Resources)
// ---------------------------------------------------------------------------

/** UC-4 A2: missing required fields are reported, nothing is published. */
function validatePractitioner(body) {
  const missing = [];
  if (!body.name) missing.push('name');
  if (!body.contactInfo) missing.push('contactInfo');
  if (!body.specialties || !body.specialties.length) missing.push('specialties');
  return missing;
}

function validateSchoolResource(body) {
  const missing = [];
  if (!body.title) missing.push('title');
  if (!body.school) missing.push('school');
  if (!body.serviceType) missing.push('serviceType');
  if (!body.contactInfo) missing.push('contactInfo');
  return missing;
}

function normaliseSpecialties(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  return String(value || '')
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// POST /api/resources/practitioner - FR-7, create or update own profile
router.post('/practitioner', requireAuth, requireRole('practitioner'), (req, res) => {
  const body = { ...req.body, specialties: normaliseSpecialties(req.body.specialties) };
  if (!body.name) body.name = req.user.name;

  const missing = validatePractitioner(body);
  if (missing.length) {
    return res.status(400).json({ error: 'Some required fields are missing.', missing });
  }

  const profile = {
    id: db.read().practitioners.find((p) => p.ownerId === req.user.id)?.id || db.newId('prc'),
    ownerId: req.user.id,
    name: body.name,
    credentials: body.credentials || '',
    specialties: body.specialties,
    contactInfo: body.contactInfo,
    location: body.location || '',
    acceptingStudents: body.acceptingStudents !== false,
    acceptsStudentInsurance: Boolean(body.acceptsStudentInsurance),
    telehealth: Boolean(body.telehealth),
    bio: body.bio || '',
    published: true,
    updatedAt: new Date().toISOString(),
  };

  db.update((data) => {
    const index = data.practitioners.findIndex((p) => p.ownerId === req.user.id);
    if (index === -1) data.practitioners.push(profile);
    else data.practitioners[index] = profile;
  });

  db.audit(req.user.id, 'resource.practitioner.publish', profile.id);
  return res.status(201).json({ practitioner: profile });
});

// GET /api/resources/practitioner/me - the provider's own profile
router.get('/practitioner/me', requireAuth, requireRole('practitioner'), (req, res) => {
  const profile = db.read().practitioners.find((p) => p.ownerId === req.user.id) || null;
  res.json({ practitioner: profile });
});

// POST /api/resources/school - FR-8, publish a campus service
router.post('/school', requireAuth, requireRole('school_admin'), (req, res) => {
  const body = { ...req.body, school: req.body.school || req.user.school };
  const missing = validateSchoolResource(body);
  if (missing.length) {
    return res.status(400).json({ error: 'Some required fields are missing.', missing });
  }

  const resource = {
    id: db.newId('sch'),
    ownerId: req.user.id,
    school: body.school,
    title: body.title,
    serviceType: body.serviceType,
    contactInfo: body.contactInfo,
    hours: body.hours || '',
    description: body.description || '',
    cost: body.cost || 'Included with tuition',
    createdAt: new Date().toISOString(),
  };

  db.update((data) => data.schoolResources.push(resource));
  db.audit(req.user.id, 'resource.school.publish', resource.id);
  return res.status(201).json({ resource });
});

// GET /api/resources/school/mine - what this admin has published
router.get('/school/mine', requireAuth, requireRole('school_admin'), (req, res) => {
  const resources = db.read().schoolResources.filter((r) => r.ownerId === req.user.id);
  res.json({ resources });
});

// ---------------------------------------------------------------------------
// UC-4 A1: bulk import of resource data in a standard format (CSV or JSON)
// ---------------------------------------------------------------------------

/** Minimal RFC-4180-ish CSV parser - handles quoted fields and embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return [];

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] || '').trim();
    });
    return obj;
  });
}

// POST /api/resources/import  { format: 'csv' | 'json', payload: '<raw text>' }
router.post('/import', requireAuth, requireRole('school_admin'), (req, res) => {
  const { format = 'csv', payload = '' } = req.body || {};

  let rows;
  try {
    rows = format === 'json' ? JSON.parse(payload) : parseCsv(payload);
  } catch (err) {
    return res.status(400).json({ error: `That file could not be read as ${format.toUpperCase()}.` });
  }
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'No rows were found in that file.' });
  }

  const accepted = [];
  const rejected = [];

  rows.forEach((raw, index) => {
    const candidate = { ...raw, school: raw.school || req.user.school };
    const missing = validateSchoolResource(candidate);
    if (missing.length) {
      // UC-4 A2: invalid rows are reported with the exact fields that are missing.
      rejected.push({ row: index + 1, missing, title: raw.title || '(untitled)' });
      return;
    }
    accepted.push({
      id: db.newId('sch'),
      ownerId: req.user.id,
      school: candidate.school,
      title: candidate.title,
      serviceType: candidate.serviceType,
      contactInfo: candidate.contactInfo,
      hours: candidate.hours || '',
      description: candidate.description || '',
      cost: candidate.cost || 'Included with tuition',
      createdAt: new Date().toISOString(),
    });
  });

  if (accepted.length) {
    db.update((data) => data.schoolResources.push(...accepted));
    db.audit(req.user.id, 'resource.import', `accepted=${accepted.length}`);
  }

  return res.status(accepted.length ? 201 : 400).json({
    importedCount: accepted.length,
    rejectedCount: rejected.length,
    imported: accepted,
    rejected,
  });
});

module.exports = router;
module.exports.parseCsv = parseCsv;
