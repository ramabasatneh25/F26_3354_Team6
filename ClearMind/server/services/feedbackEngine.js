// FeedbackEngine  (SDD section 2.5.2 - Services package)
// Implements FR-2: personalized feedback at each check-in.
//
// Feedback is rule-based and derived from the student's own recent history, not
// from a diagnostic model. The Ethical NFR forbids diagnosing conditions, so
// every message describes what the data shows and suggests a habit - it never
// names a condition or tells a student they do or do not need professional care.

const POSITIVE_HABITS = [
  'a 10-minute walk outside between classes',
  'putting your phone on do-not-disturb an hour before bed',
  'messaging one friend you have not talked to this week',
  'writing down the single task that would make tomorrow easier',
  'a short stretch break every time you finish a study block',
];

/** Average of a numeric field across a list of check-ins. */
function average(checkIns, field) {
  if (!checkIns.length) return null;
  const sum = checkIns.reduce((acc, c) => acc + c[field], 0);
  return sum / checkIns.length;
}

/**
 * Builds feedback for a newly submitted check-in.
 * @param {object} checkIn the check-in just saved
 * @param {object[]} history the student's previous check-ins, newest first
 * @returns {{message:string, insights:string[], trend:string}}
 */
function generateFeedback(checkIn, history = []) {
  const recent = history.slice(0, 7);
  const insights = [];

  // Mood relative to the student's own recent baseline (FR-2).
  const moodAvg = average(recent, 'moodScore');
  let trend = 'steady';
  if (moodAvg !== null) {
    const delta = checkIn.moodScore - moodAvg;
    if (delta >= 1.5) {
      trend = 'up';
      insights.push(
        `Your mood today (${checkIn.moodScore}/10) is noticeably higher than your recent average of ${moodAvg.toFixed(1)}. Whatever changed this week, it is worth repeating.`
      );
    } else if (delta <= -1.5) {
      trend = 'down';
      insights.push(
        `Your mood today (${checkIn.moodScore}/10) is lower than your recent average of ${moodAvg.toFixed(1)}. A dip after a heavy week is common - keep checking in so you can see whether it recovers.`
      );
    } else {
      insights.push(
        `Your mood is holding close to your recent average of ${moodAvg.toFixed(1)}/10.`
      );
    }
  } else {
    insights.push(
      'This is your first check-in, so there is no baseline yet. After about a week of entries ClearMind can show you how things are trending.'
    );
  }

  // Stress.
  if (checkIn.stressLevel >= 8) {
    insights.push(
      `Stress at ${checkIn.stressLevel}/10 is high. Narrowing the week down to the two things that actually have deadlines tends to help more than trying to do everything.`
    );
  } else if (checkIn.stressLevel <= 3) {
    insights.push(`Stress at ${checkIn.stressLevel}/10 is low - a good week to get ahead on work.`);
  }

  // Sleep, which is the lever students have the most control over.
  if (typeof checkIn.sleepHours === 'number') {
    if (checkIn.sleepHours < 6) {
      insights.push(
        `You logged ${checkIn.sleepHours} hours of sleep. Short sleep tends to show up as low mood and high stress the next day, so it is usually the first thing worth protecting.`
      );
    } else if (checkIn.sleepHours >= 8) {
      insights.push(`${checkIn.sleepHours} hours of sleep is solid - that is a habit to keep.`);
    }
  }

  // One concrete, rotating suggestion so feedback does not read the same daily.
  const habit = POSITIVE_HABITS[history.length % POSITIVE_HABITS.length];
  insights.push(`Something small to try before your next check-in: ${habit}.`);

  const headline =
    trend === 'up'
      ? 'Things are trending up this week.'
      : trend === 'down'
      ? 'This looks like a harder day than usual.'
      : 'Thanks for checking in today.';

  return {
    message: headline,
    insights,
    trend,
  };
}

module.exports = { generateFeedback, average };
