import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, useLoginMutation } from './api';
import { ErrorBox, Field } from './ui';

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
      <section className="signin-card" aria-labelledby="signin-title">
        <div className="signin-brand">
          Rewound <span>Raid planner</span>
        </div>
        <h1 id="signin-title">Officer sign in</h1>
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
            {state.isLoading ? 'Signing in...' : 'Officer sign in'}
          </button>
        </form>
        <p className="signin-help">Officer access only. Ask Eizzo for account help.</p>
        <p className="signin-help">
          <Link to="/">Back to professions</Link>
        </p>
      </section>
    </main>
  );
}
