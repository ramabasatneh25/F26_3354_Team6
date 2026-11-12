// ReportGenerator  (SDD section 2.5.2 - Services package)
// Implements FR-4: weekly reports summarising how a student's metrics changed.

const { average } = require('./feedbackEngine');

/** ISO date (YYYY-MM-DD) of the Monday that starts the week containing `date`. */
function weekStart(date) {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Groups check-ins into ISO weeks, newest week first. */
function groupByWeek(checkIns) {
  const weeks = new Map();
  for (const c of checkIns) {
    const key = weekStart(c.timestamp);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(c);
  }
  return [...weeks.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([start, entries]) => ({ weekStart: start, entries }));
}

function describeChange(current, previous, label, higherIsBetter) {
  if (previous === null || current === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) {
    return `${label} held steady at about ${current.toFixed(1)} compared with ${previous.toFixed(1)} the week before.`;
  }
  const rising = delta > 0;
  const good = higherIsBetter ? rising : !rising;
  const direction = rising ? 'rose' : 'fell';
  return `${label} ${direction} from ${previous.toFixed(1)} to ${current.toFixed(1)}${good ? ' - a change in the right direction.' : '.'}`;
}

/** Entries whose timestamp falls in [start, end). */
function inWindow(checkIns, start, end) {
  return checkIns.filter((c) => {
    const t = new Date(c.timestamp);
    return t >= start && t < end;
  });
}

/**
 * Builds the latest weekly report for a student.
 *
 * The window is the last seven days rather than the current calendar week.
 * A calendar week means that on a Monday or Tuesday the report summarises one
 * or two entries and compares them against a full week, which reads as a
 * collapse in mood that did not happen. A rolling seven days always compares
 * like with like, and a student checking in on Wednesday still gets a report.
 *
 * UC-2 A3: if there are fewer than three entries in total, no report is
 * produced and the caller tells the student a report is not available yet.
 *
 * @param {object[]} checkIns all of the student's check-ins (any order)
 * @param {Date} [now] injectable clock, used by the tests
 * @returns {object|null} the report, or null when there is not enough data
 */
function generateWeeklyReport(checkIns, now = new Date()) {
  const sorted = [...checkIns].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (sorted.length < 3) return null;

  const end = new Date(now);
  const sevenDaysAgo = new Date(end);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const fourteenDaysAgo = new Date(end);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

  const current = { weekStart: sevenDaysAgo.toISOString().slice(0, 10) };
  current.entries = inWindow(sorted, sevenDaysAgo, end);

  // If the student has not logged anything in the last seven days, fall back to
  // their most recent seven days of data rather than showing an empty report.
  if (!current.entries.length) {
    const latest = new Date(sorted[0].timestamp);
    const from = new Date(latest);
    from.setUTCDate(from.getUTCDate() - 7);
    current.entries = inWindow(sorted, from, new Date(latest.getTime() + 1));
    current.weekStart = from.toISOString().slice(0, 10);
    current.stale = true;
  }

  const priorEntries = inWindow(sorted, fourteenDaysAgo, sevenDaysAgo);
  const previous = priorEntries.length ? { entries: priorEntries } : null;

  const moodAvg = average(current.entries, 'moodScore');
  const stressAvg = average(current.entries, 'stressLevel');
  const sleepAvg = average(
    current.entries.filter((c) => typeof c.sleepHours === 'number'),
    'sleepHours'
  );

  const prevMood = previous ? average(previous.entries, 'moodScore') : null;
  const prevStress = previous ? average(previous.entries, 'stressLevel') : null;
  const prevSleep = previous
    ? average(previous.entries.filter((c) => typeof c.sleepHours === 'number'), 'sleepHours')
    : null;

  const insights = [
    describeChange(moodAvg, prevMood, 'Average mood', true),
    describeChange(stressAvg, prevStress, 'Average stress', false),
    describeChange(sleepAvg, prevSleep, 'Average sleep', true),
  ].filter(Boolean);

  if (current.stale) {
    insights.unshift(
      'You have not checked in for over a week, so this covers your most recent seven days of entries.'
    );
  }

  // Best and worst day of the week, which is usually the most actionable detail.
  const best = current.entries.reduce((a, b) => (b.moodScore > a.moodScore ? b : a));
  const worst = current.entries.reduce((a, b) => (b.moodScore < a.moodScore ? b : a));
  if (best.id !== worst.id) {
    const fmt = (c) => new Date(c.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
    insights.push(
      `Your highest mood this week was ${fmt(best)} (${best.moodScore}/10) and your lowest was ${fmt(worst)} (${worst.moodScore}/10).`
    );
  }

  const flagged = current.entries.filter((c) => c.crisisFlagged).length;
  if (flagged > 0) {
    insights.push(
      `${flagged} check-in${flagged > 1 ? 's' : ''} this week crossed the crisis threshold. Support options stay on your Support page.`
    );
  }

  if (!previous) {
    insights.push(
      'This is your first full week of data. Next week ClearMind can compare these numbers against this one.'
    );
  }

  return {
    weekStart: current.weekStart,
    entryCount: current.entries.length,
    summary: `${current.entries.length} check-in${current.entries.length > 1 ? 's' : ''} in the last seven days, averaging ${moodAvg.toFixed(1)}/10 mood and ${stressAvg.toFixed(1)}/10 stress.`,
    averages: {
      mood: moodAvg,
      stress: stressAvg,
      sleep: sleepAvg,
    },
    previousAverages: {
      mood: prevMood,
      stress: prevStress,
      sleep: prevSleep,
    },
    insights,
  };
}

module.exports = { generateWeeklyReport, groupByWeek, weekStart };
