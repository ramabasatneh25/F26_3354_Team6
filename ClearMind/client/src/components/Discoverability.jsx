import { useState } from 'react';
import { api } from '../api';

const SUGGESTED = [
  'Exam stress',
  'Sleep',
  'Low mood',
  'Anxiety',
  'Adjusting to campus',
  'Workload',
  'Homesickness',
];

/**
 * FR-7, student half. A practitioner can only find a student who has turned
 * this on, and can only see what the student typed here - never a check-in,
 * a score, or anything derived from one.
 */
export default function Discoverability({ user, onChange }) {
  const [optIn, setOptIn] = useState(Boolean(user.optInDiscoverable));
  const [areas, setAreas] = useState(user.supportAreas || []);
  const [custom, setCustom] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleArea(area) {
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  function addCustom(event) {
    event.preventDefault();
    const value = custom.trim();
    if (!value || areas.includes(value)) return;
    setAreas((prev) => [...prev, value]);
    setCustom('');
  }

  async function save() {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      const { user: updated } = await api.setDiscoverability({
        optInDiscoverable: optIn,
        supportAreas: areas,
      });
      onChange?.(updated);
      setStatus(
        optIn
          ? 'Saved. Practitioners taking new students can now send you a request.'
          : 'Saved. You are hidden from practitioners.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl">Let practitioners reach out</h2>
      <p className="mt-2 max-w-reading text-muted">
        Off by default. If you turn this on, practitioners who are taking new students can send you
        a request. They see your first name, your school, and the areas you pick below — never your
        check-ins, your scores, or anything ClearMind works out from them. Your email is only shared
        if you accept a request.
      </p>

      <label className="mt-5 flex items-start gap-3 border border-line bg-surface p-4">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(event) => setOptIn(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-moss"
        />
        <span>
          <span className="font-medium">Practitioners can find me</span>
          <span className="block text-sm text-muted">
            You can turn this off at any time. Turning it off hides you immediately.
          </span>
        </span>
      </label>

      {optIn && (
        <div className="mt-5">
          <p className="font-medium">What would you like help with?</p>
          <p className="mt-1 max-w-reading text-sm text-muted">
            In your words. Pick as many as apply, or add your own.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {[...new Set([...SUGGESTED, ...areas])].map((area) => {
              const on = areas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  aria-pressed={on}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    on
                      ? 'bg-moss text-white'
                      : 'border border-line bg-surface text-muted hover:border-moss hover:text-moss-deep'
                  }`}
                >
                  {area}
                </button>
              );
            })}
          </div>

          <form onSubmit={addCustom} className="mt-4 flex max-w-sm gap-2">
            <input
              className="field py-1"
              placeholder="Something else"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              aria-label="Add your own support area"
            />
            <button type="submit" className="btn-quiet py-1.5">
              Add
            </button>
          </form>
        </div>
      )}

      {status && (
        <p className="mt-5 border border-moss/40 bg-moss-pale p-3 text-moss-deep">{status}</p>
      )}
      {error && (
        <p role="alert" className="mt-5 border border-signal/30 bg-signal/5 p-3 text-signal">
          {error}
        </p>
      )}

      <button type="button" onClick={save} disabled={busy} className="btn-primary mt-5">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
