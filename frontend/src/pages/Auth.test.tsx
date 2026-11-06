// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { AuthPage } from './Auth';
import { apiRequest, setCsrfToken } from '../services/transactionsApi';
vi.mock('../services/transactionsApi', () => ({
  apiRequest: vi.fn(),
  setCsrfToken: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const session = {
  user: { id: 'account', name: 'Ana', email: 'ana@test.invalid' },
  csrfToken: 'csrf-test',
};
function Probe() {
  const { user, logout } = useAuth();
  return (
    <>
      <output>{user?.name ?? 'Visitante'}</output>
      <button onClick={() => void logout()}>Sair</button>
    </>
  );
}
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Entre na conta.'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
});
it('cadastra pelo formulário, mantém a sessão somente em memória e limpa ao sair', async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <AuthPage register />
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    ),
  );
  for (const [name, value] of Object.entries({
    name: 'Ana',
    email: 'ana@test.invalid',
    password: 'Strong-test-password-123!',
  }))
    container.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value =
      value;
  vi.mocked(apiRequest).mockResolvedValueOnce(session);
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(apiRequest).toHaveBeenLastCalledWith('/auth/register', 'POST', {
    name: 'Ana',
    email: 'ana@test.invalid',
    password: 'Strong-test-password-123!',
  });
  expect(container.querySelector('output')?.textContent).toBe('Ana');
  expect(setCsrfToken).toHaveBeenCalledWith('csrf-test');
  vi.mocked(apiRequest).mockResolvedValueOnce(undefined);
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent === 'Sair')!
      .click();
  });
  expect(container.querySelector('output')?.textContent).toBe('Visitante');
  expect(setCsrfToken).toHaveBeenLastCalledWith('');
});
it('mostra erro de login e remove identidade quando a sessão expira', async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <AuthPage />
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    ),
  );
  container.querySelector<HTMLInputElement>('[name="email"]')!.value =
    'ana@test.invalid';
  container.querySelector<HTMLInputElement>('[name="password"]')!.value =
    'incorrect';
  vi.mocked(apiRequest).mockRejectedValueOnce(
    new Error('Email ou senha incorretos.'),
  );
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'Email ou senha incorretos',
  );
  await act(async () =>
    window.dispatchEvent(new Event('finantrack:unauthorized')),
  );
  expect(container.querySelector('output')?.textContent).toBe('Visitante');
});
