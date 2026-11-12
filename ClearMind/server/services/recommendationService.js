// RecommendationService  (SDD section 2.5.2 - Services package)
// Implements FR-5 (recommended practitioners) and FR-8 (school resources).
//
// UC-3 A1: if the student is enrolled at a partner school, that school's own
// services are ranked above outside practitioners, because students have
// usually already paid for them through tuition.

const { average } = require('./feedbackEngine');

/**
 * Derives the student's likely needs from their recent check-ins so that
 * recommendations are tailored rather than a flat directory listing (FR-5).
 */
function deriveNeeds(checkIns) {
  const recent = checkIns.slice(0, 14);
  const needs = new Set();
  if (!recent.length) return [...needs];

  const moodAvg = average(recent, 'moodScore');
  const stressAvg = average(recent, 'stressLevel');
  const sleepEntries = recent.filter((c) => typeof c.sleepHours === 'number');
  const sleepAvg = sleepEntries.length ? average(sleepEntries, 'sleepHours') : null;

  if (moodAvg !== null && moodAvg <= 4) needs.add('mood');
  if (stressAvg !== null && stressAvg >= 7) needs.add('stress');
  if (sleepAvg !== null && sleepAvg < 6) needs.add('sleep');
  if (recent.some((c) => c.crisisFlagged)) needs.add('crisis');
  if (recent.some((c) => /exam|midterm|final|grade|class/i.test(c.thoughts || ''))) {
    needs.add('academic');
  }
  return [...needs];
}

/** Maps a derived need onto the practitioner specialties that address it. */
const NEED_TO_SPECIALTY = {
  mood: ['depression', 'mood', 'cbt', 'counseling'],
  stress: ['anxiety', 'stress', 'cbt', 'mindfulness'],
  sleep: ['sleep', 'insomnia', 'behavioral health'],
  crisis: ['crisis', 'trauma', 'psychiatry'],
  academic: ['academic', 'student', 'adjustment', 'counseling'],
};

function scorePractitioner(practitioner, needs) {
  let score = 0;
  const specialties = (practitioner.specialties || []).map((s) => s.toLowerCase());

  for (const need of needs) {
    const wanted = NEED_TO_SPECIALTY[need] || [];
    if (specialties.some((s) => wanted.some((w) => s.includes(w)))) score += 3;
  }
  if (practitioner.acceptingStudents) score += 2;
  if (practitioner.acceptsStudentInsurance) score += 1;
  if (practitioner.telehealth) score += 1;
  return score;
}

/**
 * Builds the Support page payload.
 * @param {object} student the logged-in student
 * @param {object[]} checkIns the student's check-ins, newest first
 * @param {object[]} practitioners all published practitioner profiles
 * @param {object[]} schoolResources all published school resources
 */
function recommend(student, checkIns, practitioners, schoolResources) {
  const needs = deriveNeeds(checkIns);

  // FR-8 / UC-3 A1 - the student's own campus services come first.
  const campus = schoolResources
    .filter((r) => !student.school || r.school === student.school)
    .map((r) => ({ ...r, source: 'school' }));

  const otherCampus = schoolResources
    .filter((r) => student.school && r.school !== student.school)
    .map((r) => ({ ...r, source: 'school-other' }));

  const ranked = practitioners
    .filter((p) => p.published !== false)
    .map((p) => ({ ...p, source: 'practitioner', matchScore: scorePractitioner(p, needs) }))
    .sort((a, b) => b.matchScore - a.matchScore);

  // Plain-language names for the derived needs - the internal keys are not
  // something a student should ever see.
  const NEED_LABELS = {
    mood: 'low mood',
    stress: 'high stress',
    sleep: 'sleep',
    crisis: 'immediate crisis support',
    academic: 'academic pressure',
  };

  const labels = needs.map((need) => NEED_LABELS[need] || need);
  const readable =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

  const counted = Math.min(checkIns.length, 14);
  const reason = needs.length
    ? `Your last ${counted} check-in${counted === 1 ? '' : 's'} point to ${readable}, so those come first below.`
    : 'Log a few check-ins and these recommendations will be tailored to what your entries show.';

  return {
    needs,
    reason,
    schoolResources: campus,
    otherSchoolResources: otherCampus,
    practitioners: ranked,
  };
}

module.exports = { recommend, deriveNeeds, scorePractitioner };
