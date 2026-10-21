import { lazy, Suspense, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { RefreshCw } from 'lucide-react';
import { type Session } from '@spf/shared';
import { api, errorMessage, useLogoutMutation, useSessionQuery, useSnapshotQuery } from './api';
import { ErrorBox } from './ui';
import SignIn from './SignIn';

const SharedRaidPage = lazy(() => import('./pages/SharedRaid'));
const Planner = lazy(() => import('./pages/Planner'));
const Professions = lazy(() => import('./pages/Professions'));
export default function App() {
  const location = useLocation();
  if (location.pathname === '/share')
    return (
      <Suspense fallback={<div className="loading-screen">Loading raid...</div>}>
        <SharedRaidPage key={location.hash} />
      </Suspense>
    );
  if (location.pathname === '/' || location.pathname === '/profs') return <PublicApp />;
  return <PrivateApp />;
}
function PublicApp() {
  const session = useSessionQuery(undefined, { refetchOnFocus: true });
  const user = session.data?.user;
  const isHome = useLocation().pathname === '/';
  const dispatch = useDispatch();
  const [logout, logoutState] = useLogoutMutation();
  async function signOut() {
    await logout().unwrap();
    dispatch(api.util.resetApiState());
  }
  return (
    <div className="workspace">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            Rewound
          </Link>
          {user && (
            <nav className="site-nav" aria-label="Main navigation">
              <NavLink to="/planner">Raid planner</NavLink>
              <NavLink to="/profs" className={isHome ? 'active' : undefined}>
                Professions
              </NavLink>
            </nav>
          )}
          <div className="header-account">
            {user ? (
              <>
                <span>{user.username}</span>
                <button
                  className="text-link"
                  disabled={logoutState.isLoading}
                  onClick={() => void signOut().catch(() => {})}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/planner" className="text-link">
                Officer sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <div className="main-shell">
        <main className="main-content">
          {session.isLoading ? (
            <div className="empty">Loading professions...</div>
          ) : (
            <Suspense fallback={<div className="empty">Loading professions...</div>}>
              <Professions key={user?.id ?? 'public'} userId={user?.id ?? null} />
            </Suspense>
          )}
          {logoutState.error && <ErrorBox message={errorMessage(logoutState.error)} />}
        </main>
      </div>
    </div>
  );
}
function PrivateApp() {
  const session = useSessionQuery(undefined, { refetchOnFocus: true });
  if (session.isLoading)
    return (
      <div className="loading-screen">
        <p>Loading planner...</p>
      </div>
    );
  if (session.error)
    return (
      <div className="loading-screen">
        <ErrorBox message={errorMessage(session.error)} />
        <button className="button secondary" onClick={() => session.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!session.data?.user) return <SignIn />;
  if (!session.data.workspaces.length) return <NoAccess />;
  return <Workspace session={session.data} />;
}
function NoAccess() {
  const [logout] = useLogoutMutation();
  return (
    <div className="loading-screen">
      <h1>No planner access</h1>
      <p>Ask the administrator to set up your private planner.</p>
      <button className="button secondary" onClick={() => logout()}>
        Sign out
      </button>
    </div>
  );
}
function Workspace({ session }: { session: Session }) {
  const [guildId, setGuildId] = useState(session.workspaces[0].id);
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();
  const query = useSnapshotQuery(guildId, {
    pollingInterval: 20000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  async function signOut() {
    try {
      await logout().unwrap();
      dispatch(api.util.resetApiState());
      navigate('/');
    } catch {
      query.refetch();
    }
  }
  if (query.error && 'status' in query.error && query.error.status === 401) return <SignIn />;
  if (query.error && 'status' in query.error && [403, 404].includes(Number(query.error.status)))
    return <NoAccess />;
  return (
    <div className="workspace">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            Rewound
          </Link>
          <nav className="site-nav" aria-label="Main navigation">
            <NavLink to="/planner" className="active">
              Raid planner
            </NavLink>
            <NavLink to="/profs">Professions</NavLink>
          </nav>
          <div className="header-account">
            {session.workspaces.length > 1 && (
              <select
                className="workspace-picker"
                aria-label="Switch workspace"
                value={guildId}
                onChange={(e) => {
                  setGuildId(e.target.value);
                  navigate('/planner');
                }}
              >
                {session.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw size={15} />
            </button>
            <span>{session.user!.username}</span>
            <button className="text-link" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="main-shell">
        <main className="main-content">
          {query.error && <ErrorBox message={errorMessage(query.error)} />}
          {query.data ? (
            <Suspense fallback={<div className="empty">Loading planner...</div>}>
              <Routes>
                <Route path="/planner" element={<Planner key={guildId} data={query.data} />} />
                <Route path="/plans/:id" element={<Planner key={guildId} data={query.data} />} />
                <Route path="*" element={<Navigate to="/planner" replace />} />
              </Routes>
            </Suspense>
          ) : (
            <div className="empty">
              {query.error ? 'Planner unavailable. Refresh to retry.' : 'Loading planner...'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
