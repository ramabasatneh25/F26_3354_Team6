import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Scale from '../components/Scale';
import CrisisOverlay from '../components/CrisisOverlay';
import { useAuth } from '../context/AuthContext';

/**
 * UC-1 Complete Mental Health Check-In.
 * FR-1 logs mood, thoughts and wellness metrics; FR-2 returns personalized
 * feedback; UC-1 A1 shows the crisis alert first when the entry is flagged;
 * UC-1 A2 keeps the entry in the form if saving fails so it can be resubmitted.
 */
export default function CheckIn() {
  const { user } = useAuth();
  const [mood, setMood] = useState(5);
  const [stress, setStress] = useState(5);
  const [sleepHours, setSleepHours] = useState('7');
  const [thoughts, setThoughts] = useState('');

  const [result, setResult] = useState(null);
  const [crisis, setCrisis] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const firstName = user.name.split(' ')[0];

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await api.submitCheckIn({
        moodScore: mood,
        stressLevel: stress,
        sleepHours: sleepHours === '' ? null : Number(sleepHours),
        thoughts,
      });
      setResult(response);
      // UC-1 A1: the alert comes before the feedback, and cannot be skipped.
      if (response.crisis.flagged) setCrisis(response.crisis);
      setThoughts('');
    } catch (err) {
      // UC-1 A2: nothing is cleared, so the student can simply press again.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startAnother() {
    setResult(null);
    setMood(5);
    setStress(5);
    setThoughts('');
  }

  if (result) {
    const { feedback, checkIn } = result;
    return (
      <>
        {crisis && <CrisisOverlay {...crisis} onAcknowledge={() => setCrisis(null)} />}

        <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 lg:py-16">
          <p className="text-muted">
            Saved at{' '}
            {new Date(checkIn.timestamp).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          <h1 className="mt-2 text-4xl">{feedback.message}</h1>

          <div className="mt-8 flex gap-10">
            <div>
              <p className="text-sm text-muted">Mood</p>
              <p className="font-display text-5xl leading-none text-moss-deep">
                {checkIn.moodScore}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Stress</p>
              <p className="font-display text-5xl leading-none text-mulberry">
                {checkIn.stressLevel}
              </p>
            </div>
            {checkIn.sleepHours !== null && (
              <div>
                <p className="text-sm text-muted">Sleep</p>
                <p className="font-display text-5xl leading-none text-ink">{checkIn.sleepHours}</p>
              </div>
            )}
          </div>

          <ul className="mt-10 max-w-reading space-y-5 border-t border-line pt-8">
            {feedback.insights.map((insight) => (
              <li key={insight} className="border-l-2 border-moss pl-4 leading-relaxed">
                {insight}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn-primary">
              See how my week is going
            </Link>
            <Link to="/support" className="btn-quiet">
              Find support
            </Link>
            <button type="button" onClick={startAnother} className="btn-quiet">
              Log another entry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 lg:py-16">
      <h1 className="text-4xl">Hi {firstName}, how is today going?</h1>
      <p className="mt-3 max-w-reading text-muted">
        Answer honestly rather than optimistically. The numbers are only useful to you if they match
        how the day actually felt.
      </p>

      <form onSubmit={onSubmit} className="mt-12 space-y-12">
        <Scale
          id="mood"
          label="My mood today"
          value={mood}
          onChange={setMood}
          lowLabel="As low as it gets"
          highLabel="Really good"
          tint="moss"
        />

        <Scale
          id="stress"
          label="My stress today"
          value={stress}
          onChange={setStress}
          lowLabel="Totally calm"
          highLabel="Overwhelmed"
          tint="mulberry"
        />

        <div className="max-w-xs">
          <label htmlFor="sleep" className="mb-2 block text-lg font-medium">
            Hours of sleep last night
          </label>
          <input
            id="sleep"
            type="number"
            min="0"
            max="24"
            step="0.5"
            className="field"
            value={sleepHours}
            onChange={(event) => setSleepHours(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="thoughts" className="mb-2 block text-lg font-medium">
            Anything on your mind?
          </label>
          <p className="mb-2 max-w-reading text-sm text-muted">
            Optional. Only you can read this.
          </p>
          <textarea
            id="thoughts"
            rows="4"
            className="field max-w-reading resize-y"
            placeholder="Midterm week, barely slept, but the study group helped."
            value={thoughts}
            onChange={(event) => setThoughts(event.target.value)}
          />
        </div>

        {error && (
          <div role="alert" className="max-w-reading border border-signal/30 bg-signal/5 p-4">
            <p className="font-medium text-signal">{error}</p>
            <p className="mt-1 text-sm text-ink">
              Your answers are still here. Press the button again to resend them.
            </p>
          </div>
        )}

        <div className="border-t border-line pt-8">
          <button type="submit" className="btn-primary px-6 py-3 text-lg" disabled={busy}>
            {busy ? 'Saving…' : 'Save my check-in'}
          </button>
        </div>
      </form>
    </div>
  );
}
