// Unit tests for ReportGenerator (FR-4).
// The clock is injected so the rolling seven-day window is deterministic.

const { generateWeeklyReport, weekStart } = require('../services/reportGenerator');

const NOW = new Date('2026-11-11T18:00:00.000Z'); // a Wednesday

/** Builds a check-in `daysAgo` days before NOW. */
function entry(daysAgo, moodScore, stressLevel, sleepHours = 7) {
  const timestamp = new Date(NOW);
  timestamp.setUTCDate(timestamp.getUTCDate() - daysAgo);
  return {
    id: `chk_${daysAgo}`,
    studentId: 'usr_1',
    timestamp: timestamp.toISOString(),
    moodScore,
    stressLevel,
    sleepHours,
    thoughts: '',
    crisisFlagged: moodScore <= 2 || stressLevel >= 9,
  };
}

describe('generateWeeklyReport', () => {
  test('returns null until there are at least three check-ins (UC-2 A3)', () => {
    expect(generateWeeklyReport([], NOW)).toBeNull();
    expect(generateWeeklyReport([entry(1, 5, 5), entry(2, 6, 4)], NOW)).toBeNull();
  });

  test('summarises the last seven days, not the calendar week', () => {
    // Mon and Tue of this calendar week, plus four days that fall in the
    // previous calendar week but inside the rolling seven-day window.
    const checkIns = [
      entry(1, 5, 8),
      entry(2, 6, 7),
      entry(3, 6, 7),
      entry(4, 7, 6),
      entry(5, 7, 5),
      entry(6, 6, 6),
    ];
    const report = generateWeeklyReport(checkIns, NOW);

    expect(report.entryCount).toBe(6);
    expect(report.averages.mood).toBeCloseTo(6.17, 1);
    expect(report.summary).toContain('last seven days');
  });

  test('compares against the seven days before that', () => {
    const recent = [entry(1, 4, 8), entry(2, 4, 8), entry(3, 4, 8)];
    const older = [entry(8, 8, 3), entry(9, 8, 3), entry(10, 8, 3)];

    const report = generateWeeklyReport([...recent, ...older], NOW);

    expect(report.averages.mood).toBeCloseTo(4, 5);
    expect(report.previousAverages.mood).toBeCloseTo(8, 5);
    expect(report.insights.join(' ')).toMatch(/Average mood fell from 8.0 to 4.0/);
  });

  test('falls back to the most recent seven days when nothing is current', () => {
    const stale = [entry(30, 6, 5), entry(31, 6, 5), entry(32, 7, 4)];
    const report = generateWeeklyReport(stale, NOW);

    expect(report.entryCount).toBe(3);
    expect(report.insights[0]).toMatch(/have not checked in for over a week/);
  });

  test('reports crisis-flagged entries in the window', () => {
    const checkIns = [entry(1, 1, 10), entry(2, 5, 5), entry(3, 6, 4)];
    const report = generateWeeklyReport(checkIns, NOW);
    expect(report.insights.join(' ')).toMatch(/crossed the crisis threshold/);
  });
});

describe('weekStart', () => {
  test('returns the Monday of the containing week', () => {
    expect(weekStart('2026-11-11T18:00:00.000Z')).toBe('2026-11-09');
    expect(weekStart('2026-11-09T00:30:00.000Z')).toBe('2026-11-09');
    expect(weekStart('2026-11-15T23:00:00.000Z')).toBe('2026-11-09');
  });
});
