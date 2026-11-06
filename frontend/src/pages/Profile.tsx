import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/transactionsApi';
export function Profile() {
  const { user, refresh, logout } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>, password: boolean) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await apiRequest(
        password ? '/auth/password' : '/auth/profile',
        password ? 'POST' : 'PATCH',
        password
          ? {
              currentPassword: String(data.get('currentPassword')),
              password: String(data.get('password')),
            }
          : { name: String(data.get('name')).trim() },
      );
      if (password) {
        window.dispatchEvent(new Event('finantrack:unauthorized'));
      } else {
        await refresh();
        setMessage('Perfil atualizado.');
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Minha conta</h1>
      <p>{user?.email}</p>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <p role="status" className="success-message">
        {message}
      </p>
      <section className="panel profile-forms">
        <form onSubmit={(e) => void submit(e, false)}>
          <fieldset disabled={busy}>
            <h2>Dados pessoais</h2>
            <label>
              Nome
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={user?.name}
              />
            </label>
            <button className="primary-button">Salvar nome</button>
          </fieldset>
        </form>
        <form onSubmit={(e) => void submit(e, true)}>
          <fieldset disabled={busy}>
            <h2>Alterar senha</h2>
            <label>
              Senha atual
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Nova senha
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </label>
            <p className="form-help">
              Alterar a senha encerra todas as sessões.
            </p>
            <button className="primary-button">Alterar senha</button>
          </fieldset>
        </form>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            try {
              await logout();
            } catch {
              setError('Não foi possível sair. Tente novamente.');
            }
          }}
        >
          Encerrar sessão
        </button>
      </section>
    </>
  );
}
