import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { RefreshCw } from 'lucide-react';
import { type Session } from '@spf/shared';
import { api, errorMessage, useLogoutMutation, useSessionQuery, useSnapshotQuery } from './api';
import { ErrorBox } from './ui';
import SignIn from './SignIn';
import { ThemeToggle } from './theme';

const SharedRaidPage = lazy(() => import('./pages/SharedRaid'));
const Planner = lazy(() => import('./pages/Planner'));
export default function App() {
  const location = useLocation();
  if (location.pathname === '/share')
    return (
      <Suspense fallback={<div className="loading-screen">Loading raid...</div>}>
        <SharedRaidPage key={location.hash} />
      </Suspense>
    );
  return <PrivateApp />;
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
          <div className="header-account">
            {session.workspaces.length > 1 && (
              <select
                className="workspace-picker"
                aria-label="Switch workspace"
                value={guildId}
                onChange={(e) => {
                  setGuildId(e.target.value);
                  navigate('/');
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
            <ThemeToggle />
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
                <Route path="/" element={<Planner key={guildId} data={query.data} />} />
                <Route path="/plans/:id" element={<Planner key={guildId} data={query.data} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
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
