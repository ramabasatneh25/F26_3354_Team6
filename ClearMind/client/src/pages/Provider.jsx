import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

/**
 * UC-4 Provide Mental Health Resources.
 * FR-7 practitioner profiles, FR-8 school resources, UC-4 A1 bulk CSV/JSON
 * import, UC-4 A2 invalid rows are reported and nothing is published.
 */

const SAMPLE_CSV = `title,serviceType,contactInfo,hours,description
Peer Support Drop-In,Group Program,peersupport@utdallas.edu,Tue & Thu 5-6pm,Student-led drop-in group. No appointment needed.
Mindfulness Lab,Workshop,mindfulness@utdallas.edu,Mon 12-1pm,Guided practice sessions between classes.
Sleep Clinic Referral,Referral,health@utdallas.edu,,Referral to the campus health center sleep program.`;

/**
 * FR-7, practitioner half: finding students who have opted in.
 * This list is built only from what students published about themselves. No
 * check-in, score or derived risk is ever sent to a practitioner.
 */
function FindStudents() {
  const [students, setStudents] = useState([]);
  const [sent, setSent] = useState([]);
  const [openFor, setOpenFor] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [{ students: rows }, { requests }] = await Promise.all([
      api.discoverableStudents(),
      api.listConnections(),
    ]);
    setStudents(rows);
    setSent(requests);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function send(studentId) {
    setError('');
    setBusy(true);
    try {
      await api.sendConnectionRequest({ studentId, message });
      setOpenFor(null);
      setMessage('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const statusFor = (studentId) => sent.find((r) => r.studentId === studentId)?.status;

  return (
    <section className="mt-16 border-t border-line pt-12">
      <h2 className="text-2xl">Students looking for support</h2>
      <p className="mt-2 max-w-reading text-muted">
        Students who chose to be findable. You can see their first name, school and the areas they
        picked — never their check-ins or anything ClearMind infers from them. Their email reaches
        you only if they accept.
      </p>

      {error && (
        <p role="alert" className="mt-5 border border-signal/30 bg-signal/5 p-3 text-signal">
          {error}
        </p>
      )}

      {students.length === 0 ? (
        <p className="mt-5 text-muted">No students are currently accepting requests.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {students.map((student) => {
            const status = statusFor(student.id);
            return (
              <li key={student.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h3 className="text-xl">{student.displayName}</h3>
                  <span className="text-sm text-muted">{student.school}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {student.supportAreas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full bg-moss-pale px-3 py-0.5 text-sm text-moss-deep"
                    >
                      {area}
                    </span>
                  ))}
                </div>

                {status ? (
                  <p
                    className={`mt-4 text-sm ${
                      status === 'accepted'
                        ? 'text-moss-deep'
                        : status === 'declined'
                        ? 'text-muted'
                        : 'text-muted'
                    }`}
                  >
                    {status === 'pending' && 'Request sent — waiting for them to answer.'}
                    {status === 'accepted' &&
                      `Accepted. Contact them at ${
                        sent.find((r) => r.studentId === student.id)?.studentEmail
                      }`}
                    {status === 'declined' && 'They declined this request.'}
                  </p>
                ) : openFor === student.id ? (
                  <div className="mt-4 max-w-xl">
                    <label
                      htmlFor={`msg-${student.id}`}
                      className="mb-1 block text-sm font-medium"
                    >
                      A short note to {student.displayName}
                    </label>
                    <textarea
                      id={`msg-${student.id}`}
                      rows="3"
                      className="field resize-y"
                      placeholder="Introduce yourself and say how you could help."
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => send(student.id)}
                        disabled={busy}
                        className="btn-primary"
                      >
                        {busy ? 'Sending…' : 'Send request'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenFor(null);
                          setMessage('');
                        }}
                        className="btn-quiet"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFor(student.id);
                      setMessage('');
                    }}
                    className="btn-quiet mt-4"
                  >
                    Send a connection request
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PractitionerPortal() {
  const [form, setForm] = useState({
    name: '',
    credentials: '',
    specialties: '',
    contactInfo: '',
    location: '',
    bio: '',
    acceptingStudents: true,
    acceptsStudentInsurance: false,
    telehealth: false,
  });
  const [status, setStatus] = useState(null);
  const [missing, setMissing] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.myPractitionerProfile().then(({ practitioner }) => {
      if (practitioner) {
        setForm({
          ...practitioner,
          specialties: practitioner.specialties.join(', '),
        });
        setStatus('loaded');
      }
    });
  }, []);

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setMissing([]);
    try {
      await api.savePractitionerProfile(form);
      setStatus('published');
    } catch (err) {
      setError(err.message);
      setMissing(err.body?.missing || []);
    }
  }

  const invalid = (field) => missing.includes(field);

  return (
    <>
      <h1 className="text-4xl">My practitioner profile</h1>
      <p className="mt-3 max-w-reading text-muted">
        What you publish here is what students see on their Support page. Students are matched to
        you by specialty, so be specific.
      </p>

      <form onSubmit={onSubmit} className="mt-10 max-w-2xl space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="p-name" className="mb-1 block font-medium">
              Display name
            </label>
            <input
              id="p-name"
              className={`field ${invalid('name') ? 'border-signal' : ''}`}
              value={form.name}
              onChange={set('name')}
            />
          </div>
          <div>
            <label htmlFor="p-cred" className="mb-1 block font-medium">
              Credentials
            </label>
            <input
              id="p-cred"
              className="field"
              placeholder="Licensed Professional Counselor"
              value={form.credentials}
              onChange={set('credentials')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="p-spec" className="mb-1 block font-medium">
            Specialties
          </label>
          <input
            id="p-spec"
            className={`field ${invalid('specialties') ? 'border-signal' : ''}`}
            placeholder="Anxiety, Stress, CBT"
            value={form.specialties}
            onChange={set('specialties')}
          />
          <p className="mt-1 text-sm text-muted">Separate with commas.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="p-contact" className="mb-1 block font-medium">
              How students reach you
            </label>
            <input
              id="p-contact"
              className={`field ${invalid('contactInfo') ? 'border-signal' : ''}`}
              placeholder="name@practice.com | (972) 555-0100"
              value={form.contactInfo}
              onChange={set('contactInfo')}
            />
          </div>
          <div>
            <label htmlFor="p-loc" className="mb-1 block font-medium">
              Location
            </label>
            <input
              id="p-loc"
              className="field"
              placeholder="Richardson, TX"
              value={form.location}
              onChange={set('location')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="p-bio" className="mb-1 block font-medium">
            Short description
          </label>
          <textarea
            id="p-bio"
            rows="3"
            className="field resize-y"
            value={form.bio}
            onChange={set('bio')}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">Availability</legend>
          {[
            ['acceptingStudents', 'Currently taking new students'],
            ['acceptsStudentInsurance', 'Accepts student insurance'],
            ['telehealth', 'Offers telehealth appointments'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={set(key)}
                className="h-4 w-4 accent-moss"
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        {error && (
          <div role="alert" className="border border-signal/30 bg-signal/5 p-3">
            <p className="text-signal">{error}</p>
            {missing.length > 0 && (
              <p className="mt-1 text-sm text-ink">
                Fill in: {missing.join(', ')}. Nothing was published.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-line pt-6">
          <button type="submit" className="btn-primary">
            Publish to students
          </button>
          {status === 'published' && <span className="text-moss-deep">Published.</span>}
        </div>
      </form>

      <FindStudents />
    </>
  );
}

function SchoolPortal() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState({
    title: '',
    serviceType: '',
    contactInfo: '',
    hours: '',
    description: '',
    cost: 'Included with tuition',
  });
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState('csv');
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState([]);

  async function refresh() {
    const { resources: rows } = await api.mySchoolResources();
    setResources(rows);
  }

  useEffect(() => {
    refresh();
  }, []);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setMissing([]);
    try {
      await api.saveSchoolResource(form);
      setForm({
        title: '',
        serviceType: '',
        contactInfo: '',
        hours: '',
        description: '',
        cost: 'Included with tuition',
      });
      await refresh();
    } catch (err) {
      setError(err.message);
      setMissing(err.body?.missing || []);
    }
  }

  async function onImport(event) {
    event.preventDefault();
    setError('');
    setImportResult(null);
    try {
      const result = await api.importResources({ format: importFormat, payload: importText });
      setImportResult(result);
      await refresh();
    } catch (err) {
      setError(err.message);
      if (err.body?.rejected) setImportResult(err.body);
    }
  }

  const invalid = (field) => missing.includes(field);

  return (
    <>
      <h1 className="text-4xl">Campus resources</h1>
      <p className="mt-3 max-w-reading text-muted">
        Anything published here appears at the top of the Support page for students at{' '}
        {user.school || 'your school'}, above outside practitioners.
      </p>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-2xl">Add one service</h2>
        <form onSubmit={onSubmit} className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="s-title" className="mb-1 block font-medium">
                Service name
              </label>
              <input
                id="s-title"
                className={`field ${invalid('title') ? 'border-signal' : ''}`}
                value={form.title}
                onChange={set('title')}
              />
            </div>
            <div>
              <label htmlFor="s-type" className="mb-1 block font-medium">
                Type
              </label>
              <input
                id="s-type"
                className={`field ${invalid('serviceType') ? 'border-signal' : ''}`}
                placeholder="Counseling"
                value={form.serviceType}
                onChange={set('serviceType')}
              />
            </div>
            <div>
              <label htmlFor="s-contact" className="mb-1 block font-medium">
                Contact
              </label>
              <input
                id="s-contact"
                className={`field ${invalid('contactInfo') ? 'border-signal' : ''}`}
                placeholder="(972) 883-2575 | SSB 4.600"
                value={form.contactInfo}
                onChange={set('contactInfo')}
              />
            </div>
            <div>
              <label htmlFor="s-hours" className="mb-1 block font-medium">
                Hours
              </label>
              <input
                id="s-hours"
                className="field"
                placeholder="Mon-Fri 8am - 5pm"
                value={form.hours}
                onChange={set('hours')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="s-desc" className="mb-1 block font-medium">
              What students should know
            </label>
            <textarea
              id="s-desc"
              rows="2"
              className="field resize-y"
              value={form.description}
              onChange={set('description')}
            />
          </div>

          {error && (
            <div role="alert" className="border border-signal/30 bg-signal/5 p-3">
              <p className="text-signal">{error}</p>
              {missing.length > 0 && (
                <p className="mt-1 text-sm text-ink">
                  Fill in: {missing.join(', ')}. Nothing was published.
                </p>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary">
            Publish service
          </button>
        </form>
      </section>

      {/* UC-4 A1 bulk import */}
      <section className="mt-14 max-w-2xl">
        <h2 className="text-2xl">Import many at once</h2>
        <p className="mt-2 max-w-reading text-muted">
          Paste a CSV or JSON export from your existing directory. Rows missing a required field
          are listed back to you and are not published.
        </p>

        <form onSubmit={onImport} className="mt-5 space-y-4">
          <div className="flex items-center gap-4">
            {['csv', 'json'].map((format) => (
              <label key={format} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="format"
                  value={format}
                  checked={importFormat === format}
                  onChange={() => setImportFormat(format)}
                  className="h-4 w-4 accent-moss"
                />
                <span>{format.toUpperCase()}</span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                setImportFormat('csv');
                setImportText(SAMPLE_CSV);
              }}
              className="text-sm text-moss-deep underline underline-offset-4"
            >
              Load a sample file
            </button>
          </div>

          <textarea
            rows="6"
            className="field resize-y font-mono text-sm"
            placeholder="title,serviceType,contactInfo,hours,description"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />

          <button type="submit" className="btn-primary" disabled={!importText.trim()}>
            Import
          </button>
        </form>

        {importResult && (
          <div className="mt-5 panel p-4">
            <p className="font-medium">
              {importResult.importedCount} published, {importResult.rejectedCount} skipped.
            </p>
            {importResult.rejected?.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {importResult.rejected.map((row) => (
                  <li key={row.row} className="text-signal">
                    Row {row.row} ({row.title}) is missing: {row.missing.join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-14 max-w-2xl">
        <h2 className="text-2xl">Published ({resources.length})</h2>
        {resources.length === 0 ? (
          <p className="mt-3 text-muted">Nothing published yet.</p>
        ) : (
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {resources.map((resource) => (
              <li key={resource.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6">
                  <h3 className="text-lg font-medium">{resource.title}</h3>
                  <span className="text-sm text-muted">{resource.serviceType}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {resource.contactInfo}
                  {resource.hours ? ` — ${resource.hours}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Provider() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-10 lg:py-16">
      {user.role === 'practitioner' ? <PractitionerPortal /> : <SchoolPortal />}
    </div>
  );
}
