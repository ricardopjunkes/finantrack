import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export function AuthPage({ register = false }: { register?: boolean }) {
  const { signIn, error: sessionError } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await signIn(register, {
        ...(register ? { name: String(data.get('name')).trim() } : {}),
        email: String(data.get('email')).trim(),
        password: String(data.get('password')),
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível entrar.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <div className="eyebrow">FINANTRACK</div>
        <h1>{register ? 'Crie sua conta' : 'Seu dinheiro, com clareza.'}</h1>
        <p>
          {register
            ? 'Comece a organizar suas finanças.'
            : 'Entre para acessar seu espaço financeiro.'}
        </p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            {(error || sessionError) && (
              <p role="alert" className="error-message">
                {error || sessionError}
              </p>
            )}
            {register && (
              <label>
                Nome
                <input
                  name="name"
                  required
                  maxLength={120}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={72}
                autoComplete={register ? 'new-password' : 'current-password'}
              />
            </label>
            {register && (
              <p className="form-help">
                Use pelo menos 12 caracteres (até 72 bytes).
              </p>
            )}
            <button className="primary-button" type="submit">
              {busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'}
            </button>
          </fieldset>
        </form>
        <Link className="text-link" to={register ? '/login' : '/register'}>
          {register ? 'Já tenho uma conta' : 'Criar uma conta'}
        </Link>
      </section>
    </main>
  );
}
