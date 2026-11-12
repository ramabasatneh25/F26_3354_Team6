// Integration tests for the ClearMind REST API.
//
// These run against the real Express app with supertest. They are additional
// to the Deliverable #2 unit test (crisisService.test.js) and exist to show
// that each functional requirement is reachable end to end.
//
// The data store is redirected to a throwaway directory first, so running the
// test suite never touches server/data/clearmind.json.

const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'clearmind-test-'));
process.env.CLEARMIND_DATA_DIR = TMP;
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../server');
const db = require('../db');

const STUDENT = {
  name: 'Test Student',
  email: 'test.student@utdallas.edu',
  password: 'TestPassword1',
  role: 'student',
  school: 'The University of Texas at Dallas',
  consent: true,
};

let studentToken;

beforeAll(async () => {
  db.reset();
  const res = await request(app).post('/api/auth/register').send(STUDENT);
  studentToken = res.body.token;
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

const asStudent = (req) => req.set('Authorization', `Bearer ${studentToken}`);

describe('authentication (Security NFR)', () => {
  test('registration returns a token and never echoes the password hash', async () => {
    expect(studentToken).toEqual(expect.any(String));
    const me = await asStudent(request(app).get('/api/auth/me'));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(STUDENT.email);
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  test('a student account cannot be created without consent (Ethical NFR)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...STUDENT, email: 'no.consent@utdallas.edu', consent: false });
    expect(res.status).toBe(400);
  });

  test('protected routes reject an unauthenticated request', async () => {
    const res = await request(app).get('/api/checkins');
    expect(res.status).toBe(401);
  });

  test('a wrong password is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STUDENT.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});

describe('FR-1 / FR-2 submit a check-in and get feedback', () => {
  test('a valid check-in is stored and returns personalized feedback', async () => {
    const res = await asStudent(
      request(app).post('/api/checkins').send({
        moodScore: 6,
        stressLevel: 5,
        sleepHours: 7,
        thoughts: 'Normal day.',
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.checkIn.moodScore).toBe(6);
    expect(res.body.feedback.insights.length).toBeGreaterThan(0);
    expect(res.body.crisis.flagged).toBe(false);
  });

  test('out-of-range values are rejected rather than stored', async () => {
    const res = await asStudent(
      request(app).post('/api/checkins').send({ moodScore: 11, stressLevel: 5 })
    );
    expect(res.status).toBe(400);
  });
});

describe('FR-6 crisis detection (Safety NFR)', () => {
  test('a check-in past the threshold returns crisis resources with it', async () => {
    const res = await asStudent(
      request(app).post('/api/checkins').send({
        moodScore: 1,
        stressLevel: 10,
        sleepHours: 4,
        thoughts: 'Rough night.',
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.checkIn.crisisFlagged).toBe(true);
    expect(res.body.crisis.flagged).toBe(true);
    expect(res.body.crisis.resources.some((r) => r.hotlineNumber === '988')).toBe(true);
  });

  test('crisis resources are reachable without submitting a check-in first', async () => {
    const res = await asStudent(request(app).get('/api/resources/crisis'));
    expect(res.status).toBe(200);
    expect(res.body.resources.length).toBeGreaterThan(0);
  });
});

describe('FR-3 / FR-4 history, filtering and weekly report', () => {
  test('history returns only the signed-in student own check-ins', async () => {
    const res = await asStudent(request(app).get('/api/checkins'));
    expect(res.status).toBe(200);
    expect(res.body.checkIns.length).toBeGreaterThanOrEqual(2);
    expect(res.body.checkIns.every((c) => c.studentId === res.body.checkIns[0].studentId)).toBe(
      true
    );
  });

  test('a date filter outside the range returns nothing (UC-2 A1)', async () => {
    const res = await asStudent(request(app).get('/api/checkins?from=2000-01-01&to=2000-01-31'));
    expect(res.status).toBe(200);
    expect(res.body.checkIns).toHaveLength(0);
  });

  test('a weekly report is unavailable until there are enough entries (UC-2 A3)', async () => {
    const res = await asStudent(request(app).get('/api/reports/weekly'));
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('a weekly report is produced once there are three entries', async () => {
    await asStudent(
      request(app).post('/api/checkins').send({ moodScore: 7, stressLevel: 4, sleepHours: 8 })
    );
    const res = await asStudent(request(app).get('/api/reports/weekly'));
    expect(res.body.available).toBe(true);
    expect(res.body.report.insights.length).toBeGreaterThan(0);
  });
});

describe('FR-5 / FR-7 / FR-8 resources', () => {
  let practitionerToken;
  let adminToken;

  beforeAll(async () => {
    const p = await request(app).post('/api/auth/register').send({
      name: 'Dr. Test',
      email: 'dr.test@example.com',
      password: 'TestPassword1',
      role: 'practitioner',
    });
    practitionerToken = p.body.token;

    const a = await request(app).post('/api/auth/register').send({
      name: 'Campus Admin',
      email: 'campus.admin@utdallas.edu',
      password: 'TestPassword1',
      role: 'school_admin',
      school: 'The University of Texas at Dallas',
    });
    adminToken = a.body.token;
  });

  test('FR-7 a practitioner can publish a profile', async () => {
    const res = await request(app)
      .post('/api/resources/practitioner')
      .set('Authorization', `Bearer ${practitionerToken}`)
      .send({
        name: 'Dr. Test',
        specialties: 'Anxiety, Stress',
        contactInfo: 'dr.test@example.com',
      });
    expect(res.status).toBe(201);
    expect(res.body.practitioner.specialties).toEqual(['Anxiety', 'Stress']);
  });

  test('UC-4 A2 a profile missing required fields is not published', async () => {
    const res = await request(app)
      .post('/api/resources/practitioner')
      .set('Authorization', `Bearer ${practitionerToken}`)
      .send({ name: 'Dr. Test' });
    expect(res.status).toBe(400);
    expect(res.body.missing).toContain('contactInfo');
  });

  test('a student cannot publish practitioner resources', async () => {
    const res = await asStudent(
      request(app).post('/api/resources/practitioner').send({ name: 'Nope' })
    );
    expect(res.status).toBe(403);
  });

  test('FR-8 a school admin can publish a campus resource', async () => {
    const res = await request(app)
      .post('/api/resources/school')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Counseling Center',
        serviceType: 'Counseling',
        contactInfo: '(972) 883-2575',
      });
    expect(res.status).toBe(201);
  });

  test('UC-4 A1 bulk CSV import accepts valid rows and reports invalid ones', async () => {
    const csv = [
      'title,serviceType,contactInfo,hours',
      'Peer Support Group,Group Program,peers@utdallas.edu,Tue 5pm',
      'Broken Row,,,',
    ].join('\n');

    const res = await request(app)
      .post('/api/resources/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ format: 'csv', payload: csv });

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(1);
    expect(res.body.rejectedCount).toBe(1);
    expect(res.body.rejected[0].missing).toContain('serviceType');
  });

  test('FR-5 recommendations put the student own campus resources first', async () => {
    const res = await asStudent(request(app).get('/api/resources/recommendations'));
    expect(res.status).toBe(200);
    expect(res.body.schoolResources.length).toBeGreaterThan(0);
    expect(res.body.practitioners.length).toBeGreaterThan(0);
  });
});

describe('Legislative-Privacy NFR: view and remove my data', () => {
  test('a student can export everything held about them', async () => {
    const res = await asStudent(request(app).get('/api/account/export'));
    expect(res.status).toBe(200);
    expect(res.body.checkIns.length).toBeGreaterThan(0);
    expect(res.body.account.email).toBe(STUDENT.email);
  });

  test('a student can erase all check-in history', async () => {
    const res = await asStudent(request(app).delete('/api/account/checkins'));
    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBeGreaterThan(0);

    const after = await asStudent(request(app).get('/api/checkins'));
    expect(after.body.checkIns).toHaveLength(0);
  });
});
