import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api';

/**
 * UC-2 Track Mental Wellness.
 * FR-3 lists previous check-ins (with UC-2 A1 date filtering and UC-2 A2
 * removal); FR-4 shows the weekly report and trend.
 */

function formatDay(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line bg-surface px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{formatDay(label)}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [trend, setTrend] = useState([]);
  const [report, setReport] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [range, setRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async (filter) => {
    const { checkIns: rows } = await api.listCheckIns(filter);
    setCheckIns(rows);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [trendData, reportData] = await Promise.all([api.trend(30), api.weeklyReport()]);
      setTrend(trendData.series);
      setReport(reportData);
      await loadHistory({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loadHistory]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function applyFilter(event) {
    event.preventDefault();
    setError('');
    try {
      await loadHistory(range);
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearFilter() {
    setRange({ from: '', to: '' });
    await loadHistory({});
  }

  async function removeEntry(id) {
    // UC-2 A2: the system asks for confirmation before permanently removing data.
    const ok = window.confirm('Delete this check-in? This cannot be undone.');
    if (!ok) return;
    try {
      await api.deleteCheckIn(id);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="px-6 py-16 text-muted sm:px-10">Loading your wellness data…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-10 lg:py-16">
      <h1 className="text-4xl">My wellness</h1>
      <p className="mt-3 max-w-reading text-muted">
        Everything here is built from your own check-ins. Nobody else can see it.
      </p>

      {error && (
        <p role="alert" className="mt-6 border border-signal/30 bg-signal/5 p-3 text-signal">
          {error}
        </p>
      )}

      {/* FR-4 trend */}
      <section className="mt-12">
        <h2 className="text-2xl">The last 30 days</h2>
        {trend.length < 2 ? (
          <p className="mt-3 max-w-reading text-muted">
            Once you have a couple of check-ins, your mood and stress will be plotted here.{' '}
            <Link to="/check-in" className="text-moss-deep underline underline-offset-4">
              Log one now
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="mt-5 flex gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-6 bg-moss" aria-hidden="true" /> Mood
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-6 bg-mulberry" aria-hidden="true" /> Stress
              </span>
            </div>
            <div className="mt-4 h-72 w-full panel p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid stroke="#D7DEDC" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDay}
                    tick={{ fill: '#5A6A72', fontSize: 12 }}
                    stroke="#D7DEDC"
                    minTickGap={24}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    tick={{ fill: '#5A6A72', fontSize: 12 }}
                    stroke="#D7DEDC"
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    name="Mood"
                    stroke="#2F6F5E"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="stress"
                    name="Stress"
                    stroke="#7A3A58"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {/* FR-4 weekly report */}
      <section className="mt-14">
        <h2 className="text-2xl">Your week</h2>
        {report?.available ? (
          <div className="mt-4 panel p-6">
            <p className="text-lg">{report.report.summary}</p>
            <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
              {[
                ['Average mood', report.report.averages.mood, 'text-moss-deep'],
                ['Average stress', report.report.averages.stress, 'text-mulberry'],
                ['Average sleep', report.report.averages.sleep, 'text-ink'],
              ].map(([label, value, tint]) => (
                <div key={label}>
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className={`font-display text-4xl leading-none ${tint}`}>
                    {value === null || value === undefined ? '—' : value.toFixed(1)}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="mt-6 max-w-reading space-y-3 border-t border-line pt-5">
              {report.report.insights.map((insight) => (
                <li key={insight} className="leading-relaxed">
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          // UC-2 A3: not enough data yet.
          <p className="mt-3 max-w-reading text-muted">{report?.message}</p>
        )}
      </section>

      {/* FR-3 history */}
      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl">Every check-in</h2>
          <form onSubmit={applyFilter} className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="from" className="mb-1 block text-sm text-muted">
                From
              </label>
              <input
                id="from"
                type="date"
                className="field py-1"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="to" className="mb-1 block text-sm text-muted">
                To
              </label>
              <input
                id="to"
                type="date"
                className="field py-1"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-quiet py-1.5">
              Filter
            </button>
            {(range.from || range.to) && (
              <button type="button" onClick={clearFilter} className="btn-quiet py-1.5">
                Clear
              </button>
            )}
          </form>
        </div>

        {checkIns.length === 0 ? (
          <p className="mt-6 text-muted">No check-ins in that range.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {checkIns.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start gap-x-6 gap-y-2 py-4">
                <time
                  dateTime={entry.timestamp}
                  className="w-28 shrink-0 text-sm text-muted"
                >
                  {new Date(entry.timestamp).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>

                <div className="flex shrink-0 gap-5">
                  <span className="font-display text-2xl leading-none text-moss-deep">
                    {entry.moodScore}
                  </span>
                  <span className="font-display text-2xl leading-none text-mulberry">
                    {entry.stressLevel}
                  </span>
                </div>

                <div className="min-w-[12rem] flex-1">
                  {entry.thoughts ? (
                    <p className="text-ink">{entry.thoughts}</p>
                  ) : (
                    <p className="text-muted">No note</p>
                  )}
                  {entry.crisisFlagged && (
                    <p className="mt-1 text-sm text-signal">
                      Crisis resources were shown with this entry
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="text-sm text-muted underline underline-offset-4 hover:text-signal"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
