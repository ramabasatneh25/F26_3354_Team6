import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * UC-3 Receive Mental Health Support.
 * FR-5 recommends practitioners from the student's own check-in history,
 * FR-8 puts the student's campus services at the top (UC-3 A1), and FR-6
 * keeps crisis numbers on the page at all times (UC-3 A2 / A3).
 */
export default function Support() {
  const [data, setData] = useState(null);
  const [crisis, setCrisis] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  function loadRequests() {
    return api.listConnections().then(({ requests: rows }) => setRequests(rows));
  }

  useEffect(() => {
    Promise.all([api.recommendations(), api.crisisResources(), api.listConnections()])
      .then(([recommendations, crisisData, connections]) => {
        setData(recommendations);
        setCrisis(crisisData.resources);
        setRequests(connections.requests);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function respond(id, decision) {
    setError('');
    try {
      await api.respondToConnection(id, decision);
      await loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const accepted = requests.filter((r) => r.status === 'accepted');

  if (error) {
    return (
      <div className="px-6 py-16 sm:px-10">
        <p role="alert" className="border border-signal/30 bg-signal/5 p-3 text-signal">
          {error}
        </p>
      </div>
    );
  }
  if (!data) return <div className="px-6 py-16 text-muted sm:px-10">Finding support…</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-10 lg:py-16">
      <h1 className="text-4xl">Support</h1>
      <p className="mt-3 max-w-reading text-muted">{data.reason}</p>

      {/* FR-6: crisis numbers are never behind a click. */}
      <section className="mt-10 border-l-4 border-signal bg-signal/5 p-5">
        <h2 className="text-xl text-signal">If you need help right now</h2>
        <ul className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
          {crisis.map((resource) => (
            <li key={resource.id}>
              <a
                href={resource.action}
                className="font-display text-2xl text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal"
              >
                {resource.hotlineNumber}
              </a>
              <p className="text-sm text-muted">{resource.title}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* FR-7: requests from practitioners who found this student. The student
          decides; nothing is shared with the practitioner until they accept. */}
      {pending.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl">
            {pending.length === 1
              ? 'A practitioner would like to connect'
              : `${pending.length} practitioners would like to connect`}
          </h2>
          <p className="mt-2 max-w-reading text-muted">
            They can see your first name, your school and the areas you listed. Nothing else is
            shared unless you accept.
          </p>

          <ul className="mt-6 space-y-5">
            {pending.map((request) => (
              <li key={request.id} className="border border-line bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h3 className="text-xl">{request.practitioner.name}</h3>
                  <span className="text-sm text-muted">{request.practitioner.credentials}</span>
                </div>

                {request.practitioner.specialties?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.practitioner.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className="rounded-full bg-moss-pale px-3 py-0.5 text-sm text-moss-deep"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                )}

                {request.message && (
                  <blockquote className="mt-4 max-w-reading border-l-2 border-moss pl-4 leading-relaxed">
                    {request.message}
                  </blockquote>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => respond(request.id, 'accept')}
                    className="btn-primary"
                  >
                    Accept and share my email
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(request.id, 'decline')}
                    className="btn-quiet"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {accepted.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl">Practitioners you accepted</h2>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {accepted.map((request) => (
              <li key={request.id} className="py-4">
                <h3 className="text-lg font-medium">{request.practitioner.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {request.contactInfo || 'They will be in touch by email.'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FR-8 / UC-3 A1: campus services first. */}
      {data.schoolResources.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl">On your campus</h2>
          <p className="mt-2 max-w-reading text-muted">
            You have already paid for these through tuition, so they come first.
          </p>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {data.schoolResources.map((resource) => (
              <li key={resource.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h3 className="text-xl">{resource.title}</h3>
                  <span className="text-sm text-muted">{resource.cost}</span>
                </div>
                <p className="mt-2 max-w-reading">{resource.description}</p>
                <p className="mt-3 text-sm text-muted">
                  {resource.contactInfo}
                  {resource.hours ? ` — open ${resource.hours}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FR-5: tailored practitioner recommendations. */}
      <section className="mt-14">
        <h2 className="text-2xl">Practitioners who match what you have logged</h2>
        {data.practitioners.length === 0 ? (
          <p className="mt-3 text-muted">No practitioners have published a profile yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {data.practitioners.map((practitioner) => (
              <li key={practitioner.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h3 className="text-xl">{practitioner.name}</h3>
                  <span
                    className={`text-sm ${
                      practitioner.acceptingStudents ? 'text-moss-deep' : 'text-muted'
                    }`}
                  >
                    {practitioner.acceptingStudents
                      ? 'Taking new students'
                      : 'Not taking new students'}
                  </span>
                </div>

                <p className="text-sm text-muted">{practitioner.credentials}</p>
                <p className="mt-2 max-w-reading">{practitioner.bio}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {practitioner.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="rounded-full bg-moss-pale px-3 py-0.5 text-sm text-moss-deep"
                    >
                      {specialty}
                    </span>
                  ))}
                  {practitioner.telehealth && (
                    <span className="rounded-full border border-line px-3 py-0.5 text-sm text-muted">
                      Telehealth
                    </span>
                  )}
                  {practitioner.acceptsStudentInsurance && (
                    <span className="rounded-full border border-line px-3 py-0.5 text-sm text-muted">
                      Takes student insurance
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm text-muted">
                  {practitioner.contactInfo}
                  {practitioner.location ? ` — ${practitioner.location}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-12 max-w-reading text-sm text-muted">
        ClearMind does not diagnose anything and does not replace professional care. These are
        suggestions based on what you logged, not a treatment plan.
      </p>
    </div>
  );
}
