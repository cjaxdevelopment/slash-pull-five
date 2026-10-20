import { useState, type FormEvent } from 'react';
import { errorMessage, useLoginMutation } from './api';
import { ErrorBox, Field } from './ui';
import { ThemeToggle } from './theme';

export default function SignIn() {
  const [login, state] = useLoginMutation();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const fields = new FormData(event.currentTarget);
    try {
      await login({
        username: String(fields.get('username')),
        password: String(fields.get('password')),
      }).unwrap();
    } catch (error) {
      setError(errorMessage(error));
    }
  }

  return (
    <main className="signin-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <section className="signin-card" aria-labelledby="signin-title">
        <div className="signin-brand">
          Rewound <span>Raid planner</span>
        </div>
        <h1 id="signin-title">Sign in</h1>
        <form onSubmit={submit} aria-busy={state.isLoading}>
          <Field label="Username">
            <input
              autoFocus
              name="username"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              minLength={2}
              maxLength={40}
            />
          </Field>
          <div className="field">
            <div className="password-label">
              <label htmlFor="signin-password">Password</label>
              <button
                type="button"
                className="text-link"
                aria-controls="signin-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
            <input
              id="signin-password"
              name="password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
            />
          </div>
          {error && <ErrorBox message={error} />}
          <button className="button primary full" disabled={state.isLoading}>
            {state.isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="signin-help">Ask your raid leader for account help.</p>
      </section>
    </main>
  );
}
