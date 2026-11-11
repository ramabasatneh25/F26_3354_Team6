# assessRisk Unit Test

## How to run

Requires Node.js (nodejs.org).

```
cd unit-test
npm install
npm test
```

## Test Plan

**Scope:** The unit tested is the assessRisk method of the CrisisService class from the class diagram in section 2.5.2. This method indicates whether a user’s check-in is showing signs of crisis based on the values of moodScore and stressLevel. Because the full application was not implemented, the assessRisk method is implemented as a standalone JavaScript function to demonstrate the test plan.

**Objectives:** There are three behaviors being tested. The function returns true if either mood or stress passes or is at the threshold defined as MOOD_THRESHOLD = 2 and STRESS_THRESHOLD = 9 (for moodScore <= 2, for stressLevel >= 9). The function returns false if neither value meets or passes the threshold. The function throws an error if the input is invalid (not in range [1-10] for mood/stress, not a number, null object, undefined object).

**Approach:** We created automated tests using Jest, an automated JavaScript testing framework that matches our Node.js backend. Using equivalence partitioning, the test cases are split into 3 classes of input: crisis, non-crisis, and invalid input. Using boundary value analysis, we tested when each value, moodScore and stressLevel, exceeds the threshold (for moodScore <= 2, for stressLevel >= 9), when stress value is just under the threshold and when mood value is just above the threshold, when it is equal to the threshold, when values are not in the range [1-10], and when checkIn was null or undefined.

The unit passes if all 12 test cases have the expected output.
