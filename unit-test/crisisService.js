// This code implements the assessRisk function where it checks based on user's check-in if it exceeds the risk threshold

// Thresholds for moodScore and stressLevel for it to be seen as a risk
const MOOD_THRESHOLD = 2;
const STRESS_THRESHOLD = 9;

//This function returns true if risk is shown from the user's checkIn
function assessRisk(checkIn)
{
    // Throw error if checkIn does not exist or stress and mood values are not numbers
    if (checkIn === null || checkIn === undefined || typeof checkIn.stressLevel !== 'number' || typeof checkIn.moodScore !== 'number' )
    {
        throw new Error('Invalid mood/stress levels');
    }

    // Variables for userStress and userMood
    let userStress = checkIn.stressLevel;
    let userMood = checkIn.moodScore;

    // Throw error if values of mood or stress from check-in are not [1-10]
    if (userStress > 10 || userStress < 1 || userMood > 10 || userMood < 1)
    {
        throw new Error('Invalid mood/stress levels. Must be [1-10].');
    }

    // Return true if either mood or stress passed the threshold
    return userMood <= MOOD_THRESHOLD || userStress >= STRESS_THRESHOLD;
}

module.exports = {assessRisk};  // Make assessRisk visible to other files
