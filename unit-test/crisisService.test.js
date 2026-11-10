//This file includes automated tests for the assessRisk function 

// Load assessRisk function into this file
const { assessRisk } = require('./crisisService');

// Tests with valid input -> true
test('TC-1: risk due to moodScore', () => {
  expect(assessRisk({ moodScore: 1, stressLevel: 6 })).toBe(true);
});

test('TC-2: risk due to stressLevel', () => {
  expect(assessRisk({ moodScore: 4, stressLevel: 10 })).toBe(true);
});

test('TC-3: risk due to moodScore (exact threshold)', () => {
  expect(assessRisk({ moodScore: 2, stressLevel: 6 })).toBe(true);
});

test('TC-4: risk due to stressLevel (exact threshold)', () => {
  expect(assessRisk({ moodScore: 4, stressLevel: 9 })).toBe(true);
});

// Tests with valid input -> false
test('TC-5: no risk just past STRESS_THRESHOLD', () => {
  expect(assessRisk({ moodScore: 5, stressLevel: 8 })).toBe(false);
});

test('TC-6: no risk just past MOOD_THRESHOLD', () => {
  expect(assessRisk({ moodScore: 3, stressLevel: 5 })).toBe(false);
});

// Test cases with invalid input -> throw error
test('TC-7: stressLevel not in range [1-10]', () => {
  expect(() => assessRisk({ moodScore: 5, stressLevel: 11 })).toThrow();
});

test('TC-8: moodScore not in range [1-10]', () => {
  expect(() => assessRisk({ moodScore: 0, stressLevel: 4 })).toThrow();
});

test('TC-9: non-number moodScore', () => {
  expect(() => assessRisk({ moodScore: 'string', stressLevel: 4 })).toThrow();
});

test('TC-10: non-number stressLevel', () => {
  expect(() => assessRisk({ moodScore: 6, stressLevel: 'string' })).toThrow();
});

test('TC-11: null checkIn', () => {
  expect(() => assessRisk(null)).toThrow();
});

test('TC-12: undefined checkIn', () => {
  expect(() => assessRisk()).toThrow();
});

