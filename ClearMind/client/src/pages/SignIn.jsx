import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { role: 'Student', email: 'student@utdallas.edu' },
  { role: 'Practitioner', email: 'practitioner@clearmind.app' },
  { role: 'School admin', email: 'admin@utdallas.edu' },
];
const DEMO_PASSWORD = 'ClearMind2026';

export default function SignIn() {
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState('sign-in');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    school: 'The University of Texas at Dallas',
    consent: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await signIn({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function useDemo(email) {
    setMode('sign-in');
    setForm((prev) => ({ ...prev, email, password: DEMO_PASSWORD }));
    setError('');
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Left: what the product is for. The scale is the product, so the page
          opens on the question a student actually answers every day. */}
      <section className="flex flex-col justify-between bg-ink px-6 py-10 text-paper sm:px-12 lg:py-16">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl">ClearMind</span>
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-moss" />
        </div>

        <div className="my-12 lg:my-0">
          <p className="text-lg text-paper/70">How are you doing today?</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {[3, 4, 5, 6, 7].map((n, i) => (
              <span
                key={n}
                className="font-display leading-none"
                style={{
                  fontSize: `${2.5 + i * 0.9}rem`,
                  opacity: 0.25 + i * 0.19,
                }}
              >
                {n}
              </span>
            ))}
          </div>
          <h1 className="mt-8 max-w-reading text-4xl leading-tight text-paper sm:text-5xl">
            Two numbers a day, and a record of what they add up to.
          </h1>
          <p className="mt-5 max-w-reading text-paper/75">
            ClearMind is a check-in that takes under three minutes. It shows you how your mood and
            stress move over a semester, and puts campus counseling and crisis support one tap away
            when you need them.
          </p>
        </div>

        <p className="max-w-reading text-sm text-paper/60">
          A wellness tool built for students, not a medical service. If you are in immediate danger,
          call 911. For free confidential support any time, call or text 988.
        </p>
      </section>

      {/* Right: the form. */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="flex gap-6 border-b border-line">
            {[
              ['sign-in', 'Sign in'],
              ['register', 'Create account'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setError('');
                }}
                className={`-mb-px border-b-2 pb-3 font-medium transition-colors ${
                  mode === key
                    ? 'border-moss text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="mb-1 block font-medium">
                  Your name
                </label>
                <input
                  id="name"
                  className="field"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1 block font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="field"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="field"
                value={form.password}
                onChange={set('password')}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
              />
              {mode === 'register' && (
                <p className="mt-1 text-sm text-muted">At least 8 characters.</p>
              )}
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="role" className="mb-1 block font-medium">
                    I am a
                  </label>
                  <select id="role" className="field" value={form.role} onChange={set('role')}>
                    <option value="student">Student</option>
                    <option value="practitioner">Mental health practitioner</option>
                    <option value="school_admin">School administrator</option>
                  </select>
                </div>

                {form.role !== 'practitioner' && (
                  <div>
                    <label htmlFor="school" className="mb-1 block font-medium">
                      School
                    </label>
                    <input
                      id="school"
                      className="field"
                      value={form.school}
                      onChange={set('school')}
                    />
                  </div>
                )}

                {/* Ethical NFR: consent is collected before anything is recorded. */}
                {form.role === 'student' && (
                  <label className="flex gap-3 rounded border border-line bg-surface p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={set('consent')}
                      className="mt-1 h-4 w-4 shrink-0 accent-moss"
                      required
                    />
                    <span>
                      I agree to ClearMind storing my check-ins so it can show me my trends. I can
                      export or delete this data at any time, and it is never sold or shared.
                    </span>
                  </label>
                )}
              </>
            )}

            {error && (
              <p role="alert" className="rounded border border-signal/30 bg-signal/5 p-3 text-signal">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-8 border-t border-line pt-5">
            <p className="text-sm text-muted">
              Reviewing the project? These seeded accounts all use the password{' '}
              <code className="rounded bg-paper px-1 py-0.5 text-ink">{DEMO_PASSWORD}</code>.
            </p>
            <ul className="mt-3 space-y-1">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted">{account.role}</span>
                  <button
                    type="button"
                    onClick={() => useDemo(account.email)}
                    className="text-sm text-moss-deep underline underline-offset-4 hover:text-ink"
                  >
                    {account.email}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
