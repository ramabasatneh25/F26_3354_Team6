// Integration tests for FR-7: a practitioner finding and contacting students.
//
// The privacy boundaries matter more than the happy path here, so most of
// these assert what a practitioner must NOT be able to see or do.

const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'clearmind-conn-'));
process.env.CLEARMIND_DATA_DIR = TMP;
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../server');
const db = require('../db');

let studentToken;
let studentId;
let hiddenToken;
let practitionerToken;
let otherPractitionerToken;

beforeAll(async () => {
  db.reset();

  const student = await request(app).post('/api/auth/register').send({
    name: 'Jordan Ellis',
    email: 'jordan@utdallas.edu',
    password: 'TestPassword1',
    role: 'student',
    school: 'The University of Texas at Dallas',
    consent: true,
  });
  studentToken = student.body.token;
  studentId = student.body.user.id;

  const hidden = await request(app).post('/api/auth/register').send({
    name: 'Hidden Student',
    email: 'hidden@utdallas.edu',
    password: 'TestPassword1',
    role: 'student',
    school: 'The University of Texas at Dallas',
    consent: true,
  });
  hiddenToken = hidden.body.token;

  const practitioner = await request(app).post('/api/auth/register').send({
    name: 'Dr. Maya Chen',
    email: 'maya@example.com',
    password: 'TestPassword1',
    role: 'practitioner',
  });
  practitionerToken = practitioner.body.token;

  await request(app)
    .post('/api/resources/practitioner')
    .set('Authorization', `Bearer ${practitionerToken}`)
    .send({ specialties: 'Anxiety, Stress', contactInfo: 'maya@example.com | (972) 555-0144' });

  const other = await request(app).post('/api/auth/register').send({
    name: 'Dr. Second Opinion',
    email: 'second@example.com',
    password: 'TestPassword1',
    role: 'practitioner',
  });
  otherPractitionerToken = other.body.token;

  // The visible student logs a check-in, so we can prove it never leaks.
  await request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ moodScore: 1, stressLevel: 10, thoughts: 'Private note that must never leak.' });
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

const asStudent = (req) => req.set('Authorization', `Bearer ${studentToken}`);
const asPractitioner = (req) => req.set('Authorization', `Bearer ${practitionerToken}`);

describe('opting in', () => {
  test('students are not discoverable by default', async () => {
    const res = await asPractitioner(request(app).get('/api/connections/students'));
    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(0);
  });

  test('a student can opt in and publish their own support areas', async () => {
    const res = await asStudent(
      request(app)
        .patch('/api/connections/discoverability')
        .send({ optInDiscoverable: true, supportAreas: ['Exam stress', 'Sleep'] })
    );
    expect(res.status).toBe(200);
    expect(res.body.user.optInDiscoverable).toBe(true);
    expect(res.body.user.supportAreas).toEqual(['Exam stress', 'Sleep']);
  });

  test('a practitioner now sees only the opted-in student', async () => {
    const res = await asPractitioner(request(app).get('/api/connections/students'));
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].supportAreas).toEqual(['Exam stress', 'Sleep']);
  });

  test('a practitioner never sees a name, email, or any check-in data', async () => {
    const res = await asPractitioner(request(app).get('/api/connections/students'));
    const serialised = JSON.stringify(res.body);

    expect(res.body.students[0].displayName).toBe('Jordan E.');
    expect(serialised).not.toContain('jordan@utdallas.edu');
    expect(serialised).not.toContain('Private note that must never leak.');
    expect(serialised).not.toContain('moodScore');
    expect(res.body.students[0].crisisFlagged).toBeUndefined();
  });

  test('a practitioner cannot read a student check-in endpoint', async () => {
    const res = await asPractitioner(request(app).get('/api/checkins'));
    expect(res.status).toBe(403);
  });

  test('a student cannot browse other students', async () => {
    const res = await asStudent(request(app).get('/api/connections/students'));
    expect(res.status).toBe(403);
  });
});

describe('sending a request', () => {
  let requestId;

  test('a practitioner can send one request to an opted-in student', async () => {
    const res = await asPractitioner(
      request(app)
        .post('/api/connections')
        .send({ studentId, message: 'I work with undergraduates on exam stress.' })
    );
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe('pending');
    requestId = res.body.request.id;
  });

  test('the same practitioner cannot contact the same student twice', async () => {
    const res = await asPractitioner(request(app).post('/api/connections').send({ studentId }));
    expect(res.status).toBe(409);
  });

  test('a student who has not opted in cannot be contacted', async () => {
    const hidden = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${hiddenToken}`);

    const res = await asPractitioner(
      request(app).post('/api/connections').send({ studentId: hidden.body.user.id })
    );
    expect(res.status).toBe(403);
  });

  test('the student sees the request but not their own email echoed back', async () => {
    const res = await asStudent(request(app).get('/api/connections'));
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].practitioner.name).toBe('Dr. Maya Chen');
    // Contact details are withheld until the student accepts.
    expect(res.body.requests[0].contactInfo).toBeNull();
  });

  test('the practitioner cannot see the student email while pending', async () => {
    const res = await asPractitioner(request(app).get('/api/connections'));
    expect(res.body.requests[0].studentEmail).toBeNull();
    expect(res.body.requests[0].student.displayName).toBe('Jordan E.');
  });

  test('a student can accept, which releases contact details both ways', async () => {
    const res = await asStudent(
      request(app).post(`/api/connections/${requestId}/respond`).send({ decision: 'accept' })
    );
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('accepted');

    const practitionerView = await asPractitioner(request(app).get('/api/connections'));
    expect(practitionerView.body.requests[0].studentEmail).toBe('jordan@utdallas.edu');

    const studentView = await asStudent(request(app).get('/api/connections'));
    expect(studentView.body.requests[0].contactInfo).toContain('maya@example.com');
  });

  test('accepting does not expose check-ins to the practitioner', async () => {
    const res = await asPractitioner(request(app).get('/api/connections'));
    expect(JSON.stringify(res.body)).not.toContain('Private note that must never leak.');
  });

  test('a request cannot be answered twice', async () => {
    const res = await asStudent(
      request(app).post(`/api/connections/${requestId}/respond`).send({ decision: 'decline' })
    );
    expect(res.status).toBe(409);
  });

  test('a student cannot answer a request addressed to someone else', async () => {
    const sent = await request(app)
      .post('/api/connections')
      .set('Authorization', `Bearer ${otherPractitionerToken}`)
      .send({ studentId, message: 'Hello.' });

    const res = await request(app)
      .post(`/api/connections/${sent.body.request.id}/respond`)
      .set('Authorization', `Bearer ${hiddenToken}`)
      .send({ decision: 'accept' });

    expect(res.status).toBe(404);
  });

  test('a practitioner cannot answer a request on a student behalf', async () => {
    const pending = await asPractitioner(request(app).get('/api/connections'));
    const open = pending.body.requests.find((r) => r.status === 'pending');

    const res = await asPractitioner(
      request(app).post(`/api/connections/${open?.id}/respond`).send({ decision: 'accept' })
    );
    expect(res.status).toBe(403);
  });
});

describe('opting back out', () => {
  test('turning discoverability off hides the student immediately', async () => {
    await asStudent(
      request(app)
        .patch('/api/connections/discoverability')
        .send({ optInDiscoverable: false, supportAreas: [] })
    );

    const res = await asPractitioner(request(app).get('/api/connections/students'));
    expect(res.body.students).toHaveLength(0);
  });
});
