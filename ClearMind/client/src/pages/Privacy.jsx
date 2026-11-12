import { useState } from 'react';
import { api, getToken } from '../api';
import { useAuth } from '../context/AuthContext';
import Discoverability from '../components/Discoverability';

/**
 * Legislative-Privacy NFR: students can view or remove their data on request
 * (FERPA / HIPAA). Backs UC-2 A2 Remove My Data.
 */
export default function Privacy() {
  const { user, signOut, updateUser } = useAuth();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setError('');
    setBusy(true);
    try {
      // Fetched directly so the browser saves it as a file rather than
      // rendering JSON in the page.
      const response = await fetch('/api/account/export', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'clearmind-my-data.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('Your data was downloaded as clearmind-my-data.json.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCheckIns() {
    const ok = window.confirm(
      'Permanently delete every check-in you have logged? Your account stays, but the history cannot be recovered.'
    );
    if (!ok) return;
    setError('');
    setBusy(true);
    try {
      const { deletedCount } = await api.deleteAllCheckIns();
      setStatus(`${deletedCount} check-in${deletedCount === 1 ? '' : 's'} deleted.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 lg:py-16">
      <h1 className="text-4xl">My data</h1>
      <p className="mt-3 max-w-reading text-muted">
        You own what ClearMind stores about you. Take a copy or erase it whenever you want.
      </p>

      <dl className="mt-10 divide-y divide-line border-y border-line">
        {[
          ['Account', user.name, false],
          ['Email', user.email, false],
          ['Account type', user.role.replace('_', ' '), true],
          [
            'Consent given',
            user.consentGivenAt
              ? new Date(user.consentGivenAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Not applicable for this account type',
            false,
          ],
        ].map(([label, value, capitalize]) => (
          <div key={label} className="flex flex-wrap gap-x-6 py-3">
            <dt className="w-36 shrink-0 text-muted">{label}</dt>
            <dd className={capitalize ? 'capitalize' : ''}>{value}</dd>
          </div>
        ))}
      </dl>

      {status && (
        <p className="mt-6 border border-moss/40 bg-moss-pale p-3 text-moss-deep">{status}</p>
      )}
      {error && (
        <p role="alert" className="mt-6 border border-signal/30 bg-signal/5 p-3 text-signal">
          {error}
        </p>
      )}

      <section className="mt-12 space-y-8">
        {/* FR-7, student half: opting in to be findable by practitioners. */}
        {user.role === 'student' && (
          <div className="border-b border-line pb-8">
            <Discoverability user={user} onChange={updateUser} />
          </div>
        )}

        <div>
          <h2 className="text-2xl">Download everything</h2>
          <p className="mt-2 max-w-reading text-muted">
            A JSON file with your account, every check-in, and the access log of when your data was
            read.
          </p>
          <button type="button" onClick={exportData} disabled={busy} className="btn-quiet mt-4">
            Download my data
          </button>
        </div>

        {user.role === 'student' && (
          <div>
            <h2 className="text-2xl">Erase my check-in history</h2>
            <p className="mt-2 max-w-reading text-muted">
              Deletes every check-in you have logged. Your account stays open so you can start
              again. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={deleteCheckIns}
              disabled={busy}
              className="btn mt-4 border border-signal/40 bg-surface text-signal hover:bg-signal hover:text-white"
            >
              Delete all my check-ins
            </button>
          </div>
        )}

        <div className="border-t border-line pt-8">
          <h2 className="text-2xl">How your data is handled</h2>
          <ul className="mt-4 max-w-reading space-y-3">
            <li>
              Your check-ins are visible only to you. Nobody else can read them — not a
              practitioner, not your school, not ClearMind staff.
            </li>
            <li>ClearMind does not sell or share your data with third parties.</li>
            <li>
              Every read and write of your check-in data is recorded in an access log, which you can
              download above.
            </li>
            <li>
              ClearMind is a wellness tool. It does not diagnose conditions and does not replace
              professional care or emergency services.
            </li>
          </ul>
          <button
            type="button"
            onClick={signOut}
            className="mt-6 text-muted underline underline-offset-4 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
