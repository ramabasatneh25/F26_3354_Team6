// Seeds a demo dataset so the app can be opened and reviewed immediately.
//
//   npm run seed          (from server/, or `npm run seed` at the repo root)
//
// Running this WIPES server/data/clearmind.json and rebuilds it. The check-in
// history is generated from a fixed pseudo-random seed, so every run produces
// the same numbers and the demo is reproducible.

const bcrypt = require('bcryptjs');
const db = require('./db');
const { assessRisk } = require('./services/crisisService');

const DEMO_PASSWORD = 'ClearMind2026';

// Deterministic PRNG (mulberry32) so seeded data never changes between runs.
function makeRandom(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THOUGHT_POOL = [
  'Group project meeting ran long but we finally split up the work.',
  'Slept badly before the midterm. Caffeine is doing the heavy lifting today.',
  'Went to the rec center between classes and felt a lot better after.',
  'Three assignments due the same week. Trying not to think about all of them at once.',
  'Called home. Helped more than I expected it to.',
  'Skipped lunch to study. Probably why the afternoon felt so rough.',
  'Good day. Got ahead on the reading for once.',
  'Lab writeup took way longer than it should have.',
  'Roommate situation is still tense but we talked about it.',
  'Finally finished the exam. Mostly just tired now.',
  'Walked around campus after class instead of going straight back to my room.',
  'Hard to focus today, kept re-reading the same page.',
  'Study group actually helped. Understanding the material better now.',
  'Registration for next semester is stressing me out.',
];

function buildCheckInHistory(studentId, days, random) {
  const checkIns = [];
  // A gentle downward drift over the last stretch so the weekly report and the
  // tailored recommendations have something real to describe.
  for (let i = days; i >= 1; i -= 1) {
    // Skip roughly one day in six - students do not check in every single day.
    if (random() < 0.17) continue;

    const recency = (days - i) / days; // 0 = oldest, 1 = newest
    const baseMood = 7.2 - recency * 2.4;
    const baseStress = 4.6 + recency * 2.8;

    const mood = Math.min(10, Math.max(3, Math.round(baseMood + (random() - 0.5) * 2.4)));
    const stress = Math.min(10, Math.max(1, Math.round(baseStress + (random() - 0.5) * 2.4)));
    const sleep = Math.round((7.4 - recency * 1.6 + (random() - 0.5) * 2) * 10) / 10;

    const timestamp = new Date();
    timestamp.setUTCDate(timestamp.getUTCDate() - i);
    timestamp.setUTCHours(20, Math.floor(random() * 59), 0, 0);

    checkIns.push({
      id: db.newId('chk'),
      studentId,
      timestamp: timestamp.toISOString(),
      moodScore: mood,
      stressLevel: stress,
      sleepHours: Math.max(3, Math.min(11, sleep)),
      thoughts: THOUGHT_POOL[Math.floor(random() * THOUGHT_POOL.length)],
      crisisFlagged: assessRisk({ moodScore: mood, stressLevel: stress }),
    });
  }
  return checkIns;
}

async function seed() {
  db.reset();
  const random = makeRandom(3354);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = new Date().toISOString();

  const student = {
    id: db.newId('usr'),
    name: 'Jordan Ellis',
    email: 'student@utdallas.edu',
    passwordHash,
    role: 'student',
    school: 'The University of Texas at Dallas',
    consentGivenAt: now,
    // FR-7: opted in, with areas the student chose themselves. Practitioners
    // never see check-in data - only what the student published here.
    optInDiscoverable: true,
    supportAreas: ['Exam stress', 'Sleep'],
    createdAt: now,
  };

  const secondStudent = {
    id: db.newId('usr'),
    name: 'Priya Nair',
    email: 'priya.nair@utdallas.edu',
    passwordHash,
    role: 'student',
    school: 'The University of Texas at Dallas',
    consentGivenAt: now,
    optInDiscoverable: true,
    supportAreas: ['Adjusting to campus', 'Low mood'],
    createdAt: now,
  };

  const thirdStudent = {
    id: db.newId('usr'),
    name: 'Daniel Okonkwo',
    email: 'daniel.okonkwo@utdallas.edu',
    passwordHash,
    role: 'student',
    school: 'The University of Texas at Dallas',
    consentGivenAt: now,
    // Not opted in - should never appear to a practitioner.
    optInDiscoverable: false,
    supportAreas: [],
    createdAt: now,
  };

  const practitioner = {
    id: db.newId('usr'),
    name: 'Dr. Maya Chen, LPC',
    email: 'practitioner@clearmind.app',
    passwordHash,
    role: 'practitioner',
    school: '',
    consentGivenAt: null,
    optInDiscoverable: false,
    supportAreas: [],
    createdAt: now,
  };

  const schoolAdmin = {
    id: db.newId('usr'),
    name: 'UTD Student Counseling Center',
    email: 'admin@utdallas.edu',
    passwordHash,
    role: 'school_admin',
    school: 'The University of Texas at Dallas',
    consentGivenAt: null,
    optInDiscoverable: false,
    supportAreas: [],
    createdAt: now,
  };

  const practitioners = [
    {
      id: db.newId('prc'),
      ownerId: practitioner.id,
      name: 'Dr. Maya Chen, LPC',
      credentials: 'Licensed Professional Counselor',
      specialties: ['Anxiety', 'Stress', 'CBT'],
      contactInfo: 'maya.chen@example.com | (972) 555-0144',
      location: 'Richardson, TX',
      acceptingStudents: true,
      acceptsStudentInsurance: true,
      telehealth: true,
      bio: 'Works mostly with undergraduates on exam anxiety and workload stress. Evening telehealth slots.',
      published: true,
      updatedAt: now,
    },
    {
      id: db.newId('prc'),
      ownerId: null,
      name: 'Dr. Andre Whitfield, PsyD',
      credentials: 'Clinical Psychologist',
      specialties: ['Depression', 'Mood', 'Counseling'],
      contactInfo: 'awhitfield@example.com | (214) 555-0177',
      location: 'Plano, TX',
      acceptingStudents: true,
      acceptsStudentInsurance: true,
      telehealth: false,
      bio: 'Fifteen years working with young adults on low mood and motivation.',
      published: true,
      updatedAt: now,
    },
    {
      id: db.newId('prc'),
      ownerId: null,
      name: 'Priya Raman, LCSW',
      credentials: 'Licensed Clinical Social Worker',
      specialties: ['Sleep', 'Behavioral Health', 'Mindfulness'],
      contactInfo: 'praman@example.com | (469) 555-0132',
      location: 'Telehealth only',
      acceptingStudents: true,
      acceptsStudentInsurance: false,
      telehealth: true,
      bio: 'Focuses on sleep routines and behavioral activation for students on irregular schedules.',
      published: true,
      updatedAt: now,
    },
    {
      id: db.newId('prc'),
      ownerId: null,
      name: 'Dr. Lena Okafor, MD',
      credentials: 'Psychiatrist',
      specialties: ['Psychiatry', 'Crisis', 'Trauma'],
      contactInfo: 'lokafor@example.com | (972) 555-0190',
      location: 'Dallas, TX',
      acceptingStudents: false,
      acceptsStudentInsurance: true,
      telehealth: true,
      bio: 'Currently at capacity. Accepts referrals from campus counseling for urgent cases.',
      published: true,
      updatedAt: now,
    },
    {
      id: db.newId('prc'),
      ownerId: null,
      name: 'Marcus Delgado, LPC-A',
      credentials: 'Licensed Professional Counselor Associate',
      specialties: ['Academic', 'Adjustment', 'Student'],
      contactInfo: 'mdelgado@example.com | (214) 555-0118',
      location: 'Richardson, TX',
      acceptingStudents: true,
      acceptsStudentInsurance: false,
      telehealth: true,
      bio: 'Sliding-scale sessions for first-generation and transfer students adjusting to campus.',
      published: true,
      updatedAt: now,
    },
  ];

  const schoolResources = [
    {
      id: db.newId('sch'),
      ownerId: schoolAdmin.id,
      school: 'The University of Texas at Dallas',
      title: 'Student Counseling Center - Individual Counseling',
      serviceType: 'Counseling',
      contactInfo: '(972) 883-2575 | SSB 4.600',
      hours: 'Mon-Fri 8:00am - 5:00pm',
      description:
        'Short-term individual counseling for enrolled students. First appointment is usually within a week.',
      cost: 'Included with tuition',
      createdAt: now,
    },
    {
      id: db.newId('sch'),
      ownerId: schoolAdmin.id,
      school: 'The University of Texas at Dallas',
      title: 'After-Hours Crisis Line',
      serviceType: 'Crisis Support',
      contactInfo: '(972) 883-2575, press 2',
      hours: '24 hours a day, 7 days a week',
      description: 'Speak with the on-call counselor outside normal office hours.',
      cost: 'Free',
      createdAt: now,
    },
    {
      id: db.newId('sch'),
      ownerId: schoolAdmin.id,
      school: 'The University of Texas at Dallas',
      title: 'Stress Management Workshop Series',
      serviceType: 'Group Program',
      contactInfo: 'counseling@utdallas.edu',
      hours: 'Wednesdays 4:00pm during the fall semester',
      description:
        'Four-week group workshop on workload planning, sleep routines and exam stress.',
      cost: 'Free',
      createdAt: now,
    },
  ];

  const checkIns = buildCheckInHistory(student.id, 24, random);

  db.update((data) => {
    data.users.push(student, secondStudent, thirdStudent, practitioner, schoolAdmin);
    data.practitioners.push(...practitioners);
    data.schoolResources.push(...schoolResources);
    data.checkIns.push(...checkIns);
  });

  console.log('ClearMind demo data seeded.\n');
  console.log(`  ${checkIns.length} check-ins over the last 24 days for Jordan Ellis`);
  console.log(`  ${practitioners.length} practitioner profiles`);
  console.log(`  ${schoolResources.length} UT Dallas resources`);
  console.log('  3 students, 2 of them discoverable to practitioners\n');
  console.log('Demo accounts (password for all three: ' + DEMO_PASSWORD + ')');
  console.log('  Student        student@utdallas.edu');
  console.log('  Practitioner   practitioner@clearmind.app');
  console.log('  School admin   admin@utdallas.edu');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seed, DEMO_PASSWORD };
