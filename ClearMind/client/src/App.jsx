import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import SignIn from './pages/SignIn';
import CheckIn from './pages/CheckIn';
import Dashboard from './pages/Dashboard';
import Support from './pages/Support';
import Provider from './pages/Provider';
import Privacy from './pages/Privacy';

/** Destinations differ by account type (student vs resource provider). */
function navFor(role) {
  if (role === 'student') {
    return [
      { to: '/check-in', label: 'Check in' },
      { to: '/dashboard', label: 'My wellness' },
      { to: '/support', label: 'Support' },
      { to: '/privacy', label: 'My data' },
    ];
  }
  return [
    { to: '/provider', label: 'My resources' },
    { to: '/privacy', label: 'My data' },
  ];
}

function Wordmark() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-2xl tracking-tight text-ink">ClearMind</span>
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-moss"
      />
    </div>
  );
}

function Shell({ children }) {
  const { user, signOut } = useAuth();
  const links = navFor(user.role);

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop: a quiet left rail. Mobile: this collapses to a bottom bar. */}
      <header className="hidden border-r border-line bg-surface md:flex md:w-60 md:shrink-0 md:flex-col md:justify-between md:p-6">
        <div>
          <Wordmark />
          <nav className="mt-10 flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded px-3 py-2 transition-colors ${
                    isActive
                      ? 'bg-moss-pale font-medium text-moss-deep'
                      : 'text-muted hover:bg-paper hover:text-ink'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-line pt-4">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-muted underline underline-offset-4"
        >
          Sign out
        </button>
      </div>

      <main className="flex-1 pb-24 md:pb-0">{children}</main>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex-1 px-1 py-3 text-center text-sm ${
                isActive ? 'font-medium text-moss-deep' : 'text-muted'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'student' ? '/check-in' : '/provider'} replace />;
  }
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { user, loading } = useAuth();

  const home = user ? (user.role === 'student' ? '/check-in' : '/provider') : '/sign-in';

  return (
    <Routes>
      <Route
        path="/sign-in"
        element={loading ? null : user ? <Navigate to={home} replace /> : <SignIn />}
      />
      <Route
        path="/check-in"
        element={
          <RequireAuth roles={['student']}>
            <CheckIn />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth roles={['student']}>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/support"
        element={
          <RequireAuth roles={['student']}>
            <Support />
          </RequireAuth>
        }
      />
      <Route
        path="/provider"
        element={
          <RequireAuth roles={['practitioner', 'school_admin']}>
            <Provider />
          </RequireAuth>
        }
      />
      <Route
        path="/privacy"
        element={
          <RequireAuth>
            <Privacy />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
