// CrisisService  (SDD section 2.5.2 - Services package)
// Implements FR-6: detect a high-risk check-in and return immediate crisis resources.
//
// assessRisk() is the unit under test in the Deliverable #2 Test Plan (section 4.2).
// It is kept as a pure, side-effect-free function so it can be unit tested in
// isolation with Jest - see server/tests/crisisService.test.js

// Thresholds for moodScore and stressLevel for a check-in to be seen as a risk
const MOOD_THRESHOLD = 2;
const STRESS_THRESHOLD = 9;

/**
 * Returns true if the student's check-in shows signs of crisis.
 * @param {{moodScore:number, stressLevel:number}} checkIn
 * @returns {boolean} true when mood is at/below 2 OR stress is at/above 9
 * @throws {Error} when checkIn is missing, non-numeric, or outside [1-10]
 */
function assessRisk(checkIn) {
  // Throw error if checkIn does not exist or stress and mood values are not numbers
  if (
    checkIn === null ||
    checkIn === undefined ||
    typeof checkIn.stressLevel !== 'number' ||
    typeof checkIn.moodScore !== 'number'
  ) {
    throw new Error('Invalid mood/stress levels');
  }

  // Variables for userStress and userMood
  const userStress = checkIn.stressLevel;
  const userMood = checkIn.moodScore;

  // Throw error if values of mood or stress from check-in are not [1-10]
  if (userStress > 10 || userStress < 1 || userMood > 10 || userMood < 1) {
    throw new Error('Invalid mood/stress levels. Must be [1-10].');
  }

  // Return true if either mood or stress passed the threshold
  return userMood <= MOOD_THRESHOLD || userStress >= STRESS_THRESHOLD;
}

/**
 * Explains which threshold triggered the crisis flag. Used by the UI so the
 * unskippable alert (Safety NFR) can tell the student what the system noticed.
 */
function riskReasons(checkIn) {
  const reasons = [];
  if (checkIn.moodScore <= MOOD_THRESHOLD) {
    reasons.push('your reported mood is very low');
  }
  if (checkIn.stressLevel >= STRESS_THRESHOLD) {
    reasons.push('your reported stress is very high');
  }
  return reasons;
}

/**
 * FR-6 / UC-3 A2: immediate crisis resources returned with a high-risk check-in.
 * These are national services that do not depend on the student's school.
 */
function getCrisisResources() {
  return [
    {
      id: 'cr-988',
      title: '988 Suicide & Crisis Lifeline',
      hotlineNumber: '988',
      region: 'United States',
      description: 'Free, confidential support 24/7. Call or text 988.',
      action: 'tel:988',
    },
    {
      id: 'cr-text',
      title: 'Crisis Text Line',
      hotlineNumber: '741741',
      region: 'United States',
      description: 'Text HOME to 741741 to reach a trained crisis counselor.',
      action: 'sms:741741',
    },
    {
      id: 'cr-911',
      title: 'Emergency Services',
      hotlineNumber: '911',
      region: 'United States',
      description: 'If you are in immediate physical danger, call 911.',
      action: 'tel:911',
    },
    {
      id: 'cr-utd',
      title: 'UTD Student Counseling Center - 24/7 Crisis Line',
      hotlineNumber: '972-883-2575',
      region: 'UT Dallas campus',
      description: 'Press 2 after hours to reach the on-call counselor.',
      action: 'tel:9728832575',
    },
  ];
}

module.exports = {
  assessRisk,
  riskReasons,
  getCrisisResources,
  MOOD_THRESHOLD,
  STRESS_THRESHOLD,
};
